import React, { Suspense, cache } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { StatusPill } from "@/components/admin/StatusPill";
import { LiveVisitors } from "@/components/admin/LiveVisitors";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { RevenueTable } from "@/components/admin/RevenueTable";
import { RangeTabs } from "@/components/admin/RangeTabs";
import { Delta } from "@/components/admin/Delta";
import type { RevenuePoint } from "@/components/admin/revenue";
import { parseRange, rangeDays, rangeSpan } from "@/lib/admin/range";
import { Skeleton } from "@/components/motion/Skeleton";
import { formatPrice } from "@/lib/format";
import { OPEN_STATUSES, REVENUE_STATUSES } from "@/lib/orders/lifecycle";
import { OPEN_MESSAGE_STATUSES } from "@/lib/inbox/lifecycle";
import { isMissingInstall } from "@/lib/inbox/install";
import { readDiscountUsage } from "@/lib/discounts/usage";
import { describeDiscount, isDiscountKind } from "@/lib/discounts/lifecycle";
import { AlertTriangle, ArrowRight, Inbox as InboxIcon, Mail, Ticket } from "lucide-react";
import type { Order, Product } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

/** Keep in step with idx_products_low_stock in admin_performance.sql. */
const LOW_STOCK_AT = 5;

/** The dashboard only ever shows the most recent handful. */
const RECENT_ORDERS = 5;

/**
 * Four independent regions, four Suspense boundaries. The stats go in parallel
 * and land almost immediately; the chart and the two lists arrive when they
 * arrive, and none of them holds up another or the page frame.
 *
 * The reporting window comes out of the URL rather than out of state, so the
 * whole screen — tiles, chart and table — is rendered on the server for the
 * window asked for, and "the last 90 days" is an address rather than something
 * you have to click your way back to. See lib/admin/range.
 */
export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const range = parseRange((await searchParams).range);
  const days = rangeDays(range);
  const span = rangeSpan(range);

  return (
    <div>
      <AdminHeading
        title="Dashboard"
        copy="What needs attention today, and how the store is trading."
        action={<RangeTabs active={range} />}
      />

      {/* Above the grid, not in it: the tiles are settled totals, this is a
          sample of the last minute and a half. It fetches its own number. */}
      <LiveVisitors />

      {/* Keyed on the window: switching to 90 days should put the skeleton
          back rather than leave last week's numbers on screen, unlabelled,
          under a tab that now says something else. */}
      <Suspense key={range} fallback={<StatsSkeleton />}>
        <Stats days={days} />
      </Suspense>

      {/* Its own boundary, below the settled totals: these two are the
          storefront asking for something rather than a measure of trading,
          and neither should hold up the tiles above it. */}
      <Suspense fallback={null}>
        <InboxSummary />
      </Suspense>

      <div className="mt-10">
        <Suspense key={range} fallback={<ChartSkeleton />}>
          <Revenue days={days} span={span} />
        </Suspense>
      </div>

      {/* Under the chart because it explains part of it: the revenue above is
          already net of every code redeemed in the same window. Keyed on the
          range for the reason the tiles are — switching windows must not leave
          last week's counts on screen under a tab that says something else. */}
      <Suspense key={range} fallback={null}>
        <DiscountUsage days={days} span={span} />
      </Suspense>

      <Suspense fallback={null}>
        <LowStock />
      </Suspense>

      <Suspense fallback={<RecentOrdersSkeleton />}>
        <RecentOrders />
      </Suspense>
    </div>
  );
}

/* ── The reporting window ───────────────────────────────────────────────── */

/** `YYYY-MM-DD` in UTC, matching the day boundaries admin_revenue_series uses. */
function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The UTC day `back` days ago. `dayKeyBack(0)` is today. */
function dayKeyBack(back: number): string {
  const day = new Date();
  day.setUTCDate(day.getUTCDate() - back);
  return utcDayKey(day);
}

/** The day spine, oldest first, so a quiet day is a zero and not a gap. */
function emptySeries(days: number): RevenuePoint[] {
  return Array.from({ length: days }, (_, i) => ({
    day: dayKeyBack(days - 1 - i),
    revenue: 0,
    orders: 0,
  }));
}

/** `days` days of daily revenue, ending today. */
async function readSeries(days: number): Promise<RevenuePoint[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_revenue_series", { p_days: days });

  if (!error && Array.isArray(data) && data.length > 0) {
    return (data as { day: string; revenue: string | number; orders: string | number }[]).map(
      (row) => ({
        day: row.day,
        revenue: Number(row.revenue ?? 0),
        orders: Number(row.orders ?? 0),
      })
    );
  }

  /* Function absent. Pull the window and bucket it here — bounded by date, so
     it stays proportional to the window that was asked for however large the
     order book grows. */
  const spine = emptySeries(days);
  const since = `${spine[0].day}T00:00:00.000Z`;

  const { data: rows } = await supabase
    .from("orders")
    .select("created_at, total_amount")
    .gte("created_at", since)
    .in("status", [...REVENUE_STATUSES]);

  const byDay = new Map(spine.map((point) => [point.day, point]));

  for (const row of (rows ?? []) as { created_at: string; total_amount: number | string }[]) {
    const point = byDay.get(utcDayKey(new Date(row.created_at)));
    if (!point) continue;
    point.revenue += Number(row.total_amount ?? 0);
    point.orders += 1;
  }

  return spine;
}

/**
 * The window on screen and the equal-length one before it, in one read.
 *
 * Asking for twice the days and cutting the result in half is what makes "vs.
 * previous period" nearly free: `admin_revenue_series` already returns a
 * gapless daily spine, so the comparison window is the front of the same array
 * rather than a second query with its own date arithmetic to get subtly wrong.
 *
 * `cache` is what lets the tiles and the chart stay separate Suspense
 * boundaries: neither waits on the other, both render from one round trip, and
 * the total printed above the chart can never disagree with the revenue tile
 * because the two are summing the same rows.
 */
const readWindow = cache(
  async (days: number): Promise<{ current: RevenuePoint[]; previous: RevenuePoint[] }> => {
    const series = await readSeries(days * 2);
    return { current: series.slice(-days), previous: series.slice(0, -days) };
  }
);

/** One window's trading, summed out of its days. */
interface Period {
  revenue: number;
  orders: number;
  avgOrderValue: number;
}

function sumPeriod(points: RevenuePoint[]): Period {
  const revenue = points.reduce((total, point) => total + point.revenue, 0);
  const orders = points.reduce((total, point) => total + point.orders, 0);
  /* Divided by the orders that make it up, not by the days in the window —
     the same definition avg_order_value uses in revenue_recognition.sql. */
  return { revenue, orders, avgOrderValue: orders > 0 ? revenue / orders : 0 };
}

/**
 * Customers acquired in the window, and in the one before it.
 *
 * Two head counts rather than a sum over rows: the number is all that is
 * wanted, `idx_customers_created_at` serves both bounds, and no customer data
 * needs to cross the wire to render an integer. The counts come back null —
 * and so read as zero — when `customers` is not there yet, which is exactly
 * what the tile did before there was a window to count over.
 */
async function readNewCustomers(days: number): Promise<{ current: number; previous: number }> {
  const supabase = await createClient();

  const opened = `${dayKeyBack(days - 1)}T00:00:00.000Z`;
  const before = `${dayKeyBack(days * 2 - 1)}T00:00:00.000Z`;

  const [current, previous] = await Promise.all([
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .gte("created_at", opened),
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .gte("created_at", before)
      .lt("created_at", opened),
  ]);

  return { current: current.count ?? 0, previous: previous.count ?? 0 };
}


/* ── Stat tiles ─────────────────────────────────────────────────────────── */

function Stat({
  label,
  value,
  delta,
  note,
  tone = "plain",
}: {
  label: string;
  value: string;
  /** The movement against the window before, on the tiles that measure a flow. */
  delta?: React.ReactNode;
  note?: string;
  tone?: "plain" | "alert";
}) {
  return (
    <div
      className={`border p-5 ${tone === "alert" ? "border-sale/40 bg-sale/5" : "border-line bg-white"}`}
    >
      <span className="admin-label">{label}</span>
      <p
        className={`mt-3 font-[family-name:var(--font-display)] text-[30px] leading-none tabular-nums ${
          tone === "alert" ? "text-sale" : "text-ink"
        }`}
      >
        {value}
      </p>
      {delta}
      {note && <p className="admin-hint mt-2">{note}</p>}
    </div>
  );
}

interface DashboardStats {
  totalRevenue: number;
  avgOrderValue: number;
  totalOrders: number;
  openOrders: number;
  productCount: number;
  lowStockCount: number;
  customerCount: number;
  /** False when the aggregate could not be read — the tile notes say so. */
  exact: boolean;
}

/**
 * One RPC when `dashboard_schema.sql` has been applied. If it has not, this
 * falls back to counting over REST — correct for the counts, and revenue is
 * then only across the window it could see. Same fallback contract as
 * `getSettings()`.
 */
async function readStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_dashboard_stats").maybeSingle();

  if (!error && data) {
    const row = data as Record<string, string | number | null>;
    return {
      totalRevenue: Number(row.revenue ?? 0),
      avgOrderValue: Number(row.avg_order_value ?? 0),
      totalOrders: Number(row.order_count ?? 0),
      openOrders: Number(row.open_orders ?? 0),
      productCount: Number(row.product_count ?? 0),
      lowStockCount: Number(row.low_stock_count ?? 0),
      customerCount: Number(row.customer_count ?? 0),
      exact: true,
    };
  }

  /* Function absent, or still the four-column version from
     admin_performance.sql. Head counts are cheap — only the money has to be
     done the old way, over a bounded window. */
  const [products, allOrders, open, lowStock, customers, billable] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      /* Same set as admin_dashboard_stats in order_lifecycle.sql — a new
         order is open work from the moment it lands, not once accepted. */
      .in("status", [...OPEN_STATUSES]),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .lte("stock", LOW_STOCK_AT),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    /* Fulfilled only — the same set revenue_recognition.sql sums. */
    supabase
      .from("orders")
      .select("total_amount")
      .in("status", [...REVENUE_STATUSES])
      .limit(200),
  ]);

  const amounts = (billable.data ?? []).map((row: { total_amount: number | string }) =>
    Number(row.total_amount ?? 0)
  );
  const totalRevenue = amounts.reduce((sum, amount) => sum + amount, 0);

  return {
    totalRevenue,
    avgOrderValue: amounts.length > 0 ? totalRevenue / amounts.length : 0,
    totalOrders: allOrders.count ?? 0,
    openOrders: open.count ?? 0,
    productCount: products.count ?? 0,
    lowStockCount: lowStock.count ?? 0,
    /* Zero when `customers` is not there yet — the count query simply errors
       and `count` comes back null. The tile reads 0 rather than breaking. */
    customerCount: customers.count ?? 0,
    exact: false,
  };
}

/**
 * Six tiles, of two kinds, and the difference is why only four carry a delta.
 *
 * The first four measure a *flow* — money taken, baskets, orders fulfilled,
 * customers gained — which is a quantity per unit of time and therefore has a
 * previous period to be compared against. They now read for the window the
 * tabs select, with the all-time figure demoted to the note so nothing that
 * used to be on this screen has been lost.
 *
 * The last two measure a *state*: how many orders are open, how many products
 * are low, as of this moment. There is no such thing as the open-order count
 * "over the last 90 days", so those two are unwindowed and carry no delta —
 * showing one would be inventing a number to fill a slot.
 */
async function Stats({ days }: { days: number }) {
  const [stats, window, customers] = await Promise.all([
    readStats(),
    readWindow(days),
    readNewCustomers(days),
  ]);

  const current = sumPeriod(window.current);
  const previous = sumPeriod(window.previous);

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Stat
        label="Revenue"
        value={formatPrice(current.revenue)}
        delta={<Delta current={current.revenue} previous={previous.revenue} days={days} />}
        note={
          stats.exact
            ? `Fulfilled orders · ${formatPrice(stats.totalRevenue)} all time`
            : "Fulfilled orders only"
        }
      />
      <Stat
        label="Average order value"
        value={formatPrice(current.avgOrderValue)}
        delta={
          <Delta current={current.avgOrderValue} previous={previous.avgOrderValue} days={days} />
        }
        note="Revenue ÷ the fulfilled orders behind it"
      />
      <Stat
        label="Fulfilled orders"
        value={String(current.orders)}
        delta={<Delta current={current.orders} previous={previous.orders} days={days} />}
        note={
          stats.exact
            ? `${stats.totalOrders.toLocaleString()} orders placed, all time`
            : "Closed or completed, dated by when they were placed"
        }
      />
      <Stat
        label="New customers"
        value={String(customers.current)}
        delta={<Delta current={customers.current} previous={customers.previous} days={days} />}
        note={`${stats.customerCount.toLocaleString()} on the books`}
      />
      <Stat
        label="Open orders"
        value={String(stats.openOrders)}
        note="New, opened, pending or processing, right now"
      />
      <Stat
        label="Low stock"
        value={String(stats.lowStockCount)}
        note={`At or below ${LOW_STOCK_AT} units · ${stats.productCount} products`}
        tone={stats.lowStockCount > 0 ? "alert" : "plain"}
      />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="border border-line bg-white p-5">
          <Skeleton className="h-2 w-20" />
          <Skeleton className="mt-4 h-7 w-24" />
          {/* The delta row. Reserved on all six so the grid does not resettle
              when the four that carry one arrive. */}
          <Skeleton className="mt-3.5 h-3.5 w-32" />
          <Skeleton className="mt-3 h-2.5 w-28" />
        </div>
      ))}
    </div>
  );
}

/* ── Inbox ──────────────────────────────────────────────────────────────── */

/**
 * What the two storefront forms have brought in.
 *
 * Tiles rather than rows because there is nothing to read here — the number is
 * the whole message, and the click is the point. Both link somewhere that can
 * be acted on: the messages tile lands on the Unanswered tab rather than the
 * whole inbox, because "eleven messages" is trivia and "eleven still owed an
 * answer" is a morning's work.
 *
 * Renders nothing at all when `inbox_schema.sql` has not been applied. The
 * dashboard is a summary, and a summary is the wrong place to be told about a
 * migration — the screens themselves say so, at length, where somebody has
 * gone looking for the data.
 */
async function InboxSummary() {
  const supabase = await createClient();

  const [unanswered, subscribers] = await Promise.all([
    supabase
      .from("contact_messages")
      .select("id", { count: "exact", head: true })
      .in("status", [...OPEN_MESSAGE_STATUSES]),
    supabase
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("status", "subscribed"),
  ]);

  if (isMissingInstall(unanswered.error) || isMissingInstall(subscribers.error)) return null;

  const waiting = unanswered.count ?? 0;

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <InboxTile
        href="/admin/contacts?status=unanswered"
        icon={<InboxIcon className="h-4 w-4" strokeWidth={1.5} />}
        label="Messages waiting"
        value={String(waiting)}
        note={
          waiting > 0
            ? "New or read, and not yet replied to"
            : "Everything through /contact has been answered"
        }
        tone={waiting > 0 ? "alert" : "plain"}
      />
      <InboxTile
        href="/admin/newsletter"
        icon={<Mail className="h-4 w-4" strokeWidth={1.5} />}
        label="Newsletter subscribers"
        value={String(subscribers.count ?? 0)}
        note="Addresses currently receiving it"
      />
    </div>
  );
}

function InboxTile({
  href,
  icon,
  label,
  value,
  note,
  tone = "plain",
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: "plain" | "alert";
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-4 border p-5 transition-colors ${
        tone === "alert"
          ? "border-purple/40 bg-lilac hover:border-purple"
          : "border-line bg-white hover:border-purple hover:bg-lilac"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center border ${
          tone === "alert"
            ? "border-purple/30 bg-white text-purple"
            : "border-line text-muted group-hover:text-purple"
        }`}
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="admin-label">{label}</span>
        <span className="mt-1 block font-[family-name:var(--font-display)] text-[26px] leading-none tabular-nums text-ink">
          {value}
        </span>
        <span className="admin-hint mt-1.5 block">{note}</span>
      </span>

      <ArrowRight
        aria-hidden
        className="h-4 w-4 shrink-0 text-faint transition-colors group-hover:text-purple"
      />
    </Link>
  );
}

/* ── Revenue chart ──────────────────────────────────────────────────────── */

async function Revenue({ days, span }: { days: number; span: string }) {
  /* One read, two views of it: the deferred plot and the table that does not
     need JavaScript to be readable. The window before this one comes back on
     the same read and is simply not plotted — the tiles above are what it is
     for. See readWindow. */
  const { current } = await readWindow(days);

  return (
    <figure className="m-0">
      <RevenueChart data={current} span={span} />
      <RevenueTable data={current} span={span} />
    </figure>
  );
}

function ChartSkeleton() {
  return (
    <div className="border border-line bg-white p-5" aria-hidden>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-2 h-2.5 w-64" />
      <Skeleton className="mt-5 h-[260px] w-full" />
    </div>
  );
}

/* ── Discount codes ─────────────────────────────────────────────────────── */

/** Enough to show which codes are working without becoming a second screen. */
const TOP_CODES = 5;

/**
 * What the codes did in the window on screen.
 *
 * Counted from the redemption ledger through `admin_discount_usage()`, which
 * is the same aggregate /admin/discounts reads — so the number here and the
 * number there cannot disagree, and neither can be thrown off by an order that
 * was deleted after the fact.
 *
 * Renders nothing when `discount_codes.sql` has not been applied, and nothing
 * when the store has never written a code. Same judgement as `InboxSummary`
 * above: the dashboard is a summary, and a summary is the wrong place to be
 * told about a migration or about a feature nobody has started using. The
 * screen itself says so, at length, where somebody has gone looking.
 *
 * A store that *has* codes but used none this window still gets the section,
 * saying exactly that. Zero is the answer somebody running a campaign most
 * needs to see, and it is the one an empty-state check would hide.
 */
async function DiscountUsage({ days, span }: { days: number; span: string }) {
  const usage = await readDiscountUsage(days);

  if (usage.status !== "ok" || usage.rows.length === 0) return null;

  const used = usage.rows.filter((row) => row.uses > 0);
  const redemptions = used.reduce((sum, row) => sum + row.uses, 0);
  const discounted = used.reduce((sum, row) => sum + row.discounted, 0);
  const orderTotal = used.reduce((sum, row) => sum + row.order_total, 0);

  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-4">
        <div className="flex items-center gap-2">
          <Ticket className="h-4 w-4 text-purple" strokeWidth={1.5} />
          <h2 className="admin-section-title">Discount codes</h2>
        </div>
        <Link
          href="/admin/discounts"
          className="flex items-center gap-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-purple"
        >
          All codes <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {used.length === 0 ? (
        <p className="mt-4 border border-line bg-white p-8 text-center text-sm text-muted">
          No codes were used in {span}. {usage.rows.length}{" "}
          {usage.rows.length === 1 ? "code is" : "codes are"} on file.
        </p>
      ) : (
        <>
          <p className="admin-hint mt-2">
            {redemptions.toLocaleString()} {redemptions === 1 ? "redemption" : "redemptions"} in{" "}
            {span} · {formatPrice(discounted)} off {formatPrice(orderTotal)} of orders
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-ink">
                  {["Code", "Used", "Customers", "Given away"].map((head) => (
                    <th key={head} className="admin-th pb-3">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {used.slice(0, TOP_CODES).map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-line transition-colors hover:bg-frost"
                  >
                    <td className="py-3.5">
                      <Link
                        href={`/admin/discounts/${row.id}`}
                        className="font-medium tracking-[0.06em] text-ink transition-colors hover:text-purple"
                      >
                        {row.code}
                      </Link>
                      <span className="admin-hint mt-1 block">
                        {isDiscountKind(row.kind)
                          ? describeDiscount(row.kind, row.value)
                          : row.kind}
                      </span>
                    </td>
                    <td className="py-3.5 tabular-nums text-ink">{row.uses.toLocaleString()}</td>
                    <td className="py-3.5 tabular-nums text-ink-soft">
                      {row.customers.toLocaleString()}
                    </td>
                    <td className="py-3.5 tabular-nums text-purple">
                      −{formatPrice(row.discounted)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

/* ── Running low ────────────────────────────────────────────────────────── */

async function LowStock() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("products")
    .select("id, name, stock")
    .lte("stock", LOW_STOCK_AT)
    .order("stock", { ascending: true })
    .limit(8);

  const lowStock = (data ?? []) as Pick<Product, "id" | "name" | "stock">[];
  if (lowStock.length === 0) return null;

  return (
    <section className="mt-12">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-sale" strokeWidth={1.5} />
        <h2 className="admin-section-title">Running low</h2>
      </div>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {lowStock.map((product) => (
          <li key={product.id} className="flex items-center justify-between gap-4 py-3">
            <Link
              href={`/admin/products/${product.id}`}
              className="truncate text-sm text-ink transition-colors hover:text-purple"
            >
              {product.name}
            </Link>
            <span
              className={`shrink-0 text-[13px] tabular-nums ${
                product.stock === 0 ? "text-sale" : "text-muted"
              }`}
            >
              {product.stock === 0 ? "Out of stock" : `${product.stock} left`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ── Recent orders ──────────────────────────────────────────────────────── */

const RECENT_COLUMNS = "id, status, total_amount, created_at, shipping_address";

/**
 * The five most recent orders with the customer's name joined on.
 *
 * The embed is the whole point of the `customers` table — but it only exists
 * once `dashboard_schema.sql` has been applied, and PostgREST rejects the
 * whole query if the relationship is unknown. So the join is attempted, and a
 * failure falls back to the name in the shipping address, which is where
 * /admin/orders has always read it from.
 */
async function readRecentOrders(): Promise<Order[]> {
  const supabase = await createClient();

  const joined = await supabase
    .from("orders")
    .select(`${RECENT_COLUMNS}, customer:customers(id, name, email)`)
    .order("created_at", { ascending: false })
    .limit(RECENT_ORDERS);

  if (!joined.error) return (joined.data ?? []) as unknown as Order[];

  const { data } = await supabase
    .from("orders")
    .select(RECENT_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(RECENT_ORDERS);

  return (data ?? []) as unknown as Order[];
}

/** Relationship first, then the name captured at checkout, then nothing. */
function customerName(order: Order): string {
  return order.customer?.name ?? order.shipping_address?.fullName ?? "—";
}

async function RecentOrders() {
  const orders = await readRecentOrders();

  return (
    <section className="mt-12">
      <div className="flex items-end justify-between gap-4">
        <h2 className="admin-section-title">Recent orders</h2>
        <Link
          href="/admin/orders"
          className="flex items-center gap-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-purple"
        >
          All orders <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="mt-6 border border-line bg-white p-8 text-center text-sm text-muted">
          No orders yet. They will appear here the moment one is placed.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ink">
                {["Order", "Customer", "Placed", "Status", "Total"].map((head) => (
                  <th key={head} className="admin-th pb-3">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-line transition-colors hover:bg-frost">
                  <td className="py-3.5">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-ink transition-colors hover:text-purple"
                    >
                      #{order.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="max-w-[14rem] truncate py-3.5 text-ink-soft">
                    {customerName(order)}
                  </td>
                  <td className="py-3.5 text-muted">
                    {new Date(order.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-3.5">
                    <StatusPill status={order.status} />
                  </td>
                  <td className="py-3.5 tabular-nums text-ink">
                    {formatPrice(order.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RecentOrdersSkeleton() {
  return (
    <section className="mt-12" aria-hidden>
      <Skeleton className="h-3 w-32" />
      <div className="mt-4 border border-line">
        {Array.from({ length: RECENT_ORDERS }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-soft px-4 py-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-28" />
            <Skeleton className="ml-auto h-3 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </section>
  );
}
