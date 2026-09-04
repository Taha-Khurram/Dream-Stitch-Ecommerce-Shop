import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/admin/StatusPill";
import { Pagination, PaginationSkeleton } from "@/components/admin/Pagination";
import { Skeleton } from "@/components/motion/Skeleton";
import { formatPrice } from "@/lib/format";
import { buildPageHref, lastPageFor, rangeFor, type PerPage } from "@/lib/pagination";
import type { Order } from "@/types/ecommerce";

export const BASE_PATH = "/admin/orders";

/** `all` is not a column value — it means "no status filter". */
export const FILTERS = ["all", "pending", "processing", "completed", "cancelled"] as const;
export type OrderFilter = (typeof FILTERS)[number];

const COLUMNS = "id, status, total_amount, created_at, shipping_address";

/** The status filter as search params — the shape the pager URLs build on. */
export function filterParams(status: OrderFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  return params;
}

export async function OrdersTable({
  status,
  page,
  perPage,
}: {
  status: OrderFilter;
  page: number;
  perPage: PerPage;
}) {
  const supabase = await createClient();
  const { from, to } = rangeFor(page, perPage);

  let request = supabase
    .from("orders")
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") request = request.eq("status", status);

  const { data, count } = await request;
  const orders = (data ?? []) as Order[];
  const total = count ?? 0;
  const lastPage = lastPageFor(total, perPage);

  /* Past the end — stale link, or the filter narrowed since. Show the last
     real page rather than an empty table implying there are no such orders. */
  if (orders.length === 0 && total > 0 && page > lastPage) {
    redirect(buildPageHref(BASE_PATH, filterParams(status), { page: lastPage, perPage }));
  }

  if (orders.length === 0) {
    return (
      <p className="mt-10 border border-line bg-white p-12 text-center text-sm text-muted">
        {status === "all" ? "No orders yet." : `No ${status} orders.`}
      </p>
    );
  }

  return (
    <>
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

      <Pagination
        basePath={BASE_PATH}
        total={total}
        page={page}
        perPage={perPage}
        noun="order"
      />
    </>
  );
}

/* Capped rather than tracking `perPage`: see the note in ProductsTable. */
const SKELETON_ROWS = 10;

export function OrdersTableSkeleton() {
  return (
    <>
      <div className="mt-4 border border-line" aria-hidden>
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-soft px-4 py-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="ml-auto h-3 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <PaginationSkeleton />
    </>
  );
}
