"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { RotateCw } from "lucide-react";

/**
 * The other half of the Suspense boundaries added alongside loading.tsx.
 *
 * Every storefront page is force-dynamic, so a dropped Supabase connection is
 * a live failure mode, not a theoretical one. Without this the shopper gets
 * Next's raw error screen; with it they keep the site chrome and a way out.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side digest is all we get in production; log it so the entry in
    // the platform logs can actually be matched to this render.
    console.error("Storefront render failed:", error.digest ?? error.message);
  }, [error]);

  return (
    <div className="page-in mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 py-24 text-center">
      <span className="eyebrow text-purple">Something went wrong</span>

      <h1 className="mt-5 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink sm:text-[38px]">
        We dropped a stitch
      </h1>

      <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
        This page didn&apos;t load. It is almost always temporary — try again, and if it keeps
        happening the collection is still browsable from the shop.
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <button onClick={reset} className="btn-primary cursor-pointer">
          <RotateCw className="h-3.5 w-3.5" /> Try Again
        </button>
        <Link href="/shop" className="btn-outline">
          Browse the Shop
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
