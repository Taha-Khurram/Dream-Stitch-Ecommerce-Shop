import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingInstall } from "@/lib/inbox/install";
import {
  isDiscountKind,
  isDiscountOutcome,
  type DiscountKind,
  type DiscountOutcome,
} from "@/lib/discounts/lifecycle";

/**
 * The two SECURITY DEFINER functions from `discount_codes.sql`, wrapped once.
 *
 * Both endpoints that touch a code — the promo field's `/api/discount` and the
 * checkout route that spends it — go through here, so "what does Postgres call
 * this outcome" is answered in one file rather than in two that can drift.
 *
 * The wrappers distinguish three things a caller has to tell apart, and which
 * a bare `.rpc()` flattens into one error object:
 *
 *   * a **verdict** — the code is expired, the bag is too small. Ordinary, and
 *     the caller has something to say about it.
 *   * **not installed** — `discount_codes.sql` has not been run. The request
 *     was fine, the feature is not here, and answering "no such code" would be
 *     a lie that hides a missing migration.
 *   * a **fault** — anything else, which is ours and goes to the log.
 */

export interface DiscountPreview {
  outcome: DiscountOutcome;
  /** Null only on `not_found` — there is no rule to describe. */
  code: string | null;
  kind: DiscountKind | null;
  value: number | null;
  minSubtotal: number | null;
  /** Zero on every outcome but `ok`. */
  amount: number;
}

export type DiscountReply<T> =
  | { status: "ok"; value: T }
  | { status: "not_installed" }
  | { status: "failed"; message: string };

/** One row, whatever the client hands back for a set-returning function. */
function firstRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return (data[0] as Record<string, unknown>) ?? null;
  if (data && typeof data === "object") return data as Record<string, unknown>;
  return null;
}

/**
 * An outcome this build has never heard of means the SQL is ahead of the app.
 * Refusing the code is the safe direction to fail — the alternative is
 * applying a reduction whose reason we cannot name.
 */
function outcomeOf(value: unknown): DiscountOutcome {
  const raw = String(value ?? "");
  if (isDiscountOutcome(raw)) return raw;
  console.warn(`Unrecognised discount outcome: ${raw}`);
  return "not_found";
}

function kindOf(value: unknown): DiscountKind | null {
  const raw = String(value ?? "");
  return isDiscountKind(raw) ? raw : null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** "Is this code any good to me, and for how much?" Never spends it. */
export async function previewDiscount(
  supabase: SupabaseClient,
  code: string,
  subtotal: number
): Promise<DiscountReply<DiscountPreview>> {
  const { data, error } = await supabase.rpc("preview_discount", {
    p_code: code,
    p_subtotal: subtotal,
  });

  if (error) {
    if (isMissingInstall(error)) return { status: "not_installed" };
    console.error("preview_discount failed:", error.message);
    return { status: "failed", message: error.message };
  }

  const row = firstRow(data);

  if (!row) {
    /* A set-returning function that returned nothing at all. Not a shape this
       one can produce — it returns on every path — so it is a fault, not a
       verdict, and it must not read as "your code is fine". */
    console.error("preview_discount returned no row");
    return { status: "failed", message: "The discount service returned nothing." };
  }

  return {
    status: "ok",
    value: {
      outcome: outcomeOf(row.outcome),
      code: row.code ? String(row.code) : null,
      kind: kindOf(row.kind),
      value: numberOrNull(row.value),
      minSubtotal: numberOrNull(row.min_subtotal),
      amount: numberOrNull(row.amount) ?? 0,
    },
  };
}

export interface DiscountRedemption {
  outcome: DiscountOutcome;
  amount: number;
}

/**
 * Spends a code against an order the caller owns, once.
 *
 * The order has to exist first, which is why this runs *after* the insert in
 * the checkout route rather than before it: the ledger row points at an order
 * id, and the UNIQUE on that column is what makes "one code per order" true
 * even for a retried request.
 */
export async function redeemDiscount(
  supabase: SupabaseClient,
  code: string,
  orderId: string,
  subtotal: number
): Promise<DiscountReply<DiscountRedemption>> {
  const { data, error } = await supabase.rpc("redeem_discount", {
    p_code: code,
    p_order_id: orderId,
    p_subtotal: subtotal,
  });

  if (error) {
    if (isMissingInstall(error)) return { status: "not_installed" };
    console.error("redeem_discount failed:", error.message);
    return { status: "failed", message: error.message };
  }

  const row = firstRow(data);

  if (!row) {
    console.error("redeem_discount returned no row");
    return { status: "failed", message: "The discount service returned nothing." };
  }

  return {
    status: "ok",
    value: { outcome: outcomeOf(row.outcome), amount: numberOrNull(row.amount) ?? 0 },
  };
}
