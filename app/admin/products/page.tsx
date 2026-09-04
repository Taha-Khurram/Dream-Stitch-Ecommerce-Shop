import React, { Suspense } from "react";
import Link from "next/link";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { SearchBox } from "@/components/admin/SearchBox";
import { Plus } from "lucide-react";
import { parseWindow } from "@/lib/pagination";
import { ProductsTable, ProductsTableSkeleton } from "./ProductsTable";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string; per?: string }>;
}

/**
 * The shell only. Resolving `searchParams` is a microtask rather than I/O, so
 * everything below reaches the browser before a single row has been queried —
 * the heading, the search box and the New Product button are interactive while
 * Postgres is still working. The table streams in behind the boundary.
 */
export default async function AdminProductsPage({ searchParams }: PageProps) {
  const { q = "", ...paging } = await searchParams;
  const query = q.trim();
  const { page, perPage } = parseWindow(paging);

  return (
    <div>
      <AdminHeading
        title="Products"
        copy="Everything in the catalogue. Prices are what customers pay; stock drives the sold-out state."
        action={
          <Link href="/admin/products/new" className="btn-primary">
            <Plus className="h-3.5 w-3.5" /> New Product
          </Link>
        }
      />

      <SearchBox
        action="/admin/products"
        query={query}
        perPage={perPage}
        placeholder="Search by name…"
        label="Search products"
      />

      {/* Keyed so a new search, page or row count remounts the boundary and
          shows the skeleton again, rather than leaving the previous rows
          sitting there looking like live results. */}
      <Suspense key={`${query}:${page}:${perPage}`} fallback={<ProductsTableSkeleton />}>
        <ProductsTable query={query} page={page} perPage={perPage} />
      </Suspense>
    </div>
  );
}
