import React from "react";
import { Skeleton, LoadingAnnouncement } from "@/components/motion/Skeleton";

/**
 * Auth fallback, matching AuthShell's split: editorial panel on the left from
 * lg up, form column on the right. The auth pages run chrome-free, so without
 * this the screen would go entirely white between click and form.
 */
export default function AuthLoading() {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <LoadingAnnouncement label="Loading" />

      {/* Editorial panel */}
      <Skeleton className="hidden lg:block" />

      {/* Form column */}
      <div className="page-in flex items-center justify-center px-6 py-16 sm:px-12">
        <div className="w-full max-w-sm">
          <Skeleton className="h-2 w-24" />
          <Skeleton className="mt-4 h-9 w-56" />
          <Skeleton className="mt-4 h-3 w-full" />

          <div className="mt-10 space-y-7">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-2 w-16" />
                <Skeleton className="mt-3 h-6 w-full" />
              </div>
            ))}
          </div>

          <Skeleton className="mt-10 h-[50px] w-full" />
          <Skeleton className="mx-auto mt-6 h-2.5 w-48" />
        </div>
      </div>
    </div>
  );
}
