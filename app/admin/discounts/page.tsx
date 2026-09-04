import React, { Suspense } from "react";
import Link from "next/link";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { buildPageHref, parseWindow } from "@/lib/pagination";
import { Plus } from "lucide-react";
import {
  BASE_PATH,
  FILTERS,
  DiscountsTable,
  DiscountsTableSkeleton,
  filterLabel,
  filterParams,
  type DiscountFilter,
} from "./DiscountsTable";

export const dynamic = "force-dynamic";

/** Shell only — the filter rail and New code are usable while the rows load. */
export default async function AdminDiscountsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; per?: string }>;
}) {
  const { status, ...paging } = await searchParams;
  const active: DiscountFilter = FILTERS.includes(status as DiscountFilter)
    ? (status as DiscountFilter)
    : "all";
  const { page, perPage } = parseWindow(paging);

  return (
    <div>
      <AdminHeading
        title="Discounts"
        copy="Every code, and what it has actually cost. Usage is counted from the redemptions themselves, so a deleted order gives its use back."
        action={
          <Link href="/admin/discounts/new" className="btn-primary inline-flex items-center gap-2">
            <Plus className="h-4 w-4" strokeWidth={2} />
            New code
          </Link>
        }
      />

      <div className="mt-6 flex flex-wrap gap-2 border-b border-line pb-4">
        {FILTERS.map((filter) => (
          <Link
            key={filter}
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

      <Suspense key={`${active}:${page}:${perPage}`} fallback={<DiscountsTableSkeleton />}>
        <DiscountsTable status={active} page={page} perPage={perPage} />
      </Suspense>
    </div>
  );
}
