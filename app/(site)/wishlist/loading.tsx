import React from "react";
import {
  Skeleton,
  ProductGridSkeleton,
  LoadingAnnouncement,
} from "@/components/motion/Skeleton";

/**
 * Wishlist fallback. The breadcrumb, heading block and grid land on the same
 * pixels the real page uses, so nothing shifts when the saved sets arrive.
 */
export default function WishlistLoading() {
  return (
    <div className="pb-20">
      <LoadingAnnouncement label="Loading wishlist" />

      {/* Breadcrumb */}
      <div className="mx-auto flex max-w-[1500px] items-center gap-2 px-6 py-4 xl:px-10">
        <Skeleton className="h-2.5 w-12" />
        <Skeleton className="h-2.5 w-14" />
      </div>

      <div className="mx-auto max-w-[1500px] px-6 xl:px-10">
        <div className="border-b border-line pb-8">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="mt-4 h-8 w-64" />
          <Skeleton className="mt-4 h-3 w-full max-w-lg" />
        </div>

        <ProductGridSkeleton
          count={5}
          className="grid grid-cols-2 gap-x-4 gap-y-10 pt-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        />
      </div>
    </div>
  );
}
