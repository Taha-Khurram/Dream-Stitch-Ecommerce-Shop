/**
 * Idle-session policy, in one place.
 *
 * Supabase sessions do not expire on their own. The access token is short
 * lived, but `@supabase/ssr` silently exchanges the refresh token for a new
 * one on every request, so an untouched browser tab stays signed in for as
 * long as the refresh token lives — weeks, by default. For a panel that shows
 * the order book and customer contact details, that is the wrong default.
 *
 * So activity is tracked explicitly: the middleware stamps a `last seen` time
 * on every real request, and refuses (and tears down) any session whose stamp
 * is older than the window below.
 *
 * Kept free of `next/headers` and node built-ins so the middleware — which
 * runs on the edge runtime — can import it.
 */

const DEFAULT_IDLE_MINUTES = 30;

function readMinutes(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Override with `SESSION_IDLE_TIMEOUT_MINUTES` in `.env.local`. */
export const IDLE_TIMEOUT_MINUTES = readMinutes(
  process.env.SESSION_IDLE_TIMEOUT_MINUTES,
  DEFAULT_IDLE_MINUTES
);

export const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60_000;

/**
 * How often an *active* client tells the server it is still there.
 *
 * Without this, someone filling in a long product form would be signed out
 * mid-edit: typing is not a request, so the server's clock would keep running
 * while the person was plainly working. A quarter of the window means at most
 * three pings across it, and none at all while the tab is idle.
 */
export const HEARTBEAT_INTERVAL_MS = Math.max(60_000, Math.floor(IDLE_TIMEOUT_MS / 4));

export const HEARTBEAT_PATH = "/api/session/heartbeat";

/** Holds the epoch-ms of the last request the user actually made. */
export const LAST_SEEN_COOKIE = "ds-last-seen";

/**
 * Deliberately far longer than the idle window.
 *
 * If this cookie expired *with* the window, its absence would be
 * indistinguishable from a fresh sign-in and the check would fail open —
 * an abandoned tab would come back to a working session. Outliving the
 * window is what lets a missing stamp mean "new session" and an old stamp
 * mean "expired".
 */
const LAST_SEEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export function lastSeenCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: LAST_SEEN_MAX_AGE_SECONDS,
  };
}

/** Marks a redirect that happened because the session went stale. */
export const TIMEOUT_REASON = "timeout";

/**
 * A prefetch is the router guessing where the user might go, not the user
 * going there. Counting it as activity would keep a session alive off a
 * hovered link, which defeats the whole point.
 */
export function isPrefetch(headers: Headers): boolean {
  return (
    headers.get("next-router-prefetch") === "1" ||
    headers.get("purpose") === "prefetch" ||
    headers.get("x-purpose") === "prefetch" ||
    (headers.get("sec-purpose") ?? "").includes("prefetch")
  );
}

/**
 * How long the session has been untouched, in ms.
 *
 * A missing or unparseable stamp yields 0: the session has only just started
 * (or the stamp predates this feature), so the clock starts now rather than
 * signing the person out on their first request.
 */
export function idleDuration(stamp: string | undefined, now: number): number {
  const lastSeen = Number(stamp);
  if (!Number.isFinite(lastSeen) || lastSeen <= 0) return 0;
  /* A clock that moved backwards must not read as "idle for a long time". */
  return Math.max(0, now - lastSeen);
}

export function isSessionExpired(stamp: string | undefined, now: number): boolean {
  return idleDuration(stamp, now) > IDLE_TIMEOUT_MS;
}
