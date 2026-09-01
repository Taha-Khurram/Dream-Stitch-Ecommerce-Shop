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

      <form className="mt-6 flex items-center gap-3 border-b border-line pb-4" action="/admin/products">
        <Search className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.5} />
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name…"
          aria-label="Search products"
          className="w-full max-w-sm bg-transparent text-[13px] text-ink placeholder-faint focus:outline-none"
        />
        <button type="submit" className="eyebrow link-underline cursor-pointer text-purple">
          Search
        </button>
      </form>

      {products.length === 0 ? (
        <div className="mt-10 border border-line bg-white p-12 text-center">
          <p className="text-[13px] text-muted">
            {q ? `Nothing matches “${q}”.` : "No products yet."}
          </p>
          <Link href="/admin/products/new" className="btn-primary mt-6">
            Add the first one
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink">
                {["Product", "Category", "Price", "Stock", ""].map((head) => (
                  <th key={head} className="eyebrow pb-3 text-ink">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const soldOut = product.stock <= 0;
                const low = product.stock > 0 && product.stock <= 5;

                return (
                  <tr key={product.id} className="border-b border-line align-middle">
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
                          <span className="text-[11px] text-faint">{product.fabric}</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-muted">{product.category?.name ?? "—"}</td>
                    <td className="py-3 tabular-nums text-ink">
                      {formatPrice(product.price)}
                      {product.compare_at_price &&
                        Number(product.compare_at_price) > Number(product.price) && (
                          <span className="ml-2 text-[11px] text-faint line-through">
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
