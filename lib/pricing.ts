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

export function calcShipping(
  subtotal: number,
  itemCount: number,
  rates: DeliveryRates = DEFAULT_RATES
): number {
  if (itemCount <= 0) return 0;
  return subtotal >= rates.freeShippingThreshold ? 0 : rates.shippingFee;
}

export function calcTotal(
  subtotal: number,
  itemCount: number,
  rates: DeliveryRates = DEFAULT_RATES
): number {
  if (itemCount <= 0) return 0;
  return subtotal + calcTax(subtotal) + calcShipping(subtotal, itemCount, rates);
}

/** How much more the customer must spend to unlock free delivery. */
export function amountToFreeShipping(
  subtotal: number,
  rates: DeliveryRates = DEFAULT_RATES
): number {
  return Math.max(0, rates.freeShippingThreshold - subtotal);
}
