"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { img } from "@/lib/imagery";

export interface FabricTile {
  name: string;
  slug: string;
  /** Local fallback used when the category carries no uploaded image. */
  image: string;
  imageUrl?: string | null;
  blurb: string;
}

/**
 * Sliding fabric rail.
 *
 * Built on native overflow + scroll snap rather than a transform track, so
 * touch momentum, trackpads and keyboard focus all work for free; the arrows
 * and dots only drive `scrollTo`. Card widths deliberately don't divide evenly
 * into the viewport — the part-visible card is what tells you it slides.
 */
export function FabricCarousel({ tiles }: { tiles: FabricTile[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);
  const [scrollable, setScrollable] = useState(false);
  const [dragging, setDragging] = useState(false);

  /* A drag that moved must not fire the card's link on release. */
  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: false });

  const cardsOf = (el: HTMLElement) => Array.from(el.children) as HTMLElement[];

  const sync = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;

    const max = el.scrollWidth - el.clientWidth;
    setScrollable(max > 4);
    setAtStart(el.scrollLeft <= 4);
    setAtEnd(el.scrollLeft >= max - 4);

    const left = el.getBoundingClientRect().left;
    let nearest = 0;
    let best = Infinity;
    cardsOf(el).forEach((card, i) => {
      const distance = Math.abs(card.getBoundingClientRect().left - left);
      if (distance < best) {
        best = distance;
        nearest = i;
      }
    });
    setActive(nearest);
  }, []);

  useEffect(() => {
    sync();
    const el = trackRef.current;
    if (!el) return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sync, tiles.length]);

  const goTo = useCallback((index: number) => {
    const el = trackRef.current;
    if (!el) return;
    const card = cardsOf(el)[Math.max(0, Math.min(index, el.children.length - 1))];
    if (!card) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({
      left: el.scrollLeft + (card.getBoundingClientRect().left - el.getBoundingClientRect().left),
      behavior: reduced ? "auto" : "smooth",
    });
  }, []);

  /* Mouse drag only — touch already scrolls natively. */
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    const el = trackRef.current;
    if (!el || !scrollable) return;
    drag.current = { down: true, startX: event.clientX, startLeft: el.scrollLeft, moved: false };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = trackRef.current;
    if (!el || !drag.current.down) return;
    const delta = event.clientX - drag.current.startX;
    if (Math.abs(delta) > 4) drag.current.moved = true;
    el.scrollLeft = drag.current.startLeft - delta;
  };

  const endDrag = () => {
    if (!drag.current.down) return;
    drag.current.down = false;
    setDragging(false);
    /* Snapping is off mid-drag, so settle onto the nearest card by hand. */
    goTo(active);
    /* Let the click that follows the release see `moved`, then clear it. */
    window.setTimeout(() => {
      drag.current.moved = false;
    }, 0);
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={sync}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onClickCapture={(event) => {
          if (drag.current.moved) {
            event.preventDefault();
            event.stopPropagation();
          }
        }}
        role="group"
        aria-roledescription="carousel"
        aria-label="Shop by fabric"
        className={`hide-scrollbar flex gap-5 overflow-x-auto overscroll-x-contain scroll-smooth ${
          dragging ? "cursor-grabbing select-none" : scrollable ? "cursor-grab" : ""
        } ${dragging ? "" : "snap-x snap-mandatory"}`}
      >
        {tiles.map((tile) => (
          <Link
            key={tile.slug}
            href={`/shop?category=${tile.slug}`}
            draggable={false}
            className="group w-[78%] shrink-0 snap-start text-center sm:w-[46%] lg:w-[38%]"
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-lilac">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={tile.imageUrl ?? img(tile.image, 800)}
                alt={tile.name}
                loading="lazy"
                draggable={false}
                className="h-full w-full object-cover object-center transition-transform duration-[1400ms] group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-aubergine/0 transition-colors duration-500 group-hover:bg-aubergine/10" />
            </div>
            <h3 className="mt-6 font-[family-name:var(--font-display)] text-xl text-ink transition-colors group-hover:text-purple">
              {tile.name}
            </h3>
            <p className="mt-2 text-[13px] text-muted">{tile.blurb}</p>
          </Link>
        ))}
      </div>

      {scrollable && (
        <>
          {/* Sits over the image band, which ends up near 42% of card height. */}
          <Arrow side="left" disabled={atStart} onClick={() => goTo(active - 1)} />
          <Arrow side="right" disabled={atEnd} onClick={() => goTo(active + 1)} />

          <div className="mt-10 flex items-center justify-center gap-2.5">
            {tiles.map((tile, i) => (
              <button
                key={tile.slug}
                onClick={() => goTo(i)}
                aria-label={`Show ${tile.name}`}
                aria-current={i === active}
                className={`h-[2px] cursor-pointer transition-all duration-500 ${
                  i === active ? "w-10 bg-purple" : "w-5 bg-line hover:bg-muted"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Arrow({
  side,
  disabled,
  onClick,
}: {
  side: "left" | "right";
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={side === "left" ? "Previous fabric" : "Next fabric"}
      className={`absolute top-[42%] hidden h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center border border-line bg-white text-ink transition-all duration-300 hover:border-ink hover:bg-ink hover:text-white disabled:pointer-events-none disabled:opacity-0 sm:flex ${
        side === "left" ? "-left-4 xl:-left-5" : "-right-4 xl:-right-5"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
