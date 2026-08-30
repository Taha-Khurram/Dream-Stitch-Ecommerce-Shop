"use client";

import React, { useEffect, useState } from "react";
import { SIZE_GUIDE } from "@/lib/constants";
import { X } from "lucide-react";

export function SizeGuideDialog() {
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
        Size Guide
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/45 px-5"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Size guide"
        >
          <div
            className="animate-fade-up w-full max-w-lg bg-white p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="eyebrow text-purple">Finished Dimensions</span>
                <h3 className="mt-2 font-[family-name:var(--font-display)] text-2xl text-ink">
                  Bed Size Guide
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
                    {["Size", "Bedsheet", "Pillow Cover", "Set", "Fits"].map((head) => (
                      <th key={head} className="eyebrow pb-3 text-ink">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SIZE_GUIDE.map((row) => (
                    <tr key={row.size} className="border-b border-line-soft">
                      <td className="py-3 font-medium text-ink">{row.size}</td>
                      <td className="py-3 text-ink-soft">{row.sheet}</td>
                      <td className="py-3 text-ink-soft">{row.pillow}</td>
                      <td className="py-3 text-ink-soft">{row.pieces}</td>
                      <td className="py-3 text-ink-soft">{row.fits}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-5 text-[12px] leading-relaxed text-muted">
              Dimensions are of the finished sheet, measured flat — the side drop is already
              included. Allow an inch either way on hand-finished hems. Falling between two
              sizes? We will cut it to your numbers.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
