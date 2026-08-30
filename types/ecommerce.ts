export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "customer" | "admin";
  created_at: string;
  updated_at: string;
}

/**
 * Single-row configuration table. Mirrors `store_settings` in
 * `admin_schema.sql`; `lib/api/settings.ts` falls back to the compiled-in
 * constants when the migration has not been applied.
 */
export interface StoreSettings {
  brand_email: string | null;
  brand_phone: string | null;
  brand_whatsapp: string | null;
  brand_address: string | null;
  free_shipping_threshold: number;
  shipping_fee: number;
  announcements: string[];
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  is_featured: boolean;
  rating?: number;
  reviews_count?: number;
  /* ── Bedding attributes (optional: present once bedding_seed.sql has run) ── */
  /** Additional gallery shots, in display order after `image_url`. */
  images?: string[] | null;
  /** Bed sizes, e.g. ["Single", "King Size"]; ["Custom Size"] for made-to-order. */
  sizes?: string[] | null;
  /** Colourway names — resolved to hex via `swatchHex()`. */
  colors?: string[] | null;
  /** e.g. "Pure Cotton", "Cotton Zeen", "Cotton Satin". */
  fabric?: string | null;
  /** What the set contains, e.g. "1 bedsheet + 2 pillow covers". */
  pieces?: string | null;
  /** Original price, struck through when higher than `price`. */
  compare_at_price?: number | null;
  created_at: string;
  updated_at: string;
  category?: Category | null;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  product?: Product;
}

export interface ShippingAddress {
  fullName: string;
  email: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface Order {
  id: string;
  user_id: string;
  status: "pending" | "processing" | "completed" | "cancelled";
  total_amount: number;
  shipping_address: ShippingAddress;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface CartItem {
  id: string; // product id
  productId: string;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
  quantity: number;
  maxStock: number;
  categoryName?: string | null;
  /** Chosen variant, carried for display only — checkout aggregates by product. */
  size?: string | null;
  color?: string | null;
}

export interface CheckoutPayload {
  items: {
    productId: string;
    quantity: number;
  }[];
  shippingAddress: ShippingAddress;
}

export interface CheckoutResponse {
  success: boolean;
  orderId?: string;
  totalAmount?: number;
  status?: string;
  message?: string;
  error?: string;
  details?: unknown;
}
