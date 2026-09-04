import { createClient } from "@/lib/supabase/server";
import { isMissingInstall } from "@/lib/inbox/install";
import type { DiscountUsage } from "@/types/ecommerce";

/**
 * Every code, with what it has actually done — one call to
 * `admin_discount_usage()` in `discount_codes.sql`.
 *
 * There is no REST fallback here, and the absence is the point. Elsewhere in
 * the app a missing RPC means the app is ahead of the database on a feature
 * that existed before it — `getSettings()` still has constants to fall back to,
 * the dashboard can still bucket orders by hand. A discount code has no life
 * before its migration: if the function is not there, neither are the tables,
 * and counting redemptions over REST would be counting a table that does not
 * exist. So a missing install is reported as one, and the screens say which
 * file to run.
 *
 * `days` is the window — null for all time, which is what /admin/discounts
 * lists. The dashboard passes the window its range tabs select, so its figures
 * move with the rest of the screen.
 */

export type UsageReply =
  | { status: "ok"; rows: DiscountUsage[] }
  | { status: "not_installed" }
  | { status: "failed"; message: string };

/** NUMERIC and BIGINT arrive as strings over PostgREST. */
function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toLimit(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function readDiscountUsage(days: number | null = null): Promise<UsageReply> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("admin_discount_usage", { p_days: days });

  if (error) {
    if (isMissingInstall(error)) return { status: "not_installed" };
    console.error("admin_discount_usage failed:", error.message);
    return { status: "failed", message: error.message };
  }

  const rows = (data ?? []) as Record<string, unknown>[];

  return {
    status: "ok",
    rows: rows.map((row) => ({
      id: String(row.id),
      code: String(row.code),
      kind: String(row.kind),
      value: toNumber(row.value),
      is_active: Boolean(row.is_active),
      min_subtotal: toNumber(row.min_subtotal),
      max_uses: toLimit(row.max_uses),
      starts_at: (row.starts_at as string | null) ?? null,
      expires_at: (row.expires_at as string | null) ?? null,
      created_at: String(row.created_at),
      uses: toNumber(row.uses),
      customers: toNumber(row.customers),
      discounted: toNumber(row.discounted),
      order_total: toNumber(row.order_total),
      last_used_at: (row.last_used_at as string | null) ?? null,
    })),
  };
}
