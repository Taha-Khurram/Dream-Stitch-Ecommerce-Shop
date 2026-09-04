import React, { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { Skeleton } from "@/components/motion/Skeleton";
import { Mail, Phone } from "lucide-react";
import type { Customer } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

/**
 * The customer book — everyone the store has a record for, whether or not
 * they ever registered an account.
 *
 * Shell only, so the heading paints while the rows are still in flight.
 */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page = "1" } = await searchParams;
  const current = Math.max(1, Number(page) || 1);

  return (
    <div>
      <AdminHeading
        title="Customers"
        copy="Everyone on the books, newest first. Accounts and guest records alike."
      />

      <Suspense key={current} fallback={<CustomersTableSkeleton />}>
        <CustomersTable page={current} />
      </Suspense>
    </div>
  );
}

/** `orders(count)` is a PostgREST aggregate embed — an array of one row. */
type CustomerRow = Customer & { orders?: { count: number }[] };

async function CustomersTable({ page }: { page: number }) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;

  const { data, count, error } = await supabase
    .from("customers")
    .select("id, name, email, phone, created_at, orders(count)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

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
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (customers.length === 0) {
    return (
      <p className="mt-10 border border-line bg-white p-12 text-center text-sm text-muted">
        No customers yet.
      </p>
    );
  }

  return (
    <>
      <p className="admin-hint mt-4 text-right">
        {total} {total === 1 ? "customer" : "customers"}
        {lastPage > 1 && ` · page ${page} of ${lastPage}`}
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              {["Customer", "Contact", "Joined", "Orders"].map((head) => (
                <th key={head} className="admin-th pb-3">
                  {head}
                </th>
              ))}
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
                  <td className="max-w-[16rem] truncate py-3.5 font-medium text-ink">
                    {customer.name}
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && (
        <div className="mt-6 flex items-center justify-between gap-4">
          <PageLink page={page - 1} disabled={page <= 1}>
            Previous
          </PageLink>
          <PageLink page={page + 1} disabled={page >= lastPage}>
            Next
          </PageLink>
        </div>
      )}
    </>
  );
}

function PageLink({
  page,
  disabled,
  children,
}: {
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className="text-[13px] text-faint">{children}</span>;
  }

  return (
    <Link
      href={page <= 1 ? "/admin/customers" : `/admin/customers?page=${page}`}
      className="text-[13px] font-medium text-ink-soft transition-colors hover:text-purple"
    >
      {children}
    </Link>
  );
}

function CustomersTableSkeleton() {
  return (
    <div className="mt-8 border border-line" aria-hidden>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line-soft px-4 py-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-48" />
          <Skeleton className="ml-auto h-3 w-24" />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}
