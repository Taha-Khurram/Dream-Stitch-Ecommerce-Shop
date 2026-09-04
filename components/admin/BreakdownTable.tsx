import React from "react";
import Link from "next/link";
import { CURRENCY, formatAmount } from "@/lib/format";

/**
 * A ranked breakdown of revenue — what sold, or which category it came from.
 *
 * Both panels on /admin/analytics are the same shape, so they are the same
 * component: a list of named things ordered by money, each with the share of
 * the total it accounts for.
 *
 * **A table, not a chart.** The data's job here is magnitude *and* identity
 * over a handful of named rows, and the exact figures are the point — an admin
 * reading this wants to know that the King set took PKR 84,000, not that its
 * bar is a bit longer than the next one. So the numbers are the primary
 * encoding and the bar is a second, redundant read of one of the columns,
 * which is why it is `aria-hidden`: the share it draws is printed beside it in
 * text, and announcing the same number twice helps nobody.
 *
 * One hue for every bar, and it is the house purple. Colour is not carrying
 * identity here — the row label does that — so a palette would be decoration
 * that a reader has to decode. Square ends, like every other surface in this
 * app; the design system's `--radius-card` is 0 for a reason.
 *
 * Server-rendered, no JavaScript, no charting library. `/admin/analytics` ships
 * nothing to the client that it does not already ship for the nav.
 */

export interface BreakdownEntry {
  /** React key. The row id where there is one, the name where there is not. */
  key: string;
  name: string;
  /** Where the row leads, when it leads anywhere. */
  href?: string;
  units: number;
  orders: number;
  revenue: number;
  /** 0–100, this row's share of the panel's total. */
  share: number;
}

export function BreakdownTable({
  rows,
  caption,
  nameHead,
}: {
  rows: BreakdownEntry[];
  /** Read by screen readers in place of the visible heading above the table. */
  caption: string;
  /** What the first column is a list of — "Product", "Category". */
  nameHead: string;
}) {
  return (
    <div className="mt-4 overflow-x-auto border border-line bg-white">
      <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="admin-th px-4 py-2.5">
              {nameHead}
            </th>
            <th scope="col" className="admin-th px-4 py-2.5">
              Share of revenue
            </th>
            <th scope="col" className="admin-th px-4 py-2.5 text-right">
              Units
            </th>
            <th scope="col" className="admin-th px-4 py-2.5 text-right">
              Orders
            </th>
            <th scope="col" className="admin-th px-4 py-2.5 text-right">
              Revenue ({CURRENCY})
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-b border-line-soft last:border-b-0">
              <th
                scope="row"
                className="max-w-[16rem] px-4 py-3 text-left text-sm font-medium text-ink"
              >
                {row.href ? (
                  <Link
                    href={row.href}
                    className="block truncate transition-colors hover:text-purple"
                  >
                    {row.name}
                  </Link>
                ) : (
                  <span className="block truncate">{row.name}</span>
                )}
              </th>

              <td className="px-4 py-3">
                <span className="flex items-center gap-3">
                  {/* Fixed-width track, so a bar's length is comparable down
                      the column rather than relative to whatever the label
                      beside it left over. */}
                  <span
                    aria-hidden
                    className="h-1.5 w-24 shrink-0 bg-lilac-deep sm:w-36"
                  >
                    <span
                      className="block h-full bg-purple"
                      style={{ width: `${Math.max(row.share, row.revenue > 0 ? 1.5 : 0)}%` }}
                    />
                  </span>
                  <span className="shrink-0 text-[13px] tabular-nums text-muted">
                    {Math.round(row.share)}%
                  </span>
                </span>
              </td>

              <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{row.units}</td>
              <td className="px-4 py-3 text-right tabular-nums text-muted">{row.orders}</td>
              <td className="px-4 py-3 text-right tabular-nums text-ink">
                {formatAmount(row.revenue)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
