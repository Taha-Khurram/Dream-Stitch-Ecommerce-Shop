"use client";

import React, { useState } from "react";
import type { Product } from "@/types/ecommerce";
import { AddToCartButton } from "./AddToCartButton";
import { WishlistButton } from "./WishlistButton";
import { SizeGuideDialog } from "./SizeGuideDialog";
import { CustomSizeFields, type CustomSizeDraft } from "./CustomSizeFields";
import { productSizes, isMadeToOrder } from "@/lib/product-attributes";
import { CUSTOM_SIZE_LABEL, parseCustomSize } from "@/lib/custom-size";
import type { SizeGuide } from "@/lib/size-guide";
import { Ruler, X } from "lucide-react";

/**
 * Bed-size selection for the product page.
 *
 * Two ways to buy: a stocked size off the run, or this same design cut to the
 * buyer's own mattress. Made-to-order products only have the second — they
 * have no size run to pick from, and used to be told to "send us your
 * measurements" with nowhere on the page to send them.
 */
export function ProductOptions({
  product,
  sizeGuide,
}: {
  product: Product;
  /** The chart for this product's category, or null when there is none. */
  sizeGuide: SizeGuide | null;
}) {
  const sizes = productSizes(product);
  const madeToOrder = isMadeToOrder(product);

  const [size, setSize] = useState<string | null>(
    madeToOrder || sizes.length === 1 ? sizes[0] : null
  );

  // A made-to-order product is in custom mode from the start and cannot leave.
  const [customOpen, setCustomOpen] = useState(madeToOrder);
  const [draft, setDraft] = useState<CustomSizeDraft>({
    width: "",
    height: "",
    unit: "in",
  });
  /* The measurement error only appears once they have actually tried to add —
     typing the first digit of a width should not turn the field red. */
  const [showError, setShowError] = useState(false);

  const soldOut = product.stock <= 0;
  const parsed = customOpen ? parseCustomSize(draft.width, draft.height, draft.unit) : null;
  const customSize = parsed?.ok ? parsed.value : null;

  const openCustom = () => {
    setCustomOpen(true);
    setShowError(false);
  };

  const closeCustom = () => {
    setCustomOpen(false);
    setShowError(false);
  };

  /* What blocks the bag, in the order the buyer would hit it. `null` means the
     line is ready to add. */
  const blocker = customOpen
    ? parsed && !parsed.ok
      ? parsed.message
      : null
    : !size && !soldOut
      ? "Please choose a bed size first."
      : null;

  return (
    <div className="space-y-7">
      {!madeToOrder && !customOpen && (
        <div>
          <div className="flex items-center justify-between">
            <span className="eyebrow text-ink">
              Bed Size {size && <span className="text-muted">· {size}</span>}
            </span>
            {sizeGuide && <SizeGuideDialog guide={sizeGuide} />}
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

      {customOpen ? (
        <div className="space-y-3">
          {madeToOrder && (
            <p className="border-l-2 border-purple bg-lilac px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
              Made to order — this design is cut to your bed rather than to a stocked size.
            </p>
          )}

          <CustomSizeFields
            draft={draft}
            onChange={(next) => {
              setDraft(next);
              setShowError(false);
            }}
            error={showError ? blocker : null}
          />

          {/* A stocked product can change its mind; a made-to-order one has no
              size run to fall back to, so it gets no way out. */}
          {!madeToOrder && (
            <button
              type="button"
              onClick={closeCustom}
              className="flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-muted transition-colors hover:text-ink"
            >
              <X className="h-3 w-3" />
              Back to stocked sizes
            </button>
          )}
        </div>
      ) : (
        <p className="border-l-2 border-purple bg-lilac px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
          Bed an odd size?{" "}
          <button
            type="button"
            onClick={openCustom}
            className="link-rule inline-flex cursor-pointer items-center gap-1 font-medium text-purple"
          >
            <Ruler className="h-3 w-3" />
            Order this in a custom size
          </button>{" "}
          — same fabric, same finish, cut to your exact measurements.
        </p>
      )}

      <div className="flex items-stretch gap-3">
        <AddToCartButton
          product={product}
          variant={
            customOpen
              ? { size: CUSTOM_SIZE_LABEL, custom: customSize }
              : { size }
          }
          label={customOpen ? "Add Custom Size to Bag" : "Add to Bag"}
          requireSelection={blocker}
          /* In custom mode the reason belongs against the fields it is about,
             so the button hands it over instead of printing its own copy. */
          onBlocked={customOpen ? () => setShowError(true) : undefined}
        />
        <div className="shrink-0">
          <WishlistButton productId={product.id} size="lg" />
        </div>
      </div>
    </div>
  );
}
