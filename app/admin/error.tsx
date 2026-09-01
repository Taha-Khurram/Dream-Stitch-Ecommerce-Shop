"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";

/**
 * The admin panel used to inherit the storefront's error boundary from the
 * (site) group. It no longer sits there, so it carries its own — and it wants
 * different copy anyway: an admin needs the failure reference to hand on, not
 * an invitation to go browsing.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin render failed:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-start justify-center">
      <span className="admin-label text-sale">Something went wrong</span>

      <h1 className="mt-4 font-[family-name:var(--font-display)] text-[28px] leading-tight text-ink">
        This screen didn&apos;t load
      </h1>

      <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">
        Usually a dropped connection to the database rather than anything you did. Nothing has
        been saved or lost — try again.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <button onClick={reset} className="btn-primary cursor-pointer">
          <RotateCw className="h-3.5 w-3.5" /> Try Again
        </button>
        <Link href="/admin" className="btn-outline">
          Back to Dashboard
        </Link>
      </div>

      {error.digest && (
        <p className="mt-8 text-[10px] uppercase tracking-[0.2em] text-faint">
          Reference {error.digest}
        </p>
      )}
    </div>
  );
}
