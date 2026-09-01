import React from "react";
import {
  Skeleton,
  SkeletonText,
  SectionHeadingSkeleton,
  LoadingAnnouncement,
} from "@/components/motion/Skeleton";

/**
 * Default storefront fallback — the boundary for every page under (site) that
 * does not ship a closer one. Shaped as banner → heading → content, which is
 * how about, contact, custom and dashboard all read.
 *
 * Site chrome (header, cart, footer) stays live above and below this: only the
 * <main> swaps, so navigation never blanks the page.
 */
export default function SiteLoading() {
  return (
    <div>
      <LoadingAnnouncement label="Loading page" />

      {/* Banner */}
      <Skeleton className="h-[220px] w-full sm:h-[300px]" />

      <div className="mx-auto max-w-[1500px] px-6 py-16 sm:py-24 xl:px-10">
        <SectionHeadingSkeleton />

        <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="aspect-[4/3] w-full" />
              <Skeleton className="mt-5 h-5 w-40" />
              <SkeletonText lines={2} className="mt-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
