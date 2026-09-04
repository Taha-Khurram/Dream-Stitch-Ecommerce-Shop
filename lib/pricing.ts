/**
 * Single source of truth for order maths, shared by the cart drawer and the
 * checkout API so the total a customer sees is the total that gets recorded.
 *
 * Pakistani retail convention: shelf prices are GST-inclusive, so no tax line
 * is added on top — only delivery.
 */

/** Defaults, used until `store_settings` overrides them from the admin panel. */
export const FREE_SHIPPING_THRESHOLD = 5000;

/** Flat nationwide delivery fee below the free-shipping threshold. */
export const SHIPPING_FEE = 250;

/**
 * Delivery rates are configurable per store, so every function below takes
 * them explicitly and falls back to the constants above. Passing them in
 * rather than reading a module-level value keeps the cart, the product page
 * and the checkout route agreeing on one set of numbers.
 */
export interface DeliveryRates {
  freeShippingThreshold: number;
  shippingFee: number;
}

export const DEFAULT_RATES: DeliveryRates = {
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  shippingFee: SHIPPING_FEE,
};

/** Prices are GST-inclusive, so nothing is added at checkout. */
export const TAX_RATE = 0;

export function calcTax(subtotal: number): number {
  return Math.round(subtotal * TAX_RATE);
}

/**
 * What is left of the bag after a discount code, floored at zero.
 *
 * Every number downstream is computed from this rather than from the raw
 * subtotal, which is the decision that makes a code behave consistently: it is
 * what tax would be charged on, and it is what the free-delivery threshold is
 * measured against. See the note on `calcShipping`.
 */
export function payableSubtotal(subtotal: number, discount: number = 0): number {
  return Math.max(0, subtotal - Math.max(0, discount));
}

/**
 * Delivery, from the subtotal the customer is actually paying.
 *
 * Callers pass the *discounted* figure, and that is a real choice rather than
 * an oversight: a code large enough to drop a bag under the threshold takes
 * the free delivery with it. The alternative — measuring the threshold against
 * the pre-discount subtotal — lets a coupon buy the courier as well as the
 * goods, and quietly makes every large code more expensive than its face value
 * says. The cart drawer's progress bar moves the moment a code is applied, so
 * nothing about it arrives as a surprise at the last step.
 */
export function calcShipping(
  subtotal: number,
  itemCount: number,
  rates: DeliveryRates = DEFAULT_RATES
): number {
  if (itemCount <= 0) return 0;
  return subtotal >= rates.freeShippingThreshold ? 0 : rates.shippingFee;
}

/**
 * The total, with a discount code's reduction already taken off.
 *
 * `discount` is the amount, not the rule — the rule is evaluated by
 * `calcDiscountAmount()` in lib/discounts/lifecycle.ts on the client and by
 * `discount_amount_for()` in Postgres at checkout, and both hand the same
 * number to this function. Keeping the two apart is what lets the order maths
 * stay one expression anybody can read.
 */
export function calcTotal(
  subtotal: number,
  itemCount: number,
  rates: DeliveryRates = DEFAULT_RATES,
  discount: number = 0
): number {
  if (itemCount <= 0) return 0;
  const payable = payableSubtotal(subtotal, discount);
  return payable + calcTax(payable) + calcShipping(payable, itemCount, rates);
}

/** How much more the customer must spend to unlock free delivery. */
export function amountToFreeShipping(
  subtotal: number,
  rates: DeliveryRates = DEFAULT_RATES
): number {
  return Math.max(0, rates.freeShippingThreshold - subtotal);
}
