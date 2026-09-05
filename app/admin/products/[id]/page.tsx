import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { ProductForm } from "@/components/admin/ProductForm";
import { PRODUCT_COST_EMBED } from "@/lib/admin/cost";
import { isUuid } from "@/lib/api/products";
import nextDynamic from "next/dynamic";
import type { Category, Product, ProductMedia } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/* The form edits the whole row, so it asks for the whole row — plus the cost,
   which is not a column on it. See lib/admin/cost.ts. */
const COLUMNS = "*";
const COLUMNS_WITH_COST = `*, ${PRODUCT_COST_EMBED}`;

/**
 * The product this URL names, whether the segment is an id or a slug.
 *
 * Two things it has to survive, and it used to survive neither.
 *
 * The first is `product_costs` not being installed. The embed is a
 * relationship PostgREST refuses the *entire* request over when the migration
 * has not been run, so a page that asked for it in one shot answered 404 for
 * every product in a perfectly healthy catalogue — the list beside it already
 * drops the cost and keeps the rows for exactly this reason, and this now does
 * the same. A missing cost table is a dash in one field, never a missing
 * product.
 *
 * The second is the shape of the segment. The catalogue links by slug, because
 * a slug is what somebody typed on the way in and what they recognise on the
 * way back, but every id-shaped link already sitting in a bookmark, an
 * analytics row or the dashboard still has to land. A uuid is tried as an id
 * and falls through to the slug on a miss, since nothing stops a slug from
 * being uuid-shaped.
 */
async function readProduct(
  supabase: ServerClient,
  idOrSlug: string
): Promise<Product | null> {
  const read = async (columns: string, column: "id" | "slug") => {
    const { data, error } = await supabase
      .from("products")
      .select(columns)
      .eq(column, idOrSlug)
      .maybeSingle();

    return { product: (data as unknown as Product) ?? null, error };
  };

  const attempt = async (column: "id" | "slug") => {
    const { product, error } = await read(COLUMNS_WITH_COST, column);
    if (!error) return product;

    /* The cost embed is the only part of that query that can fail on a
       database which is otherwise fine, so the retry drops it. */
    return (await read(COLUMNS, column)).product;
  };

  if (isUuid(idOrSlug)) {
    const byId = await attempt("id");
    if (byId) return byId;
  }

  return attempt("slug");
}

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

  /* Resolved first, and alone: the segment may be a slug, and the media below
     is keyed by the product's real id rather than by whatever is in the URL. */
  const product = await readProduct(supabase, id);
  if (!product) notFound();

  const [{ data: categories }, { data: media }] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    // Fetched here rather than in the client so the gallery is on screen with
    // the first paint. Missing table (migration not run yet) => no media.
    supabase
      .from("product_media")
      .select("*")
      .eq("product_id", product.id)
      .order("sort_order"),
  ]);

  return (
    <div>
      <AdminHeading
        title={product.name}
        copy="Changes reach the storefront as soon as you save."
        action={
          <div className="flex gap-3">
            {/* The storefront takes either, and the slug is the address a
                shopper would ever be given. */}
            <Link href={`/shop/${product.slug || product.id}`} className="btn-outline">
              View
            </Link>
            <Link href="/admin/products" className="btn-outline">
              Back
            </Link>
          </div>
        }
      />
      <div className="mt-8 max-w-3xl space-y-12">
        <ProductForm product={product} categories={(categories ?? []) as Category[]} />

        <div className="border-t border-line pt-10">
          <ProductMediaUploader
            productId={product.id}
            initialMedia={(media ?? []) as ProductMedia[]}
          />
        </div>
      </div>
    </div>
  );
}
