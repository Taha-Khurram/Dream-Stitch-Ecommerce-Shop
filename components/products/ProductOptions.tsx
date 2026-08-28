"use client";

import React, { useState } from "react";
import type { Product } from "@/types/ecommerce";
import { AddToCartButton } from "./AddToCartButton";
import { WishlistButton } from "./WishlistButton";
import { SizeGuideDialog } from "./SizeGuideDialog";
import { swatchHex } from "@/lib/constants";
import { productSizes, productColors, isUnstitched } from "@/lib/product-attributes";

/**
 * Colourway + size selection for the product page. A size must be chosen
 * before the bag accepts stitched pret; unstitched fabric skips the run.
 */
export function ProductOptions({ product }: { product: Product }) {
  const sizes = productSizes(product);
  const colors = productColors(product);
  const unstitched = isUnstitched(product);

  const [color, setColor] = useState(colors[0]);
  const [size, setSize] = useState<string | null>(unstitched ? sizes[0] : null);

  const soldOut = product.stock <= 0;

  return (
    <div className="space-y-7">
      {colors.length > 0 && (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="eyebrow text-ink">Colour</span>
            <span className="text-[12px] text-muted">{color}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {colors.map((option) => (
              <button
                key={option}
                onClick={() => setColor(option)}
                title={option}
                aria-label={option}
                aria-pressed={color === option}
                data-active={color === option}
                className="swatch h-7 w-7 cursor-pointer"
                style={{ backgroundColor: swatchHex(option) }}
              />
            ))}
          </div>
        </div>
      )}

      {!unstitched && (
        <div>
          <div className="flex items-center justify-between">
            <span className="eyebrow text-ink">
              Size {size && <span className="text-muted">· {size}</span>}
            </span>
            <SizeGuideDialog />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {sizes.map((option) => (
              <button
                key={option}
                onClick={() => setSize(option === size ? null : option)}
                aria-pressed={size === option}
                className={`h-11 min-w-12 cursor-pointer border px-3 text-[12px] font-medium tracking-wider transition-colors ${
                  size === option
                    ? "border-ink bg-ink text-white"
                    : "border-line text-ink hover:border-ink"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {unstitched && (
        <p className="border-l-2 border-clay bg-cream px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
          Sold unstitched. Add our stitching service at checkout to have it cut to your
          measurements in 7–10 working days.
        </p>
      )}

      <div className="flex items-stretch gap-3">
        <AddToCartButton
          product={product}
          variant={{ size, color }}
          requireSelection={!unstitched && !size && !soldOut ? "Please select a size first." : null}
        />
        <div className="shrink-0">
          <WishlistButton productId={product.id} size="lg" />
        </div>
      </div>
    </div>
  );
}
