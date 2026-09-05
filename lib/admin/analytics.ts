import { createClient } from "@/lib/supabase/server";
import { isMissingInstall, type QueryError } from "@/lib/inbox/install";

/**
 * The numbers behind /admin/analytics.
 *
 * The dashboard answers "how much did we take". This module answers the five
 * questions that come next: **how many people came**, **what sold**, **which
 * part of the range earned it**, **how many of the people who arrive go on to
 * buy**, and **how many come back**.
 *
 * Four of the five are read out of tables the store has been writing all
 * along — no new collection to answer them. The fifth is footfall, and it is
 * the exception worth knowing about: nothing in the order book records a
 * visit that did not become an order, and `live_sessions` forgets within the
 * hour by design, so `visit_analytics.sql` adds one row per visitor per day
 * and the storefront beacon fills it. One row, one date, no page paths and no
 * identifier that outlives the browser session — see that file.
 *
 * The arithmetic lives in `analytics_schema.sql`, for the same reason the
 * revenue series does: PostgREST has aggregate functions disabled on Supabase,
 * so summing over `order_items` from here would mean pulling every line of
 * every fulfilled order into a server render to add up in JavaScript. Four
 * RPCs, four round trips, no order data crossing the wire.
 *
 * Windows are the dashboard's windows — see lib/admin/range. `p_days` means
 * exactly what it means to `admin_revenue_series`, so a figure here and a
 * figure on /admin under the same tab are describing the same days.
 */

/** How many products the panel ranks. Clamped again inside the function. */
export const TOP_PRODUCTS = 8;

/**
 * What a panel came back with, and — when it came back with nothing — why.
 *
 * The distinction is the whole point. An empty list and an un-run migration
 * look identical on screen unless something carries the difference this far,
 * and "no products sold" is a very different thing to be told than "this
 * screen is not installed yet". Same choice the Customers screen makes.
 */
export interface Panel<T> {
  /** Null when the panel could not be read at all. */
  data: T | null;
  /** True when the reason is that `analytics_schema.sql` has not been run. */
  missing: boolean;
}

/** One row of a ranked breakdown — a product, or a category. */
export interface BreakdownRow {
  /** Null for the uncategorised bucket, which is not a real category. */
  id: string | null;
  name: string;
  units: number;
  /** Distinct orders the row appeared in, not lines. */
  orders: number;
  /** Goods only — `quantity × unit_price`, so no delivery. See the migration. */
  revenue: number;
}

/**
 * A ranked panel, and the figure its shares are shares *of*.
 *
 * The total is carried separately rather than summed from the rows because
 * only one of the two panels can be summed: the category breakdown is the
 * whole book, but the product panel is a top eight, and dividing those eight
 * by their own subtotal would report the best seller of a quiet week as 40% of
 * the business. Both denominators are therefore the same number — every
 * fulfilled line in the window — which is what puts a product's share and its
 * category's share on one scale.
 */
export interface Breakdown {
  rows: BreakdownRow[];
  /** Line revenue across every fulfilled order in the window. */
  total: number;
}

/**
 * The raw counts behind the two rates, current window and the one before it.
 *
 * Counts rather than percentages, deliberately: a rate with no denominator
 * beside it cannot be told apart from a rate with a denominator of one, and
 * both tiles need to know whether there was anything to measure before they
 * claim a movement.
 */
export interface ShopperStats {
  /** Customers who joined in the window. */
  signups: number;
  /** Of those, how many have since had an order fulfilled. */
  converted: number;
  priorSignups: number;
  priorConverted: number;
  /** Distinct customers with an order fulfilled in the window. */
  buyers: number;
  /** Of those, how many have ever had more than one fulfilled. */
  repeatBuyers: number;
  priorBuyers: number;
  priorRepeatBuyers: number;
}

/**
 * One window of footfall, and the equal-length window before it.
 *
 * Two counts rather than one, because "how many people visited" has two
 * honest answers over anything longer than a day and they diverge exactly
 * where it matters. `visitors` is distinct visitors; `visits` is visitor-days,
 * so a shopper who came back on three days of the week is one visitor and
 * three visits. Over the daily window they are necessarily the same number.
 *
 * "Distinct visitor" means a distinct browser session, not a distinct person:
 * the id is the session cookie /api/presence mints, so somebody who closes
 * their browser and comes back tomorrow arrives as a new one. The weekly and
 * monthly figures therefore lean generous. See visit_analytics.sql, which
 * explains why that is the trade and what the alternative would cost.
 */
export interface VisitWindow {
  /** `day`, `week` or `month` — what the tile is labelled. */
  bucket: string;
  /** The window's length. `previousSpan(days)` describes what it compares to. */
  days: number;
  /** Distinct visitors in the window — browser sessions, see above. */
  visitors: number;
  /** Visitor-days — the same person on two days is two. */
  visits: number;
  /** Of `visitors`, how many were signed in at some point that day. */
  signedIn: number;
  priorVisitors: number;
  priorVisits: number;
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

/**
 * A missing migration is a state to render; anything else is a fault to log.
 *
 * Both end up showing the panel nothing, but only one of them is worth
 * telling the reader to go and fix, and quietly printing "run the migration"
 * at somebody whose database is simply down would send them the wrong way.
 */
function failed<T>(label: string, error: QueryError): Panel<T> {
  if (isMissingInstall(error)) return { data: null, missing: true };
  console.error("%s failed: %s", label, error.message ?? "unknown error");
  return { data: null, missing: false };
}

/** Both breakdown functions return the same shape under two different id keys. */
interface BreakdownRpcRow {
  product_id?: string | null;
  category_id?: string | null;
  name?: string | null;
  units?: string | number | null;
  orders?: string | number | null;
  revenue?: string | number | null;
  /** Repeated on every row by admin_top_products; absent on the category one. */
  window_revenue?: string | number | null;
}

/* NUMERIC arrives from PostgREST as a string once it is wide enough to lose
   precision in a double, so every figure goes through Number() rather than
   being trusted to already be one. Same treatment as readSeries. */
function toBreakdown(row: BreakdownRpcRow): BreakdownRow {
  return {
    id: row.product_id ?? row.category_id ?? null,
    name: row.name ?? "—",
    units: Number(row.units ?? 0),
    orders: Number(row.orders ?? 0),
    revenue: Number(row.revenue ?? 0),
  };
}

/** The best-selling products of the window, by money. */
export async function readTopProducts(days: number): Promise<Panel<Breakdown>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_top_products", {
    p_days: days,
    p_limit: TOP_PRODUCTS,
  });

  if (error) return failed("admin_top_products", error);

  const raw = (data ?? []) as BreakdownRpcRow[];
  return {
    /* The window total rides on every row, so any row will do — and there are
       no rows precisely when the total is zero. */
    data: { rows: raw.map(toBreakdown), total: Number(raw[0]?.window_revenue ?? 0) },
    missing: false,
  };
}

/** The same window split by category, uncategorised products included. */
export async function readCategoryRevenue(days: number): Promise<Panel<Breakdown>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_category_revenue", { p_days: days });

  if (error) return failed("admin_category_revenue", error);

  const rows = ((data ?? []) as BreakdownRpcRow[]).map(toBreakdown);
  /* Every fulfilled line is in one of these buckets, so the rows are the
     window — the same number admin_top_products computes the long way. */
  return {
    data: { rows, total: rows.reduce((sum, row) => sum + row.revenue, 0) },
    missing: false,
  };
}

/** Conversion and repeat custom, both windows, in one round trip. */
export async function readShopperStats(days: number): Promise<Panel<ShopperStats>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .rpc("admin_shopper_stats", { p_days: days })
    .maybeSingle();

  if (error) return failed("admin_shopper_stats", error);

  /* Zero rows means the `is_admin()` gate said no — which cannot happen
     behind requireAdmin(), but the function is the authority, not the layout. */
  if (!data) return { data: null, missing: false };

  const row = data as Record<string, string | number | null>;
  return {
    data: {
      signups: Number(row.signups ?? 0),
      converted: Number(row.converted ?? 0),
      priorSignups: Number(row.prior_signups ?? 0),
      priorConverted: Number(row.prior_converted ?? 0),
      buyers: Number(row.buyers ?? 0),
      repeatBuyers: Number(row.repeat_buyers ?? 0),
      priorBuyers: Number(row.prior_buyers ?? 0),
      priorRepeatBuyers: Number(row.prior_repeat_buyers ?? 0),
    },
    missing: false,
  };
}

/**
 * Footfall at three lengths — today, the last 7 days, the last 30 — in one
 * round trip.
 *
 * The only figure on this screen that is not read out of the order book, and
 * the only one that ignores the range tabs: "daily, weekly and monthly" is
 * the question, so the three windows are the panel rather than something the
 * reader has to click between. The windows are still the dashboard's
 * arithmetic — `n` days ending today, in UTC — so today's visits and today's
 * revenue mean the same today.
 *
 * Rows arrive shortest-window first and are handed on in that order.
 */
export async function readVisits(): Promise<Panel<VisitWindow[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_visit_stats");

  if (error) return failed("admin_visit_stats", error);

  const rows = (data ?? []) as Record<string, string | number | null>[];

  return {
    data: rows.map((row) => ({
      bucket: String(row.bucket ?? ""),
      days: Number(row.days ?? 0),
      visitors: Number(row.visitors ?? 0),
      visits: Number(row.visits ?? 0),
      signedIn: Number(row.signed_in ?? 0),
      priorVisitors: Number(row.prior_visitors ?? 0),
      priorVisits: Number(row.prior_visits ?? 0),
    })),
    missing: false,
  };
}

/* ── Rates ──────────────────────────────────────────────────────────────── */

/**
 * `part / whole` as a percentage, or null when there is no whole.
 *
 * Null rather than zero, and it matters on both tiles: a window in which
 * nobody signed up has no conversion rate at all, and rendering that as "0%"
 * would report a failure to convert where there was nothing to convert. The
 * tile shows an em dash instead, and skips the comparison chip.
 */
export function rate(part: number, whole: number): number | null {
  return whole > 0 ? (part / whole) * 100 : null;
}

/** `33.3%`, `50%` — one decimal, and never a trailing `.0`. */
export function formatRate(value: number | null): string {
  if (value === null) return "—";
  return `${Number(value.toFixed(1))}%`;
}

/**
 * Each row's share of the window's line revenue, as a percentage.
 *
 * The denominator is the whole window in both panels, so the category shares
 * sum to 100 and the top-eight product shares deliberately do not — what is
 * left over is the tail the panel is not showing, which is a true thing for
 * the numbers to say.
 */
export function shareOf(total: number): (row: BreakdownRow) => number {
  return (row) => (total > 0 ? (row.revenue / total) * 100 : 0);
}
