/**
 * The service-role Supabase client. **Bypasses RLS entirely.**
 *
 * Importing this into a Client Component leaks `SUPABASE_SERVICE_ROLE_KEY` into
 * the browser bundle and hands every visitor unrestricted read/write on every
 * table. `server-only` turns that mistake into a build error rather than an
 * incident; do not remove it.
 *
 * Why it is needed at all: the email path reads an order together with its
 * customer record, and `customers` is admin-only (see dashboard_schema.sql).
 * A webhook has no session to read it with, and post-response email delivery
 * outlives the request whose cookies would have carried one — so both run as
 * the service role and are responsible for their own authorisation.
 *
 * Not `createClient` from @supabase/supabase-js, and not the cookie-backed
 * client in ./server.ts: `createServerClient` with a no-op cookie adapter is
 * the @supabase/ssr-native way to get a session-less client. The adapter must
 * stay inert — reading cookies here would let a caller's session silently
 * override the service role.
 */

import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resilientFetch } from "@/lib/supabase/fetch";

/** One per server process. The client is stateless without a cookie store. */
let instance: SupabaseClient | null = null;

export function createServiceClient(): SupabaseClient {
  if (instance) return instance;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  instance = createServerClient(url, key, {
    // A dropped connection must not read as an empty table. See fetch.ts.
    global: { fetch: resilientFetch },
    auth: {
      // No session to persist or refresh, and nothing to refresh it from.
      persistSession: false,
      autoRefreshToken: false,
    },
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });

  return instance;
}
