import type { Product } from "@/types/ecommerce";
import { DEFAULT_SIZES, UNSTITCHED_SIZES } from "@/lib/constants";

/**
 * The apparel columns are optional (see `clothing_seed.sql`). These helpers give
 * every product a sensible set of gallery shots, sizes and colourways whether or
 * not the migration has been applied, so the UI never renders half-empty.
 */

const FALLBACK_COLORS = ["Ivory", "Clay", "Indigo"];

/** True for unstitched fabric, which is sold by the suit rather than by size. */
export function isUnstitched(product: Product): boolean {
  const slug = product.category?.slug ?? "";
  const pieces = product.pieces?.toLowerCase() ?? "";
  return slug === "fabrics" || pieces.includes("unstitched");
}

export function productSizes(product: Product): string[] {
  if (product.sizes?.length) return product.sizes;
  if (isUnstitched(product)) return UNSTITCHED_SIZES;
  return DEFAULT_SIZES;
}

export function productColors(product: Product): string[] {
  if (product.colors?.length) return product.colors;
  return FALLBACK_COLORS;
}

/** `image_url` first, then any extra gallery shots, de-duplicated. */
export function productImages(product: Product): string[] {
  const all = [product.image_url, ...(product.images ?? [])].filter(
    (src): src is string => Boolean(src)
  );
  return Array.from(new Set(all));
}

/** Second image drives the hover cross-fade on product cards. */
export function hoverImage(product: Product): string | null {
  const images = productImages(product);
  return images[1] ?? null;
}

/** Short descriptor under the product name, e.g. "Lawn · 3 Piece". */
export function productSubtitle(product: Product): string {
  return [product.fabric, product.pieces].filter(Boolean).join(" · ");
}
