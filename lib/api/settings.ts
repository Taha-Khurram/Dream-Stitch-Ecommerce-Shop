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
};

export async function getSettings(): Promise<StoreSettings> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("store_settings")
      .select(
        "brand_email, brand_phone, brand_whatsapp, brand_address, free_shipping_threshold, shipping_fee, announcements"
      )
      .eq("id", 1)
      .single();

    if (error || !data) return DEFAULT_SETTINGS;

    return {
      brand_email: data.brand_email || DEFAULT_SETTINGS.brand_email,
      brand_phone: data.brand_phone || DEFAULT_SETTINGS.brand_phone,
      brand_whatsapp: data.brand_whatsapp || DEFAULT_SETTINGS.brand_whatsapp,
      brand_address: data.brand_address || DEFAULT_SETTINGS.brand_address,
      free_shipping_threshold:
        Number(data.free_shipping_threshold) || DEFAULT_SETTINGS.free_shipping_threshold,
      shipping_fee: Number(data.shipping_fee ?? DEFAULT_SETTINGS.shipping_fee),
      announcements: data.announcements?.length
        ? data.announcements
        : DEFAULT_SETTINGS.announcements,
    };
  } catch {
    // Table absent (migration not run) — the storefront still needs to render.
    return DEFAULT_SETTINGS;
  }
}
