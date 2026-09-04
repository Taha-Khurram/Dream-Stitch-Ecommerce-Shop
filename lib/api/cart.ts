import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartItemInput } from "@/lib/validations/checkout";

/**
 * What a cart is worth, priced from the database.
 *
 * This exists because two endpoints now need the same answer and must not be
 * allowed to give different ones. `/api/checkout` prices the bag to charge for
 * it; `/api/discount` prices it to decide whether a code's minimum is met and
 * what it takes off. If the second were to trust a subtotal sent by the
 * browser, a shopper could be quoted a discount against a bag they do not
 * have — and then be charged against the bag they do.
 *
 * So the rule the checkout route has always followed is the rule here, in one
 * place: **prices come from the database, never from the payload.**
 *
 * Stock is deliberately not checked. Whether there are enough sheets on the
 * shelf is a question about placing an order, not about pricing one, and
 * asking it here would make the promo field refuse a code for a reason that
 * has nothing to do with the code. `ordered` is returned so the caller that
 * does care can check it once per product rather than once per line.
 */

export interface CataloguePrice {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export interface PricedCart {
  ok: true;
  /** Every requested product, by id. */
  products: Map<string, CataloguePrice>;
  /** Units of each product across all of its lines — one King, one custom. */
  ordered: Map<string, number>;
  subtotal: number;
  itemCount: number;
}

export interface CartProblem {
  ok: false;
  status: number;
  error: string;
}

/**
 * One product can arrive as several lines — a King, and the same design cut to
 * a bed that is not one. Stock is held per product, so a caller checking it has
 * to check the total across those lines; 2 + 2 of a sheet with 3 in stock has
 * to fail, and checking each line alone would let it through.
 */
export function orderedPerProduct(items: CartItemInput[]): Map<string, number> {
  const ordered = new Map<string, number>();
  for (const item of items) {
    ordered.set(item.productId, (ordered.get(item.productId) ?? 0) + item.quantity);
  }
  return ordered;
}

export async function priceCart(
  supabase: SupabaseClient,
  items: CartItemInput[]
): Promise<PricedCart | CartProblem> {
  const productIds = [...new Set(items.map((item) => item.productId))];

  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, stock")
    .in("id", productIds);

  if (error) {
    console.error("Failed to price cart:", error.message);
    return { ok: false, status: 500, error: "Failed to verify product availability" };
  }

  if (!data || data.length === 0) {
    return {
      ok: false,
      status: 404,
      error: "None of the requested products were found in the catalog",
    };
  }

  const products = new Map(
    (data as CataloguePrice[]).map((product) => [product.id, product])
  );

  let subtotal = 0;
  let itemCount = 0;

  for (const item of items) {
    const product = products.get(item.productId);

    if (!product) {
      return {
        ok: false,
        status: 404,
        error: `Product with ID ${item.productId} was not found`,
      };
    }

    subtotal += Number(product.price) * item.quantity;
    itemCount += item.quantity;
  }

  return { ok: true, products, ordered: orderedPerProduct(items), subtotal, itemCount };
}
