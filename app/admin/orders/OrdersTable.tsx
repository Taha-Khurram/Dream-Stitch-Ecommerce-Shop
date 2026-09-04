import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusPill } from "@/components/admin/StatusPill";
import { OrderIntakeActions } from "@/components/admin/OrderIntakeActions";
import { Pagination, PaginationSkeleton } from "@/components/admin/Pagination";
import { Skeleton } from "@/components/motion/Skeleton";
import { formatPrice } from "@/lib/format";
import { buildPageHref, lastPageFor, rangeFor, type PerPage } from "@/lib/pagination";
import {
  ORDER_STATUSES,
  STATUS_COPY,
  isAwaitingReview,
  orderReference,
} from "@/lib/orders/lifecycle";
import type { Order } from "@/types/ecommerce";

export const BASE_PATH = "/admin/orders";

/**
 * The filter rail: every status, plus `all`.
 *
 * Derived from `ORDER_STATUSES` rather than hand-listed, so a status added to
 * the lifecycle cannot end up unreachable here. `all` is not a column value —
 * it means "no status filter" — and `new` leads because it is the only tab
 * with anything waiting on the admin.
 */
export const FILTERS = ["all", ...ORDER_STATUSES] as const;
export type OrderFilter = (typeof FILTERS)[number];

/** How a filter tab reads, and what an empty result under it should say. */
export function filterLabel(filter: OrderFilter): string {
  return filter === "all" ? "All" : STATUS_COPY[filter].label;
}

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
        {status === "all"
          ? "No orders yet."
          : `No ${filterLabel(status).toLowerCase()} orders.`}
      </p>
    );
  }

  return (
    <>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              {["Order", "Customer", "Placed", "Status", "Total"].map((head) => (
                <th key={head} className="admin-th pb-3">
                  {head}
                </th>
              ))}
              {/* The heading is for screen readers only — a visible "Actions"
                  label over two buttons earns nothing but width. */}
              <th className="admin-th pb-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
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
                    {orderReference(order.id)}
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
                {/* Accept-or-delete belongs to the intake step only. Once an
                    order is on the books its stage is a track, not a yes/no,
                    so the row sends you to the detail page for it. */}
                <td className="py-3.5 text-right">
                  {isAwaitingReview(order.status) ? (
                    <div className="flex justify-end">
                      <OrderIntakeActions id={order.id} />
                    </div>
                  ) : (
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-[12px] font-medium text-muted transition-colors hover:text-purple"
                    >
                      Manage
                    </Link>
                  )}
                </td>
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
            <Skeleton className="h-6 w-28" />
          </div>
        ))}
      </div>
      <PaginationSkeleton />
    </>
  );
}
