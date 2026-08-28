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
  /* ── Apparel attributes (optional: present once clothing_seed.sql has run) ── */
  /** Additional gallery shots, in display order after `image_url`. */
  images?: string[] | null;
  /** Body sizes for stitched pret; omit for unstitched fabric. */
  sizes?: string[] | null;
  /** Colourway names — resolved to hex via `swatchHex()`. */
  colors?: string[] | null;
  /** e.g. "Lawn", "Cambric", "Khaddar", "Organza". */
  fabric?: string | null;
  /** e.g. "3 Piece", "Kurta", "Unstitched Suit". */
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
