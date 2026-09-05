import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/constants";
import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "@/lib/pricing";
import type { StoreSettings } from "@/types/ecommerce";

/**
 * The values an admin can change without a deploy.
 *
 * Every read falls back to the compiled-in constants, so the storefront keeps
 * rendering correctly before `admin_schema.sql` has been applied — the same
 * contract `lib/product-attributes.ts` honours for the bedding columns.
 */
export const DEFAULT_SETTINGS: StoreSettings = {
  brand_email: BRAND.email,
  brand_phone: BRAND.phone,
  brand_whatsapp: BRAND.whatsapp,
  brand_address: BRAND.address,
  free_shipping_threshold: FREE_SHIPPING_THRESHOLD,
  shipping_fee: SHIPPING_FEE,
  announcements: [
    "Free delivery on orders above PKR 5,000",
    "Custom sizes made to order — any bed, any drop",
    "Easy 7-day exchange, unused and in original packing",
    "Cash on delivery available nationwide",
  ],
  /* Off, and staying off, unless a row says otherwise: a database this app
     cannot read must never be the reason the shop shows a closed sign. */
  coming_soon_enabled: false,
  coming_soon_launch_at: null,
  coming_soon_heading: "Something beautiful is on its way",
  coming_soon_message:
    "We are putting the final stitches into the new shop. Set your clock — the doors open the moment this timer runs out.",
  coming_soon_note: "",
  coming_soon_cta: "Click anywhere to enter",
};

/** The columns as they exist once `coming_soon.sql` has been applied. */
const COLUMNS =
  "brand_email, brand_phone, brand_whatsapp, brand_address, free_shipping_threshold, " +
  "shipping_fee, announcements, coming_soon_enabled, coming_soon_launch_at, " +
  "coming_soon_heading, coming_soon_message, coming_soon_note, coming_soon_cta";

/**
 * The same list without the holding-page columns.
 *
 * PostgREST fails the *whole* select if one named column is missing, so asking
 * for `coming_soon_enabled` on a database that has not run the migration would
 * not merely lose the switch — it would drop the brand's phone number and
 * delivery rates back to the compiled-in defaults on every page. Retrying with
 * this list costs one extra round trip on exactly those installs, and none on
 * an install that is up to date.
 */
const LEGACY_COLUMNS =
  "brand_email, brand_phone, brand_whatsapp, brand_address, free_shipping_threshold, " +
  "shipping_fee, announcements";

/* Cached per request, matching `getSiteContent()`: the layout and the page
   body both ask for these, and neither should pay for a second round trip. */
export const getSettings = cache(async (): Promise<StoreSettings> => {
  try {
    const supabase = await createClient();

    const read = (columns: string) =>
      supabase.from("store_settings").select(columns).eq("id", 1).single();

    let { data, error } = await read(COLUMNS);
    if (error) ({ data, error } = await read(LEGACY_COLUMNS));

    if (error || !data) return DEFAULT_SETTINGS;

    return merge(data as Partial<StoreSettings>);
  } catch {
    // Table absent (migration not run) — the storefront still needs to render.
    return DEFAULT_SETTINGS;
  }
});

/**
 * A row over the defaults. Missing keys and empty strings both mean "the admin
 * has not set this", so both fall through to the compiled-in value — except
 * the switch and the launch instant, where blank is a real answer.
 */
function merge(row: Partial<StoreSettings>): StoreSettings {
  return {
    brand_email: row.brand_email || DEFAULT_SETTINGS.brand_email,
    brand_phone: row.brand_phone || DEFAULT_SETTINGS.brand_phone,
    brand_whatsapp: row.brand_whatsapp || DEFAULT_SETTINGS.brand_whatsapp,
    brand_address: row.brand_address || DEFAULT_SETTINGS.brand_address,
    free_shipping_threshold:
      Number(row.free_shipping_threshold) || DEFAULT_SETTINGS.free_shipping_threshold,
    shipping_fee: Number(row.shipping_fee ?? DEFAULT_SETTINGS.shipping_fee),
    announcements: row.announcements?.length
      ? row.announcements
      : DEFAULT_SETTINGS.announcements,
    coming_soon_enabled: row.coming_soon_enabled === true,
    coming_soon_launch_at: row.coming_soon_launch_at || null,
    coming_soon_heading: row.coming_soon_heading || DEFAULT_SETTINGS.coming_soon_heading,
    coming_soon_message: row.coming_soon_message || DEFAULT_SETTINGS.coming_soon_message,
    /* Genuinely optional, so an admin who clears it gets an empty line rather
       than the default text reappearing under the clock. */
    coming_soon_note: row.coming_soon_note ?? DEFAULT_SETTINGS.coming_soon_note,
    coming_soon_cta: row.coming_soon_cta || DEFAULT_SETTINGS.coming_soon_cta,
  };
}
