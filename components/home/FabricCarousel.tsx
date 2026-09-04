"use client";

import React from "react";
import Link from "next/link";

export interface FabricTile {
  name: string;
  slug: string;
  /** `categories.image_url` — null until an admin uploads one. */
  imageUrl?: string | null;
  /** `categories.description` — may be empty, in which case no line is drawn. */
  blurb: string;
}

/** Column gap, in rem. Mirrored into CSS so the loop lands exactly. */
const GAP_REM = 1.25;
/** Roughly how long one card takes to travel its own width. */
const SECONDS_PER_CARD = 7;

/**
 * Fabric rail.
 *
 * A continuous right-to-left drift rather than a stepped carousel: the track
 * holds two identical halves and the animation walks it exactly one half to the
 * left, so the seam never shows and there is nothing to press. It pauses under
 * the cursor — and on keyboard focus — which is also what makes the cards
 * clickable: by the time a pointer reaches one, the rail has already stopped.
 */
export function FabricCarousel({ tiles }: { tiles: FabricTile[] }) {
  if (tiles.length === 0) return null;

  // One half has to out-measure the widest viewport it can sit in, or the loop
  // would run dry and show empty track before it repeats.
  const copies = Math.max(1, Math.ceil(6 / tiles.length));
  const half = Array.from({ length: copies }, () => tiles).flat();
  const track = [...half, ...half];

  return (
    <div
      className="fabric-rail-viewport relative"
      role="group"
      aria-roledescription="carousel"
      aria-label="Shop by fabric"
    >
      <div
        className="fabric-rail"
        style={
          {
            "--rail-gap": `${GAP_REM}rem`,
            "--rail-duration": `${half.length * SECONDS_PER_CARD}s`,
          } as React.CSSProperties
        }
      >
        {track.map((tile, i) => {
          // Everything past the first pass is decoration for the loop.
          const duplicate = i >= tiles.length;
          return (
            <Link
              key={`${tile.slug}-${i}`}
              href={`/shop?category=${tile.slug}`}
              draggable={false}
              aria-hidden={duplicate}
              tabIndex={duplicate ? -1 : undefined}
              className="group w-[78vw] shrink-0 text-center sm:w-[22rem] lg:w-[26rem]"
            >
              <div className="relative aspect-[4/5] overflow-hidden bg-lilac">
                {/* Without an uploaded image the lilac block behind is the
                    card — no stock photo stands in for the real thing. */}
                {tile.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={tile.imageUrl}
                    alt={duplicate ? "" : tile.name}
                    loading="lazy"
                    draggable={false}
                    className="h-full w-full object-cover object-center transition-transform duration-[1400ms] group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-aubergine/0 transition-colors duration-500 group-hover:bg-aubergine/10" />
              </div>
              <h3 className="mt-6 font-[family-name:var(--font-display)] text-xl text-ink transition-colors group-hover:text-purple">
                {tile.name}
              </h3>
              {tile.blurb && <p className="mt-2 text-[13px] text-muted">{tile.blurb}</p>}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
