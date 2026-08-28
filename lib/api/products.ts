import { createClient } from "@/lib/supabase/server";
import type { Product, Category } from "@/types/ecommerce";

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

  let queryBuilder = supabase
    .from("products")
    .select("*, category:categories(*)");

  // Filter by category slug if provided
  if (categorySlug && categorySlug !== "all") {
    // Look up category id first to ensure clean query
    const { data: categoryData } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", categorySlug)
      .maybeSingle();

    if (categoryData?.id) {
      queryBuilder = queryBuilder.eq("category_id", categoryData.id);
    }
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
