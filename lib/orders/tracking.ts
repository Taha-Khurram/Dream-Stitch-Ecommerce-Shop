import type { SupabaseClient } from "@supabase/supabase-js";
import type { Order } from "@/types/ecommerce";
import { CUSTOMER_STATUS_COPY, customerStatusLabel, type OrderStatus } from "@/lib/orders/lifecycle";
import { selectOrderColumns } from "@/lib/orders/columns";

/**
 * Order tracking, as the person who placed the order experiences it.
 *
 * `lib/orders/lifecycle.ts` owns what an order *is* — the six statuses and the
 * words for them. This file owns the two things tracking adds on top:
 *
 *   1. **Finding the order from what the customer actually has.** Nobody keeps
 *      a UUID. What they were given is the short reference the confirmation
 *      panel printed — `#3F9A21C4`, the first eight characters — so that, and
 *      anything reasonably close to it, has to be enough to find the row.
 *   2. **Saying where it has got to.** The status alone is a word; a journey is
 *      the word plus the ones behind and ahead of it, which is what somebody
 *      checking on a parcel is actually asking about.
 *
 * Nothing here is a security boundary. The reads below are scoped to the
 * caller's own `user_id` and RLS scopes them again — see the SELECT policy on
 * `orders` in `ecommerce_schema.sql`. A reference is a convenience, not a
 * credential: it is eight hex characters and it is printed in the box.
 */

/** The query-string field the track page reads its reference from. */
export const TRACKING_PARAM = "order";

/**
 * Shortest fragment that will be looked up.
 *
 * The reference is eight characters, so six is two typos of slack. Below that
 * the range below stops being a lookup and starts being a list.
 */
const MIN_REFERENCE_LENGTH = 6;

/** Why a reference could not be used, in the order the page checks them. */
export type ReferenceProblem = "empty" | "malformed" | "too_short";

export type ParsedReference =
  | { ok: true; hex: string }
  | { ok: false; problem: ReferenceProblem };

/**
 * What the customer typed, reduced to the hex an order id is made of.
 *
 * Forgiving on purpose about everything that is decoration rather than data:
 * the leading `#` the reference is always printed with, the case it is printed
 * in, the spaces a paste picks up, and the dashes of a full UUID for the rare
 * person who has one. What is left has to be hex, because that is the only
 * thing an id can be — and a reference that is not hex is a mistake worth
 * naming rather than a lookup worth running.
 */
export function parseOrderReference(raw: string | undefined | null): ParsedReference {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, problem: "empty" };

  const hex = trimmed.replace(/^#/, "").replace(/[\s-]/g, "").toLowerCase();

  if (!/^[0-9a-f]{1,32}$/.test(hex)) return { ok: false, problem: "malformed" };
  if (hex.length < MIN_REFERENCE_LENGTH) return { ok: false, problem: "too_short" };

  return { ok: true, hex };
}

/** What to tell someone whose reference could not be used. */
export const REFERENCE_PROBLEM_COPY: Record<ReferenceProblem, string> = {
  empty: "Enter the order number from your confirmation.",
  malformed:
    "An order number is made up of numbers and the letters A–F, like 3F9A21C4. Check your confirmation and try again.",
  too_short: `Enter at least ${MIN_REFERENCE_LENGTH} characters of the order number.`,
};

/**
 * The span of order ids a partial reference covers.
 *
 * Postgres compares `uuid` by its bytes, so a prefix is a contiguous range:
 * every id beginning `3f9a21c4` sits between that prefix padded with zeroes and
 * the same prefix padded with `f`. That turns "starts with" — which PostgREST
 * cannot express against a uuid column, since `LIKE` has no operator for one —
 * into two comparisons the primary key index answers directly.
 *
 * A full 32-character reference pads to nothing and the range collapses to a
 * single id, so both cases go down one code path.
 */
export function orderIdRange(hex: string): { from: string; to: string } {
  return { from: asUuid(hex.padEnd(32, "0")), to: asUuid(hex.padEnd(32, "f")) };
}

function asUuid(hex32: string): string {
  return [
    hex32.slice(0, 8),
    hex32.slice(8, 12),
    hex32.slice(12, 16),
    hex32.slice(16, 20),
    hex32.slice(20, 32),
  ].join("-");
}

/* ── The read ──────────────────────────────────────────────────────────── */

const ORDER_COLUMNS = "id, status, total_amount, created_at, updated_at, shipping_address";

/** Carries `slug` and `image_url` beyond what the printable documents need:
 *  this is a screen, and every line on it is a set the customer can go back
 *  and look at. */
const ITEMS_EMBED =
  "order_items(id, product_id, quantity, unit_price, size, custom_width, custom_height, custom_unit, " +
  "product:products(id, name, slug, image_url, fabric, pieces))";

export type TrackedOrder =
  | { status: "found"; order: Order }
  | { status: "not_found" }
  /** More than one of the customer's own orders starts with what they typed. */
  | { status: "ambiguous" }
  | { status: "failed" };

/**
 * One of this customer's orders, found from a whole or partial reference.
 *
 * Two round trips rather than one, and the split is what keeps the second read
 * safe: the id is resolved first from a query scoped to `user_id`, so the
 * document read that follows can only ever be handed an id this customer owns.
 * Both are primary-key lookups, so the cost of the pair is not the point.
 *
 * `ambiguous` is close to impossible — it needs two of one customer's own
 * orders to share the first eight characters of a v4 UUID — but a customer who
 * typed six characters can reach it, and answering "not found" to a reference
 * that matched twice would be a lie.
 */
export async function findTrackedOrder(
  supabase: SupabaseClient,
  userId: string,
  hex: string
): Promise<TrackedOrder> {
  const { from, to } = orderIdRange(hex);

  const { data: matches, error } = await supabase
    .from("orders")
    .select("id")
    .eq("user_id", userId)
    .gte("id", from)
    .lte("id", to)
    .limit(2);

  if (error) {
    console.error("Order tracking lookup failed: %s", error.message);
    return { status: "failed" };
  }

  if (!matches?.length) return { status: "not_found" };
  if (matches.length > 1) return { status: "ambiguous" };

  const order = await readTrackedOrder(supabase, matches[0].id as string);
  return order ? { status: "found", order } : { status: "not_found" };
}

/**
 * The order and everything the tracking screen renders off it.
 *
 * The discount and payment columns each arrive with a migration of their own,
 * and PostgREST rejects the whole select if one is unknown rather than
 * returning it as null — so `selectOrderColumns` asks for the most complete set
 * this database will answer. Same contract as `lib/admin/order-document.ts` and
 * the admin order screen.
 */
async function readTrackedOrder(supabase: SupabaseClient, id: string): Promise<Order | null> {
  const { data } = await selectOrderColumns((extra) =>
    supabase
      .from("orders")
      .select(`${ORDER_COLUMNS}${extra}, ${ITEMS_EMBED}`)
      .eq("id", id)
      .single()
  );

  return (data as unknown as Order) ?? null;
}

/** The header line of one of the customer's own recent orders. */
export interface OrderSummary {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
}

/**
 * The customer's latest orders, so the page can offer them the reference
 * rather than asking them to remember it.
 *
 * Capped rather than paginated: this is a shortcut past typing eight
 * characters, not an order history. Anything older is still trackable — by its
 * reference, which is what the page is for.
 */
export async function readRecentOrders(
  supabase: SupabaseClient,
  userId: string,
  limit = 5
): Promise<OrderSummary[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, total_amount, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Recent orders read failed: %s", error.message);
    return [];
  }

  return (data as OrderSummary[]) ?? [];
}

/* ── The journey ───────────────────────────────────────────────────────── */

/**
 * The rail an order travels along, as the customer sees it.
 *
 * Four of the six statuses, in order. The two that are missing are the two
 * that are not places on a journey:
 *
 *   * `pending` is a pause, not a stage. Internally it covers stock, payment
 *     and "waiting on the customer"; from outside it is the order standing
 *     still at wherever it had got to, so it is drawn as a hold on the current
 *     step rather than a step of its own.
 *   * `cancelled` is the journey ending, and a rail that carried it would be
 *     drawing progress towards a delivery that is not coming.
 */
export const TRACKING_STAGES = ["new", "opened", "processing", "closed"] as const;

export type TrackingStage = (typeof TRACKING_STAGES)[number];

/** What each stage means to the person waiting, not to the workroom. */
const STAGE_NOTE: Record<TrackingStage, string> = {
  new: "We have your order and it is with the studio.",
  opened: "Your set is being cut and made up.",
  processing: "Packed and on its way to you.",
  closed: "Delivered. We hope you love it.",
};

export type StepState = "done" | "current" | "upcoming";

export interface TrackingStep {
  stage: TrackingStage;
  label: string;
  note: string;
  state: StepState;
}

export interface TrackingJourney {
  steps: TrackingStep[];
  /** Where the order is, in one line — the status in the customer's words. */
  headline: string;
  /** The journey ended early. Nothing ahead of it will happen. */
  cancelled: boolean;
  /** Standing still at `headline`'s step — see the note on `TRACKING_STAGES`. */
  paused: boolean;
  /** Every stage is behind it. */
  complete: boolean;
}

/**
 * Where a status sits on the rail.
 *
 * `pending` maps to `opened`, which is where an order that has paused had got
 * to. `completed` is the pre-lifecycle spelling of `closed` and maps to it, on
 * the same grounds as `statusLabel()`: history still has to render. Anything
 * else — a status written by a migration this build has not seen — lands at
 * -1, which draws the rail with nothing marked done rather than guessing.
 */
function stageIndex(status: string): number {
  if (status === "pending") return TRACKING_STAGES.indexOf("opened");
  if (status === "completed") return TRACKING_STAGES.indexOf("closed");
  return (TRACKING_STAGES as readonly string[]).indexOf(status);
}

export function trackingJourney(status: string): TrackingJourney {
  const cancelled = status === "cancelled";
  const paused = status === "pending";
  const current = cancelled ? -1 : stageIndex(status);

  /* The last stage is not somewhere an order waits — reaching `closed` *is*
     being delivered. So a finished order ticks its final step rather than
     marking it as the one in progress, which would leave a delivered parcel
     drawn with a spinner against it. */
  const complete = current === TRACKING_STAGES.length - 1;

  const steps = TRACKING_STAGES.map<TrackingStep>((stage, index) => ({
    stage,
    label: CUSTOMER_STATUS_COPY[stage as OrderStatus],
    note: STAGE_NOTE[stage],
    state:
      index < current || (complete && index === current)
        ? "done"
        : index === current
          ? "current"
          : "upcoming",
  }));

  return { steps, headline: customerStatusLabel(status), cancelled, paused, complete };
}
