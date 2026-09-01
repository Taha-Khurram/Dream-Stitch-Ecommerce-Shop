"use client";

import { useEffect } from "react";

/**
 * The scroll-reveal observer.
 *
 * Any element anywhere — including inside a server component — opts into an
 * entrance with a bare attribute:
 *
 *   <div data-reveal>              slide up (the default)
 *   <div data-reveal="fade">       opacity only
 *   <div data-reveal="scale">      settle in from 96.5%
 *   <div data-reveal="left|right"> slide in horizontally
 *
 * A container marked `data-reveal-stagger` reveals its children together when
 * the container itself comes into view, each child delayed by its column so
 * the grid ripples across a row rather than landing on one frame. Children
 * need no attribute of their own, and are never touched by this code —
 * globals.css cascades their state off the container.
 *
 * ── The hydration rule ──
 * Next renders each route segment inside its own Suspense boundary, so page
 * content hydrates well after this component's effect runs — and writing to a
 * server-rendered node React has not hydrated yet is reported as a mismatch.
 * There is no reliable "hydration finished" signal to wait on, so the rule is
 * structural instead: this only ever writes to elements whose markup opts in,
 * and every one of those call sites pairs `data-reveal` with
 * `suppressHydrationWarning`. Add one without the other and the warning is
 * back. That is also why a stagger container is revealed as a unit rather than
 * per child: the children are not ours to touch.
 *
 * The hidden state itself is armed before first paint by the inline script in
 * app/layout.tsx — doing it here would let content paint, then blink out.
 */

/* Fire a little before the element is fully on screen — by the time the eye
   reaches it the motion has already resolved, which is what reads as smooth. */
const ROOT_MARGIN = "0px 0px -10% 0px";
const THRESHOLD = 0.01;

/* Only elements the author marked up — never their children. Every element
   matching this carries suppressHydrationWarning at its call site, which is
   what makes it safe for this component to write to. */
const SELECTOR = "[data-reveal], [data-reveal-stagger]";

export function ScrollReveal() {
  useEffect(() => {
    const root = document.documentElement;

    /* Under reduced motion the inline script never armed the hidden state, so
       there is nothing to observe and nothing to reveal. */
    if (!root.hasAttribute("data-reveal-ready")) return;

    /* Tells the inline script's failsafe to stand down: something is now in
       charge of making this content visible again. */
    root.setAttribute("data-reveal-armed", "");

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.setAttribute("data-revealed", "true");
          // One-shot: nothing re-hides on the way back up.
          observer.unobserve(el);
        }
      },
      { rootMargin: ROOT_MARGIN, threshold: THRESHOLD }
    );

    const register = (scope: ParentNode) => {
      const found = Array.from(scope.querySelectorAll<HTMLElement>(SELECTOR));

      // querySelectorAll skips the scope node itself, which matters for the
      // nodes handed to us one at a time by the MutationObserver below.
      if (scope instanceof HTMLElement && scope.matches(SELECTOR)) {
        found.push(scope);
      }

      for (const el of found) {
        if (el.dataset.revealed === "true") continue;
        observer.observe(el);
      }
    };

    register(document.body);

    /* Client-rendered content (filter results, carousels) arrives after this
       pass, so no page has to wire anything up itself. */
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) register(node as Element);
        }
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, []);

  return null;
}
