import React from "react";
import {
  Skeleton,
  ProductGridSkeleton,
  LoadingAnnouncement,
} from "@/components/motion/Skeleton";

/**
 * Shop fallback. The collection banner, breadcrumb, toolbar and grid all land
 * on the same pixels the real page uses, so when the products arrive nothing
 * below them shifts — the placeholders are simply replaced in place.
 */
export default function ShopLoading() {
  return (
    <div>
      <LoadingAnnouncement label="Loading collection" />

      {/* Collection banner */}
      <Skeleton className="h-[220px] w-full sm:h-[300px]" />

      {/* Breadcrumb */}
      <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-6 py-4 xl:px-10">
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2.5 w-12" />
      </div>

      <div className="mx-auto max-w-[1500px] px-6 pb-16 xl:px-10">
        {/* Toolbar */}
        <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
          <Skeleton className="h-3 w-16" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div>

        <ProductGridSkeleton
          count={10}
          className="grid grid-cols-2 gap-x-4 gap-y-10 pt-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        />
      </div>
    </div>
  );
}
