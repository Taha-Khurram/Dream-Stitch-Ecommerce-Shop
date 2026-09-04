"use client";

import React, { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

/**
 * The shop grid runs to sixty products and the home page is five full sections
 * deep, so the trip back to the nav is long. This appears once that trip is
 * worth shortening and stays out of the way until then.
 */
const SHOW_AFTER = 700;

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;

    const onScroll = () => {
      // Coalesce to one read per frame; scroll fires far faster than paint.
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setVisible(window.scrollY > SHOW_AFTER);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const toTop = () => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`fixed right-[1.875rem] bottom-[5.75rem] z-40 flex h-11 w-11 cursor-pointer items-center justify-center border border-line bg-white text-ink shadow-[0_16px_34px_-24px_rgba(42,27,51,0.7)] transition-[opacity,transform,background-color,color] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-ink hover:text-white ${
        visible
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      <ArrowUp className="h-4 w-4" strokeWidth={1.4} />
    </button>
  );
}
