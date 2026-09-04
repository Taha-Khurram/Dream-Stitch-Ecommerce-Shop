"use client";

import React from "react";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/motion/Skeleton";
import type { RevenuePoint } from "./revenue";

/**
 * Deferred loader for the revenue plot.
 *
 * recharts is ~110 kB gzipped — more than the entire rest of the admin entry
 * bundle. app/admin/layout.tsx exists precisely so the panel stops paying for
 * code it does not need on first paint, and shipping a charting library in
 * the critical path would undo that.
 *
 * So the plot is its own chunk, fetched after hydration. `ssr: false` costs
 * nothing real: ResponsiveContainer measures its parent to size the SVG, and
 * on the server that measurement is zero, so a server-rendered recharts tree
 * is an empty box either way.
 *
 * Nothing is gated behind that chunk — the KPI tiles, the recent-orders table
 * and the day-by-day revenue table are all server-rendered and readable with
 * no JavaScript at all.
 */
const RevenueChartCanvas = dynamic(
  () => import("./RevenueChartCanvas").then((mod) => mod.RevenueChartCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="border border-line bg-white p-5" aria-hidden>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-2 h-2.5 w-64" />
        <Skeleton className="mt-5 h-[260px] w-full" />
      </div>
    ),
  }
);

export function RevenueChart({ data, span }: { data: RevenuePoint[]; span: string }) {
  return <RevenueChartCanvas data={data} span={span} />;
}
