import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Product, Category } from "@/types/ecommerce";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Whether a URL segment could be a product id at all.
 *
 * `products.id` is a uuid column, so asking for a slug by id is not a miss —
 * PostgREST refuses the request outright. Anywhere a route segment might be
 * either has to make this check before it reaches for the id.
 */
export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export interface GetProductsOptions {
  categorySlug?: string;
  query?: string;
  featured?: boolean;
  /** Inclusive lower bound on price, in store currency. */
  minPrice?: number;
  /** Exclusive upper bound on price, in store currency. */
  maxPrice?: number;
  limit?: number;
  offset?: number;
  sortBy?: "newest" | "price-asc" | "price-desc" | "rating";
}

/**
 * Fetch product listings from Supabase with joined category data,
 * supporting filtering by category slug, full text search, featured flag, and sorting.
 */
export async function getProducts(options: GetProductsOptions = {}): Promise<Product[]> {
  const {
    categorySlug,
    query,
    featured,
    minPrice,
    maxPrice,
    limit = 50,
    offset = 0,
    sortBy = "newest",
  } = options;

  const supabase = await createClient();

  /* Filtering by category used to cost two sequential round trips: resolve the
     slug to an id, wait, then query products. `!inner` turns the embed into an
     inner join, so the slug filters the products in the same request. */
  const filterByCategory = Boolean(categorySlug && categorySlug !== "all");

  let queryBuilder = supabase
    .from("products")
    .select(filterByCategory ? "*, category:categories!inner(*)" : "*, category:categories(*)");

  if (filterByCategory) {
    queryBuilder = queryBuilder.eq("categories.slug", categorySlug!);
  }

  // Filter by featured status
  if (featured !== undefined) {
    queryBuilder = queryBuilder.eq("is_featured", featured);
  }

  // Filter by price band
  if (typeof minPrice === "number") {
    queryBuilder = queryBuilder.gte("price", minPrice);
  }
  if (typeof maxPrice === "number") {
    queryBuilder = queryBuilder.lt("price", maxPrice);
  }

  // Filter by search term in product name or description
  if (query && query.trim().length > 0) {
    const sanitized = query.trim();
    queryBuilder = queryBuilder.or(`name.ilike.%${sanitized}%,description.ilike.%${sanitized}%`);
  }

  // Sorting
  switch (sortBy) {
    case "price-asc":
      queryBuilder = queryBuilder.order("price", { ascending: true });
      break;
    case "price-desc":
      queryBuilder = queryBuilder.order("price", { ascending: false });
      break;
    case "rating":
      queryBuilder = queryBuilder.order("rating", { ascending: false });
      break;
    case "newest":
    default:
      queryBuilder = queryBuilder.order("created_at", { ascending: false });
      break;
  }

  // Pagination
  if (limit) {
    queryBuilder = queryBuilder.range(offset, offset + limit - 1);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error("Error fetching products from Supabase:", error.message);
    return [];
  }

  // Cast and transform data ensuring category is properly formatted
  return (data as unknown as Product[]) || [];
}

/**
 * Fetch a single product by its UUID.
 */
export async function getProductById(id: string): Promise<Product | null> {
  if (!id) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching product by ID (${id}):`, error.message);
    return null;
  }

  return (data as unknown as Product) || null;
}

/**
 * Fetch a single product by its unique slug.
 */
export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!slug) return null;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error(`Error fetching product by slug (${slug}):`, error.message);
    return null;
  }

  return (data as unknown as Product) || null;
}

/**
 * The product behind a `/shop/[id]` URL, which carries either its uuid or its
 * slug.
 *
 * Cached for the length of the request, because the page asks for it twice —
 * once in `generateMetadata`, once in the body — and each ask used to try the
 * id first and then the slug regardless. Four round trips for one row, four
 * chances for a dropped connection to 404 a page that exists, and on a slug
 * URL two of them were guaranteed to fail: `id` is a uuid column, so handing
 * it a slug is a type error rather than a miss. One shape can match, so only
 * that one is tried.
 */
export const getProductByIdOrSlug = cache(
  async (idOrSlug: string): Promise<Product | null> => {
    if (!idOrSlug) return null;

    if (UUID_PATTERN.test(idOrSlug)) {
      const byId = await getProductById(idOrSlug);
      // Nothing stops a slug from being uuid-shaped, so a miss still falls
      // through — it just costs a query on the 404 path rather than every page.
      if (byId) return byId;
    }

    return getProductBySlug(idOrSlug);
  }
);

/**
 * Fetch a set of products by id, returned in the order the ids were given.
 *
 * The wishlist lives in the browser, so it arrives as a bare list of ids with
 * no ordering the database knows about — the caller's order is the one the
 * shopper saved in, and it is restored here rather than in the component.
 */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  // `id` is a uuid column, so a single malformed id from a stale browser store
  // would fail the whole query rather than just being absent from the results.
  const unique = Array.from(new Set(ids.filter((id) => UUID_PATTERN.test(id))));
  if (unique.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*, category:categories(*)")
    .in("id", unique);

  if (error) {
    console.error("Error fetching products by id:", error.message);
    return [];
  }

  const byId = new Map((data as unknown as Product[]).map((product) => [product.id, product]));
  return unique
    .map((id) => byId.get(id))
    .filter((product): product is Product => Boolean(product));
}

/**
 * Fetch all product categories.
 */
export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching categories from Supabase:", error.message);
    return [];
  }

  return (data as Category[]) || [];
}

/**
 * Fetch featured products for showcases and landing sections.
 */
export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  return getProducts({ featured: true, limit });
}
