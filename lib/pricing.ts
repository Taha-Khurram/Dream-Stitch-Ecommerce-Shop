/**
 * Single source of truth for order maths, shared by the cart drawer and the
 * checkout API so the total a customer sees is the total that gets recorded.
 *
 * Pakistani retail convention: shelf prices are GST-inclusive, so no tax line
 * is added on top — only delivery.
 */

/** Orders at or above this subtotal ship free. */
export const FREE_SHIPPING_THRESHOLD = 5000;

/** Flat nationwide delivery fee below the free-shipping threshold. */
export const SHIPPING_FEE = 250;

/** Prices are GST-inclusive, so nothing is added at checkout. */
export const TAX_RATE = 0;

export function calcTax(subtotal: number): number {
  return Math.round(subtotal * TAX_RATE);
}

export function calcShipping(subtotal: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
}

export function calcTotal(subtotal: number, itemCount: number): number {
  if (itemCount <= 0) return 0;
  return subtotal + calcTax(subtotal) + calcShipping(subtotal, itemCount);
}

/** How much more the customer must spend to unlock free delivery. */
export function amountToFreeShipping(subtotal: number): number {
  return Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
}
