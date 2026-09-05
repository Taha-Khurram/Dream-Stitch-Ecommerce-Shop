"use client";

import React, { Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import type { Category } from "@/types/ecommerce";
import { FilterPanel, countActiveFilters } from "./FilterPanel";
import { SlidersHorizontal, X } from "lucide-react";
import { usePresence, useScrollLock } from "@/components/motion/usePresence";

/**
 * The filter rail lives behind this button at every width — the shop grid gets
 * the full page, and filters are only on screen while someone is choosing them.
 */
function FilterSheetInner({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);
  const searchParams = useSearchParams();
  const activeCount = countActiveFilters(new URLSearchParams(searchParams.toString()));
  const { mounted, state } = usePresence(open);

  useScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  /* The sheet is portalled to <body> rather than rendered where the button
     sits. Everything under /(site) renders inside the page-transition wrapper,
     and any wrapper that ever holds a transform becomes the containing block
     for `position: fixed` — which would size this overlay to the page body
     instead of the viewport and slide it under the sticky header. Going
     straight to <body> makes that impossible to reintroduce from above. */
  const overlay = mounted ? (
    <div className="fixed inset-0 z-[70] h-[100dvh] w-screen">
      <div
        className="veil absolute inset-0 bg-aubergine/45"
        data-state={state}
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        data-state={state}
        className="sheet-right absolute inset-y-0 right-0 flex h-full w-full flex-col bg-white shadow-[0_0_60px_-15px_rgba(42,27,51,0.45)] sm:w-[88%] sm:max-w-sm"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <span className="eyebrow text-ink">Filter</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close filters"
            className="cursor-pointer text-muted hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <FilterPanel categories={categories} onApplied={() => setOpen(false)} />
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="eyebrow flex cursor-pointer items-center gap-2 text-ink transition-colors hover:text-purple"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filter
        {activeCount > 0 && (
          <span className="flex h-4 min-w-4 items-center justify-center bg-purple px-1 text-[10px] leading-none text-white">
            {activeCount}
          </span>
        )}
      </button>

      {overlay && createPortal(overlay, document.body)}
    </>
  );
}

export function FilterSheet({ categories }: { categories: Category[] }) {
  return (
    <Suspense fallback={<span className="eyebrow text-muted">Filter</span>}>
      <FilterSheetInner categories={categories} />
    </Suspense>
  );
}
