"use client";

import { useEffect } from "react";
import { PING_INTERVAL_MS, PRESENCE_PATH } from "@/lib/presence";

/**
 * Tells the server this tab is open, so the dashboard can count it.
 *
 * Renders nothing, holds no state, and costs no re-renders — it is one
 * interval and two listeners. Mounted once in the storefront layout, so it
 * survives client-side navigation between shop pages and does not restart its
 * clock on every route change.
 *
 * Three rules keep it honest and cheap:
 *
 *   1. **Only visible tabs ping.** A tab buried behind twelve others is not a
 *      person looking at the store. Hiding stops the pings, and the row goes
 *      stale on its own inside the live window.
 *   2. **Ping on becoming visible, immediately.** Browsers throttle timers in
 *      background tabs hard, so coming back to the foreground is exactly when
 *      the interval cannot be trusted to have fired.
 *   3. **Stop for good on 501.** That is the server saying presence_schema.sql
 *      has not been applied. Without this, every storefront tab in an
 *      un-migrated install would POST every thirty seconds forever.
 *
 * There is deliberately no "I am leaving" beacon on unload. `sendBeacon` on
 * pagehide is unreliable across browsers, and the live window already expires
 * a departed visitor within about a minute and a half — so the complexity
 * would buy a slightly faster decrement and a new class of bug.
 */
export function PresenceBeacon() {
  useEffect(() => {
    /* Module-scope would leak this flag between tests and fast-refreshes; a
       closure over the effect's lifetime is exactly the right scope. */
    let stopped = false;
    let timer: number | undefined;

    async function ping() {
      if (stopped || document.visibilityState !== "visible") return;

      try {
        const response = await fetch(PRESENCE_PATH, {
          method: "POST",
          cache: "no-store",
          credentials: "same-origin",
          /* The tab may be navigating away as this fires; keepalive lets the
             request finish rather than being cancelled half-sent. */
          keepalive: true,
        });

        /* Not installed. Nothing to retry, so shut the whole thing down. */
        if (response.status === 501) {
          stopped = true;
          if (timer !== undefined) window.clearInterval(timer);
        }
      } catch {
        /* Offline, or the tab is being torn down. The next tick tries again
           and a missed ping is what the live window is sized to absorb. */
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") void ping();
    }

    void ping();
    timer = window.setInterval(ping, PING_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return null;
}
