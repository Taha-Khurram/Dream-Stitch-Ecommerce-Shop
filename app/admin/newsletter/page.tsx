import React, { Suspense } from "react";
import Link from "next/link";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { buildPageHref, parseWindow } from "@/lib/pagination";
import { Download } from "lucide-react";
import {
  BASE_PATH,
  FILTERS,
  SubscribersTable,
  SubscribersTableSkeleton,
  filterLabel,
  filterParams,
  type SubscriberFilter,
} from "./SubscribersTable";

export const dynamic = "force-dynamic";

/** Shell only — the filter rail and the export are usable while rows load. */
export default async function AdminNewsletterPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; per?: string }>;
}) {
  const { status, ...paging } = await searchParams;
  const active: SubscriberFilter = FILTERS.includes(status as SubscriberFilter)
    ? (status as SubscriberFilter)
    : "all";
  const { page, perPage } = parseWindow(paging);

  /**
   * The export follows the tab you are looking at, with one exception: on
   * "All" it narrows to the people who are actually subscribed.
   *
   * That is not a shortcut, it is the safe default. The most likely thing to
   * happen to this file is that it gets pasted into a mail platform, and the
   * unsubscribed rows are on it precisely so they are never mailed again.
   * Exporting them by default would hand somebody a list whose whole purpose
   * is to be excluded. The Unsubscribed tab still exports them, deliberately.
   */
  const exportStatus = active === "all" ? "subscribed" : active;
  const exportHref = `/api/admin/subscribers/export?status=${exportStatus}`;

  return (
    <div>
      <AdminHeading
        title="Newsletter"
        copy="Everyone who signed up through the storefront, newest first. Unsubscribing keeps the address on file so it is never mailed again."
        action={
          /* A plain anchor, not a Link: the response is a file, and letting
             the router try to navigate to it would do nothing at all. */
          <a href={exportHref} className="btn-outline inline-flex items-center gap-2">
            <Download className="h-4 w-4" strokeWidth={1.75} />
            Export {exportStatus === "subscribed" ? "subscribed" : exportStatus} CSV
          </a>
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

      <Suspense key={`${active}:${page}:${perPage}`} fallback={<SubscribersTableSkeleton />}>
        <SubscribersTable status={active} page={page} perPage={perPage} />
      </Suspense>
    </div>
  );
}
