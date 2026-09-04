import React, { Suspense } from "react";
import Link from "next/link";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { buildPageHref, parseWindow } from "@/lib/pagination";
import {
  BASE_PATH,
  FILTERS,
  OrdersTable,
  OrdersTableSkeleton,
  filterLabel,
  filterParams,
  type OrderFilter,
} from "./OrdersTable";

export const dynamic = "force-dynamic";

/** Shell only — the filter rail is usable while the rows are still in flight. */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; per?: string }>;
}) {
  const { status, ...paging } = await searchParams;
  const active: OrderFilter = FILTERS.includes(status as OrderFilter)
    ? (status as OrderFilter)
    : "all";
  const { page, perPage } = parseWindow(paging);

  return (
    <div>
      <AdminHeading
        title="Orders"
        copy="Every order placed through checkout, newest first. A new order waits under New until it is accepted or deleted."
      />

      <div className="mt-6 flex flex-wrap gap-2 border-b border-line pb-4">
        {FILTERS.map((filter) => (
          <Link
            key={filter}
            /* Switching filter starts at page 1 — the old page number means
               nothing against a different set — but keeps the row count, which
               is a preference about this screen rather than about these rows. */
            href={buildPageHref(BASE_PATH, filterParams(filter), { page: 1, perPage })}
            aria-current={active === filter ? "page" : undefined}
            className={`px-3.5 py-2 text-[13px] font-medium transition-colors ${
              active === filter
                ? "bg-purple text-white"
                : "border border-line text-ink-soft hover:border-purple hover:bg-lilac hover:text-purple"
            }`}
          >
            {filterLabel(filter)}
          </Link>
        ))}
      </div>

      <Suspense key={`${active}:${page}:${perPage}`} fallback={<OrdersTableSkeleton />}>
        <OrdersTable status={active} page={page} perPage={perPage} />
      </Suspense>
    </div>
  );
}
