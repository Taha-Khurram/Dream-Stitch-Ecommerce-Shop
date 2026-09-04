import React, { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { StatusPill } from "@/components/admin/StatusPill";
import { LiveVisitors } from "@/components/admin/LiveVisitors";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { RevenueTable } from "@/components/admin/RevenueTable";
import type { RevenuePoint } from "@/components/admin/revenue";
import { Skeleton } from "@/components/motion/Skeleton";
import { formatPrice } from "@/lib/format";
import { OPEN_STATUSES } from "@/lib/orders/lifecycle";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { Order, Product } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

/** Keep in step with idx_products_low_stock in admin_performance.sql. */
const LOW_STOCK_AT = 5;

/** The dashboard only ever shows the most recent handful. */
const RECENT_ORDERS = 5;

/** Window for the revenue chart, and for admin_revenue_series(p_days). */
const CHART_DAYS = 7;

/**
 * Four independent regions, four Suspense boundaries. The stats are one round
 * trip and land almost immediately; the chart and the two lists arrive when
 * they arrive, and none of them holds up another or the page frame.
 */
export default function AdminDashboard() {
  return (
    <div>
      <AdminHeading
        title="Dashboard"
        copy="What needs attention today, and how the store is trading."
      />

      {/* Above the grid, not in it: the tiles are settled totals, this is a
          sample of the last minute and a half. It fetches its own number. */}
      <LiveVisitors />

      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
      </Suspense>

      <div className="mt-10">
        <Suspense fallback={<ChartSkeleton />}>
          <Revenue />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <LowStock />
      </Suspense>

      <Suspense fallback={<RecentOrdersSkeleton />}>
        <RecentOrders />
      </Suspense>
    </div>
  );
}

/* ── Stat tiles ─────────────────────────────────────────────────────────── */

function Stat({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: string;
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
    supabase.from("orders").select("total_amount").neq("status", "cancelled").limit(200),
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

async function Stats() {
  const stats = await readStats();

  /* The three the brief leads on come first; the operational tiles follow. */
  const revenueNote = stats.exact
    ? "All orders, excluding cancelled"
    : "Across the last 200 orders";

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Stat label="Total revenue" value={formatPrice(stats.totalRevenue)} note={revenueNote} />
      <Stat
        label="Average order value"
        value={formatPrice(stats.avgOrderValue)}
        note={stats.exact ? "Revenue ÷ orders billed" : "Across the last 200 orders"}
      />
      <Stat
        label="Total orders"
        value={String(stats.totalOrders)}
        note="Every order ever placed"
      />
      <Stat
        label="Open orders"
        value={String(stats.openOrders)}
        note="New, opened, pending or processing"
      />
      <Stat label="Customers" value={String(stats.customerCount)} note="On the books" />
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
          <Skeleton className="mt-3 h-2.5 w-28" />
        </div>
      ))}
    </div>
  );
}

/* ── Revenue chart ──────────────────────────────────────────────────────── */

/** `YYYY-MM-DD` in UTC, matching the day boundaries admin_revenue_series uses. */
function utcDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The seven-day spine, oldest first, so a quiet day is a zero and not a gap. */
function emptySeries(days: number): RevenuePoint[] {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - (days - 1 - i));
    return { day: utcDayKey(day), revenue: 0, orders: 0 };
  });
}

async function readRevenueSeries(): Promise<RevenuePoint[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_revenue_series", { p_days: CHART_DAYS });

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
     it stays small however large the order book grows. */
  const spine = emptySeries(CHART_DAYS);
  const since = `${spine[0].day}T00:00:00.000Z`;

  const { data: rows } = await supabase
    .from("orders")
    .select("created_at, total_amount")
    .gte("created_at", since)
    .neq("status", "cancelled");

  const byDay = new Map(spine.map((point) => [point.day, point]));

  for (const row of (rows ?? []) as { created_at: string; total_amount: number | string }[]) {
    const point = byDay.get(utcDayKey(new Date(row.created_at)));
    if (!point) continue;
    point.revenue += Number(row.total_amount ?? 0);
    point.orders += 1;
  }

  return spine;
}

async function Revenue() {
  /* One read, two views of it: the deferred plot and the table that does not
     need JavaScript to be readable. */
  const series = await readRevenueSeries();

  return (
    <figure className="m-0">
      <RevenueChart data={series} />
      <RevenueTable data={series} />
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
