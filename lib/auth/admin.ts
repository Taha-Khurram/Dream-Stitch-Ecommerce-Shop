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
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, created_at, updated_at")
    .eq("id", user.id)
    .single();

  return (data as Profile) ?? null;
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
