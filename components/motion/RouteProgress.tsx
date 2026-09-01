"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Global navigation feedback.
 *
 * Every storefront page is `force-dynamic`, so a click on a nav link parks the
 * shopper on the *old* page while the server fetches. Without a signal the site
 * reads as broken — this is the filament that says "heard you".
 *
 * Start is detected two ways:
 *   1. a capture-phase click on any same-origin <a>, which covers every existing
 *      <Link> without touching a single call site;
 *   2. `startRouteProgress()`, for the handful of places that call router.push.
 *
 * Finish is a pathname or query change — i.e. the new page actually committed.
 */

const START_EVENT = "dreamstitch:route-start";

/** Kick the bar manually, for programmatic router.push / router.replace. */
export function startRouteProgress() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(START_EVENT));
  }
}

/* The curve creeps toward 90% and never arrives: the remaining 10% is what the
   commit itself pays out, so the bar can't finish before the page does. */
const CEILING = 0.9;
const TIME_CONSTANT = 1100;

/** Nothing on this site should take longer than this; release the bar if it does. */
const SAFETY_MS = 12000;

function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);

  const frameRef = useRef<number | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  const clearTimers = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    if (safetyRef.current) clearTimeout(safetyRef.current);
    if (settleRef.current) clearTimeout(settleRef.current);
    frameRef.current = null;
    safetyRef.current = null;
    settleRef.current = null;
  };

  const finish = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearTimers();

    setProgress(1);
    // Let the wipe-out play, then reset for the next navigation.
    settleRef.current = setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 320);

    document.documentElement.removeAttribute("data-navigating");
  }, []);

  const start = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    clearTimers();

    setActive(true);
    setProgress(0.08);

    /* Smooth scrolling is disabled for the duration: Next jumps to the top on
       commit, and animating that jump on a long page is a slow drag. */
    document.documentElement.setAttribute("data-navigating", "");

    const startedAt = performance.now();
    const tick = () => {
      const elapsed = performance.now() - startedAt;
      setProgress(CEILING * (1 - Math.exp(-elapsed / TIME_CONSTANT)));
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    safetyRef.current = setTimeout(finish, SAFETY_MS);
  }, [finish]);

  /* ── Start: capture clicks on anything that navigates ───────────────── */
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      // Modified clicks open a new tab; the current page never changes.
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      let destination: URL;
      try {
        destination = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (destination.origin !== window.location.origin) return;
      // A pure hash jump scrolls; it never re-renders, so it would never finish.
      if (
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search
      ) {
        return;
      }

      start();
    };

    // Back / forward re-render through the same commit path.
    const onPopState = () => start();

    document.addEventListener("click", onClick, { capture: true });
    window.addEventListener("popstate", onPopState);
    window.addEventListener(START_EVENT, start);

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener(START_EVENT, start);
    };
  }, [start]);

  /* ── Finish: the new route committed ───────────────────────────────── */
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  useEffect(() => () => clearTimers(), []);

  return (
    <div
      className="route-progress"
      data-active={active ? "true" : "false"}
      style={{ "--progress": progress } as React.CSSProperties}
      role="progressbar"
      aria-hidden="true"
    />
  );
}

export function RouteProgress() {
  // useSearchParams needs a Suspense boundary to keep the tree from bailing
  // out of static rendering wherever this layout is reused.
  return (
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}
