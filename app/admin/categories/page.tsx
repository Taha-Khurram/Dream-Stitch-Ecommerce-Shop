import React, { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { CategoryEditor } from "@/components/admin/CategoryEditor";
import { Skeleton } from "@/components/motion/Skeleton";
import type { Category } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

export default function AdminCategoriesPage() {
  return (
    <div>
      <AdminHeading
        title="Categories"
        copy="These are the fabrics. They drive the shop filter rail, the homepage tiles and the Shop menu."
      />

      <div className="mt-8">
        <Suspense fallback={<CategoriesSkeleton />}>
          <Categories />
        </Suspense>
      </div>
    </div>
  );
}

/** A category row as it comes back, with its product tally embedded. */
type CategoryRow = Category & { product_count: { count: number }[] | null };

async function Categories() {
  const supabase = await createClient();

  /* One request, counted in Postgres. This used to be two: a `select("*")` on
     categories plus a `select("category_id")` over the ENTIRE products table,
     tallied row by row in JavaScript — an unbounded transfer to produce four
     integers. PostgREST's embedded aggregate does it in the database. */
  const { data } = await supabase
    .from("categories")
    .select("*, product_count:products(count)")
    .order("name");

  const rows = (data ?? []) as unknown as CategoryRow[];

  const counts = Object.fromEntries(
    rows.map((row) => [row.id, row.product_count?.[0]?.count ?? 0])
  );

  return (
    <CategoryEditor
      categories={rows.map(({ product_count: _count, ...category }) => category) as Category[]}
      counts={counts}
    />
  );
}

function CategoriesSkeleton() {
  return (
    <div className="space-y-4" aria-hidden>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="border border-line p-5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-2.5 w-24" />
        </div>
      ))}
    </div>
  );
}
