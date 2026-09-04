import React, { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { CategoryEditor } from "@/components/admin/CategoryEditor";
import { Pagination, PaginationSkeleton } from "@/components/admin/Pagination";
import { Skeleton } from "@/components/motion/Skeleton";
import { buildPageHref, lastPageFor, parseWindow, rangeFor, type PerPage } from "@/lib/pagination";
import type { Category } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/categories";

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; per?: string }>;
}) {
  const { page, perPage } = parseWindow(await searchParams);

  return (
    <div>
      <AdminHeading
        title="Categories"
        copy="These are the fabrics. They drive the shop filter rail, the homepage tiles and the Shop menu."
      />

      <div className="mt-8">
        <Suspense key={`${page}:${perPage}`} fallback={<CategoriesSkeleton />}>
          <Categories page={page} perPage={perPage} />
        </Suspense>
      </div>
    </div>
  );
}

/** A category row as it comes back, with its product tally embedded. */
type CategoryRow = Category & { product_count: { count: number }[] | null };

async function Categories({ page, perPage }: { page: number; perPage: PerPage }) {
  const supabase = await createClient();
  const { from, to } = rangeFor(page, perPage);

  /* One request, counted in Postgres. This used to be two: a `select("*")` on
     categories plus a `select("category_id")` over the ENTIRE products table,
     tallied row by row in JavaScript — an unbounded transfer to produce four
     integers. PostgREST's embedded aggregate does it in the database.

     The outer `count: "exact"` is a second tally on the same request — the
     number of categories, for the pager — and rides along free. */
  const { data, count } = await supabase
    .from("categories")
    .select("*, product_count:products(count)", { count: "exact" })
    .order("name")
    .range(from, to);

  const rows = (data ?? []) as unknown as CategoryRow[];
  const total = count ?? 0;
  const lastPage = lastPageFor(total, perPage);

  if (rows.length === 0 && total > 0 && page > lastPage) {
    redirect(buildPageHref(BASE_PATH, undefined, { page: lastPage, perPage }));
  }

  const counts = Object.fromEntries(
    rows.map((row) => [row.id, row.product_count?.[0]?.count ?? 0])
  );

  return (
    <>
      <CategoryEditor
        categories={rows.map(({ product_count: _count, ...category }) => category) as Category[]}
        counts={counts}
      />

      {/* Three fabrics fit on any page size, so this is usually just the row
          count — but the list grows with the catalogue, and a pager that only
          appears once the screen is already unwieldy is a pager nobody trusts. */}
      <Pagination
        basePath={BASE_PATH}
        total={total}
        page={page}
        perPage={perPage}
        noun="category"
        plural="categories"
      />
    </>
  );
}

function CategoriesSkeleton() {
  return (
    <>
      <div className="space-y-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-line p-5">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="mt-3 h-2.5 w-24" />
          </div>
        ))}
      </div>
      <PaginationSkeleton />
    </>
  );
}
