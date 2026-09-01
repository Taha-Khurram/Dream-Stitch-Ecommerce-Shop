import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { ProductRowActions } from "@/components/admin/ProductRowActions";
import { formatPrice } from "@/lib/format";
import { Plus, Search } from "lucide-react";
import type { Product } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminProductsPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("products")
    .select("id, name, slug, price, compare_at_price, stock, image_url, fabric, category:categories(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  if (q?.trim()) query = query.ilike("name", `%${q.trim()}%`);

  const { data } = await query;
  const products = (data ?? []) as unknown as Product[];

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

      <form className="mt-6 flex flex-wrap items-center gap-3" action="/admin/products">
        <div className="relative w-full max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            strokeWidth={1.5}
          />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
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
        {q?.trim() && (
          <Link href="/admin/products" className="text-[13px] text-muted hover:text-purple">
            Clear
          </Link>
        )}
        <p className="admin-hint ml-auto">
          {products.length} {products.length === 1 ? "product" : "products"}
        </p>
      </form>

      {products.length === 0 ? (
        <div className="mt-10 border border-line bg-white p-12 text-center">
          <p className="text-sm text-muted">
            {q ? `Nothing matches “${q}”.` : "No products yet."}
          </p>
          <Link href="/admin/products/new" className="btn-primary mt-6">
            Add the first one
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
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
                const low = product.stock > 0 && product.stock <= 5;

                return (
                  <tr key={product.id} className="border-b border-line align-middle transition-colors hover:bg-frost">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-10 shrink-0 overflow-hidden bg-lilac">
                          {product.image_url && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={product.image_url}
                              alt=""
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
      )}
    </div>
  );
}
