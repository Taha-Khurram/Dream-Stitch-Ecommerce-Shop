import type { Product, ProductType } from "@/types/ecommerce";
import { DEFAULT_SIZES, CUSTOM_SIZES } from "@/lib/constants";

/**
 * The bedding columns are optional (see `bedding_seed.sql`). These helpers give
 * every product a sensible set of gallery shots and bed sizes whether or not
 * the migration has been applied, so the UI never renders half-empty.
 */

/** The kinds of product the catalogue carries, in the order they are offered. */
export const PRODUCT_TYPES: { value: ProductType; label: string }[] = [
  { value: "bedsheet", label: "Bedsheet" },
  { value: "cushion_cover", label: "Cushion Cover" },
];

export function isProductType(value: unknown): value is ProductType {
  return PRODUCT_TYPES.some((type) => type.value === value);
}

/**
 * What this product is. Anything unmarked — including every row on a database
 * that has not run product_type.sql — is a bedsheet, which is what the whole
 * page assumed before the column existed.
 */
export function productType(product: Product): ProductType {
  return isProductType(product.product_type) ? product.product_type : "bedsheet";
}

export function isCushion(product: Product): boolean {
  return productType(product) === "cushion_cover";
}

export function productTypeLabel(type: ProductType): string {
  return PRODUCT_TYPES.find((each) => each.value === type)?.label ?? type;
}

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

/**
 * The size run to offer. Empty means "one size" — a cushion cover set with no
 * sizes entered is sold as it is, rather than borrowing the bed-size run.
 */
export function productSizes(product: Product): string[] {
  if (product.sizes?.length) return product.sizes;
  if (isMadeToOrder(product)) return CUSTOM_SIZES;
  if (isCushion(product)) return [];
  return DEFAULT_SIZES;
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
