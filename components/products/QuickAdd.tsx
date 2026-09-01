"use client";

import React, { useState } from "react";
import { useCart } from "@/context/CartContext";
import type { Product } from "@/types/ecommerce";
import { productSizes, isMadeToOrder } from "@/lib/product-attributes";
import { Check } from "lucide-react";

/**
 * The bar that slides up over a product image on hover. One tap on a size adds
 * that size straight to the bag — the pattern shoppers expect on a product grid.
 */
export function QuickAdd({ product }: { product: Product }) {
  const { addItem, quantityOfProduct } = useCart();
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const soldOut = product.stock <= 0;
  const maxed = !soldOut && quantityOfProduct(product.id) >= product.stock;
  const sizes = productSizes(product);
  const madeToOrder = isMadeToOrder(product);

  if (soldOut) {
    return (
      <div className="label-track bg-white/95 py-3 text-center text-[10px] text-muted">
        Sold Out
      </div>
    );
  }

  const add = (e: React.MouseEvent, size: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (maxed) return;
    addItem(product, 1, { size });
    setJustAdded(size);
    setTimeout(() => setJustAdded(null), 1600);
  };

  // Made-to-order sets have no size run — a single "Add to Bag" is enough
  if (madeToOrder) {
    return (
      <button
        onClick={(e) => add(e, sizes[0])}
        disabled={maxed}
        className="label-track w-full cursor-pointer bg-white/95 py-3.5 text-[10px] font-medium text-ink transition-colors hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-white/95 disabled:hover:text-muted"
      >
        {justAdded ? (
          <span className="inline-flex items-center gap-1.5">
            <Check className="h-3 w-3" /> Added
          </span>
        ) : maxed ? (
          "All Stock in Bag"
        ) : (
          "Add to Bag"
        )}
      </button>
    );
  }

  return (
    <div className="bg-white/95 px-3 py-3">
      <span className="eyebrow mb-2 block text-center text-[8px] text-muted">
        {justAdded ? `Size ${justAdded} added` : "Quick add"}
      </span>
      <div className="flex items-center justify-center gap-1">
        {sizes.map((size) => (
          <button
            key={size}
            onClick={(e) => add(e, size)}
            disabled={maxed}
            aria-label={`Add size ${size} to bag`}
            className={`h-7 min-w-8 cursor-pointer px-1.5 text-[10px] font-medium tracking-wider transition-colors disabled:cursor-not-allowed disabled:text-faint ${
              justAdded === size
                ? "bg-jade text-white"
                : "text-ink-soft hover:bg-ink hover:text-white"
            }`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}
