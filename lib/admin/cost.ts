import type { Product } from "@/types/ecommerce";

export type { ProductCost } from "@/types/ecommerce";

/**
 * Reading a product's cost, and the arithmetic that follows from it.
 *
 * Everything here is pure and free of server imports, which is the point: the
 * product form works a margin out in the browser as somebody types, and the
 * dashboard works one out on the server over a quarter of orders. The reads
 * and the writes live in lib/admin/profit.ts and app/admin/actions.ts, both of
 * which reach for the Supabase server client — something a client component
 * cannot import at all.
 *
 * Cost is not a column on `products`. It lives in `product_costs`, a table
 * with nothing but an admin policy on it, because `products` is world-readable
 * and a cost column there would publish the whole range's margins to anyone
 * holding the anon key. See product_cost_price.sql for the full argument.
 */

/**
 * The embed that fetches it, for any admin query that needs a cost.
 *
 * PostgREST follows the foreign key, and the policy on `product_costs` does
 * the rest: an admin's request comes back with the cost, and nobody else's
 * would come back with anything. It is spelled once here so the product list
 * and the product form cannot drift apart on how they ask.
 */
export const PRODUCT_COST_EMBED = "cost:product_costs(cost_price)";

/**
 * A product's cost, or null when it has none.
 *
 * The array branch is not defensive clutter: PostgREST returns a to-one embed
 * as an object when it can prove the relationship is one-to-one and as a
 * one-element array when it cannot, and which of those you get has changed
 * between versions. Both mean the same thing here.
 *
 * Null covers every way of not knowing — no row, the table not installed, a
 * query that did not ask — and they are deliberately indistinguishable to a
 * caller. None of them is a cost of zero.
 */
export function productCost(product: Pick<Product, "cost"> | null | undefined): number | null {
  const embedded = product?.cost;
  const row = Array.isArray(embedded) ? embedded[0] : embedded;
  if (!row || row.cost_price === null || row.cost_price === undefined) return null;

  const value = Number(row.cost_price);
  return Number.isFinite(value) ? value : null;
}

/** What one unit earns. Negative when it sells below what it costs to make. */
export function unitProfit(price: number, cost: number): number {
  return price - cost;
}

/**
 * Margin as a whole percentage, or null when the denominator is nothing.
 *
 * Null rather than 0 throughout: "no margin" and "no sales to have a margin
 * on" are different answers, and only one of them is a reason to worry.
 */
export function marginPercent(revenue: number, cost: number): number | null {
  if (!Number.isFinite(revenue) || revenue <= 0) return null;
  return Math.round(((revenue - cost) / revenue) * 100);
}
