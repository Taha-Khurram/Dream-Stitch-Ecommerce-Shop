import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkoutPayloadSchema } from "@/lib/validations/checkout";
import { calcTotal } from "@/lib/pricing";
import { z } from "zod";

export async function POST(request: Request) {
  try {
    // 1. Parse and strictly validate incoming request body with Zod
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

    // 2. Initialize Supabase Server Client and authenticate user
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized. You must be signed in to place an order.",
        },
        { status: 401 }
      );
    }

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

    // Check inventory and calculate verified total amount
    let subtotal = 0;
    const verifiedOrderItems: {
      product_id: string;
      quantity: number;
      unit_price: number;
    }[] = [];

    for (const item of items) {
      const dbProduct = productMap.get(item.productId);

      if (!dbProduct) {
        return NextResponse.json(
          {
            success: false,
            error: `Product with ID ${item.productId} was not found`,
          },
          { status: 404 }
        );
      }

      if (dbProduct.stock < item.quantity) {
        return NextResponse.json(
          {
            success: false,
            error: `Insufficient stock for product "${dbProduct.name}". Only ${dbProduct.stock} available.`,
          },
          { status: 409 }
        );
      }

      const unitPrice = Number(dbProduct.price);
      subtotal += unitPrice * item.quantity;

      verifiedOrderItems.push({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: unitPrice,
      });
    }

    // Order maths live in lib/pricing so the cart and this route always agree
    const totalItemCount = items.reduce((acc, i) => acc + i.quantity, 0);
    const totalAmount = calcTotal(subtotal, totalItemCount);

    // 4. Create Order in Supabase
    const { data: newOrder, error: orderInsertError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        status: "pending",
        total_amount: totalAmount,
        shipping_address: shippingAddress,
      })
      .select("id, user_id, status, total_amount, created_at")
      .single();

    if (orderInsertError || !newOrder) {
      console.error("Order creation failed in Supabase:", orderInsertError?.message);
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
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsInsertError } = await supabase
      .from("order_items")
      .insert(orderItemsWithOrderId);

    if (itemsInsertError) {
      console.error("Order items insertion failed:", itemsInsertError.message);
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

    // 6. Decrement product inventory for ordered items
    for (const item of items) {
      const dbProduct = productMap.get(item.productId);
      if (dbProduct) {
        const newStock = Math.max(0, dbProduct.stock - item.quantity);
        await supabase
          .from("products")
          .update({ stock: newStock })
          .eq("id", item.productId);
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
