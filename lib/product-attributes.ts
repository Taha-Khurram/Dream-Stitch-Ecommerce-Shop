import type { Product } from "@/types/ecommerce";
import { DEFAULT_SIZES, CUSTOM_SIZES } from "@/lib/constants";

/**
 * The bedding columns are optional (see `bedding_seed.sql`). These helpers give
 * every product a sensible set of gallery shots, bed sizes and colourways
 * whether or not the migration has been applied, so the UI never renders
 * half-empty.
 */

const FALLBACK_COLORS = ["White", "Lilac", "Charcoal"];

/**
 * True for sets we cut to the customer's own measurements rather than to a
 * stocked size run — the Custom Demand service.
 */
export function isMadeToOrder(product: Product): boolean {
  const pieces = product.pieces?.toLowerCase() ?? "";
  if (pieces.includes("made to order") || pieces.includes("custom")) return true;

  const sizes = product.sizes ?? [];
  return sizes.length > 0 && sizes.every((size) => size.toLowerCase().includes("custom"));
}

export function productSizes(product: Product): string[] {
  if (product.sizes?.length) return product.sizes;
  if (isMadeToOrder(product)) return CUSTOM_SIZES;
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

/** Short descriptor under the product name, e.g. "Pure Cotton · 3 Piece". */
export function productSubtitle(product: Product): string {
  return [product.fabric, product.pieces].filter(Boolean).join(" · ");
}
