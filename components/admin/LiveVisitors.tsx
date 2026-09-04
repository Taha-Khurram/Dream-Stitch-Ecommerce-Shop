"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ADMIN_POLL_INTERVAL_MS,
  ADMIN_PRESENCE_PATH,
  LIVE_WINDOW_SECONDS,
  type LiveVisitors as Live,
} from "@/lib/presence";

/**
 * The only number on the dashboard that moves on its own.
 *
 * It sits above the stat grid rather than in it, because it is a different
 * kind of fact: the tiles are cumulative and settled, this is a sample of the
 * last ninety seconds. Putting it in the grid would invite reading it as
 * another total.
 *
 * Polling, not realtime. A websocket would mean shipping the realtime client
 * to the admin panel — the layout comment in app/admin/layout.tsx is about
 * having removed 67 kB of exactly that — to learn a number that only changes
 * as fast as the storefront beacon reports it anyway. One small fetch every
 * fifteen seconds, and only while the tab is visible.
 */

type State =
  | { status: "loading" }
  | { status: "ready"; live: Live }
  /* Presence SQL not applied. A dead tile would read as "nobody is here". */
  | { status: "absent" };

export function LiveVisitors() {
  const [state, setState] = useState<State>({ status: "loading" });

  const read = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await fetch(ADMIN_PRESENCE_PATH, {
        cache: "no-store",
        credentials: "same-origin",
        signal,
      });

      if (response.status === 501) {
        setState({ status: "absent" });
        return "stop" as const;
      }

      if (!response.ok) return "retry" as const;

      const body = (await response.json()) as { success: boolean; live?: Live };
      if (body.success && body.live) setState({ status: "ready", live: body.live });
    } catch {
      /* Aborted, offline, or signed out mid-poll. Leave the last good number
         on screen — a stale count is more use than a flash of nothing — and
         let the next tick correct it. */
    }
    return "retry" as const;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | undefined;

    async function tick() {
      if (document.visibilityState !== "visible") return;
      const outcome = await read(controller.signal);
      if (outcome === "stop" && timer !== undefined) window.clearInterval(timer);
    }

    function onVisibilityChange() {
      /* Back in the foreground, and the interval has been throttled to a
         crawl — the number on screen is the stalest thing on the page. */
      if (document.visibilityState === "visible") void tick();
    }

    void tick();
    timer = window.setInterval(tick, ADMIN_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [read]);

  if (state.status === "absent") {
    return (
      <Shell>
        <p className="text-sm text-ink">Live visitors are not switched on yet.</p>
        <p className="admin-hint mt-1">
          Run <code className="text-ink">presence_schema.sql</code> in the Supabase SQL
          editor, then reload.
        </p>
      </Shell>
    );
  }

  if (state.status === "loading") {
    return (
      <Shell>
        <span className="skeleton h-3 w-40" aria-hidden />
      </Shell>
    );
  }

  const { total, signedIn, guests } = state.live;
  const nobody = total === 0;

  return (
    <Shell>
      {/* aria-live on the count alone: the label and the breakdown are
          scenery, and re-announcing them every fifteen seconds would make the
          dashboard unusable with a screen reader. */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          aria-hidden
          className={`h-2 w-2 shrink-0 rounded-full ${
            nobody ? "bg-faint" : "bg-jade motion-safe:animate-pulse"
          }`}
        />
        <p className="text-sm text-ink" role="status" aria-live="polite">
          {nobody ? (
            "Nobody is on the store right now"
          ) : (
            <>
              <span className="font-medium tabular-nums">{total}</span>
              {total === 1 ? " person is" : " people are"} on the store right now
            </>
          )}
        </p>

        {!nobody && (
          <span className="admin-hint">
            {signedIn} signed in · {guests} {guests === 1 ? "guest" : "guests"}
          </span>
        )}
      </div>

      <p className="admin-hint mt-1">
        Storefront tabs active in the last {LIVE_WINDOW_SECONDS} seconds. Updates on its own.
      </p>
    </Shell>
  );
}

/** One frame for every state, so the strip never changes height as it loads. */
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="mt-6 border border-line bg-frost px-5 py-4">{children}</div>;
}
