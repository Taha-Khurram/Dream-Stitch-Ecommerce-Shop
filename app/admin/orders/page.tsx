import React, { Suspense } from "react";
import Link from "next/link";
import { AdminHeading } from "@/components/admin/AdminHeading";
import {
  FILTERS,
  OrdersTable,
  OrdersTableSkeleton,
  type OrderFilter,
} from "./OrdersTable";

export const dynamic = "force-dynamic";

/** Shell only — the filter rail is usable while the rows are still in flight. */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status, page = "1" } = await searchParams;
  const active: OrderFilter = FILTERS.includes(status as OrderFilter)
    ? (status as OrderFilter)
    : "all";
  const current = Math.max(1, Number(page) || 1);

  return (
    <div>
      <AdminHeading title="Orders" copy="Every order placed through checkout, newest first." />

      <div className="mt-6 flex flex-wrap gap-2 border-b border-line pb-4">
        {FILTERS.map((filter) => (
          <Link
            key={filter}
            href={filter === "all" ? "/admin/orders" : `/admin/orders?status=${filter}`}
            aria-current={active === filter ? "page" : undefined}
            className={`px-3.5 py-2 text-[13px] font-medium capitalize transition-colors ${
              active === filter
                ? "bg-purple text-white"
                : "border border-line text-ink-soft hover:border-purple hover:bg-lilac hover:text-purple"
            }`}
          >
            {filter}
          </Link>
        ))}
      </div>

      <Suspense key={`${active}:${current}`} fallback={<OrdersTableSkeleton />}>
        <OrdersTable status={active} page={current} />
      </Suspense>
    </div>
  );
}
