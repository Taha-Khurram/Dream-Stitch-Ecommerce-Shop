import React from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { Skeleton } from "@/components/motion/Skeleton";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/types/ecommerce";

/**
 * The catalogue table, behind its own Suspense boundary.
 *
 * This used to pull 200 rows in one go and render 200 full-resolution masters
 * into a 40x48 box. Two changes fix that: the query is a page at a time, and
 * the thumbnails go through next/image so the browser is handed something the
 * size of the box it is being painted into.
 */

export const PAGE_SIZE = 25;

/* Exactly what the table renders. `slug` was being fetched and never read. */
const COLUMNS =
  "id, name, price, compare_at_price, stock, image_url, fabric, category:categories(name)";

const LOW_STOCK_AT = 5;

/* The thumbnail is 40x48 CSS px. next/image asks the optimiser for the 2x
   variant on its own, so this is all the size information it needs. */
const THUMB_W = 40;
const THUMB_H = 48;

export async function ProductsTable({ query, page }: { query: string; page: number }) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;

  /* `count: "exact"` rides along on the same request, so the pager is sized
     without a second round trip. */
  let request = supabase
    .from("products")
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (query) request = request.ilike("name", `%${query}%`);

  const { data, count } = await request;
  const products = (data ?? []) as unknown as Product[];
  const total = count ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (products.length === 0) {
    return (
      <div className="mt-10 border border-line bg-white p-12 text-center">
        <p className="text-sm text-muted">
          {query ? `Nothing matches “${query}”.` : "No products yet."}
        </p>
        <Link href="/admin/products/new" className="btn-primary mt-6">
          Add the first one
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="admin-hint mt-4 text-right">
        {total} {total === 1 ? "product" : "products"}
        {lastPage > 1 && ` · page ${page} of ${lastPage}`}
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[46rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              {["Product", "Category", "Price", "Stock", ""].map((head) => (
                <th key={head} className="admin-th pb-3">
                  {head === "" ? <span className="sr-only">Actions</span> : head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const soldOut = product.stock <= 0;
              const low = product.stock > 0 && product.stock <= LOW_STOCK_AT;

              return (
                <tr
                  key={product.id}
                  className="border-b border-line align-middle transition-colors hover:bg-frost"
                >
                  <td className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-10 shrink-0 overflow-hidden bg-lilac">
                        {product.image_url && (
                          <Image
                            src={product.image_url}
                            alt=""
                            width={THUMB_W}
                            height={THUMB_H}
                            sizes="40px"
                            className="h-full w-full object-cover object-center"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/products/${product.id}`}
                          className="block truncate font-medium text-ink transition-colors hover:text-purple"
                        >
                          {product.name}
                        </Link>
                        <span className="text-[12px] text-muted">{product.fabric}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 text-muted">{product.category?.name ?? "—"}</td>
                  <td className="py-3 tabular-nums text-ink">
                    {formatPrice(product.price)}
                    {product.compare_at_price &&
                      Number(product.compare_at_price) > Number(product.price) && (
                        <span className="ml-2 text-[12px] text-muted line-through">
                          {formatPrice(product.compare_at_price)}
                        </span>
                      )}
                  </td>
                  <td className="py-3">
                    <span
                      className={`tabular-nums ${
                        soldOut ? "text-sale" : low ? "text-purple" : "text-ink-soft"
                      }`}
                    >
                      {soldOut ? "Sold out" : product.stock}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <ProductRowActions id={product.id} name={product.name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {lastPage > 1 && <Pager query={query} page={page} lastPage={lastPage} />}
    </>
  );
}

/** Plain links, so paging costs no client JavaScript and each page is a URL. */
function Pager({ query, page, lastPage }: { query: string; page: number; lastPage: number }) {
  const href = (n: number) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (n > 1) params.set("page", String(n));
    const search = params.toString();
    return search ? `/admin/products?${search}` : "/admin/products";
  };

  const step =
    "border border-line px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-purple hover:bg-lilac hover:text-purple";

  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
      {page > 1 ? (
        <Link href={href(page - 1)} className={step} rel="prev">
          Previous
        </Link>
      ) : (
        <span aria-hidden />
      )}
      {page < lastPage && (
        <Link href={href(page + 1)} className={`${step} ml-auto`} rel="next">
          Next
        </Link>
      )}
    </nav>
  );
}

/** Matches the real table's row rhythm so the swap does not jump. */
export function ProductsTableSkeleton() {
  return (
    <div className="mt-6 border border-line" aria-hidden>
      {Array.from({ length: PAGE_SIZE }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-line-soft px-4 py-4">
          <Skeleton className="h-12 w-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="mt-2 h-2.5 w-20" />
          </div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  );
}
