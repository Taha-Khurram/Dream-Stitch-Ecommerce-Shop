import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth/api";
import { isMissingInstall } from "@/lib/inbox/install";
import { checkoutPayloadSchema } from "@/lib/validations/checkout";
import { calcTotal } from "@/lib/pricing";
import { getSettings } from "@/lib/api/settings";
import { priceCart } from "@/lib/api/cart";
import { previewDiscount, redeemDiscount } from "@/lib/discounts/api";
import { DISCOUNTS_NOT_INSTALLED, outcomeMessage } from "@/lib/discounts/lifecycle";
import { INTAKE_STATUS } from "@/lib/orders/lifecycle";
import { DEFAULT_PAYMENT_METHOD, PAYMENT_COPY } from "@/lib/orders/payment";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    // 1. Authenticate before anything else. A signed-out caller learns that it
    //    is signed out — not which fields of the payload it got wrong.
    const auth = await requireUser();
    if (!auth.ok) return auth.response;

    const { user, supabase } = auth;

    // 2. Parse and strictly validate incoming request body with Zod
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON payload provided",
        },
        { status: 400 }
      );
    }

    const validationResult = checkoutPayloadSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          /* The rule that was actually broken, not the fact that one was. The
             drawer prints this verbatim, and "Validation failed" left a
             shopper whose address was a character short staring at a button
             that refused with no way to know why. */
          error: firstProblem(validationResult.error),
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { items, shippingAddress, discountCode, paymentMethod } = validationResult.data;

    /* 3. Security best practice: prices come from the database, never from the
          payload. Shared with /api/discount so a code cannot be quoted against
          one subtotal and spent against another — see lib/api/cart.ts. */
    const cart = await priceCart(supabase, items);

    if (!cart.ok) {
      return NextResponse.json(
        { success: false, error: cart.error },
        { status: cart.status }
      );
    }

    const { products: productMap, ordered: orderedPerProduct, subtotal } = cart;

    /* Stock is held per product, so it is checked against the total across a
       product's lines; ordering 2 + 2 of a sheet with 3 in stock has to fail,
       and checking each line alone would let it through. */
    for (const [productId, ordered] of orderedPerProduct) {
      const dbProduct = productMap.get(productId)!;

      if (dbProduct.stock < ordered) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient stock for product "${dbProduct.name}". Only ${dbProduct.stock} available.`,
          },
          { status: 409 }
        );
      }
    }

    const verifiedOrderItems = items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: Number(productMap.get(item.productId)!.price),
      size: item.size ?? null,
      custom_width: item.custom?.width ?? null,
      custom_height: item.custom?.height ?? null,
      custom_unit: item.custom?.unit ?? null,
    }));

    /* 3b. The discount, checked before anything is written.
     *
     * Checked here and spent in step 5b, and it has to be both: the amount is
     * needed to compute the total that goes on the order, and the ledger row
     * that enforces the cap cannot be written until the order it points at
     * exists. Between the two calls the cap is re-checked under a row lock, so
     * the window this opens costs a rejected order rather than a coupon spent
     * twice. See discount_codes.sql.
     *
     * Every refusal is a 422 carrying the reason: the payload was well-formed
     * and understood, and what went wrong is about the code.
     */
    let discountAmount = 0;

    if (discountCode) {
      const preview = await previewDiscount(supabase, discountCode, subtotal);

      if (preview.status === "not_installed") {
        return NextResponse.json(
          { success: false, error: DISCOUNTS_NOT_INSTALLED },
          { status: 501 }
        );
      }

      if (preview.status === "failed") {
        return NextResponse.json(
          { success: false, error: "Could not check your discount code. Please try again." },
          { status: 503 }
        );
      }

      if (preview.value.outcome !== "ok") {
        return NextResponse.json(
          {
            success: false,
            outcome: preview.value.outcome,
            error: outcomeMessage(preview.value.outcome, {
              minSubtotal: preview.value.minSubtotal,
            }),
          },
          { status: 422 }
        );
      }

      discountAmount = preview.value.amount;
    }

    // Order maths live in lib/pricing so the cart and this route always agree
    const totalItemCount = cart.itemCount;
    const settings = await getSettings();
    const totalAmount = calcTotal(
      subtotal,
      totalItemCount,
      {
        freeShippingThreshold: settings.free_shipping_threshold,
        shippingFee: settings.shipping_fee,
      },
      discountAmount
    );

    // 4. Create Order in Supabase
    const insertOrder = (row: Record<string, unknown>) =>
      supabase
        .from("orders")
        .insert({
          /* Received, not yet triaged. An admin accepts it into the workflow
             (or deletes it) from /admin/orders — see lib/orders/lifecycle.ts. */
          user_id: user.id,
          status: INTAKE_STATUS,
          total_amount: totalAmount,
          shipping_address: shippingAddress,
          /* Spread rather than always sent: the two columns arrive with
             discount_codes.sql, and an order that carries no code must still be
             placeable on a deployment where that file has not been run. A code
             cannot have got this far without it — preview_discount() would have
             answered "not installed" above. */
          ...(discountCode
            ? { discount_code: discountCode, discount_amount: discountAmount }
            : {}),
          ...row,
        })
        .select("id, user_id, status, total_amount, created_at")
        .single();

    let created = await insertOrder({ payment_method: paymentMethod });

    /* The payment column arrives with order_payment_method.sql, and unlike the
       discount columns it is on every order rather than the occasional one —
       so it cannot be spread in conditionally, and a deployment that has not
       run the file would fail every checkout instead of the odd discounted one.
       Hence the retry.
     *
     * Dropping the column is only honest while the method being dropped is the
     * one the database would have defaulted to anyway. Today that is every
     * order — cash on delivery is the only method `AVAILABLE_METHODS` allows,
     * and it is the default — so the fallback records exactly what was chosen.
     * The day a second method goes live, silently writing "cash" over a card
     * payment would be the worst outcome available, so that case refuses
     * instead and names the file to run. */
    if (created.error && isMissingColumn(created.error)) {
      console.error(
        "orders.payment_method is unknown. Run order_payment_method.sql in the Supabase SQL editor."
      );

      if (paymentMethod !== DEFAULT_PAYMENT_METHOD) {
        return NextResponse.json(
          {
            success: false,
            error: `${PAYMENT_COPY[paymentMethod].label} is not available yet. Please choose ${PAYMENT_COPY[DEFAULT_PAYMENT_METHOD].label}.`,
          },
          { status: 501 }
        );
      }

      created = await insertOrder({});
    }

    const { data: newOrder, error: orderInsertError } = created;

    if (orderInsertError || !newOrder) {
      console.error("Order creation failed in Supabase:", orderInsertError?.message);

      /* 23514 on this insert means one thing in practice: the status CHECK
         constraint still predates the lifecycle, so it has never heard of
         `new`. Worth naming, because every checkout fails until it is run. */
      if (orderInsertError?.code === "23514") {
        console.error(
          "orders.status rejected '%s'. Run order_lifecycle.sql to widen the CHECK constraint.",
          INTAKE_STATUS
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create order. Please try again.",
        },
        { status: 500 }
      );
    }

    // 5. Insert Order Items attached to the created order
    const orderItemsWithOrderId = verifiedOrderItems.map((item) => ({
      order_id: newOrder.id,
      ...item,
    }));

    const { error: itemsInsertError } = await supabase
      .from("order_items")
      .insert(orderItemsWithOrderId);

    if (itemsInsertError) {
      console.error("Order items insertion failed:", itemsInsertError.message);

      /* Same shape of problem as the status CHECK above: the variant columns
         arrived after the table did, and without them every checkout fails. */
      if (isMissingColumn(itemsInsertError)) {
        console.error(
          "order_items rejected the variant columns. Run order_item_variants.sql."
        );
      }
      // Clean up the parent order on failure
      await discardOrder(supabase, newOrder.id);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to record order items. Transaction rolled back.",
        },
        { status: 500 }
      );
    }

    /* 5b. Spend the code, now that there is an order for it to point at.
     *
     * `redeem_discount()` re-runs every check against a locked rule row, so
     * this is where a cap is actually enforced — the preview in step 3b was
     * true when it was asked, and the last use of a coupon is exactly the kind
     * of fact that stops being true while somebody types their address.
     *
     * A refusal here unwinds the order rather than quietly charging full
     * price. The shopper asked for a total that included the code and has not
     * been told anything yet, so the honest move is to fail and let them try
     * again — silently taking the money without the discount is the one
     * outcome nobody would accept.
     *
     * `already_redeemed` is a success. It means this order already carries its
     * code, which is what a retried request looks like from here.
     */
    if (discountCode) {
      const redemption = await redeemDiscount(supabase, discountCode, newOrder.id, subtotal);

      const spent =
        redemption.status === "ok" &&
        (redemption.value.outcome === "ok" || redemption.value.outcome === "already_redeemed");

      if (!spent) {
        await discardOrder(supabase, newOrder.id);

        if (redemption.status !== "ok") {
          console.error("Discount redemption failed after the order was created.");
          return NextResponse.json(
            { success: false, error: "Could not apply your discount code. Please try again." },
            { status: 503 }
          );
        }

        return NextResponse.json(
          {
            success: false,
            outcome: redemption.value.outcome,
            error: outcomeMessage(redemption.value.outcome),
          },
          { status: 409 }
        );
      }

      /* The two figures come from one rule and one subtotal, through
         `discount_amount_for()` and its twin `calcDiscountAmount()`, so they
         can only disagree if the rule was edited in the half-second between
         the preview and the lock.

         Reported rather than corrected, and that is the deliberate half: a
         customer has no UPDATE policy on `orders` (see admin_schema.sql), so
         a repair written from here would silently touch nothing and then print
         a total the order does not hold. What is returned below is what was
         actually written, which keeps the confirmation and the row saying the
         same thing — and the log says which order to reconcile. */
      if (redemption.value.amount !== discountAmount) {
        console.error(
          "Order %s recorded a %d discount but the ledger spent %d — reconcile by hand.",
          newOrder.id,
          discountAmount,
          redemption.value.amount
        );
      }
    }

    // 6. Decrement inventory once per product, by its total across the lines
    for (const [productId, ordered] of orderedPerProduct) {
      const dbProduct = productMap.get(productId);
      if (dbProduct) {
        const newStock = Math.max(0, dbProduct.stock - ordered);
        await supabase.from("products").update({ stock: newStock }).eq("id", productId);
      }
    }

    // 7. Return standard HTTP 201 Created response
    return NextResponse.json(
      {
        success: true,
        message: "Order placed successfully",
        orderId: newOrder.id,
        /* The computed figure rather than the one that came back from the
           insert: a corrected redemption in step 5b may have moved it, and the
           drawer prints this on the confirmation panel. */
        totalAmount,
        discountCode: discountCode ?? null,
        discountAmount,
        /* Echoed back so the confirmation panel can say what happens next
           without re-reading the bag it has just emptied — and, on a
           deployment that fell back above, so it says what was actually
           recorded rather than what was asked for. */
        paymentMethod,
        status: newOrder.status,
        itemCount: totalItemCount,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected checkout error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error occurred while processing checkout",
      },
      { status: 500 }
    );
  }
}

/**
 * The first rule the payload broke, phrased for the person who broke it.
 *
 * Every message in `lib/validations/checkout` already names its own field
 * ("Street address must be at least 5 characters"), so the issue text needs no
 * prefix to make sense on its own in the cart drawer.
 */
function firstProblem(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Some of these details are not valid.";
}

/**
 * True when an insert failed because a column does not exist yet.
 *
 * Two codes for one fact, the way `isMissingInstall` needs five: PostgREST
 * answers PGRST204 off its cached schema, and Postgres raises 42703
 * (undefined_column) when the planner gets there first — which is what happens
 * in the window after a migration runs but before the cache catches up.
 *
 * Kept separate from `isMissingInstall` deliberately. That one answers "is this
 * table or function installed", and a missing column is a different question
 * with a different remedy: the table is there, one migration against it is not.
 */
function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === "PGRST204" || error?.code === "42703";
}

/**
 * Unwind an order this request created and then could not finish.
 *
 * A plain `.delete()` from here has never worked and never said so: there is
 * no DELETE policy on `orders` for a customer, and RLS filters rather than
 * raises, so PostgREST reported success at having removed nothing. Every
 * checkout that failed after the order row was written left it behind.
 *
 * `discard_failed_order()` is the definer that can actually do it, and only
 * within the narrow shape a failed checkout has — the caller's own order,
 * placed in the last five minutes, with no redemption against it. See
 * discount_codes.sql.
 *
 * The fallback is what this line did before, kept for a deployment where that
 * migration has not been applied: it still does nothing, but it does nothing
 * exactly as it always has rather than throwing on a missing function.
 */
async function discardOrder(supabase: SupabaseClient, orderId: string): Promise<void> {
  const { data, error } = await supabase.rpc("discard_failed_order", {
    p_order_id: orderId,
  });

  if (!error && data === true) return;

  if (error && !isMissingInstall(error)) {
    console.error("Could not discard order %s: %s", orderId, error.message);
  }

  await supabase.from("orders").delete().eq("id", orderId);
}
