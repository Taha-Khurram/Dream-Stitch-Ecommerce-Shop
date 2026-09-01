import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { WishlistGrid } from "@/components/products/WishlistGrid";
import { BRAND } from "@/lib/constants";
import { ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: `Wishlist | ${BRAND.name}`,
  description: `The sets you have saved at ${BRAND.name} ${BRAND.suffix}. Kept on this device — no account needed.`,
  robots: { index: false },
};

/**
 * The list lives in the browser, so this page is only the frame — the grid is a
 * client component that reads the saved ids and fetches the live products.
 */
export default function WishlistPage() {
  return (
    <div className="pb-20">
      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex max-w-[1500px] items-center gap-2 px-6 py-4 text-[11px] text-muted xl:px-10"
      >
        <Link href="/" className="transition-colors hover:text-ink">
          Home
        </Link>
        <ChevronRight className="h-3 w-3 text-faint" />
        <span className="text-ink">Wishlist</span>
      </nav>

      <div className="mx-auto max-w-[1500px] px-6 xl:px-10">
        <header className="border-b border-line pb-8">
          <span className="eyebrow text-purple">Saved For Later</span>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink sm:text-[38px]">
            Your Wishlist
          </h1>
          <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-ink-soft">
            Sets you have kept an eye on. Prices and stock shown here are live, so a set may sell
            through before you come back for it.
          </p>
        </header>

        <div className="pt-8">
          <WishlistGrid />
        </div>
      </div>
    </div>
  );
}
