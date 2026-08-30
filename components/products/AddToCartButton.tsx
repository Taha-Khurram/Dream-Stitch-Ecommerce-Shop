"use client";

import React, { useState } from "react";
import { useCart, type VariantOptions } from "@/context/CartContext";
import type { Product } from "@/types/ecommerce";
import { Check } from "lucide-react";

interface AddToCartButtonProps {
  product: Product;
  /** Chosen size / colour, carried onto the cart line. */
  variant?: VariantOptions;
  /** Blocks the click and shows this message instead of adding. */
  requireSelection?: string | null;
  label?: string;
  size?: "sm" | "lg";
  fullWidth?: boolean;
  className?: string;
}

export function AddToCartButton({
  product,
  variant,
  requireSelection = null,
  label = "Add to Bag",
  size = "lg",
  fullWidth = true,
  className = "",
}: AddToCartButtonProps) {
  const { addItem, quantityOfProduct } = useCart();
  const [added, setAdded] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const isOutOfStock = product.stock <= 0;
  const isMaxed = !isOutOfStock && quantityOfProduct(product.id) >= product.stock;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isOutOfStock || isMaxed) return;

    if (requireSelection) {
      setWarning(requireSelection);
      setTimeout(() => setWarning(null), 2400);
      return;
    }

    addItem(product, 1, variant);
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  const dimensions =
    size === "sm" ? "px-4 py-2.5 text-[10px]" : "px-8 py-4 text-[11px]";

  const tone = isOutOfStock
    ? "border border-line bg-lilac text-faint cursor-not-allowed"
    : added
      ? "bg-jade text-white"
      : isMaxed
        ? "border border-line bg-lilac text-muted cursor-not-allowed"
        : "bg-ink text-white hover:bg-purple cursor-pointer";

  return (
    <div className={fullWidth ? "w-full" : ""}>
      <button
        type="button"
        onClick={handleAdd}
        disabled={isOutOfStock || isMaxed}
        className={`label-track inline-flex items-center justify-center gap-2 font-medium transition-colors duration-300 ${dimensions} ${tone} ${
          fullWidth ? "w-full" : ""
        } ${className}`}
      >
        {isOutOfStock ? (
          "Sold Out"
        ) : added ? (
          <>
            <Check className="h-3.5 w-3.5" /> Added
          </>
        ) : isMaxed ? (
          "All Stock in Bag"
        ) : (
          label
        )}
      </button>

      {warning && (
        <p className="mt-2 text-center text-[11px] text-sale">{warning}</p>
      )}
    </div>
  );
}
