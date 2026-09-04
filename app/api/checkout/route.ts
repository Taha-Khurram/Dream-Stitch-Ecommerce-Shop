import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";
import { checkoutPayloadSchema } from "@/lib/validations/checkout";
import { calcTotal } from "@/lib/pricing";
import { getSettings } from "@/lib/api/settings";
import { INTAKE_STATUS } from "@/lib/orders/lifecycle";
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
          error: "Validation failed",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { items, shippingAddress } = validationResult.data;

    // 3. Security best practice: Fetch actual prices and verify stock directly from Database
    const productIds = items.map((item) => item.productId);
    const { data: dbProducts, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, stock")
      .in("id", productIds);

    if (productsError) {
      console.error("Failed to query products during checkout:", productsError.message);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to verify product availability",
        },
        { status: 500 }
      );
    }

    if (!dbProducts || dbProducts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "None of the requested products were found in the catalog",
        },
        { status: 404 }
      );
    }

    // Create a lookup map for products
    const productMap = new Map(dbProducts.map((p) => [p.id, p]));

    /* One product can arrive as several lines — a King, and the same design cut
       to a bed that is not one. Stock is held per product, so it is checked
       against the total across those lines; ordering 2 + 2 of a sheet with 3 in
       stock has to fail, and checking each line alone would let it through. */
    const orderedPerProduct = new Map<string, number>();
    for (const item of items) {
      orderedPerProduct.set(
        item.productId,
        (orderedPerProduct.get(item.productId) ?? 0) + item.quantity
      );
    }

    for (const [productId, ordered] of orderedPerProduct) {
      const dbProduct = productMap.get(productId);

      if (!dbProduct) {
        return NextResponse.json(
          {
            success: false,
            error: `Product with ID ${productId} was not found`,
          },
          { status: 404 }
        );
      }

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

    // Prices always come from the database, never from the payload.
    let subtotal = 0;
    const verifiedOrderItems: {
      product_id: string;
      quantity: number;
      unit_price: number;
      size: string | null;
      custom_width: number | null;
      custom_height: number | null;
      custom_unit: string | null;
    }[] = [];

    for (const item of items) {
      const unitPrice = Number(productMap.get(item.productId)!.price);
      subtotal += unitPrice * item.quantity;

      verifiedOrderItems.push({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: unitPrice,
        size: item.size ?? null,
        custom_width: item.custom?.width ?? null,
        custom_height: item.custom?.height ?? null,
        custom_unit: item.custom?.unit ?? null,
      });
    }

    // Order maths live in lib/pricing so the cart and this route always agree
    const totalItemCount = items.reduce((acc, i) => acc + i.quantity, 0);
    const settings = await getSettings();
    const totalAmount = calcTotal(subtotal, totalItemCount, {
      freeShippingThreshold: settings.free_shipping_threshold,
      shippingFee: settings.shipping_fee,
    });

    // 4. Create Order in Supabase
    const { data: newOrder, error: orderInsertError } = await supabase
      .from("orders")
      .insert({
        /* Received, not yet triaged. An admin accepts it into the workflow
           (or deletes it) from /admin/orders — see lib/orders/lifecycle.ts. */
        user_id: user.id,
        status: INTAKE_STATUS,
        total_amount: totalAmount,
        shipping_address: shippingAddress,
      })
      .select("id, user_id, status, total_amount, created_at")
      .single();

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
      if (itemsInsertError.code === "42703" || itemsInsertError.code === "PGRST204") {
        console.error(
          "order_items rejected the variant columns. Run order_item_variants.sql."
        );
      }
      // Clean up the parent order on failure
      await supabase.from("orders").delete().eq("id", newOrder.id);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to record order items. Transaction rolled back.",
        },
        { status: 500 }
      );
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
        totalAmount: newOrder.total_amount,
        status: newOrder.status,
        itemCount: items.reduce((acc, i) => acc + i.quantity, 0),
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
