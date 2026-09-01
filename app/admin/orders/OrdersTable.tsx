import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/admin/StatusPill";
import { Skeleton } from "@/components/motion/Skeleton";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/types/ecommerce";

export const PAGE_SIZE = 25;

/** `all` is not a column value — it means "no status filter". */
export const FILTERS = ["all", "pending", "processing", "completed", "cancelled"] as const;
export type OrderFilter = (typeof FILTERS)[number];

const COLUMNS = "id, status, total_amount, created_at, shipping_address";

export async function OrdersTable({ status, page }: { status: OrderFilter; page: number }) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;

  let request = supabase
    .from("orders")
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status !== "all") request = request.eq("status", status);

  const { data, count } = await request;
  const orders = (data ?? []) as Order[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (orders.length === 0) {
    return (
      <p className="mt-10 border border-line bg-white p-12 text-center text-sm text-muted">
        {status === "all" ? "No orders yet." : `No ${status} orders.`}
      </p>
    );
  }

  return (
    <>
      <p className="admin-hint mt-4 text-right">
        {total} {total === 1 ? "order" : "orders"}
        {lastPage > 1 && ` · page ${page} of ${lastPage}`}
      </p>

      <div className="mt-2 overflow-x-auto">
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
                <td className="py-3.5 text-ink-soft">{order.shipping_address?.fullName ?? "—"}</td>
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
                <td className="py-3.5 tabular-nums text-ink">{formatPrice(order.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && <Pager status={status} page={page} lastPage={lastPage} />}
    </>
  );
}

function Pager({
  status,
  page,
  lastPage,
}: {
  status: OrderFilter;
  page: number;
  lastPage: number;
}) {
  const href = (n: number) => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (n > 1) params.set("page", String(n));
    const search = params.toString();
    return search ? `/admin/orders?${search}` : "/admin/orders";
  };

  const step =
    "border border-line px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-purple hover:bg-lilac hover:text-purple";

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} className={step} rel="prev">
          Previous
        </Link>
      ) : (
        <span aria-hidden />
      )}
      {page < lastPage && (
        <Link href={href(page + 1)} className={`${step} ml-auto`} rel="next">
          Next
        </Link>
      )}
    </nav>
  );
}

export function OrdersTableSkeleton() {
  return (
    <div className="mt-6 border border-line" aria-hidden>
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line-soft px-4 py-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-32" />
          <Skeleton className="ml-auto h-3 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}
