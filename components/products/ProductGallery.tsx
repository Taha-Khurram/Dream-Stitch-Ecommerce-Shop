"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** PDP gallery: thumbnail rail on desktop, swipeable strip on mobile. */
export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="eyebrow flex aspect-[3/4] items-center justify-center bg-sand text-faint">
        Image coming soon
      </div>
    );
  }

  const go = (next: number) => setIndex((next + images.length) % images.length);

  return (
    <div className="flex gap-4">
      {images.length > 1 && (
        <div className="hidden w-20 shrink-0 flex-col gap-3 lg:flex">
          {images.map((src, i) => (
            <button
              key={src}
              onClick={() => setIndex(i)}
              aria-label={`View image ${i + 1}`}
              aria-current={i === index}
              className={`aspect-[3/4] cursor-pointer overflow-hidden border transition-colors ${
                i === index ? "border-ink" : "border-transparent hover:border-line"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover object-top" />
            </button>
          ))}
        </div>
      )}

      <div className="relative min-w-0 flex-1">
        <div className="relative aspect-[3/4] overflow-hidden bg-sand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[index]}
            alt={alt}
            className="h-full w-full object-cover object-top"
          />
        </div>

        {images.length > 1 && (
          <>
            <button
              onClick={() => go(index - 1)}
              aria-label="Previous image"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center bg-white/90 text-ink transition-colors hover:bg-ink hover:text-white"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => go(index + 1)}
              aria-label="Next image"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center bg-white/90 text-ink transition-colors hover:bg-ink hover:text-white"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="mt-3 flex items-center justify-center gap-1.5 lg:hidden">
              {images.map((src, i) => (
                <button
                  key={src}
                  onClick={() => setIndex(i)}
                  aria-label={`View image ${i + 1}`}
                  className={`h-[2px] w-6 transition-colors ${
                    i === index ? "bg-ink" : "bg-line"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
