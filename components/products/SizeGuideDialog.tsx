"use client";

import React, { useEffect, useState } from "react";
import type { SizeGuide } from "@/lib/size-guide";
import { X } from "lucide-react";

/**
 * The measurement table behind the buy box's "Size Guide" link.
 *
 * The chart itself is resolved on the server from Settings → Product, so this
 * renders whatever the store configured for this product's category and knows
 * nothing about beds — a shop selling something else changes the table without
 * touching this file.
 */
export function SizeGuideDialog({ guide }: { guide: SizeGuide }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="eyebrow link-underline cursor-pointer text-muted transition-colors hover:text-ink"
      >
        {guide.linkLabel}
      </button>

      {open && (
        /* Anchored to the top rather than centred: the link that opens it sits
           high in the buy box, and a long chart centred on a short viewport
           has nowhere to grow. The backdrop scrolls, so it always does. */
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto overscroll-contain bg-ink/45 px-5 py-6 sm:py-10"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={guide.title}
        >
          <div
            className="animate-fade-up w-full max-w-lg bg-white p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                {guide.eyebrow && <span className="eyebrow text-purple">{guide.eyebrow}</span>}
                <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-ink">
                  {guide.title}
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close size guide"
                className="cursor-pointer text-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-ink">
                    {guide.columns.map((head) => (
                      <th key={head} className="eyebrow pb-3 text-ink">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guide.rows.map((row, index) => (
                    <tr key={index} className="border-b border-line-soft">
                      {row.map((value, cell) => (
                        <td
                          key={cell}
                          className={`py-3 ${cell === 0 ? "font-medium text-ink" : "text-ink-soft"}`}
                        >
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {guide.note && (
              <p className="mt-5 text-[12px] leading-relaxed text-muted">{guide.note}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
