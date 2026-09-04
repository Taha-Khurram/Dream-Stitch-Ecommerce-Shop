"use client";

import React from "react";
import Link from "next/link";
import { formatPrice } from "@/lib/format";
import { hoverImage } from "@/lib/product-attributes";
import type { Product } from "@/types/ecommerce";

/** Column gap, in rem. Mirrored into CSS so the loop lands exactly. */
const GAP_REM = 1.25;
/** Roughly how long one card takes to travel its own width. */
const SECONDS_PER_CARD = 7;

/**
 * Below this the drift is switched off entirely.
 *
 * The track works by holding two identical halves and walking one half left,
 * so a short list has to be repeated to fill the viewport — and a rail that
 * shows the same bedsheet four times reads as a bug, not as movement. Under
 * four featured products the cards are simply set out in a centred row, which
 * is also the honest picture: this is what is featured, all of it.
 */
const MIN_FOR_DRIFT = 4;

/** Fixed card width, shared by the drifting track and the static row. */
const CARD_WIDTH = "w-[78vw] shrink-0 sm:w-[22rem] lg:w-[26rem]";

/**
 * Featured rail.
 *
 * A continuous right-to-left drift rather than a stepped carousel: the track
 * holds two identical halves and the animation walks it exactly one half to the
 * left, so the seam never shows and there is nothing to press. It pauses under
 * the cursor — and on keyboard focus — which is also what makes the cards
 * clickable: by the time a pointer reaches one, the rail has already stopped.
 *
 * The cards are deliberately lighter than `ProductCard`: no quick-add, no
 * wishlist button. Every card past the first pass is a duplicate marked
 * `inert`, and duplicating live controls would put a second, unreachable Add
 * to Basket in the DOM for the same product. A homepage teaser only has to get
 * someone to the product page, so the card is image, name and price, and the
 * whole tile is the link.
 */
export function FeaturedRail({ products }: { products: Product[] }) {
  if (products.length === 0) return null;

  const drifting = products.length >= MIN_FOR_DRIFT;

  // One half has to out-measure the widest viewport it can sit in, or the loop
  // would run dry and show empty track before it repeats.
  const copies = Math.max(1, Math.ceil(6 / products.length));
  const half = Array.from({ length: copies }, () => products).flat();
  const track = drifting ? [...half, ...half] : products;

  const cards = track.map((product, i) => {
    // Everything past the first pass is decoration for the loop.
    const duplicate = i >= products.length;
    return (
      <FeaturedCard
        key={`${product.id}-${i}`}
        product={product}
        duplicate={duplicate}
      />
    );
  });

  /* Nothing to loop, so nothing to pause — a plain centred row, wrapping on
     the narrow widths where two cards will not sit side by side. */
  if (!drifting) {
    return (
      <div className="flex flex-wrap justify-center gap-5">{cards}</div>
    );
  }

  return (
    <div
      className="featured-rail-viewport relative"
      role="group"
      aria-roledescription="carousel"
      aria-label="Featured bedsheets"
    >
      <div
        className="featured-rail"
        style={
          {
            "--rail-gap": `${GAP_REM}rem`,
            "--rail-duration": `${half.length * SECONDS_PER_CARD}s`,
          } as React.CSSProperties
        }
      >
        {cards}
      </div>
    </div>
  );
}

function FeaturedCard({
  product,
  duplicate,
}: {
  product: Product;
  duplicate: boolean;
}) {
  const secondary = hoverImage(product);
  const soldOut = product.stock <= 0;
  const compareAt = product.compare_at_price;
  const onSale = compareAt != null && Number(compareAt) > Number(product.price);

  return (
    <Link
      href={`/shop/${product.id}`}
      draggable={false}
      /* `inert` rather than `aria-hidden`: the duplicates are links, and a
         focusable element inside an aria-hidden subtree is a contradiction
         screen readers are entitled to resolve either way. */
      inert={duplicate || undefined}
      aria-hidden={duplicate}
      tabIndex={duplicate ? -1 : undefined}
      className={`img-swap group ${CARD_WIDTH} text-center`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-lilac">
        {product.image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image_url}
              alt={duplicate ? "" : product.name}
              loading="lazy"
              draggable={false}
              className="img-front absolute inset-0 h-full w-full object-cover object-center"
            />
            {/* The second photo is the same cross-fade the shop grid uses, so a
                card behaves the same wherever a shopper meets it. */}
            {secondary && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={secondary}
                alt=""
                aria-hidden="true"
                loading="lazy"
                draggable={false}
                className="img-back absolute inset-0 h-full w-full object-cover object-center"
              />
            )}
          </>
        ) : (
          <div className="eyebrow flex h-full w-full items-center justify-center text-faint">
            Image coming soon
          </div>
        )}

        {soldOut && (
          <span className="label-track absolute left-0 top-0 bg-ink px-2.5 py-1 text-[10px] text-white">
            Sold out
          </span>
        )}
        {!soldOut && onSale && (
          <span className="label-track absolute left-0 top-0 bg-purple px-2.5 py-1 text-[10px] text-white">
            Sale
          </span>
        )}

        <div className="absolute inset-0 bg-aubergine/0 transition-colors duration-500 group-hover:bg-aubergine/10" />
      </div>

      <h3 className="mt-6 font-[family-name:var(--font-display)] text-xl text-ink transition-colors group-hover:text-purple">
        {product.name}
      </h3>

      <p className="mt-2 flex items-center justify-center gap-2 text-[13px] tabular-nums">
        <span className={soldOut ? "text-faint line-through" : "text-ink-soft"}>
          {formatPrice(product.price)}
        </span>
        {onSale && (
          <span className="text-faint line-through">{formatPrice(compareAt)}</span>
        )}
      </p>
    </Link>
  );
}
