import React from "react";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { ProductBulkActions } from "@/components/admin/ProductBulkActions";
import {
  RowCheckbox,
  SelectAllCheckbox,
  SelectionProvider,
} from "@/components/admin/BulkSelection";
import { Pagination, PaginationSkeleton } from "@/components/admin/Pagination";
import { Skeleton } from "@/components/motion/Skeleton";
import { formatPrice } from "@/lib/format";
import { marginPercent, productCost, PRODUCT_COST_EMBED } from "@/lib/admin/cost";
import { buildPageHref, lastPageFor, rangeFor, type PerPage } from "@/lib/pagination";
import { SEARCH_PARAM } from "@/lib/admin/search";
import type { Product } from "@/types/ecommerce";

/**
 * The catalogue table, behind its own Suspense boundary.
 *
 * This used to pull 200 rows in one go and render 200 full-resolution masters
 * into a 40x48 box. Two changes fix that: the query is a page at a time, and
 * the thumbnails go through next/image so the browser is handed something the
 * size of the box it is being painted into.
 *
 * How big that page is now comes from the URL rather than a constant here, so
 * the window belongs to whoever is reading the list — see lib/pagination.
 */

const BASE_PATH = "/admin/products";

/* Exactly what the table renders, plus the slug — which is not drawn in a cell
   but is the address every row links to. */
const COLUMNS =
  "id, slug, name, price, compare_at_price, stock, image_url, fabric, category:categories(name)";

/* The margin column's half of it. Embedded rather than joined by hand, and
   admin-only by policy — see lib/admin/cost.ts. */
const COLUMNS_WITH_COST = `${COLUMNS}, ${PRODUCT_COST_EMBED}`;

const LOW_STOCK_AT = 5;

/**
 * Where a row points.
 *
 * The slug rather than the id, so the address bar says what the product is and
 * matches the slug that was typed on the form that created it. The product
 * page resolves either, so the id is a fallback rather than a second scheme —
 * it only stands in if a row somehow reached the database without a slug.
 */
const editHref = (product: Product) => `${BASE_PATH}/${product.slug || product.id}`;

/* The thumbnail is 40x48 CSS px. next/image asks the optimiser for the 2x
   variant on its own, so this is all the size information it needs. */
const THUMB_W = 40;
const THUMB_H = 48;

export async function ProductsTable({
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

  /* `count: "exact"` rides along on the same request, so the pager is sized
     without a second round trip. */
  const read = async (columns: string) => {
    let request = supabase
      .from("products")
      .select(columns, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);

    if (query) request = request.ilike("name", `%${query}%`);

    return request;
  };

  let { data, count, error } = await read(COLUMNS_WITH_COST);

  /* The embed is the only part of that query that can fail on a database which
     is otherwise fine — `product_costs` arrives with its own migration, and
     PostgREST refuses the whole request when it cannot find the relationship.
     A catalogue that will not load is a worse outcome than a margin column of
     dashes, so the second attempt drops the cost and keeps the table. */
  if (error) {
    ({ data, count } = await read(COLUMNS));
  }

  const products = (data ?? []) as unknown as Product[];
  const total = count ?? 0;
  const lastPage = lastPageFor(total, perPage);

  /**
   * Asked for a page past the end — a stale bookmark, a hand-edited URL, or
   * rows deleted since the link was made. Land on the last real page instead
   * of an empty table claiming there is no catalogue. Terminates: the page we
   * redirect to exists by definition, since `total > 0`.
   */
  if (products.length === 0 && total > 0 && page > lastPage) {
    const params = new URLSearchParams();
    if (query) params.set(SEARCH_PARAM, query);
    redirect(buildPageHref(BASE_PATH, params, { page: lastPage, perPage }));
  }

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
    /* The provider only knows this page's ids, which is the whole contract: a
       bulk action reaches exactly the rows drawn below it and nothing else. */
    <SelectionProvider ids={products.map((product) => product.id)}>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              <th className="admin-th w-8 pb-3 pr-6">
                <SelectAllCheckbox label="Select every product on this page" />
              </th>
              {/* A gutter on every column but the last. Without it the cells
                  only look separated while their contents happen to be short:
                  a four-digit price runs straight into the stock number. */}
              {["Product", "Category", "Price", "Margin", "Stock", ""].map((head, i, all) => (
                <th key={head} className={`admin-th pb-3 ${i < all.length - 1 ? "pr-6" : ""}`}>
                  {head === "" ? <span className="sr-only">Actions</span> : head}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const soldOut = product.stock <= 0;
              const low = product.stock > 0 && product.stock <= LOW_STOCK_AT;

              /* Null covers both "no cost table" and "nobody has costed this
                 one", and the row treats them the same: there is no margin to
                 show, and the way to change that is the same product page
                 either way. */
              const cost = productCost(product);
              const margin =
                cost === null ? null : marginPercent(Number(product.price), cost);

              return (
                <tr
                  key={product.id}
                  className="border-b border-line align-middle transition-colors hover:bg-frost"
                >
                  <td className="py-3 pr-6">
                    <RowCheckbox id={product.id} label={`Select ${product.name}`} />
                  </td>
                  <td className="py-3 pr-6">
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
                          href={editHref(product)}
                          className="block truncate font-medium text-ink transition-colors hover:text-purple"
                        >
                          {product.name}
                        </Link>
                        <span className="text-[12px] text-muted">{product.fabric}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-6 text-muted">{product.category?.name ?? "—"}</td>
                  <td className="py-3 pr-6 tabular-nums text-ink">
                    {formatPrice(product.price)}
                    {product.compare_at_price &&
                      Number(product.compare_at_price) > Number(product.price) && (
                        <span className="ml-2 text-[12px] text-muted line-through">
                          {formatPrice(product.compare_at_price)}
                        </span>
                      )}
                  </td>
                  {/* Cost sits under the margin rather than in a column of its
                      own: what a set costs is only ever read against what it
                      sells for, and a fifth money column would push the table
                      wider than the screen it is read on. */}
                  <td className="py-3 pr-6">
                    {cost === null ? (
                      <Link
                        href={editHref(product)}
                        className="text-[12px] text-muted underline-offset-4 transition-colors hover:text-purple hover:underline"
                      >
                        Add cost
                      </Link>
                    ) : (
                      <>
                        <span
                          className={`tabular-nums ${
                            margin !== null && margin < 0 ? "text-sale" : "text-ink"
                          }`}
                        >
                          {margin === null ? "—" : `${margin}%`}
                        </span>
                        <span className="admin-hint mt-0.5 block tabular-nums">
                          {formatPrice(cost)} to make
                        </span>
                      </>
                    )}
                  </td>
                  <td className="py-3 pr-6">
                    <span
                      className={`tabular-nums ${
                        soldOut ? "text-sale" : low ? "text-purple" : "text-ink-soft"
                      }`}
                    >
                      {soldOut ? "Sold out" : product.stock}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <ProductRowActions
                      id={product.id}
                      href={editHref(product)}
                      name={product.name}
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
        noun="product"
      />

      {/* Last, so the sticky bar rides the foot of the list rather than
          hovering over the middle of it. */}
      <ProductBulkActions />
    </SelectionProvider>
  );
}

/**
 * Matches the real table's row rhythm so the swap does not jump.
 *
 * The row count is capped rather than tracking `perPage` exactly: at 50 rows a
 * faithful skeleton is several screens of placeholder nobody scrolls to, and
 * the extra nodes are paid for on every single navigation. Ten fills the fold,
 * which is the only part that has to look right.
 */
const SKELETON_ROWS = 10;

export function ProductsTableSkeleton() {
  return (
    <>
      <div className="mt-4 border border-line" aria-hidden>
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-soft px-4 py-4">
            <Skeleton className="h-4 w-4 shrink-0" />
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
      <PaginationSkeleton />
    </>
  );
}
