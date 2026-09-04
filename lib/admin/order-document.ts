import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "@/types/ecommerce";

/**
 * The one read, and the one sum, behind both printable order documents.
 *
 * Two sheets come off an order — the packing slip the workroom cuts from, and
 * the receipt that goes to the customer — and they are deliberately different
 * documents. What they must never differ on is the arithmetic: the same order
 * cannot be worth one figure on the sheet in the box and another on the sheet
 * beside it.
 *
 * That is not a hypothetical. The slip originally derived delivery by taking
 * the line total off `orders.total_amount`, which was right until discount
 * codes made `total_amount` net of the code — after which every discounted
 * order printed a negative delivery charge as "Free" against a total its own
 * lines did not add up to. The fix was one term, in one file, and the reason it
 * was needed in two places is the reason this module exists.
 */

/* Kept apart from the embed so the discount retry below can ask for the same
   columns twice without spelling them twice. */
const ORDER_COLUMNS = "id, status, total_amount, created_at, shipping_address";

const ITEMS_EMBED =
  "order_items(id, product_id, quantity, unit_price, size, custom_width, custom_height, custom_unit, " +
  "product:products(id, name, fabric, pieces, category:categories(slug)))";

/**
 * One order, with everything either document needs to render.
 *
 * `discount_code` and `discount_amount` arrive with `discount_codes.sql`, and
 * PostgREST rejects the whole select if either column is unknown rather than
 * returning them as null — so they are asked for, and a failure falls back to
 * the shape these sheets read before that migration existed. Same contract as
 * the order screen they print from.
 *
 * Null means no such order; both callers turn that into `notFound()`.
 */
export async function readOrderDocument(
  supabase: SupabaseClient,
  id: string
): Promise<Order | null> {
  const withDiscount = await supabase
    .from("orders")
    .select(`${ORDER_COLUMNS}, discount_code, discount_amount, ${ITEMS_EMBED}`)
    .eq("id", id)
    .single();

  const { data } = withDiscount.error
    ? await supabase
        .from("orders")
        .select(`${ORDER_COLUMNS}, ${ITEMS_EMBED}`)
        .eq("id", id)
        .single()
    : withDiscount;

  return (data as unknown as Order) ?? null;
}

export interface OrderTotals {
  /** Goods only, summed off the lines: what was charged before anything else. */
  itemsTotal: number;
  /** What a code took off, or 0. */
  discount: number;
  /** Derived, not stored — see the note below. */
  delivery: number;
  /** `orders.total_amount`, as a number. What was actually charged. */
  total: number;
}

/**
 * The four figures on the foot of either sheet.
 *
 * Delivery is the only derived one, and the arithmetic is worth stating because
 * it reads oddly: `total_amount` is *net of the discount* (see
 * types/ecommerce.ts), so recovering the delivery charge means putting the
 * discount back before taking the line total off. Drop that term and delivery
 * goes negative on any order whose code was worth more than the postage — and
 * negative renders as "Free", which is how a sheet ends up quietly hiding a
 * charge the customer paid.
 *
 * Nothing here re-derives the total from the rates in lib/pricing: the order
 * was charged what it was charged, months ago, possibly under a different
 * delivery fee. The stored figure is the fact, and the breakdown is fitted to
 * it rather than the other way round.
 */
export function orderTotals(order: Order): OrderTotals {
  const items = order.order_items ?? [];

  const itemsTotal = items.reduce(
    (sum, item) => sum + Number(item.unit_price) * item.quantity,
    0
  );
  const discount = Number(order.discount_amount ?? 0);
  const total = Number(order.total_amount);

  return { itemsTotal, discount, delivery: total - itemsTotal + discount, total };
}
