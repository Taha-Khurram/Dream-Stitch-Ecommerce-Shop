/**
 * Shared vocabulary for the dashboard's revenue figures.
 *
 * No "use client": the chart canvas (client, lazily loaded) and the table
 * underneath it (server-rendered) both read from here, so the two views can
 * never disagree about what a day is called or how a number is shortened.
 */

export interface RevenuePoint {
  /** ISO date, `YYYY-MM-DD`, one per day with no gaps. */
  day: string;
  revenue: number;
  orders: number;
}

/**
 * Days are UTC everywhere — the same boundary `admin_revenue_series` groups
 * on. Formatting in the viewer's local zone would slide a late-evening order
 * into the wrong bar for anyone west of Greenwich.
 */
function utcDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** `Tue` — the axis tick. */
export function dayLabel(iso: string): string {
  return utcDate(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
}

/** `4 Sep 2026` — the tooltip and the table. */
export function fullDate(iso: string): string {
  return utcDate(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** `32,000` → `32k`. Axis ticks orient the reader; they are not for reading exact values. */
export function compact(value: number): string {
  if (value >= 1_000_000) return `${Math.round(value / 100_000) / 10}m`;
  if (value >= 1_000) return `${Math.round(value / 100) / 10}k`;
  return String(Math.round(value));
}
