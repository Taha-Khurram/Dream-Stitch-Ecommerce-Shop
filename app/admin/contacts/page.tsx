import React, { Suspense } from "react";
import Link from "next/link";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { buildPageHref, parseWindow } from "@/lib/pagination";
import {
  BASE_PATH,
  ContactsTable,
  ContactsTableSkeleton,
  FILTERS,
  filterLabel,
  filterParams,
  type MessageFilter,
} from "./ContactsTable";

export const dynamic = "force-dynamic";

/** Shell only — the filter rail is usable while the rows are still in flight. */
export default async function AdminContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string; per?: string }>;
}) {
  const { status, ...paging } = await searchParams;
  const active: MessageFilter = FILTERS.includes(status as MessageFilter)
    ? (status as MessageFilter)
    : "all";
  const { page, perPage } = parseWindow(paging);

  return (
    <div>
      <AdminHeading
        title="Contacts"
        copy="Every message sent through the form on /contact, newest first. Opening one marks it read; replies go out from your mail client."
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

      <Suspense key={`${active}:${page}:${perPage}`} fallback={<ContactsTableSkeleton />}>
        <ContactsTable status={active} page={page} perPage={perPage} />
      </Suspense>
    </div>
  );
}
