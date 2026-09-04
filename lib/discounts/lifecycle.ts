import { formatPrice } from "@/lib/format";

/**
 * The discount vocabulary, in one place.
 *
 * A code is a rule — a kind, a value, a minimum, a window, a cap — and every
 * surface that touches one reads its definitions from here: the promo field in
 * the cart drawer, the two route handlers, the admin form and the usage table.
 * Same arrangement as `lib/orders/lifecycle.ts`, and for the same reason: one
 * definition of what a coupon can be, so the storefront and the panel cannot
 * drift apart about it.
 *
 * The important function in this file is `calcDiscountAmount()`. It is the
 * twin of `discount_amount_for()` in `discount_codes.sql`, and the two have to
 * agree exactly — the drawer recomputes the reduction locally as the bag
 * changes, checkout recomputes it in Postgres, and a shopper who is quoted one
 * figure and charged another has been lied to. Changing the rounding here
 * means changing that function too.
 *
 * Mirrors the CHECK constraints on `discount_codes` in `discount_codes.sql`.
 */

export const DISCOUNT_KINDS = ["percent", "fixed"] as const;

export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

export function isDiscountKind(value: string): value is DiscountKind {
  return (DISCOUNT_KINDS as readonly string[]).includes(value);
}

/** What each kind is called, and what its value means, wherever one is offered. */
export const KIND_COPY: Record<DiscountKind, { label: string; note: string }> = {
  percent: { label: "Percentage", note: "A share of the bag, 1–100" },
  fixed: { label: "Fixed amount", note: "A flat sum off, never more than the bag" },
};

/* ── Codes ──────────────────────────────────────────────────────────────── */

/**
 * The shape a code may take: 3–32 of letters, digits, dash and underscore,
 * opening on a letter or digit.
 *
 * Mirrors the CHECK on `discount_codes.code`. Narrow on purpose — a code is
 * read down a phone and typed off a printed card, and every character outside
 * this set is a support email.
 */
export const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;

/**
 * A typed code as it is stored and compared: upper-cased and trimmed.
 *
 * The database enforces the same normalisation on the way in, so `summer24`
 * and `SUMMER24` cannot become two rows. Doing it here as well is what lets a
 * shopper type either one into the drawer and have it work.
 */
export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidCode(raw: string): boolean {
  return CODE_PATTERN.test(normalizeCode(raw));
}

/* ── What a code takes off ──────────────────────────────────────────────── */

/**
 * The reduction a rule makes against a subtotal, in whole currency units.
 *
 * Three things this deliberately does:
 *
 *   * rounds to whole units, because `formatPrice()` renders whole units. A
 *     discount carrying invisible paisa is a total that does not add up on
 *     screen, which is the one arithmetic error a customer always spots.
 *   * clamps to the subtotal, so a PKR 1,000 code against a PKR 400 bag takes
 *     off 400 rather than turning delivery into a refund.
 *   * applies to the subtotal alone. Delivery is never discounted — the free
 *     delivery threshold is the store's lever for that, and stacking the two
 *     would let a large code pay for the courier.
 *
 * Twin of `discount_amount_for()` in `discount_codes.sql`.
 */
export function calcDiscountAmount(
  kind: DiscountKind,
  value: number,
  subtotal: number
): number {
  const base = Math.max(0, subtotal);
  const raw = kind === "percent" ? (base * value) / 100 : value;
  return Math.min(base, Math.round(raw));
}

/** `20% off` / `PKR 500 off` — how a rule reads wherever it is named. */
export function describeDiscount(kind: DiscountKind, value: number): string {
  return kind === "percent" ? `${trimZeros(value)}% off` : `${formatPrice(value)} off`;
}

/** `10.00` → `10`, `12.50` → `12.5`. Percentages are stored NUMERIC(10,2). */
function trimZeros(value: number): string {
  return String(Number(value));
}

/* ── The answer to "can I use this?" ────────────────────────────────────── */

/**
 * Every way `preview_discount()` and `redeem_discount()` can answer.
 *
 * None of these is an error. A mistyped code, a code that ran out, a bag that
 * is PKR 200 short of the minimum — they are the ordinary things that happen
 * at a checkout, and each has something specific to say back. Mirrors the
 * strings both functions return in `discount_codes.sql`.
 */
export const DISCOUNT_OUTCOMES = [
  "ok",
  "not_found",
  "inactive",
  "not_started",
  "expired",
  "exhausted",
  "already_used",
  "below_minimum",
  /* redeem_discount() only — the preview has no order to be wrong about. */
  "already_redeemed",
  "unauthorized",
  "forbidden",
] as const;

export type DiscountOutcome = (typeof DISCOUNT_OUTCOMES)[number];

export function isDiscountOutcome(value: string): value is DiscountOutcome {
  return (DISCOUNT_OUTCOMES as readonly string[]).includes(value);
}

/**
 * What each outcome says to the person who typed the code.
 *
 * `not_found`, `inactive`, `not_started` and `expired` deliberately share one
 * sentence. Telling somebody that a code exists but is paused, or that it
 * starts on Friday, is telling them something about the store's plans that
 * they can act on — and the four are indistinguishable to an honest shopper
 * anyway, who simply has a code that does not work. The panel sees the
 * difference, which is where the difference matters.
 *
 * `below_minimum` is the exception worth spending a branch on: it is the one
 * refusal the shopper can do something about in the next ten seconds.
 */
export function outcomeMessage(
  outcome: DiscountOutcome,
  context: { minSubtotal?: number | null } = {}
): string {
  switch (outcome) {
    case "ok":
      return "Code applied.";
    case "below_minimum":
      return context.minSubtotal
        ? `This code needs a bag of ${formatPrice(context.minSubtotal)} or more.`
        : "Your bag is not large enough for this code yet.";
    case "exhausted":
      return "This code has been fully claimed.";
    case "already_used":
      return "You have already used this code.";
    case "already_redeemed":
      return "This order already has a code on it.";
    case "unauthorized":
      return "Sign in to use a discount code.";
    case "forbidden":
      return "That code could not be applied to this order.";
    default:
      return "That code is not valid.";
  }
}

/* ── A rule the storefront is holding ───────────────────────────────────── */

/**
 * What the storefront keeps once a code has been accepted.
 *
 * Deliberately not the whole row: the cap, the per-customer limit and the
 * dates are the panel's business and none of them is any use to the drawer,
 * which only has to be able to recompute the reduction as the bag changes.
 * `minSubtotal` is here because that is the one rule the cart can break on its
 * own — remove an item and the code has to come off.
 */
export interface AppliedDiscount {
  code: string;
  kind: DiscountKind;
  value: number;
  minSubtotal: number;
}

/** The reduction an applied code makes right now, at this subtotal. */
export function amountOf(discount: AppliedDiscount | null, subtotal: number): number {
  if (!discount) return 0;
  if (subtotal < discount.minSubtotal) return 0;
  return calcDiscountAmount(discount.kind, discount.value, subtotal);
}

/** True once the bag has fallen below what the applied code needs. */
export function hasLapsed(discount: AppliedDiscount | null, subtotal: number): boolean {
  return Boolean(discount) && subtotal < discount!.minSubtotal;
}

/* ── Where a rule stands, for the panel ─────────────────────────────────── */

export const DISCOUNT_STATUSES = ["active", "paused", "scheduled", "expired", "exhausted"] as const;

export type DiscountStatus = (typeof DISCOUNT_STATUSES)[number];

export const DISCOUNT_STATUS_COPY: Record<DiscountStatus, { label: string; note: string }> = {
  active: { label: "Active", note: "Live now, and accepting orders" },
  paused: { label: "Paused", note: "Switched off by hand — the dates are untouched" },
  scheduled: { label: "Scheduled", note: "Starts later, not yet accepted anywhere" },
  expired: { label: "Expired", note: "Past its end date" },
  exhausted: { label: "Fully claimed", note: "Every use has been spent" },
};

/**
 * Where a rule stands, given how many times it has been spent.
 *
 * Order matters, and it is the order a shopper would meet the refusals in:
 * the off switch first (an admin's decision beats every schedule), then the
 * window, then the cap. `preview_discount()` checks them in the same sequence,
 * so what the panel shows is what the storefront will say.
 */
export function discountStatus(
  rule: {
    is_active: boolean;
    starts_at: string | null;
    expires_at: string | null;
    max_uses: number | null;
  },
  uses: number
): DiscountStatus {
  if (!rule.is_active) return "paused";

  const now = Date.now();
  if (rule.starts_at && new Date(rule.starts_at).getTime() > now) return "scheduled";
  if (rule.expires_at && new Date(rule.expires_at).getTime() <= now) return "expired";
  if (rule.max_uses !== null && uses >= rule.max_uses) return "exhausted";

  return "active";
}

/** The one sentence every surface uses to say the migration has not been run. */
export const DISCOUNTS_NOT_INSTALLED =
  "Discount codes are not installed. Run discount_codes.sql in the Supabase SQL editor.";
