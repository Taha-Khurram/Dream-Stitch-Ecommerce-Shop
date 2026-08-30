import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { StatusPill } from "@/components/admin/StatusPill";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

const FILTERS = ["all", "pending", "processing", "completed", "cancelled"] as const;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const active = FILTERS.includes(status as (typeof FILTERS)[number]) ? status! : "all";

  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id, status, total_amount, created_at, shipping_address")
    .order("created_at", { ascending: false })
    .limit(200);

  if (active !== "all") query = query.eq("status", active);

  const { data } = await query;
  const orders = (data ?? []) as Order[];

  return (
    <div>
      <AdminHeading title="Orders" copy="Every order placed through checkout, newest first." />

      <div className="mt-6 flex flex-wrap gap-2 border-b border-line pb-4">
        {FILTERS.map((filter) => (
          <Link
            key={filter}
            href={filter === "all" ? "/admin/orders" : `/admin/orders?status=${filter}`}
            className={`px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
              active === filter
                ? "bg-purple text-white"
                : "border border-line text-ink-soft hover:border-purple hover:text-purple"
            }`}
          >
            {filter}
          </Link>
        ))}
      </div>

      {orders.length === 0 ? (
        <p className="mt-10 border border-line bg-white p-12 text-center text-[13px] text-muted">
          {active === "all" ? "No orders yet." : `No ${active} orders.`}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink">
                {["Order", "Customer", "Placed", "Status", "Total"].map((head) => (
                  <th key={head} className="eyebrow pb-3 text-ink">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-line">
                  <td className="py-3.5">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-medium text-ink transition-colors hover:text-purple"
                    >
                      #{order.id.slice(0, 8).toUpperCase()}
                    </Link>
                  </td>
                  <td className="py-3.5 text-ink-soft">
                    {order.shipping_address?.fullName ?? "—"}
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
    </div>
  );
}
