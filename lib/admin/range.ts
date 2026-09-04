/**
 * The window the dashboard is read through.
 *
 * `admin_revenue_series(p_days)` has taken the window as a parameter since it
 * was written; the panel simply never offered one, so the chart — and every
 * tile beside it — was nailed to a week. This module is the vocabulary that
 * fixes that: the query-string key, the four windows on offer, and the single
 * place that turns a window into the number of days the queries below it take.
 *
 * Like the pager (see lib/pagination), the window lives in the URL rather than
 * in component state. "The last 90 days" is then a real address — bookmarkable,
 * shareable, survives a reload — and the whole dashboard, tiles included, can
 * be rendered for it on the server in one pass with no hydration involved.
 */

/** The query-string key the dashboard reads its window from. */
export const RANGE_PARAM = "range";

/**
 * What the control offers. Numbers as strings because that is what a query
 * string holds and what the tab links spell; `rangeDays` is the one conversion.
 */
export const RANGES = ["7", "30", "90", "ytd"] as const;

export type Range = (typeof RANGES)[number];

/** A week, unchanged — what the dashboard showed before there was a choice. */
export const DEFAULT_RANGE: Range = "7";

/**
 * `?range=` → a window we are willing to serve.
 *
 * Whitelisted rather than clamped, for the same reason `parsePerPage` is: the
 * value ends up as `p_days` inside a `generate_series`, and an arbitrary number
 * in the URL is an invitation to ask the database to build a million rows.
 * Anything unrecognised quietly becomes the default.
 */
export function parseRange(raw?: string | null): Range {
  return (RANGES as readonly string[]).includes(raw ?? "") ? (raw as Range) : DEFAULT_RANGE;
}

/**
 * How many days the window covers, today included.
 *
 * Year-to-date is the only one that has to be counted rather than read: it is
 * 1 January through today, which is 1 on New Year's Day and 365 on the 31st of
 * December. Counting it here — in UTC, the boundary every query downstream
 * groups on — is what lets year-to-date travel through the same `p_days`
 * parameter as the fixed windows, so nothing below this line needs to know
 * that one of the four choices is not a fixed length.
 */
export function rangeDays(range: Range, now: Date = new Date()): number {
  if (range !== "ytd") return Number(range);

  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const january = Date.UTC(now.getUTCFullYear(), 0, 1);
  return Math.round((today - january) / 86_400_000) + 1;
}

/** What the tab says. Short — it sits in a rail of four. */
export function rangeTab(range: Range): string {
  return range === "ytd" ? "Year to date" : `${range} days`;
}

/** `the last 30 days` / `the year so far` — for headings and the table caption. */
export function rangeSpan(range: Range): string {
  return range === "ytd" ? "the year so far" : `the last ${range} days`;
}

/**
 * What a tile is being compared against.
 *
 * Always the window of equal length immediately before this one — including
 * for year-to-date, where that reaches back over New Year. One rule, spelled
 * out in full on every tile, so the reader never has to guess whether "vs
 * previous" means last month or the same month last year.
 */
export function previousSpan(days: number): string {
  return days === 1 ? "the day before" : `the previous ${days} days`;
}
