/**
 * Live-visitor policy, in one place.
 *
 * "How many people are on the store right now" is a sampled number, and these
 * three constants are the sampling. They belong together because they are only
 * correct relative to one another: the window has to outlast the ping interval,
 * or a visitor who is plainly still there blinks out between two hellos.
 *
 * Kept free of `next/*` and node built-ins so the middleware — which runs on
 * the edge runtime — and the browser beacon can both import it.
 */

/** Where a storefront tab says hello. */
export const PRESENCE_PATH = "/api/presence";

/** Where the dashboard asks for the count. */
export const ADMIN_PRESENCE_PATH = "/api/admin/presence";

/**
 * Holds the visitor's random id.
 *
 * A session cookie on purpose — no `Max-Age`, so it dies with the browser.
 * Presence is a question about right now, and an identifier that outlived the
 * visit would be tracking, which is a different feature with different
 * obligations. httpOnly because the page's own JavaScript has no use for it;
 * only /api/presence reads it.
 */
export const VISITOR_COOKIE = "ds-visitor";

/**
 * How often an open tab says hello.
 *
 * Every ping is a request that wakes the middleware and, for a signed-in
 * visitor, costs a `getUser()` round trip — so this is as slow as it can be
 * while still keeping the count honest. Only visible tabs ping at all.
 */
export const PING_INTERVAL_MS = 30_000;

/**
 * How recently someone must have said hello to count as live.
 *
 * Three times the ping interval, so one dropped request — a flaky connection,
 * a throttled timer, a tab mid-navigation — does not make a present visitor
 * vanish from the tile. The cost is that someone who closes the tab lingers
 * for up to this long, which is the right trade for a number nobody acts on
 * in the second.
 */
export const LIVE_WINDOW_SECONDS = 90;

/** How often the dashboard re-reads the count. Only while the tab is visible. */
export const ADMIN_POLL_INTERVAL_MS = 15_000;

/** What `admin_live_visitors()` answers. */
export interface LiveVisitors {
  total: number;
  signedIn: number;
  guests: number;
}

/**
 * Requests the browser makes on its own, which must never pass for activity.
 *
 * The presence beacon fires on a timer for as long as a tab is open. Left to
 * stamp the idle clock it would keep a signed-in session alive indefinitely —
 * an admin who wandered onto the storefront and walked away would never be
 * signed out — which quietly undoes the whole idle policy in lib/auth/session.
 *
 * Contrast `/api/session/heartbeat`, which SessionGuard only sends after real
 * input and which is therefore meant to count. The distinction is the point:
 * one request means "a person did something", the other means "a tab is open".
 */
export function isPresencePing(pathname: string): boolean {
  return pathname === PRESENCE_PATH;
}

/** Rejects anything that is not a uuid, so a tampered cookie cannot reach Postgres. */
export function isVisitorId(value: string | undefined): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
