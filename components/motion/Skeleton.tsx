import React from "react";

/**
 * Loading placeholders.
 *
 * These are deliberately shaped like the real thing — same aspect ratios, same
 * grid, same vertical rhythm — so the swap to live content is a fill rather
 * than a re-layout. A generic spinner would be less work and worse: it tells
 * the shopper to wait without telling them what for.
 */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

/** A run of text lines, last one short so it reads as a paragraph. */
export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`}
        />
      ))}
    </div>
  );
}

/** Mirrors ProductCard: 4:5 image, subtitle, name, price. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col" aria-hidden="true">
      <Skeleton className="aspect-[4/5] w-full" />
      <div className="pt-4">
        <Skeleton className="h-2 w-16" />
        <Skeleton className="mt-2.5 h-3.5 w-3/4" />
        <Skeleton className="mt-3 h-3 w-20" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({
  count = 10,
  className = "grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** The centred eyebrow / title / copy stack used at the top of most sections. */
export function SectionHeadingSkeleton() {
  return (
    <div className="flex flex-col items-center" aria-hidden="true">
      <Skeleton className="h-2 w-24" />
      <Skeleton className="mt-4 h-8 w-56" />
      <Skeleton className="mt-4 h-3 w-full max-w-lg" />
      <Skeleton className="mt-2 h-3 w-64" />
    </div>
  );
}

/**
 * Announces to assistive tech that a page is loading. Visually nothing — the
 * skeletons carry that job, and they are aria-hidden so the screen reader
 * hears one clear message instead of a wall of empty boxes.
 */
export function LoadingAnnouncement({ label = "Loading" }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {label}
    </p>
  );
}
