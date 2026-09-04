"use client";

import React from "react";
import { Printer } from "lucide-react";

/**
 * Hands the page to the browser's own print dialog.
 *
 * Deliberately not an auto-print on mount: the slip is also the screen anyone
 * checks an order against before committing paper to it, and a dialog that
 * opens itself is a dialog you dismiss without reading. The button is marked
 * `data-print-hide` so it does not appear on the sheet it just printed.
 */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-print-hide
      className="btn-primary inline-flex items-center gap-2"
    >
      <Printer className="h-4 w-4" strokeWidth={1.75} />
      {label}
    </button>
  );
}
