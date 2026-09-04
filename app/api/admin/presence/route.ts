import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/api";
import { LIVE_WINDOW_SECONDS, type LiveVisitors } from "@/lib/presence";

export const dynamic = "force-dynamic";

/**
 * How many people are on the storefront right now.
 *
 * A route handler rather than part of the dashboard's server render, because
 * the tile refreshes on its own: `router.refresh()` every fifteen seconds
 * would re-run the revenue series, the low-stock list and the recent orders
 * to update one number. This is the one number.
 *
 * Admin-gated here *and* inside `admin_live_visitors()`, which returns zero
 * rows to a non-admin. The RLS-level gate is the real one; this exists to
 * answer a fetch with an honest status instead of an empty body.
 */
export async function GET() {
  const auth = await requireAdminUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .rpc("admin_live_visitors", { p_window_seconds: LIVE_WINDOW_SECONDS })
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { success: false, error: "Presence is not installed. Run presence_schema.sql." },
      { status: 501, headers: { "Cache-Control": "no-store" } }
    );
  }

  /* Zero rows means the admin gate inside the function said no — which this
     handler has already ruled out — or the table is empty. Either way, nobody
     is live, and that is a legitimate answer rather than an error. */
  const row = (data ?? {}) as Record<string, number | string | null>;

  const live: LiveVisitors = {
    total: Number(row.total ?? 0),
    signedIn: Number(row.signed_in ?? 0),
    guests: Number(row.guests ?? 0),
  };

  return NextResponse.json(
    { success: true, live },
    { headers: { "Cache-Control": "no-store" } }
  );
}
