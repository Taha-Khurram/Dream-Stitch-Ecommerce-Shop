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

/** Unit a made-to-measure order was given in. */
export type CustomSizeUnit = "in" | "cm";

/** Dimensions for a set cut to the buyer's own bed. See lib/custom-size.ts. */
export interface CustomSize {
  width: number;
  height: number;
  unit: CustomSizeUnit;
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  /* ── Variant (present once order_item_variants.sql has run) ────────────── */
  /** Bed size ordered, or `CUSTOM_SIZE_LABEL` when cut to measurement. Null on
   *  rows written before the migration — unknown, rather than "no size". */
  size?: string | null;
  custom_width?: number | null;
  custom_height?: number | null;
  custom_unit?: CustomSizeUnit | null;
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

/**
 * A person the store sells to. Mirrors `customers` in `dashboard_schema.sql`.
 *
 * `user_id` is null for a customer who has no login — an imported record, a
 * phone order, or seed data. It is the account link, not the identity: the
 * identity is `email`, which is what the table is unique on.
 */
export interface Customer {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  /** Null once an order can exist without an account — see dashboard_schema.sql. */
  user_id: string | null;
  /** Set by dashboard_schema.sql; null on orders placed before it was applied. */
  customer_id?: string | null;
  /**
   * Where the order sits in its lifecycle. Widened to `string` on purpose:
   * a row written before order_lifecycle.sql ran can still say `completed`,
   * and a screen that renders whatever the database holds is more useful than
   * one that type-errors on history. Writes go through the server actions,
   * which validate against `ORDER_STATUSES` in `lib/orders/lifecycle.ts` —
   * that module, not this one, is the list of statuses.
   */
  status: string;
  /** Net of `discount_amount` — what the customer is actually charged. */
  total_amount: number;
  /* ── Discount (present once discount_codes.sql has run) ────────────────── */
  /** The code spent on this order, or null. Snapshot: the rule may be gone. */
  discount_code?: string | null;
  /** What that code took off. 0 on every order that carried none. */
  discount_amount?: number;
  shipping_address: ShippingAddress;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
  /** Populated only when the query embeds it: `customer:customers(...)`. */
  customer?: Pick<Customer, "id" | "name" | "email"> | null;
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
  /** Chosen bed size, or `CUSTOM_SIZE_LABEL` for a made-to-measure line. */
  size?: string | null;
  /** The buyer's own measurements, when `size` is `CUSTOM_SIZE_LABEL`. */
  custom?: CustomSize | null;
}

export interface CheckoutPayload {
  /** One entry per cart *line*, not per product: two sizes of the same sheet
   *  are two orderable things, and the admin has to be able to tell them
   *  apart on the packing slip. */
  items: {
    productId: string;
    quantity: number;
    size?: string | null;
    custom?: CustomSize | null;
  }[];
  shippingAddress: ShippingAddress;
  /** The code on the bag, if any. Re-checked server-side before it is spent. */
  discountCode?: string | null;
}

export interface CheckoutResponse {
  success: boolean;
  orderId?: string;
  totalAmount?: number;
  discountCode?: string | null;
  discountAmount?: number;
  status?: string;
  message?: string;
  error?: string;
  /** A `DiscountOutcome` when the order was refused over its code. */
  outcome?: string;
  details?: unknown;
}

/**
 * A discount rule. Mirrors `discount_codes` in `discount_codes.sql`.
 *
 * `kind` is widened to `string` for the reason `Order.status` is: a row
 * written by a migration this build has not seen still has to render, and a
 * screen whose job is showing what is there should not type-error on it. The
 * validation lives in `lib/discounts/lifecycle.ts`, which is the list of kinds.
 */
export interface DiscountCode {
  id: string;
  code: string;
  kind: string;
  value: number;
  min_subtotal: number;
  /** Null means unlimited, in both cases. */
  max_uses: number | null;
  per_customer_limit: number | null;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  /** The admin's own note. Never shown to a shopper. */
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * One code, with what it has actually done. Mirrors the return of
 * `admin_discount_usage()` — a rule joined to the ledger it has generated,
 * over all time or over a window.
 */
export interface DiscountUsage {
  id: string;
  code: string;
  kind: string;
  value: number;
  is_active: boolean;
  min_subtotal: number;
  max_uses: number | null;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
  /** Redemptions in the window. */
  uses: number;
  /** Distinct customers behind those redemptions. */
  customers: number;
  /** Money given away. */
  discounted: number;
  /** What the discounted orders came to in total — what the giveaway bought. */
  order_total: number;
  last_used_at: string | null;
}

/**
 * One file in the `product-media` bucket, attached to a product.
 * Mirrors `product_media` in `product_media_schema.sql`.
 *
 * `file_path` is the object key, not a URL — build the URL with the helpers in
 * `lib/supabase/storage.ts` so sizing and caching stay in one place.
 */
export interface ProductMedia {
  id: string;
  product_id: string;
  file_path: string;
  media_type: "image" | "video";
  sort_order: number;
  is_primary: boolean;
  created_at: string;
}

/**
 * A message from the /contact form. Mirrors `contact_messages` in
 * `inbox_schema.sql`.
 *
 * `user_id` is null for the visitor who wrote in signed out, which is most of
 * them — it is the account link, not the identity. `email` is the identity, and
 * it is what a reply goes to.
 *
 * `status` is widened to `string` for the same reason `Order.status` is: the
 * screens render whatever the row holds, and the validation lives in
 * `lib/inbox/lifecycle.ts`, which is the list of statuses.
 */
export interface ContactMessage {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

/**
 * An address on the newsletter list. Mirrors `newsletter_subscribers` in
 * `inbox_schema.sql`.
 *
 * Unsubscribing sets `status` and stamps `unsubscribed_at`; the row stays, so
 * the list doubles as the suppression list.
 */
export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: string;
  /** Where they signed up — see `SUBSCRIBER_SOURCES` in lib/inbox/lifecycle.ts. */
  source: string;
  created_at: string;
  updated_at: string;
  unsubscribed_at: string | null;
}
