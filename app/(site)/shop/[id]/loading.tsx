import React from "react";
import {
  Skeleton,
  SkeletonText,
  ProductGridSkeleton,
  LoadingAnnouncement,
} from "@/components/motion/Skeleton";

/**
 * Product detail fallback — the two-column gallery / buy-box split from
 * `shop/[id]/page.tsx`, held open at the same proportions so the hero image
 * does not shove the buy box down the page when it resolves.
 */
export default function ProductLoading() {
  return (
    <div>
      <LoadingAnnouncement label="Loading product" />

      {/* Breadcrumb */}
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2 px-6 py-5 xl:px-10">
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2.5 w-24" />
      </div>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-10 px-6 lg:grid-cols-2 lg:gap-16 xl:px-10">
        {/* Gallery: main frame plus its thumbnail rail */}
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-[4/5] w-full" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full" />
            ))}
          </div>
        </div>

        {/* Buy box */}
        <div className="pt-2">
          <Skeleton className="h-2 w-24" />
          <Skeleton className="mt-4 h-9 w-4/5" />
          <Skeleton className="mt-5 h-6 w-32" />

          <SkeletonText lines={3} className="mt-8" />

          {/* Size run */}
          <Skeleton className="mt-10 h-2 w-16" />
          <div className="mt-3 flex gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-16" />
            ))}
          </div>

          <Skeleton className="mt-10 h-[52px] w-full" />

          {/* Delivery / returns / custom-size reassurance rows */}
          <div className="mt-10 space-y-4 border-t border-line pt-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 shrink-0" />
                <Skeleton className="h-3 w-52" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Related */}
      <section className="mx-auto mt-24 max-w-[1500px] px-6 pb-16 xl:px-10">
        <div className="flex flex-col items-center">
          <Skeleton className="h-2 w-20" />
          <Skeleton className="mt-4 h-8 w-56" />
        </div>
        <ProductGridSkeleton
          count={4}
          className="mt-12 grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 lg:grid-cols-4"
        />
      </section>
    </div>
  );
}
