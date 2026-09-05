/**
 * How an order gets paid for, in one place.
 *
 * The store has never taken money at checkout: an order is placed, an admin
 * accepts it, and the cash arrives with the courier. That was true before this
 * module existed — it simply was not written down anywhere, so nothing
 * downstream could say it. A packing slip could not tell the driver to collect,
 * and every receipt printed "Total paid" against money nobody had handed over.
 *
 * So the method now travels with the order, and the vocabulary lives here the
 * way the statuses live in `lifecycle.ts`: one list, mirrored by the CHECK
 * constraint in `order_payment_method.sql`, read by the checkout drawer, the
 * checkout route, the admin screens and both printed sheets.
 *
 * `card` is in the list and not yet in `AVAILABLE_METHODS`. That is the point
 * of splitting the two: the column can hold it, the drawer can show it greyed
 * out as the thing that is coming, and the route refuses it — one edit turns it
 * on, rather than a migration plus a rewrite of everything that reads a method.
 */

export const PAYMENT_METHODS = ["cod", "card"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** What checkout selects when nothing has been chosen. */
export const DEFAULT_PAYMENT_METHOD = "cod" satisfies PaymentMethod;

/**
 * The methods an order may actually be placed with today.
 *
 * Narrower than `PAYMENT_METHODS` on purpose — see the note above. The drawer
 * derives which radios are live from this, and `/api/checkout` refuses
 * anything outside it, so the two cannot drift into a state where the UI
 * offers a method the server will not take.
 */
export const AVAILABLE_METHODS = ["cod"] as const satisfies readonly PaymentMethod[];

export interface PaymentCopy {
  /** What the shopper picks, in the drawer. */
  label: string;
  /** The sentence under it: what actually happens if they pick it. */
  note: string;
  /** The short form, for a printed sheet or a CSV cell where space is short. */
  short: string;
  /**
   * Whether the money is already in when the order is placed.
   *
   * The one fact every total on every document turns on: `false` means the
   * figure is owed, not paid, and a receipt that says otherwise is wrong.
   */
  prepaid: boolean;
}

export const PAYMENT_COPY: Record<PaymentMethod, PaymentCopy> = {
  cod: {
    label: "Cash on Delivery",
    note: "Pay the courier in cash when your parcel arrives.",
    short: "COD",
    prepaid: false,
  },
  card: {
    label: "Card / Online payment",
    note: "Visa, Mastercard, JazzCash and Easypaisa.",
    short: "Card",
    prepaid: true,
  },
};

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

/** True when an order may be placed with this method right now. */
export function isAvailableMethod(value: string): value is PaymentMethod {
  return (AVAILABLE_METHODS as readonly string[]).includes(value);
}

/**
 * Display name for whatever the row holds.
 *
 * Null is a real answer here and not an error: an order placed before
 * `order_payment_method.sql` ran carries no method, and so does every read that
 * fell back to the column set from before it existed. "Not recorded" is the
 * truth in both cases, and it is more use on an admin screen than a blank.
 */
export function paymentLabel(value?: string | null): string {
  if (!value) return "Not recorded";
  if (isPaymentMethod(value)) return PAYMENT_COPY[value].label;
  return value;
}

/** The same, short enough for a slip header or a spreadsheet column. */
export function paymentShortLabel(value?: string | null): string {
  if (!value) return "—";
  if (isPaymentMethod(value)) return PAYMENT_COPY[value].short;
  return value;
}

/**
 * True when the courier has to come back with money.
 *
 * Deliberately answers `false` for an unrecorded method rather than guessing.
 * The consequence of a wrong `true` is a driver asking a customer who has
 * already paid for cash again; the consequence of a wrong `false` is a line
 * missing from a slip. The first is worse, so the doubt resolves that way.
 */
export function isCollectOnDelivery(value?: string | null): boolean {
  return value === "cod";
}

/**
 * What to call the bottom line on a document, given how it was paid for.
 *
 * Three answers, not two. "Total paid" was on every receipt, every printed
 * copy and the tracking page before this module existed, and on a
 * cash-on-delivery order it was simply untrue — the customer is holding a
 * receipt for money still in their pocket. An order with no recorded method
 * gets the neutral word, because the honest thing to say about a row from
 * before the column existed is nothing at all.
 */
export function totalLabel(value?: string | null): string {
  if (isCollectOnDelivery(value)) return "Total due on delivery";
  if (value && isPaymentMethod(value) && PAYMENT_COPY[value].prepaid) return "Total paid";
  return "Total";
}
