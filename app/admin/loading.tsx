import React from "react";
import { Skeleton, LoadingAnnouncement } from "@/components/motion/Skeleton";

/**
 * Admin fallback. This renders inside the admin layout, so the sidebar rail
 * stays put and only the work surface swaps — moving between Products, Orders
 * and Settings never costs you the navigation you are using.
 *
 * Shaped as heading + table, which covers the four list screens; the two form
 * screens fill roughly the same block.
 */
export default function AdminLoading() {
  return (
    <div>
      <LoadingAnnouncement label="Loading admin data" />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-2 w-20" />
          <Skeleton className="mt-3 h-7 w-48" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Table */}
      <div className="mt-8 border border-line">
        <div className="flex items-center gap-4 border-b border-line px-4 py-3">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="ml-auto h-2.5 w-16" />
          <Skeleton className="h-2.5 w-16" />
        </div>

        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-soft px-4 py-4">
            <Skeleton className="h-11 w-11 shrink-0" />
            <div className="min-w-0 flex-1">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="mt-2 h-2.5 w-20" />
            </div>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}
