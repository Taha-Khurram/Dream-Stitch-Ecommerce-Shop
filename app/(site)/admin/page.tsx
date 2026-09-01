import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { StatusPill } from "@/components/admin/StatusPill";
import { formatPrice } from "@/lib/format";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { Order, Product } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

const LOW_STOCK_AT = 5;

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
      <span className="eyebrow text-muted">{label}</span>
      <p
        className={`mt-3 font-[family-name:var(--font-display)] text-[30px] leading-none tabular-nums ${
          tone === "alert" ? "text-sale" : "text-ink"
        }`}
      >
        {value}
      </p>
      {note && <p className="mt-2 text-[11px] text-muted">{note}</p>}
    </div>
  );
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [productCount, orderRows, lowStockRows] = await Promise.all([
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase
      .from("orders")
      .select("id, status, total_amount, created_at, user_id, shipping_address")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("products")
      .select("id, name, stock, slug")
      .lte("stock", LOW_STOCK_AT)
      .order("stock", { ascending: true })
      .limit(8),
  ]);

  const orders = (orderRows.data ?? []) as Order[];
  const lowStock = (lowStockRows.data ?? []) as Pick<Product, "id" | "name" | "stock" | "slug">[];

  const openOrders = orders.filter((o) => o.status === "pending" || o.status === "processing");
  const revenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);

  return (
    <div>
      <AdminHeading
        title="Dashboard"
        copy="What needs attention today, and how the store is trading."
      />

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open orders" value={String(openOrders.length)} note="Pending or processing" />
        <Stat
          label="Revenue"
          value={formatPrice(revenue)}
          note={`Across the last ${orders.length} orders`}
        />
        <Stat label="Products" value={String(productCount.count ?? 0)} note="Live in the catalogue" />
        <Stat
          label="Low stock"
          value={String(lowStock.length)}
          note={`At or below ${LOW_STOCK_AT} units`}
          tone={lowStock.length > 0 ? "alert" : "plain"}
        />
      </div>

      {lowStock.length > 0 && (
        <section className="mt-12">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-sale" strokeWidth={1.5} />
            <h2 className="eyebrow text-ink">Running low</h2>
          </div>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {lowStock.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-4 py-3">
                <Link
                  href={`/admin/products/${product.id}`}
                  className="truncate text-[13px] text-ink transition-colors hover:text-purple"
                >
                  {product.name}
                </Link>
                <span
                  className={`shrink-0 text-[12px] tabular-nums ${
                    product.stock === 0 ? "text-sale" : "text-muted"
                  }`}
                >
                  {product.stock === 0 ? "Out of stock" : `${product.stock} left`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <h2 className="eyebrow text-ink">Recent orders</h2>
          <Link
            href="/admin/orders"
            className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft transition-colors hover:text-purple"
          >
            All orders <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {orders.length === 0 ? (
          <p className="mt-6 border border-line bg-white p-8 text-center text-[13px] text-muted">
            No orders yet. They will appear here the moment one is placed.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left text-[13px]">
              <thead>
                <tr className="border-b border-ink">
                  {["Order", "Placed", "Status", "Total"].map((head) => (
                    <th key={head} className="eyebrow pb-3 text-ink">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.slice(0, 8).map((order) => (
                  <tr key={order.id} className="border-b border-line">
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
    </div>
  );
}
