import React, { Suspense } from "react";
import Link from "next/link";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { Plus, Search } from "lucide-react";
import { ProductsTable, ProductsTableSkeleton, PAGE_SIZE } from "./ProductsTable";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

/**
 * The shell only. Resolving `searchParams` is a microtask rather than I/O, so
 * everything below reaches the browser before a single row has been queried —
 * the heading, the search box and the New Product button are interactive while
 * Postgres is still working. The table streams in behind the boundary.
 */
export default async function AdminProductsPage({ searchParams }: PageProps) {
  const { q = "", page = "1" } = await searchParams;
  const query = q.trim();
  const current = Math.max(1, Number(page) || 1);

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

      {/* A plain GET form: no client JavaScript, and every result set stays a
          real URL that can be bookmarked or reloaded. */}
      <form className="mt-6 flex flex-wrap items-center gap-3" action="/admin/products">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            strokeWidth={1.5}
          />
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search by name…"
            aria-label="Search products"
            className="w-full border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-ink transition-colors placeholder-faint hover:border-faint focus:border-purple focus:ring-2 focus:ring-purple/15 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="cursor-pointer border border-line px-4 py-2.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-purple hover:bg-lilac hover:text-purple"
        >
          Search
        </button>
        {query && (
          <Link href="/admin/products" className="text-[13px] text-muted hover:text-purple">
            Clear
          </Link>
        )}
      </form>

      {/* Keyed so a new search or page remounts the boundary and shows the
          skeleton again, rather than leaving the previous rows sitting there
          looking like live results. */}
      <Suspense key={`${query}:${current}`} fallback={<ProductsTableSkeleton />}>
        <ProductsTable query={query} page={current} />
      </Suspense>
    </div>
  );
}
