import React, { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { StatusPill } from "@/components/admin/StatusPill";
import { Skeleton } from "@/components/motion/Skeleton";
import { formatPrice } from "@/lib/format";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { Order, Product } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

/** Keep in step with idx_products_low_stock in admin_performance.sql. */
const LOW_STOCK_AT = 5;

/** The dashboard only ever shows the most recent handful. */
const RECENT_ORDERS = 8;

/**
 * Three independent regions, three Suspense boundaries. The stats are one
 * round trip and land almost immediately; the two lists arrive when they
 * arrive, and neither holds up the other or the page frame.
 */
export default function AdminDashboard() {
  return (
    <div>
      <AdminHeading
        title="Dashboard"
        copy="What needs attention today, and how the store is trading."
      />

      <Suspense fallback={<StatsSkeleton />}>
        <Stats />
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
  openOrders: number;
  revenue: number;
  productCount: number;
  lowStockCount: number;
  /** False when the aggregate could not be read — the note says so. */
  revenueExact: boolean;
}

/**
 * One RPC when `admin_performance.sql` has been applied. If it has not, this
 * falls back to counting over REST — correct, just chattier, and revenue is
 * then only across the orders it could see. Same fallback contract as
 * `getSettings()`.
 */
async function readStats(): Promise<DashboardStats> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_dashboard_stats").maybeSingle();

  if (!error && data) {
    const row = data as {
      open_orders: number;
      revenue: string | number;
      product_count: number;
      low_stock_count: number;
    };
    return {
      openOrders: Number(row.open_orders ?? 0),
      revenue: Number(row.revenue ?? 0),
      productCount: Number(row.product_count ?? 0),
      lowStockCount: Number(row.low_stock_count ?? 0),
      revenueExact: true,
    };
  }

  /* Function absent. Head counts are cheap — only the sum has to be done the
     old way, over a bounded window. */
  const [products, open, lowStock, recent] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "processing"]),
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .lte("stock", LOW_STOCK_AT),
    supabase.from("orders").select("total_amount").neq("status", "cancelled").limit(200),
  ]);

  const revenue = (recent.data ?? []).reduce(
    (sum, row: { total_amount: number | string }) => sum + Number(row.total_amount ?? 0),
    0
  );

  return {
    openOrders: open.count ?? 0,
    revenue,
    productCount: products.count ?? 0,
    lowStockCount: lowStock.count ?? 0,
    revenueExact: false,
  };
}

async function Stats() {
  const stats = await readStats();

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        label="Open orders"
        value={String(stats.openOrders)}
        note="Pending or processing"
      />
      <Stat
        label="Revenue"
        value={formatPrice(stats.revenue)}
        note={stats.revenueExact ? "All orders, excluding cancelled" : "Across the last 200 orders"}
      />
      <Stat
        label="Products"
        value={String(stats.productCount)}
        note="Live in the catalogue"
      />
      <Stat
        label="Low stock"
        value={String(stats.lowStockCount)}
        note={`At or below ${LOW_STOCK_AT} units`}
        tone={stats.lowStockCount > 0 ? "alert" : "plain"}
      />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border border-line bg-white p-5">
          <Skeleton className="h-2 w-20" />
          <Skeleton className="mt-4 h-7 w-24" />
          <Skeleton className="mt-3 h-2.5 w-28" />
        </div>
      ))}
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

async function RecentOrders() {
  const supabase = await createClient();

  /* Eight rows, because eight is what renders. This used to fetch fifty and
     throw forty-two of them away. */
  const { data } = await supabase
    .from("orders")
    .select("id, status, total_amount, created_at")
    .order("created_at", { ascending: false })
    .limit(RECENT_ORDERS);

  const orders = (data ?? []) as Order[];

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
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ink">
                {["Order", "Placed", "Status", "Total"].map((head) => (
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
            <Skeleton className="ml-auto h-3 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </section>
  );
}
