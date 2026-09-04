import React from "react";
import { CURRENCY, formatAmount } from "@/lib/format";
import { fullDate, type RevenuePoint } from "./revenue";

/**
 * The chart's numbers as text.
 *
 * Server-rendered on purpose: it is the path to the figures that needs no
 * pointer, no colour vision and no JavaScript, so it must not sit behind the
 * same deferred chunk as the plot. `<details>` gives the disclosure for free.
 *
 * Every day in the window gets a row, at every window — a quarter is 90 rows
 * and year-to-date can be 365. That is deliberate: this is the accessible path
 * to the numbers, and summarising it into weeks would leave the one reader who
 * depends on it unable to reach a figure the chart's tooltip hands everybody
 * else. It is collapsed until asked for, so the cost is markup, not layout.
 */
export function RevenueTable({ data, span }: { data: RevenuePoint[]; span: string }) {
  return (
    <details className="group mt-2">
      <summary className="admin-hint cursor-pointer list-none select-none text-ink-soft transition-colors hover:text-purple">
        <span className="group-open:hidden">View as table</span>
        <span className="hidden group-open:inline">Hide table</span>
      </summary>

      <div className="mt-2 overflow-x-auto border border-line bg-white">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">
            Revenue and fulfilled order count for every day in {span}. Orders not yet
            fulfilled are not counted.
          </caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="admin-th px-4 py-2.5">
                Day
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
            {data.map((point) => (
              <tr key={point.day} className="border-b border-line-soft last:border-b-0">
                <td className="px-4 py-2.5 text-ink-soft">{fullDate(point.day)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-muted">
                  {point.orders}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-ink">
                  {formatAmount(point.revenue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
