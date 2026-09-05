import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isMissingInstall } from "@/lib/inbox/install";
import { marginPercent } from "@/lib/admin/cost";

/**
 * What the store keeps, rather than what it takes.
 *
 * Revenue has always been on the dashboard; this module is the other half of
 * it. Every product can now carry what it costs us to make (`product_costs`),
 * a trigger freezes that figure onto each order line as it sells
 * (`order_item_costs`), and the arithmetic below turns those snapshots into
 * the four numbers the panel shows: cost of goods, gross profit, the margin,
 * and — the one that keeps the other three honest — how much of the window has
 * a cost behind it at all.
 *
 * Both of those tables are admin-only, and that is not incidental: `products`
 * is world-readable, so a cost column on it would publish the range's margins
 * to anyone holding the anon key. product_cost_price.sql makes the full
 * argument.
 *
 * Two conventions, both inherited rather than invented here, both worth
 * knowing before reading a figure off the screen:
 *
 *   1. **Fulfilled orders only.** The window is `p_days` ending today, in UTC,
 *      dated by `orders.created_at`, over `('closed', 'completed')` — the same
 *      window and the same set as `admin_revenue_series`. A day here and a bar
 *      on the revenue chart cover the same orders.
 *
 *   2. **Goods, not takings.** Revenue here is `quantity × unit_price` off the
 *      lines, so it excludes delivery and is measured before any discount code
 *      comes off the order. That makes it a slightly different number from the
 *      revenue tile, which sums `orders.total_amount`; the profit panel says
 *      so on screen rather than leaving two figures to disagree in silence.
 *      The same choice is documented in analytics_schema.sql, and it is the
 *      only one available: no courier cost is recorded anywhere, and a
 *      discount applies to a basket rather than to a line.
 *
 * The whole panel is optional in exactly the way the inbox and the discounts
 * are: until the migration is run, `installed` comes back false and the
 * dashboard says which file to run instead of rendering a confident PKR 0.
 */

/** One day of trading, split into what it sold for and what it cost. */
export interface ProfitPoint {
  /** `YYYY-MM-DD`, UTC — the same day key the revenue series uses. */
  day: string;
  /** Goods revenue: `quantity × unit_price` over fulfilled lines. */
  revenue: number;
  /** Cost of those goods. A line with no cost recorded contributes zero. */
  cost: number;
  /** The part of `revenue` whose line actually carries a cost. */
  costedRevenue: number;
}

/** A window's worth of the above, summed. */
export interface ProfitPeriod {
  revenue: number;
  cost: number;
  /**
   * `costedRevenue - cost` — profit on the sales whose cost is known.
   *
   * Not `revenue - cost`, which is the tempting version and the wrong one: a
   * line with no cost on file would go into that sum at full margin, so the
   * headline figure would *rise* every time somebody added a product and
   * forgot to cost it. Measuring only what can be measured means the number
   * moves when trading moves, and the coverage note beside it says how much
   * of the window it speaks for.
   *
   * Negative is a real answer, not an error — that is a range being sold
   * below what it costs to make, which is exactly what the tile is for.
   */
  profit: number;
  costedRevenue: number;
  /**
   * Gross margin as a percentage, or null when there is nothing to divide by.
   *
   * Taken over `costedRevenue` rather than over `revenue`, and that is the
   * point of carrying the two separately: a window where half the sales have
   * no cost on file has a knowable margin over the half that does. Dividing
   * by everything would quietly average the unknown half in at 100% margin and
   * report a number nobody should act on.
   */
  margin: number | null;
  /**
   * The share of goods revenue that has a cost behind it, 0–1, or null when
   * nothing sold. This is what the tile's note is built from — a margin over
   * 30% of the week is worth showing and worth labelling as such.
   */
  coverage: number | null;
}

/** Sum a run of days into the period the tiles describe. */
export function sumProfit(points: ProfitPoint[]): ProfitPeriod {
  const revenue = points.reduce((total, point) => total + point.revenue, 0);
  const cost = points.reduce((total, point) => total + point.cost, 0);
  const costedRevenue = points.reduce((total, point) => total + point.costedRevenue, 0);

  return {
    revenue,
    cost,
    profit: costedRevenue - cost,
    costedRevenue,
    margin: marginPercent(costedRevenue, cost),
    coverage: revenue > 0 ? costedRevenue / revenue : null,
  };
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

/** A window and the equal-length one before it, or the reason there is neither. */
export interface ProfitWindow {
  current: ProfitPeriod;
  previous: ProfitPeriod;
  /** False when product_cost_price.sql has not been run. */
  installed: boolean;
  /** Products with no cost recorded — the note tells the admin to go fix them. */
  uncostedProducts: number;
}

interface ProfitRpcRow {
  day: string;
  revenue: string | number | null;
  cost: string | number | null;
  costed_revenue: string | number | null;
}

/**
 * `days * 2` days of split trading, newest last, or null if the function is
 * not there.
 *
 * Asking for twice the window and cutting the result in half is the trick the
 * revenue tiles already use: the series is a gapless daily spine, so the
 * comparison period is the front of the same array rather than a second query
 * with its own date arithmetic to get subtly wrong.
 *
 * There is no REST fallback, and deliberately so — twice over. The function
 * and the two cost tables arrive in the same migration, so a missing function
 * means there is nothing to fall back to: no line carries a cost, and summing
 * them over REST would render a confident zero over a feature that has not
 * been installed. And the function is `SECURITY DEFINER` for a reason — it is
 * the only thing that reads a cost and a sale in one query, which is what
 * keeps the join out of any request a customer could make.
 */
async function readProfitSeries(days: number): Promise<ProfitPoint[] | null> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_profit_series", { p_days: days * 2 });

  if (error) {
    if (isMissingInstall(error)) return null;
    console.error("admin_profit_series failed: %s", error.message ?? "unknown error");
    return null;
  }

  return ((data ?? []) as ProfitRpcRow[]).map((row) => ({
    day: row.day,
    revenue: Number(row.revenue ?? 0),
    cost: Number(row.cost ?? 0),
    costedRevenue: Number(row.costed_revenue ?? 0),
  }));
}

/**
 * How much of the catalogue nobody has costed yet.
 *
 * A head count — the number is all that is wanted, and no product data needs
 * to cross the wire to render it. Zero when the column is not there, which is
 * the honest answer for a panel that is about to say the migration has not
 * been run.
 */
async function countUncostedProducts(): Promise<number> {
  const supabase = await createClient();

  /* Two head counts and a subtraction, because the two facts live in two
     tables and PostgREST has no anti-join: a costed product is one with a row
     in `product_costs`, so what is left is what nobody has costed. Head counts
     carry no rows over the wire, which is the whole reason this is cheap
     enough to sit on the dashboard.

     `product_costs` cascades on product deletion, so the subtraction cannot go
     negative through a stale row — but it is floored anyway rather than
     printing "-3 products have no cost". */
  const [products, costed] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("product_costs").select("product_id", { count: "exact", head: true }),
  ]);

  return Math.max(0, (products.count ?? 0) - (costed.count ?? 0));
}

/**
 * Everything the profit tiles need, in two round trips.
 *
 * `cache` for the same reason the revenue window uses it: the tiles and the
 * note beneath them are free to be separate components without either one
 * paying for a second read, and two figures rendered from one array can never
 * disagree.
 */
export const readProfitWindow = cache(async (days: number): Promise<ProfitWindow> => {
  const [series, uncosted] = await Promise.all([
    readProfitSeries(days),
    countUncostedProducts(),
  ]);

  const empty = sumProfit([]);

  if (!series) {
    return { current: empty, previous: empty, installed: false, uncostedProducts: 0 };
  }

  return {
    current: sumProfit(series.slice(-days)),
    previous: sumProfit(series.slice(0, -days)),
    installed: true,
    uncostedProducts: uncosted,
  };
});
