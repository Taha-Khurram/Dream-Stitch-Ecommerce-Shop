"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Product } from "@/types/ecommerce";
import { useWishlist } from "@/context/WishlistContext";
import { fetchWishlistProducts } from "@/app/(site)/wishlist/actions";
import { ProductCard } from "./ProductCard";
import { ProductGridSkeleton } from "@/components/motion/Skeleton";
import { Heart } from "lucide-react";

const GRID_CLASS =
  "grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";

/**
 * The saved list is a browser list of ids, so the products behind it can only be
 * fetched once this has mounted.
 *
 * Fetched products are kept in a local cache keyed by id and each id is only
 * ever asked for once. Un-hearting a card therefore drops it from the grid
 * immediately, with no refetch and no flash of skeletons over the rows that are
 * already on screen.
 */
export function WishlistGrid() {
  const { ids, isHydrated, remove, clear } = useWishlist();
  const [cache, setCache] = useState<Record<string, Product>>({});
  const [pending, setPending] = useState(0);
  const requested = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isHydrated) return;

    const missing = ids.filter((id) => !requested.current.has(id));
    if (missing.length === 0) return;

    missing.forEach((id) => requested.current.add(id));
    setPending((n) => n + 1);

    fetchWishlistProducts(missing)
      .then((items) => {
        setCache((prev) => {
          const next = { ...prev };
          items.forEach((item) => {
            next[item.id] = item;
          });
          return next;
        });
      })
      .catch((e) => console.error("Failed to load wishlist products", e))
      .finally(() => setPending((n) => n - 1));
  }, [ids, isHydrated]);

  const loading = !isHydrated || pending > 0;
  const products = ids.map((id) => cache[id]).filter((p): p is Product => Boolean(p));

  // Saved ids we asked for and got nothing back for — sets that have since been
  // delisted. They are shown as a count rather than as broken cards.
  const missing = ids.filter((id) => requested.current.has(id) && !cache[id]);

  if (loading && products.length === 0) {
    return <ProductGridSkeleton count={5} className={`${GRID_CLASS} pt-8`} />;
  }

  if (products.length === 0) {
    return (
      <div className="py-24 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lilac">
          <Heart className="h-5 w-5 text-purple" strokeWidth={1.4} />
        </span>
        <h2 className="mt-6 font-[family-name:var(--font-display)] text-2xl text-ink">
          Nothing saved yet
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-ink-soft">
          Tap the heart on any set to keep it here while you decide. Your list stays on this
          device — no account needed.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/shop" className="btn-primary">
            Browse Bedsheets
          </Link>
          <Link href="/custom" className="btn-outline">
            Order a Custom Size
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
        <p className="text-[12px] text-muted">
          <span className="text-ink">{products.length}</span>{" "}
          {products.length === 1 ? "set saved" : "sets saved"}
        </p>
        <button
          onClick={clear}
          className="eyebrow link-underline cursor-pointer text-purple"
        >
          Clear Wishlist
        </button>
      </div>

      {missing.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border border-line bg-lilac px-4 py-3 text-[12px] text-ink-soft">
          <span>
            {missing.length} saved {missing.length === 1 ? "set is" : "sets are"} no longer
            available.
          </span>
          <button
            onClick={() => missing.forEach(remove)}
            className="eyebrow link-underline cursor-pointer text-purple"
          >
            Remove {missing.length === 1 ? "It" : "Them"}
          </button>
        </div>
      )}

      <div className={`${GRID_CLASS} pt-8`} data-reveal-stagger suppressHydrationWarning>
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
