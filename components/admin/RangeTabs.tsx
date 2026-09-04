import React from "react";
import Link from "next/link";
import {
  DEFAULT_RANGE,
  RANGES,
  RANGE_PARAM,
  rangeTab,
  type Range,
} from "@/lib/admin/range";

/**
 * The dashboard's window control.
 *
 * Plain links, server-rendered, same rail the orders screen wears over its
 * status filters — so the choice needs no JavaScript, the browser's back button
 * walks the windows you actually looked at, and there is no client bundle to
 * pay for on a screen whose whole point is to paint fast.
 *
 * The default window is the bare path rather than `?range=7`, so there is one
 * canonical URL per view instead of /admin and /admin?range=7 being the same
 * screen twice. Same rule as `buildPageHref`.
 */
export function RangeTabs({ active, basePath = "/admin" }: { active: Range; basePath?: string }) {
  return (
    <nav aria-label="Reporting window" className="flex flex-wrap gap-2">
      {RANGES.map((range) => (
        <Link
          key={range}
          href={range === DEFAULT_RANGE ? basePath : `${basePath}?${RANGE_PARAM}=${range}`}
          aria-current={active === range ? "page" : undefined}
          className={`px-3.5 py-2 text-[13px] font-medium transition-colors ${
            active === range
              ? "bg-purple text-white"
              : "border border-line text-ink-soft hover:border-purple hover:bg-lilac hover:text-purple"
          }`}
        >
          {rangeTab(range)}
        </Link>
      ))}
    </nav>
  );
}
