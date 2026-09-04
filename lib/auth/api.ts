import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth/admin";
import type { Profile } from "@/types/ecommerce";

/**
 * Authorization guards for route handlers.
 *
 * `requireAdmin()` in ./admin.ts is for *pages*: it redirects, which is the
 * right answer for someone looking at a screen and the wrong one for a fetch —
 * a 302 to an HTML sign-in page makes a JSON client fail somewhere confusing,
 * with a 200 attached. These return a status instead.
 *
 * The shape is a discriminated union rather than a thrown error or a bare
 * `User | null`, so a caller cannot reach the user without having dealt with
 * the failure first:
 *
 *     const auth = await requireUser();
 *     if (!auth.ok) return auth.response;
 *     // auth.user and auth.supabase are now available, and authenticated.
 *
 * None of this replaces RLS, which remains the enforcement point. It gives the
 * caller an honest status code instead of an empty result set.
 */

interface Denied {
  ok: false;
  response: NextResponse;
}

interface Authenticated {
  ok: true;
  user: User;
  supabase: SupabaseClient;
}

interface Authorized extends Authenticated {
  profile: Profile;
}

function deny(status: number, error: string): Denied {
  return {
    ok: false,
    response: NextResponse.json({ success: false, error }, { status }),
  };
}

/** 401 unless a real, unexpired session is attached to the request. */
export async function requireUser(): Promise<Authenticated | Denied> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return deny(401, "Unauthorized. You must be signed in.");
  }

  return { ok: true, user, supabase };
}

/**
 * 401 when signed out, 403 when signed in as someone who is not an admin.
 *
 * The two are kept distinct deliberately: 401 tells a client that signing in
 * would help, 403 tells it that signing in again will not.
 */
export async function requireAdminUser(): Promise<Authorized | Denied> {
  const auth = await requireUser();
  if (!auth.ok) return auth;

  const profile = await getProfile();

  if (!profile || profile.role !== "admin") {
    return deny(403, "Forbidden. This action requires an admin account.");
  }

  return { ...auth, profile };
}
