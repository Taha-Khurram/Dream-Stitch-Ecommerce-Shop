/** Storefront currency. Change this single constant to re-denominate the store. */
export const CURRENCY = "PKR";

const priceFormatter = new Intl.NumberFormat("en-PK", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** `formatPrice(7000)` → `"PKR 7,000"` — the format used across pk.khaadi.com. */
export function formatPrice(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return `${CURRENCY} 0`;
  return `${CURRENCY} ${priceFormatter.format(Math.round(amount))}`;
}

/** Bare number, no currency prefix — for tight spaces like the cart line total. */
export function formatAmount(value: number | string | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "0";
  return priceFormatter.format(Math.round(amount));
}

/** Percentage saved when a product carries a struck-through original price. */
export function discountPercent(price: number, compareAt?: number | null): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
