"use client";

import React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatPrice } from "@/lib/format";
import { axisFormatter, compact, fullDate, tickStride, type RevenuePoint } from "./revenue";

/* Brand purple, one series. There is no palette to tell apart here, so the
   only colour requirement is contrast against the white card — which #5e2b8a
   clears comfortably. A second series would need the palette validator. */
const SERIES = "#5e2b8a";
const SURFACE = "#ffffff";
const GRID = "#e5dcf0"; /* --color-line */
const MUTED = "#786a85"; /* --color-muted */

interface TooltipPayload {
  payload: RevenuePoint;
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="border border-line bg-white px-3 py-2 shadow-sm">
      <p className="admin-th">{fullDate(point.day)}</p>
      <p className="mt-1.5 text-sm tabular-nums text-ink">{formatPrice(point.revenue)}</p>
      <p className="admin-hint mt-0.5">
        {point.orders} {point.orders === 1 ? "order" : "orders"}
      </p>
    </div>
  );
}

/**
 * The plot itself. Reached only through `RevenueChart`, which defers this
 * module so recharts never lands in the /admin entry bundle.
 *
 * One series, so no legend — the heading says what is plotted. The endpoint
 * carries the only direct label; every other value is in the hover tooltip
 * and, for anyone not using a pointer, in the table below the card.
 *
 * `span` is prose rather than a day count because the heading has to read
 * "the year so far" as happily as "the last 30 days"; lib/admin/range owns
 * that wording so the tiles above the chart and the caption below it cannot
 * describe the window differently.
 */
export function RevenueChartCanvas({ data, span }: { data: RevenuePoint[]; span: string }) {
  const total = data.reduce((sum, point) => sum + point.revenue, 0);
  const peak = Math.max(0, ...data.map((point) => point.revenue));
  const last = data.at(-1);

  /* A line needs two points to be a line. Year-to-date on the 1st of January
     is one day, and with resting dots off that plots as a blank card — so for
     a window this short the points are drawn as points. */
  const sparse = data.length < 3;

  return (
    <div className="border border-line bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="admin-section-title">Revenue over {span}</h2>
        <p className="text-[13px] tabular-nums text-ink-soft">{formatPrice(total)} total</p>
      </div>
      <p className="admin-hint mt-1">
        Fulfilled orders only, dated by when they were placed. Days with none show as zero.
      </p>

      <div className="mt-5 h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 0 }}>
            <defs>
              {/* A ~10% wash under the line — a hint of volume, never a block. */}
              <linearGradient id="revenue-wash" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES} stopOpacity={0.14} />
                <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
              </linearGradient>
            </defs>

            {/* Horizontal only, hairline, solid. The grid is scaffolding. */}
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />

            <XAxis
              dataKey="day"
              tickFormatter={axisFormatter(data.length)}
              interval={tickStride(data.length)}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tick={{ fill: MUTED, fontSize: 11 }}
            />
            <YAxis
              tickFormatter={compact}
              tickLine={false}
              axisLine={false}
              width={46}
              tick={{ fill: MUTED, fontSize: 11 }}
            />

            <Tooltip content={<ChartTooltip />} cursor={{ stroke: GRID, strokeWidth: 1 }} />

            <Area
              type="monotone"
              dataKey="revenue"
              stroke={SERIES}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="url(#revenue-wash)"
              /* Resting dots would be seven marks competing with the line; the
                 active dot is the 8px marker with its 2px surface ring. The
                 exception is a window too short to draw a line at all. */
              dot={sparse ? { r: 3, fill: SERIES, stroke: SURFACE, strokeWidth: 2 } : false}
              activeDot={{ r: 4, fill: SERIES, stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* The one direct label: where the week ended up. */}
      {last && (
        <p className="mt-3 border-t border-line-soft pt-3 text-[13px] text-ink-soft">
          <span className="tabular-nums text-ink">{formatPrice(last.revenue)}</span> today · peak{" "}
          <span className="tabular-nums text-ink">{formatPrice(peak)}</span>
        </p>
      )}
    </div>
  );
}
