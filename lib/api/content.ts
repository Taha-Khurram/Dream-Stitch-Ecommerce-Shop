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

/**
 * When the editable storefront copy last changed.
 *
 * Exists for `sitemap.xml`. The marketing pages — home, about, contact, custom
 * — have no row of their own to date, but their copy all lives in
 * `store_settings.content`, so this column is the closest thing to an honest
 * "last modified" they have. Honest is the operative word: a sitemap that
 * stamps `new Date()` on every static page claims the whole site changed on
 * every crawl, and Google's documented response is to stop trusting the
 * `lastmod` signal for the site entirely.
 *
 * Null when the column cannot be read, which callers should treat as "unknown"
 * and omit — an absent `lastmod` is a smaller lie than a wrong one.
 */
export const getContentUpdatedAt = cache(async (): Promise<Date | null> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("store_settings")
      .select("updated_at")
      .eq("id", 1)
      .single();

    if (error || !data?.updated_at) return null;

    const stamp = new Date(data.updated_at as string);
    return Number.isNaN(stamp.getTime()) ? null : stamp;
  } catch {
    return null;
  }
});
