/**
 * The order lifecycle, in one place.
 *
 * An order arrives from checkout as `new` and sits there until an admin
 * triages it: **accept** it into the workflow, or **delete** it outright. Only
 * once accepted does it start moving through the fulfilment stages —
 * `opened → pending → processing → closed` — with `cancelled` as the off-ramp
 * from any of them.
 *
 * That first gate is the point of `new`: an unreviewed order is not work in
 * progress, and it should not read as if someone is already on it. Everything
 * downstream — the filter rail, the status pill, the dashboard's open count,
 * the server actions — reads its vocabulary from here, so there is exactly one
 * definition of what an order can be and where it may go next.
 *
 * Mirrors the CHECK constraint on `orders.status` in `order_lifecycle.sql`.
 * Changing this list means changing that file too.
 */

export const ORDER_STATUSES = [
  "new",
  "opened",
  "pending",
  "processing",
  "closed",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Where checkout puts an order: received, not yet looked at. */
export const INTAKE_STATUS = "new" satisfies OrderStatus;

/** Where accepting an order puts it — the first stage of real work. */
export const ACCEPTED_STATUS = "opened" satisfies OrderStatus;

/**
 * The stages an accepted order moves between, in the order they read.
 *
 * `new` is deliberately absent: it is reached by placing an order and left by
 * accepting one, never chosen from a list. An order cannot go back to
 * un-received.
 */
export const WORKFLOW_STATUSES = ORDER_STATUSES.filter(
  (status) => status !== INTAKE_STATUS
) as readonly Exclude<OrderStatus, typeof INTAKE_STATUS>[];

/**
 * Statuses that mean "someone still owes this order something", which is what
 * the dashboard's open-orders tile counts.
 */
export const OPEN_STATUSES = ["new", "opened", "pending", "processing"] as const;

/**
 * Statuses that mean the goods have left the building.
 *
 * `completed` is the pre-lifecycle spelling of `closed` — rows written before
 * the migration ran. It is never offered as a choice, only understood.
 */
export const SHIPPED_STATUSES = ["closed", "completed"] as const;

/**
 * Statuses whose money has actually been earned, which is what the dashboard's
 * revenue tiles and the revenue chart sum.
 *
 * An order still in the workflow — or waiting to be accepted at all — is money
 * on the table, not takings: it can still be cancelled, and counting it would
 * have the total fall when that happens. Only a fulfilled order counts, so the
 * figure only ever goes up.
 *
 * The same set as `SHIPPED_STATUSES` today, and for the same reason — revenue
 * is recognised when the goods go out — but named for what it measures, so
 * "has it shipped" and "may we bank it" can be answered, and changed,
 * separately.
 *
 * Mirrors the status filter in `revenue_recognition.sql`.
 */
export const REVENUE_STATUSES = ["closed", "completed"] as const;

/** What each status is called, and what it means, wherever one is offered. */
export const STATUS_COPY: Record<OrderStatus, { label: string; note: string }> = {
  new: { label: "New", note: "Received, waiting to be accepted or deleted" },
  opened: { label: "Opened", note: "Accepted and being put together" },
  pending: { label: "Pending", note: "Waiting on stock, payment or the customer" },
  processing: { label: "Processing", note: "Being packed and dispatched" },
  closed: { label: "Closed", note: "Delivered and done" },
  cancelled: { label: "Cancelled", note: "Called off — no longer being fulfilled" },
};

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

/** True while an order is still waiting on the accept-or-delete decision. */
export function isAwaitingReview(status: string): boolean {
  return status === INTAKE_STATUS;
}

/** True when the units an order reserved have already gone out the door. */
export function hasShipped(status: string): boolean {
  return (SHIPPED_STATUSES as readonly string[]).includes(status);
}

/** Display name for any status, including the legacy ones. */
export function statusLabel(status: string): string {
  if (isOrderStatus(status)) return STATUS_COPY[status].label;
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * The same six states, said to the person who placed the order.
 *
 * `STATUS_COPY` above is written for the panel, and it is written about the
 * panel's work: "Opened" means an admin accepted the order into the workflow,
 * and "New — waiting to be accepted or deleted" is a sentence about a queue the
 * customer cannot see and should not be reading about their own purchase. None
 * of it is secret, exactly; it is simply internal, and a receipt that prints it
 * is a receipt that leaks how the shop is run.
 *
 * So the vocabulary is translated once, here, next to the thing it translates —
 * the same arrangement `lib/discounts/lifecycle.ts` uses for outcomes the
 * shopper sees versus the ones the panel does.
 *
 * `pending` is the one worth reading twice. Internally it covers stock, payment
 * and "waiting on the customer", which are three different conversations; to
 * the customer it is one fact — the order has paused and somebody will be in
 * touch — because which of the three it is arrives by phone, not on paper.
 */
export const CUSTOMER_STATUS_COPY: Record<OrderStatus, string> = {
  new: "Order received",
  opened: "Being prepared",
  pending: "On hold — we will be in touch",
  processing: "Being packed",
  closed: "Delivered",
  cancelled: "Cancelled",
};

/**
 * How a status reads on a customer-facing document.
 *
 * Falls back to the internal label for a status written by a migration this
 * build has not seen, on the same grounds as `statusLabel()`: a row that does
 * not fit the vocabulary still has to print something true.
 */
export function customerStatusLabel(status: string): string {
  if (isOrderStatus(status)) return CUSTOMER_STATUS_COPY[status];
  return statusLabel(status);
}

/** `#3F9A21C4` — the short reference the panel identifies an order by. */
export function orderReference(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}
