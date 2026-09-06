"use server";

/**
 * Checkout as a Server Action.
 *
 * The live storefront posts to `/api/checkout` — this is the same order,
 * written the way the inventory-concurrency rule asks for: one call to
 * `place_order()`, which locks the product rows, verifies stock against the
 * lock, and writes the order, its lines and the decrement as a single
 * transaction. See supabase/migrations/place_order_rpc.sql. Nothing can be
 * left half-written here, so there is no failed-order cleanup path.
 *
 * The email hook at the bottom is the part worth copying: it runs after the
 * order is durable, it cannot fail the order, and it reports separately.
 *
 * Server-only by construction — `"use server"` means this module is never
 * bundled for the browser, and the RPC runs as the caller under RLS.
 */

import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendOrderEmails } from "@/lib/email-service";
import { checkoutPayloadSchema } from "@/lib/validations/checkout";
import { getSettings } from "@/lib/api/settings";
import { priceCart } from "@/lib/api/cart";
import { previewDiscount, redeemDiscount } from "@/lib/discounts/api";
import { outcomeMessage } from "@/lib/discounts/lifecycle";

export type CreateOrderResult =
  | { ok: true; orderId: string; subtotal: number; totalAmount: number }
  | { ok: false; error: string };

/** What `place_order()` returns — one row, three numeric columns. */
interface PlacedOrder {
  order_id: string;
  subtotal: number;
  total_amount: number;
}

export async function createOrder(payload: unknown): Promise<CreateOrderResult> {
  /* A Server Action is a public HTTP endpoint with a generated name, not a
     private function call. Everything a route handler validates, this
     validates — the argument is whatever the caller sent. */
  const parsed = checkoutPayloadSchema.safeParse(payload);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid checkout details." };
  }

  const { items, shippingAddress, discountCode, paymentMethod } = parsed.data;

  const supabase = await createClient();

  /* RLS applies to everything below: `place_order()` derives its owner from
     auth.uid(), and the customer's own INSERT policy on `orders` is what the
     definer stands in for. Reading the user first only turns "RLS wrote
     nothing" into a sentence somebody can act on. */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Please sign in to place your order." };

  /* Priced before the lock only so the discount can be quoted against a real
     subtotal. The figure that ends up on the order is recomputed inside
     `place_order()` from the locked rows — a price edited in between moves the
     total, not the discount's validity, and the RPC clamps the discount to the
     subtotal it actually finds. */
  const cart = await priceCart(supabase, items);
  if (!cart.ok) return { ok: false, error: cart.error };

  let discountAmount = 0;

  if (discountCode) {
    const preview = await previewDiscount(supabase, discountCode, cart.subtotal);

    if (preview.status !== "ok") {
      return { ok: false, error: "Could not check your discount code. Please try again." };
    }

    if (preview.value.outcome !== "ok") {
      return {
        ok: false,
        error: outcomeMessage(preview.value.outcome, {
          minSubtotal: preview.value.minSubtotal,
        }),
      };
    }

    discountAmount = preview.value.amount;
  }

  const settings = await getSettings();

  /* The whole write: stock reserved, order and lines inserted, inventory
     decremented, in one transaction. A stock shortfall raises inside Postgres
     and rolls the lot back, so a failure here leaves nothing behind. */
  const { data, error } = await supabase
    .rpc("place_order", {
      p_items: items.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        size: item.size ?? null,
        custom_width: item.custom?.width ?? null,
        custom_height: item.custom?.height ?? null,
        custom_unit: item.custom?.unit ?? null,
      })),
      p_shipping_address: shippingAddress,
      p_payment_method: paymentMethod,
      p_discount_code: discountCode ?? null,
      p_discount_amount: discountAmount,
      p_shipping_fee: settings.shipping_fee,
      p_free_shipping_threshold: settings.free_shipping_threshold,
    })
    .single<PlacedOrder>();

  if (error || !data) {
    console.error("[checkout] place_order failed:", error?.message);

    // P0001 is the function's own stock check — the only failure worth
    // repeating verbatim, because it names the product that came up short.
    return {
      ok: false,
      error:
        error?.code === "P0001"
          ? error.message
          : "We could not place your order. Please try again.",
    };
  }

  /* The code is spent after the order exists, because the ledger row points at
     it. `redeem_discount()` re-checks every cap under a row lock, so this is
     where a cap is actually enforced. The order is already durable, so a
     refusal is logged for reconciliation rather than used to unwind it —
     unlike /api/checkout, there is no partial state to clean up. */
  if (discountCode) {
    const redemption = await redeemDiscount(
      supabase,
      discountCode,
      data.order_id,
      data.subtotal
    );

    const spent =
      redemption.status === "ok" &&
      (redemption.value.outcome === "ok" || redemption.value.outcome === "already_redeemed");

    if (!spent) {
      console.error(
        "[checkout] order %s carries code %s but the ledger did not record it — reconcile by hand.",
        data.order_id,
        discountCode
      );
    }
  }

  /* Fire-and-forget, and `after()` is what makes that true on a serverless
     host: the invocation is frozen once the response is flushed, so an
     unawaited promise would be killed mid-SMTP-handshake often enough to
     matter. This keeps the function alive for the send without making the
     shopper wait on two round trips to Gmail.
     *
     * Email cannot fail the order and cannot roll it back. `sendOrderEmails`
     * never throws, so the only thing to handle is a partial send, and the log
     * says which half is missing. */
  after(async () => {
    const sent = await sendOrderEmails(data.order_id);

    if (!sent.customerSent || !sent.ownerSent) {
      console.error(
        "[checkout] order %s placed but email incomplete: customer=%s owner=%s%s",
        data.order_id,
        sent.customerSent,
        sent.ownerSent,
        sent.reason ? ` (${sent.reason})` : ""
      );
    }
  });

  return {
    ok: true,
    orderId: data.order_id,
    subtotal: Number(data.subtotal),
    totalAmount: Number(data.total_amount),
  };
}
