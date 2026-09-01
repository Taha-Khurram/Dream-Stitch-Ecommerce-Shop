"use client";

import React, { useState } from "react";
import type { Product } from "@/types/ecommerce";
import { AddToCartButton } from "./AddToCartButton";
import { WishlistButton } from "./WishlistButton";
import { SizeGuideDialog } from "./SizeGuideDialog";
import Link from "next/link";
import { productSizes, isMadeToOrder } from "@/lib/product-attributes";

/**
 * Bed-size selection for the product page. A size must be chosen before the bag
 * accepts a stocked set; made-to-order sets skip the run and go through the
 * Custom Demand flow instead.
 */
export function ProductOptions({ product }: { product: Product }) {
  const sizes = productSizes(product);
  const madeToOrder = isMadeToOrder(product);

  const [size, setSize] = useState<string | null>(
    madeToOrder || sizes.length === 1 ? sizes[0] : null
  );

  const soldOut = product.stock <= 0;

  return (
    <div className="space-y-7">
      {!madeToOrder && (
        <div>
          <div className="flex items-center justify-between">
            <span className="eyebrow text-ink">
              Bed Size {size && <span className="text-muted">· {size}</span>}
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

      {madeToOrder ? (
        <p className="border-l-2 border-purple bg-lilac px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
          Made to order. Send us your mattress width, length and the drop you want — we cut this
          fabric to your numbers and dispatch in 7–10 working days.
        </p>
      ) : (
        <p className="border-l-2 border-purple bg-lilac px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
          Bed an odd size?{" "}
          <Link href="/custom" className="link-rule font-medium text-purple">
            Order this in a custom size
          </Link>{" "}
          — same fabric, same finish, cut to your exact measurements.
        </p>
      )}

      <div className="flex items-stretch gap-3">
        <AddToCartButton
          product={product}
          variant={{ size }}
          requireSelection={
            !madeToOrder && !size && !soldOut ? "Please choose a bed size first." : null
          }
        />
        <div className="shrink-0">
          <WishlistButton productId={product.id} size="lg" />
        </div>
      </div>
    </div>
  );
}
