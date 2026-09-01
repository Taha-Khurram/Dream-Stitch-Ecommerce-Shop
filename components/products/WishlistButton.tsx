"use client";

import React from "react";
import { Heart } from "lucide-react";
import { useWishlist } from "@/context/WishlistContext";

/**
 * Heart toggle. The list itself lives in `WishlistContext`, so pressing this
 * updates the header count and the /wishlist grid in the same tick.
 */
export function WishlistButton({
  productId,
  size = "sm",
}: {
  productId: string;
  size?: "sm" | "lg";
}) {
  const { has, toggle, isHydrated } = useWishlist();
  const saved = isHydrated && has(productId);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(productId);
  };

  const box = size === "lg" ? "h-12 w-12" : "h-8 w-8";
  const icon = size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      className={`${box} flex cursor-pointer items-center justify-center border border-line bg-white/95 transition-colors hover:border-ink`}
    >
      <Heart
        className={`${icon} transition-colors ${saved ? "fill-purple text-purple" : "text-ink"}`}
        strokeWidth={1.4}
      />
    </button>
  );
}
