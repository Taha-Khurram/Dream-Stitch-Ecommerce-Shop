import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { ProductForm } from "@/components/admin/ProductForm";
import { PRODUCT_COST_EMBED } from "@/lib/admin/cost";
import nextDynamic from "next/dynamic";
import type { Category, Product, ProductMedia } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

/**
 * 826 lines of drag-and-drop, upload pooling, progress and retry state, sitting
 * below the fold behind a deliberate action. It has no business blocking the
 * form above it, so it is fetched once the page is interactive.
 *
 * Imported as `nextDynamic` because `dynamic` is taken by the route segment
 * config directly above.
 */
const ProductMediaUploader = nextDynamic(
  () =>
    import("@/components/admin/ProductMediaUploader").then((m) => m.ProductMediaUploader),
  {
    loading: () => (
      <div className="h-64 animate-pulse border border-line bg-lilac/30" aria-hidden />
    ),
  }
);

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: categories }, { data: media }] = await Promise.all([
    supabase.from("products").select(`*, ${PRODUCT_COST_EMBED}`).eq("id", id).single(),
    supabase.from("categories").select("*").order("name"),
    // Fetched here rather than in the client so the gallery is on screen with
    // the first paint. Missing table (migration not run yet) => no media.
    supabase
      .from("product_media")
      .select("*")
      .eq("product_id", id)
      .order("sort_order"),
  ]);

  if (!product) notFound();

  return (
    <div>
      <AdminHeading
        title={product.name}
        copy="Changes reach the storefront as soon as you save."
        action={
          <div className="flex gap-3">
            <Link href={`/shop/${product.id}`} className="btn-outline">
              View
            </Link>
            <Link href="/admin/products" className="btn-outline">
              Back
            </Link>
          </div>
        }
      />
      <div className="mt-8 max-w-3xl space-y-12">
        <ProductForm
          product={product as Product}
          categories={(categories ?? []) as Category[]}
        />

        <div className="border-t border-line pt-10">
          <ProductMediaUploader
            productId={product.id as string}
            initialMedia={(media ?? []) as ProductMedia[]}
          />
        </div>
      </div>
    </div>
  );
}
