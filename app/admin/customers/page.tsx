import React, { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { Pagination, PaginationSkeleton } from "@/components/admin/Pagination";
import { Skeleton } from "@/components/motion/Skeleton";
import { buildPageHref, lastPageFor, parseWindow, rangeFor, type PerPage } from "@/lib/pagination";
import { CustomerRowActions } from "@/components/admin/CustomerActions";
import { SearchBox } from "@/components/admin/SearchBox";
import { SEARCH_PARAM, customerSearchFilter } from "@/lib/admin/search";
import { Download, Mail, Phone } from "lucide-react";
import type { Customer } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/customers";

/**
 * The customer book — everyone the store has a record for, whether or not
 * they ever registered an account.
 *
 * Shell only, so the heading paints while the rows are still in flight.
 */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; per?: string }>;
}) {
  const { q = "", ...paging } = await searchParams;
  const query = q.trim();
  const { page, perPage } = parseWindow(paging);

  /* The export takes the same term, so the file matches the list it was asked
     for from. Without it, exporting off a filtered screen quietly hands back
     the whole book. */
  const exportHref = query
    ? `/api/admin/customers/export?${new URLSearchParams({ [SEARCH_PARAM]: query })}`
    : "/api/admin/customers/export";

  return (
    <div>
      <AdminHeading
        title="Customers"
        copy="Everyone on the books, newest first. Accounts and guest records alike."
        action={
          /* A plain anchor, not a Link: the response is a file, and letting the
             router try to navigate to it would do nothing at all. */
          <a
            href={exportHref}
            className="btn-outline inline-flex items-center gap-2"
          >
            <Download className="h-4 w-4" strokeWidth={1.75} />
            Export CSV
          </a>
        }
      />

      <SearchBox
        action={BASE_PATH}
        query={query}
        perPage={perPage}
        placeholder="Name, email or phone…"
        label="Search customers"
      />

      <Suspense key={`${query}:${page}:${perPage}`} fallback={<CustomersTableSkeleton />}>
        <CustomersTable query={query} page={page} perPage={perPage} />
      </Suspense>
    </div>
  );
}

/** `orders(count)` is a PostgREST aggregate embed — an array of one row. */
type CustomerRow = Customer & { orders?: { count: number }[] };

async function CustomersTable({
  query,
  page,
  perPage,
}: {
  query: string;
  page: number;
  perPage: PerPage;
}) {
  const supabase = await createClient();
  const { from, to } = rangeFor(page, perPage);

  let request = supabase
    .from("customers")
    .select("id, name, email, phone, created_at, orders(count)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const search = customerSearchFilter(query);
  if (search) request = request.or(search);

  const { data, count, error } = await request;

  /* The table only exists once dashboard_schema.sql has been applied. Say so
     plainly rather than rendering an empty list that looks like no customers. */
  if (error) {
    return (
      <div className="mt-10 border border-line bg-white p-10 text-center">
        <p className="text-sm text-ink">The customers table is not there yet.</p>
        <p className="admin-hint mx-auto mt-2 max-w-md">
          Run <code className="text-ink">dashboard_schema.sql</code> in the Supabase SQL
          editor, then reload this page. Existing accounts are backfilled automatically.
        </p>
      </div>
    );
  }

  const customers = (data ?? []) as CustomerRow[];
  const total = count ?? 0;
  const lastPage = lastPageFor(total, perPage);

  /* Past the end — a stale bookmark, or records removed since. Land on the
     last real page rather than an empty book. */
  if (customers.length === 0 && total > 0 && page > lastPage) {
    const params = new URLSearchParams();
    if (query) params.set(SEARCH_PARAM, query);
    redirect(buildPageHref(BASE_PATH, params, { page: lastPage, perPage }));
  }

  if (customers.length === 0) {
    return (
      <p className="mt-10 border border-line bg-white p-12 text-center text-sm text-muted">
        {query ? `Nobody matches “${query}”.` : "No customers yet."}
      </p>
    );
  }

  return (
    <>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              {["Customer", "Contact", "Joined", "Orders"].map((head) => (
                <th key={head} className="admin-th pb-3">
                  {head}
                </th>
              ))}
              <th className="admin-th pb-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => {
              const orderCount = customer.orders?.[0]?.count ?? 0;

              return (
                <tr
                  key={customer.id}
                  className="border-b border-line transition-colors hover:bg-frost"
                >
                  {/* The name is the way in, the same way the reference is on
                      the orders table — a book you can only read is half a
                      screen, and the person is what an admin arrives holding. */}
                  <td className="max-w-[16rem] py-3.5 font-medium text-ink">
                    <Link
                      href={`${BASE_PATH}/${customer.id}`}
                      className="block truncate transition-colors hover:text-purple"
                    >
                      {customer.name || customer.email}
                    </Link>
                  </td>
                  <td className="py-3.5">
                    <a
                      href={`mailto:${customer.email}`}
                      className="flex items-center gap-1.5 text-ink-soft transition-colors hover:text-purple"
                    >
                      <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                      <span className="max-w-[14rem] truncate">{customer.email}</span>
                    </a>
                    {customer.phone && (
                      <span className="admin-hint mt-1 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                        {customer.phone}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 text-muted">
                    {new Date(customer.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="py-3.5 tabular-nums text-ink-soft">{orderCount}</td>
                  <td className="py-3.5 text-right">
                    <CustomerRowActions
                      id={customer.id}
                      name={customer.name}
                      email={customer.email}
                      orderCount={orderCount}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath={BASE_PATH}
        total={total}
        page={page}
        perPage={perPage}
        noun="customer"
      />
    </>
  );
}

/* Capped rather than tracking `perPage`: see the note in ProductsTable. */
const SKELETON_ROWS = 10;

function CustomersTableSkeleton() {
  return (
    <>
      <div className="mt-4 border border-line" aria-hidden>
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-soft px-4 py-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-48" />
            <Skeleton className="ml-auto h-3 w-24" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-6 w-8" />
          </div>
        ))}
      </div>
      <PaginationSkeleton />
    </>
  );
}
