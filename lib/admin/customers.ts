/**
 * What one customer amounts to — their orders, their money, their addresses.
 *
 * The customer book is a list of people; this is the arithmetic that turns a
 * row of it into a page. It lives here rather than in the detail screen so the
 * definition of "this person's orders" has exactly one home: the moment a
 * second caller needs it — an export, a tile on the dashboard, a merge tool —
 * the two must not be allowed to disagree about who a given order belongs to.
 *
 * Money follows `lib/orders/lifecycle.ts`, not a rule of its own. Lifetime
 * value counts fulfilled orders and nothing else, for the same reason the
 * dashboard does (see `revenue_recognition.sql`): an order still in the
 * workflow can be cancelled, and a lifetime figure that falls is not a
 * lifetime figure.
 */

import { OPEN_STATUSES, REVENUE_STATUSES } from "@/lib/orders/lifecycle";
import type { Customer, Order, ShippingAddress } from "@/types/ecommerce";

/* ── Whose order is it ────────────────────────────────────────────────────── */

/**
 * PostgREST splits the arms of `or=(…)` on commas, so any value that might
 * contain one has to be quoted. Unlike the `ilike` patterns in
 * `lib/admin/search.ts` — where quoting silently disables the wildcards and
 * breaks the search — quoting an `eq` value is simply how a literal is spelled,
 * so it is safe here and wanted: an email's local part is allowed to contain a
 * comma, and a uuid interpolated unquoted would be a hole in the grammar.
 */
function quote(value: string): string {
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}

/** The identifying facts about a customer. Less than a full row on purpose. */
export type CustomerIdentity = Pick<Customer, "id" | "user_id" | "email">;

/**
 * The `.or()` argument that finds every order belonging to this person.
 *
 * Three arms, because there are three eras of order in the table and only one
 * of them carries the foreign key:
 *
 *   * `customer_id` — set by the backfill in `dashboard_schema.sql` and by the
 *     seed. The intended link, and the only one that is indexed.
 *   * `user_id` — how a signed-in checkout records who placed an order.
 *     `app/api/checkout/route.ts` writes `user_id` and never `customer_id`, so
 *     without this arm an account holder's own orders would be missing from
 *     their page from the day the migration ran onwards.
 *   * the checkout email — a guest order, which has no account to point at,
 *     and any order placed before there were customer rows at all. `email` is
 *     what the customers table is unique on, so it is the identity here too.
 *
 * The last arm is a JSON lookup and cannot use an index, which is the cost of
 * this being a query rather than a column. At the size a single customer's
 * history reaches that is the right trade: correct now, and one migration away
 * from being fast if the book ever grows. The proper fix is upstream — have
 * checkout resolve and store `customer_id` — after which this narrows to the
 * first arm and the rest stay only for history.
 */
export function customerOrderFilter({ id, user_id, email }: CustomerIdentity): string {
  const arms = [`customer_id.eq.${quote(id)}`];

  if (user_id) arms.push(`user_id.eq.${quote(user_id)}`);
  if (email) arms.push(`shipping_address->>email.eq.${quote(email)}`);

  return arms.join(",");
}

/* ── What they are worth ──────────────────────────────────────────────────── */

/** One customer's trading history, reduced to the numbers a page prints. */
export interface CustomerSummary {
  /** Every order on the book for this person, cancelled ones included. */
  orders: number;
  /** Sum of the fulfilled ones. The figure that may be called earnings. */
  lifetimeValue: number;
  fulfilled: number;
  open: number;
  cancelled: number;
  /** Money in orders still moving. Promised, not banked — kept separate. */
  inFlight: number;
  /** Lifetime value over the orders that make it up. Null before the first. */
  averageOrderValue: number | null;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
}

/** Anything with the fields the summary reads — an order, or a slice of one. */
type Summarisable = Pick<Order, "status" | "total_amount" | "created_at">;

const isRevenue = (status: string) => (REVENUE_STATUSES as readonly string[]).includes(status);
const isOpen = (status: string) => (OPEN_STATUSES as readonly string[]).includes(status);

/**
 * Fold a customer's orders into the figures beside their name.
 *
 * Deliberately total: a status this build has never heard of — a row written
 * before `order_lifecycle.sql`, or after some later migration — still counts
 * towards `orders` and towards the first and last dates, and simply lands in
 * none of the three money buckets. Dropping it would make the order count
 * disagree with the list printed directly underneath it, which is the one
 * inconsistency a page like this cannot afford.
 */
export function summariseOrders(orders: readonly Summarisable[]): CustomerSummary {
  const summary: CustomerSummary = {
    orders: orders.length,
    lifetimeValue: 0,
    fulfilled: 0,
    open: 0,
    cancelled: 0,
    inFlight: 0,
    averageOrderValue: null,
    firstOrderAt: null,
    lastOrderAt: null,
  };

  for (const order of orders) {
    const amount = Number(order.total_amount) || 0;

    if (isRevenue(order.status)) {
      summary.fulfilled += 1;
      summary.lifetimeValue += amount;
    } else if (isOpen(order.status)) {
      summary.open += 1;
      summary.inFlight += amount;
    } else if (order.status === "cancelled") {
      summary.cancelled += 1;
    }

    const placed = order.created_at;
    if (!summary.firstOrderAt || placed < summary.firstOrderAt) summary.firstOrderAt = placed;
    if (!summary.lastOrderAt || placed > summary.lastOrderAt) summary.lastOrderAt = placed;
  }

  if (summary.fulfilled > 0) {
    summary.averageOrderValue = summary.lifetimeValue / summary.fulfilled;
  }

  return summary;
}

/* ── Where they live ──────────────────────────────────────────────────────── */

/** A place this customer has had something sent, and how often. */
export interface CustomerAddress {
  address: ShippingAddress;
  /** How many orders went here. */
  orders: number;
  /** The most recent of those, which is what `address` was taken from. */
  lastUsedAt: string;
}

/**
 * Two addresses are the same address when the postal part matches.
 *
 * The recipient is left out of the key on purpose: a parcel sent to a mother
 * and one sent to a daughter at the same house are one address with two names
 * on it, and splitting them would print the street twice and make a repeat
 * customer look like two. What the key holds is the part the courier reads,
 * normalised for the capitals and stray spacing a checkout form collects.
 */
function addressKey(address: ShippingAddress): string {
  return [
    address.streetAddress,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .map((part) => (part ?? "").trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}

/**
 * The distinct addresses behind a customer's orders, most recently used first.
 *
 * There is no address column on `customers` and there should not be one — the
 * store has never asked anyone for an address except at checkout, so a field on
 * the customer row would be a second copy of a fact the orders already hold,
 * free to drift the moment someone moves. So the addresses are read back out of
 * the orders, which is where they were actually typed.
 *
 * `orders` need not be sorted; the recency is worked out here.
 */
export function distinctAddresses(
  orders: readonly Pick<Order, "shipping_address" | "created_at">[]
): CustomerAddress[] {
  const seen = new Map<string, CustomerAddress>();

  for (const order of orders) {
    const address = order.shipping_address;

    /* An order with no address at all — an import, or a row from before the
       column was filled in. Nothing to put on a parcel, so nothing to show. */
    if (!address) continue;

    const key = addressKey(address);
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, { address, orders: 1, lastUsedAt: order.created_at });
      continue;
    }

    existing.orders += 1;

    /* Keep the newest spelling of the address, and with it the newest recipient
       and phone: if the flat number changed, the later order is the one to put
       on a parcel. */
    if (order.created_at > existing.lastUsedAt) {
      existing.address = address;
      existing.lastUsedAt = order.created_at;
    }
  }

  return [...seen.values()].sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}
