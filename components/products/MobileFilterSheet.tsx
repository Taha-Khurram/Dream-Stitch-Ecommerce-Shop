"use client";

import React, { useEffect, useState } from "react";
import type { Category } from "@/types/ecommerce";
import { CategoryFilter } from "./CategoryFilter";
import { SlidersHorizontal, X } from "lucide-react";

/** Wraps the shared filter rail in a slide-over for narrow viewports. */
export function MobileFilterSheet({ categories }: { categories: Category[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="eyebrow flex cursor-pointer items-center gap-2 text-ink transition-colors hover:text-clay lg:hidden"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filter
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[88%] max-w-sm flex-col bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <span className="eyebrow text-ink">Filter</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="cursor-pointer text-muted hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-8">
              <CategoryFilter categories={categories} onNavigate={() => setOpen(false)} />
            </div>

            <div className="border-t border-line p-5">
              <button onClick={() => setOpen(false)} className="btn-ink w-full cursor-pointer">
                Show Results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
