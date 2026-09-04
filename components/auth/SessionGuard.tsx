"use client";

import { useEffect, useRef } from "react";

/**
 * Client half of the idle-session policy.
 *
 * The server is the enforcement point — the middleware refuses a stale session
 * whatever the browser believes. This exists for the two things the server
 * cannot do on its own:
 *
 *   1. Notice that someone is working without navigating. Typing is not a
 *      request, so without a heartbeat a long form would be signed out
 *      mid-edit and the work lost.
 *   2. Clear the screen. A tab left open on the order book keeps showing it
 *      until something asks the server a question; this asks.
 *
 * Deliberately not a "you will be signed out in 60 seconds" modal — that is a
 * bigger piece of UI than this needs, and it is easy to add later on top of
 * the same clock.
 */

/** Intentional input only. `mousemove` would keep a session alive off a nudged desk. */
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "scroll", "touchstart"] as const;

/** How often the clock is examined. Cheap, and never more than half a minute stale. */
const CHECK_INTERVAL_MS = 30_000;

export function SessionGuard({
  idleMs,
  heartbeatMs,
  heartbeatPath,
}: {
  idleMs: number;
  heartbeatMs: number;
  heartbeatPath: string;
}) {
  /* Refs, not state: every one of these changes on input, and none of them
     should cost a render. */
  const lastActivity = useRef(Date.now());
  const lastHeartbeat = useRef(Date.now());
  const activeSinceHeartbeat = useRef(false);
  const expired = useRef(false);

  useEffect(() => {
    function expire() {
      if (expired.current) return;
      expired.current = true;

      /* A full document load, not a client-side push: the point is to leave
         nothing of the signed-in session in memory. The middleware clears the
         cookies as this request goes through. */
      const next = encodeURIComponent(window.location.pathname);
      window.location.assign(`/signin?reason=timeout&next=${next}`);
    }

    function markActive() {
      lastActivity.current = Date.now();
      activeSinceHeartbeat.current = true;
    }

    async function heartbeat() {
      lastHeartbeat.current = Date.now();
      activeSinceHeartbeat.current = false;

      try {
        const response = await fetch(heartbeatPath, {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
        });

        /* The server disagrees that we are signed in — it wins. */
        if (response.status === 401) expire();
      } catch {
        /* Offline, or the tab is being torn down. The next tick tries again,
           and the server's own clock is unaffected either way. */
      }
    }

    function check() {
      if (expired.current) return;

      const now = Date.now();

      if (now - lastActivity.current >= idleMs) {
        expire();
        return;
      }

      if (activeSinceHeartbeat.current && now - lastHeartbeat.current >= heartbeatMs) {
        void heartbeat();
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      /* Background tabs have their timers throttled hard, so the interval
         below may not have run for the whole time the tab was hidden. Coming
         back to the foreground is exactly when the clock must be re-read. */
      check();
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActive, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);

    const timer = window.setInterval(check, CHECK_INTERVAL_MS);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActive);
      }
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(timer);
    };
  }, [idleMs, heartbeatMs, heartbeatPath]);

  return null;
}
