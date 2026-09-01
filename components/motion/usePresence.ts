"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Keeps an overlay mounted long enough to animate itself out.
 *
 * The pattern this replaces is `if (!isOpen) return null`, which gives a panel
 * a graceful entrance and then rips it off the screen. Here the caller renders
 * while `mounted` is true and hangs `data-state={state}` on the veil and the
 * panel; the CSS in globals.css owns both halves of the transition.
 *
 *   const { mounted, state } = usePresence(isOpen);
 *   if (!mounted) return null;
 *   <div className="veil" data-state={state} />
 *   <div className="sheet-right" data-state={state} />
 */
export function usePresence(open: boolean, exitMs = 460) {
  const [mounted, setMounted] = useState(open);
  const [state, setState] = useState<"open" | "closed">(open ? "open" : "closed");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (open) {
      /* Mounting straight into "open" is deliberate: the CSS animation plays
         from its own first keyframe, so there is no frame where the panel is
         briefly parked in the closed state. */
      setMounted(true);
      setState("open");
      return;
    }

    setState("closed");

    /* With reduced motion the exit animation is ~instant, so holding the
       mount for the full duration would leave an invisible overlay swallowing
       clicks. Unmount on the next tick instead. */
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    timerRef.current = setTimeout(() => setMounted(false), reduced ? 0 : exitMs);
  }, [open, exitMs]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { mounted, state };
}

/**
 * Locks page scroll while an overlay owns the screen, compensating for the
 * scrollbar so the layout behind does not jump sideways as it disappears.
 */
export function useScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;

    body.style.overflow = "hidden";
    if (gap > 0) body.style.paddingRight = `${gap}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
    };
  }, [locked]);
}
