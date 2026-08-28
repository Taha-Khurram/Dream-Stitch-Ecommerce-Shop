"use client";

import React, { useEffect, useState } from "react";
import { Heart } from "lucide-react";

const STORAGE_KEY = "aashna_wishlist_v1";

function readWishlist(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Local-only wishlist toggle. Persisted per browser — there is no wishlist
 * table yet, and a saved item shouldn't require an account to try the feature.
 */
export function WishlistButton({
  productId,
  size = "sm",
}: {
  productId: string;
  size?: "sm" | "lg";
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(readWishlist().includes(productId));
  }, [productId]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const next = saved
      ? readWishlist().filter((id) => id !== productId)
      : [...readWishlist(), productId];

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* private browsing — the toggle still reflects this session */
    }
    setSaved(!saved);
  };

  const box = size === "lg" ? "h-12 w-12" : "h-8 w-8";
  const icon = size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={saved}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      className={`${box} flex cursor-pointer items-center justify-center border border-line bg-white/95 transition-colors hover:border-ink`}
    >
      <Heart
        className={`${icon} transition-colors ${saved ? "fill-clay text-clay" : "text-ink"}`}
        strokeWidth={1.4}
      />
    </button>
  );
}
