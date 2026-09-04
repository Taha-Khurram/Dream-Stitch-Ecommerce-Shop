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

/** `Tue` — the axis tick over a week, where the weekday is the useful handle. */
export function dayLabel(iso: string): string {
  return utcDate(iso).toLocaleDateString("en-GB", {
    weekday: "short",
    timeZone: "UTC",
  });
}

/** `4 Sep` — the axis tick over a month or more, where a weekday says nothing. */
export function shortDate(iso: string): string {
  return utcDate(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * Which of the two the axis should use.
 *
 * Up to a fortnight the weekday is the more useful label — "was Saturday quiet
 * again?" is the question a week of trading actually asks. Past that the days
 * repeat and stop identifying anything, so the tick becomes a date. No year:
 * even year-to-date sits inside one calendar year by construction.
 */
export function axisFormatter(days: number): (iso: string) => string {
  return days <= 14 ? dayLabel : shortDate;
}

/**
 * recharts' `interval` — it draws every (n + 1)th tick.
 *
 * A tick per day is right for a week and unreadable for a quarter, where the
 * labels overlap into a grey smear and recharts starts dropping them at
 * whatever spacing the container happens to give. Choosing the stride here
 * instead keeps roughly eight labels on the axis at every window, evenly
 * spaced and always including the first day.
 */
export function tickStride(count: number): number {
  return Math.max(0, Math.ceil(count / 8) - 1);
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
