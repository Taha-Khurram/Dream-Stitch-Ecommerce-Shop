import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_CONTENT, type SiteContent } from "@/lib/content/defaults";
import { mergeContent } from "@/lib/content/merge";

/**
 * The editable storefront copy, read from `store_settings.content`.
 *
 * Same contract as `lib/api/settings.ts`: any failure — table absent, column
 * absent, malformed jsonb — falls back to the compiled-in defaults, so the shop
 * renders identically before the migration has been applied.
 *
 * Cached per request because the layout (header and footer) and the page body
 * both need it, and neither should pay for a second round trip.
 */
export const getSiteContent = cache(async (): Promise<SiteContent> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("store_settings")
      .select("content")
      .eq("id", 1)
      .single();

    if (error || !data) return DEFAULT_CONTENT;
    return mergeContent(data.content);
  } catch {
    return DEFAULT_CONTENT;
  }
});
