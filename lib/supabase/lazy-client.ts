/**
 * On-demand browser Supabase client. Browser only.
 *
 * `@supabase/supabase-js` is 53 kB gzipped and drags in a realtime WebSocket
 * client this app never opens. The admin forms need it for exactly two things
 * — reading the caller's access token before an upload, and deleting an object
 * afterwards — and both are deliberate user actions, not page load.
 *
 * So it is imported when one of those happens rather than bundled into every
 * admin route that can accept a file. By the time the browser has fetched this
 * the user has only just let go of a file that is about to take far longer to
 * upload than the library took to arrive.
 *
 * Same reasoning as the `tus-js-client` import in ./media-upload.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/* `createBrowserClient` is itself a singleton, so this only avoids repeating
   the dynamic import's promise plumbing. */
let pending: Promise<SupabaseClient> | null = null;

export function browserClient(): Promise<SupabaseClient> {
  pending ??= import("./client").then((m) => m.createClient());
  return pending;
}

/**
 * The caller's own access token. Uploads run as that user, so RLS in
 * `product_media_schema.sql` is the enforcement point.
 */
export async function accessToken(): Promise<string | null> {
  const supabase = await browserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}
