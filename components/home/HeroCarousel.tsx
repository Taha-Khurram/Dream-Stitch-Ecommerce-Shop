"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export interface HeroSlide {
  eyebrow: string;
  title: string;
  copy: string;
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
  image: string;
  /** Which side the copy sits on over the image. */
  align?: "left" | "center";
}

const AUTOPLAY_MS = 6500;

export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const go = useCallback(
    (next: number) => setIndex((next + slides.length) % slides.length),
    [slides.length]
  );

  useEffect(() => {
    if (paused || reducedMotion || slides.length < 2) return;
    const timer = setTimeout(() => go(index + 1), AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [index, paused, reducedMotion, go, slides.length]);

  return (
    <section
      className="relative h-[78vh] max-h-[760px] min-h-[520px] w-full overflow-hidden bg-lilac"
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured collections"
    >
      {slides.map((slide, i) => {
        const active = i === index;
        return (
          <div
            key={slide.title}
            aria-hidden={!active}
            className={`absolute inset-0 transition-opacity duration-[1200ms] ${
              active ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.image}
              alt={slide.title}
              className="h-full w-full object-cover object-center"
              loading={i === 0 ? "eager" : "lazy"}
            />
            {/* Scrim: heavy enough to keep white type legible over any photo */}
            <div
              className={`absolute inset-0 ${
                slide.align === "center"
                  ? "bg-ink/45"
                  : "bg-gradient-to-r from-ink/70 via-ink/35 to-transparent"
              }`}
            />

            <div className="absolute inset-0">
              <div
                className={`mx-auto flex h-full max-w-[1500px] flex-col justify-center px-6 xl:px-10 ${
                  slide.align === "center" ? "items-center text-center" : "items-start"
                }`}
              >
                <div className={active ? "animate-fade-up max-w-lg" : "max-w-lg"}>
                  <span className="eyebrow text-white/80">{slide.eyebrow}</span>
                  <h2 className="mt-5 whitespace-pre-line font-[family-name:var(--font-display)] text-[42px] leading-[1.05] text-white sm:text-[56px] lg:text-[64px]">
                    {slide.title}
                  </h2>
                  <p className="mt-4 max-w-md text-[13px] leading-relaxed text-white/85">
                    {slide.copy}
                  </p>
                  <div
                    className={`mt-8 flex flex-wrap gap-3 ${
                      slide.align === "center" ? "justify-center" : ""
                    }`}
                  >
                    <Link
                      href={slide.cta.href}
                      className="label-track bg-white px-8 py-4 text-[11px] font-medium text-ink transition-colors hover:bg-purple hover:text-white"
                    >
                      {slide.cta.label}
                    </Link>
                    {slide.secondary && (
                      <Link
                        href={slide.secondary.href}
                        className="label-track border border-white/70 px-8 py-4 text-[11px] font-medium text-white transition-colors hover:bg-white hover:text-ink"
                      >
                        {slide.secondary.label}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {slides.length > 1 && (
        <div className="absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-2.5">
          {slides.map((slide, i) => (
            <button
              key={slide.title}
              onClick={() => go(i)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              className={`h-[2px] cursor-pointer transition-all duration-500 ${
                i === index ? "w-10 bg-white" : "w-5 bg-white/45 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
