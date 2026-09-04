import React, { Suspense } from "react";
import Link from "next/link";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { SearchBox } from "@/components/admin/SearchBox";
import { buildPageHref, parseWindow } from "@/lib/pagination";
import { Download } from "lucide-react";
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
  searchParams: Promise<{ status?: string; q?: string; page?: string; per?: string }>;
}) {
  const { status, q = "", ...paging } = await searchParams;
  const active: OrderFilter = FILTERS.includes(status as OrderFilter)
    ? (status as OrderFilter)
    : "all";
  const query = q.trim();
  const { page, perPage } = parseWindow(paging);

  /* The export takes the screen's filters, from the same function the tab and
     pager URLs are built with — so the file is the list you were looking at.
     Without them, exporting off a filtered screen quietly hands back the whole
     book. The page number is deliberately not among them: the file is the
     whole result, not the twenty rows in front of you. */
  const exportQuery = filterParams(active, query).toString();

  return (
    <div>
      <AdminHeading
        title="Orders"
        copy="Every order placed through checkout, newest first. A new order waits under New until it is accepted or deleted."
        action={
          /* A plain anchor, not a Link: the response is a file, and letting the
             router try to navigate to it would do nothing at all. */
          <a
            href={`/api/admin/orders/export${exportQuery ? `?${exportQuery}` : ""}`}
            className="btn-outline inline-flex items-center gap-2"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} />
            Export CSV
          </a>
        }
      />

      {/* Above the rail, because it searches across the tabs rather than
          within the one you happen to be on — the tab then narrows it. */}
      <SearchBox
        action={BASE_PATH}
        query={query}
        perPage={perPage}
        placeholder="Reference, name, phone or email…"
        label="Search orders"
        keep={filterParams(active)}
      />

      <div className="mt-6 flex flex-wrap gap-2 border-b border-line pb-4">
        {FILTERS.map((filter) => (
          <Link
            key={filter}
            /* Switching filter starts at page 1 — the old page number means
               nothing against a different set — but keeps the row count, which
               is a preference about this screen rather than about these rows. */
            href={buildPageHref(BASE_PATH, filterParams(filter, query), { page: 1, perPage })}
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

      <Suspense key={`${active}:${query}:${page}:${perPage}`} fallback={<OrdersTableSkeleton />}>
        <OrdersTable status={active} query={query} page={page} perPage={perPage} />
      </Suspense>
    </div>
  );
}
