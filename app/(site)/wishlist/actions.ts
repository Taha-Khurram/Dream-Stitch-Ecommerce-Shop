"use server";

import { getProductsByIds } from "@/lib/api/products";
import type { Product } from "@/types/ecommerce";

/** Hard ceiling on one lookup — the wishlist is a browser list, not a query. */
const MAX_IDS = 100;

/**
 * The wishlist is held in localStorage, so the page can only learn what to show
 * after it mounts. The client hands its ids to this action and gets back live
 * products — prices, stock and imagery stay current instead of being frozen at
 * the moment the heart was pressed.
 */
export async function fetchWishlistProducts(ids: string[]): Promise<Product[]> {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  return getProductsByIds(ids.slice(0, MAX_IDS));
}
