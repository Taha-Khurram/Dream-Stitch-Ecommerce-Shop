import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/ecommerce";

/**
 * Server-side admin gate.
 *
 * This is belt and braces, not the security boundary. The real boundary is RLS
 * in `admin_schema.sql`: `is_admin()` guards every write policy, so a forged
 * session that slipped past this check would still be rejected by Postgres.
 * What this buys is a clean redirect instead of a wall of empty tables.
 *
 * Cached per request. `isAdmin()` from the site layout and `requireAdmin()`
 * from the admin layout both land here, and without this each one paid for
 * its own round trip to GoTrue plus its own `profiles` read — four calls to
 * answer one question. Same contract as `getSiteContent()`.
 */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at, updated_at")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
});

/** The signed-in GoTrue user, cached so the reads below share one round trip. */
const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/** What the storefront chrome needs: who is signed in, and may they see /admin. */
export interface Account {
  email: string | null;
  isAdmin: boolean;
}

/**
 * Who is signed in — answered from the *session*, not from the `profiles` row.
 *
 * The two are not the same thing, and treating them as one is what put the
 * shop into a sign-in loop: a Google account created before
 * `on_auth_user_created` existed held a perfectly valid session with no
 * profile row behind it, `getProfile()` answered null, and the header drew
 * itself signed-out with a Sign In link. The only move the page offered was to
 * sign in again — which worked, produced another good session, and rendered
 * signed-out again.
 *
 * A missing profile now costs the display name and the admin link, which is
 * all it should ever have cost. `getProfile()` keeps its own contract, because
 * the admin gate genuinely does need the row.
 */
export const getAccount = cache(async (): Promise<Account | null> => {
  const user = await getAuthUser();
  if (!user) return null;

  const profile = await getProfile();

  return {
    email: profile?.email ?? user.email ?? null,
    isAdmin: profile?.role === "admin",
  };
});

export async function isAdmin(): Promise<boolean> {
  const profile = await getProfile();
  return profile?.role === "admin";
}

/** Redirects anyone who is not an admin away from the panel. */
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile();

  if (!profile) {
    redirect("/signin?next=/admin");
  }

  if (profile.role !== "admin") {
    redirect("/?denied=admin");
  }

  return profile;
}
