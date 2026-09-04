/**
 * A first line of defence in front of the two public forms.
 *
 * Be clear about what this is and is not. It is a fixed-window counter in a
 * `Map` held by one server instance, so it forgets everything on a restart and
 * knows nothing about what the instance next to it has seen. On a serverless
 * deployment that means a determined caller spread across enough cold starts
 * gets through it.
 *
 * That is acceptable because it is not the enforcement point. The real caps
 * live in `inbox_schema.sql`, inside the SECURITY DEFINER functions, where
 * they are per-address, transactional and shared by every instance — and where
 * they still apply to somebody who bypasses these route handlers and calls
 * PostgREST directly. What this buys is that the ordinary flood never reaches
 * the database at all: a stuck retry loop or a script pointed at /api/contact
 * is answered from memory rather than costing a round trip each time.
 *
 * Kept free of `next/*` so a route handler on any runtime can use it.
 */

interface Window {
  /** Requests seen in the current window. */
  count: number;
  /** When the window closes, in epoch ms. */
  resetAt: number;
}

/**
 * Keyed by `${bucket}:${client}` so the two forms cannot spend each other's
 * allowance — subscribing to the newsletter should not make the contact form
 * refuse you.
 */
const windows = new Map<string, Window>();

/**
 * Bound the map so a spray of forged `X-Forwarded-For` values cannot grow it
 * without limit. Well past any real concurrent caller count, and the sweep
 * below keeps it far below this in practice.
 */
const MAX_TRACKED = 10_000;

/** Drop every window that has already closed. Cheap: it runs on a miss only. */
function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export interface ThrottleVerdict {
  allowed: boolean;
  /** Seconds until the window opens again — the `Retry-After` value. */
  retryAfter: number;
}

/**
 * Count one request against `bucket` for `client`.
 *
 * Fixed window rather than a sliding one: the burst at a boundary is the known
 * cost, and it does not matter for a limit whose job is absorbing an obviously
 * broken caller rather than metering a paid API.
 */
export function take(
  bucket: string,
  client: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): ThrottleVerdict {
  const now = Date.now();
  const key = `${bucket}:${client}`;
  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    if (windows.size >= MAX_TRACKED) sweep(now);
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfter: 0 };
  }

  current.count += 1;

  if (current.count > limit) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }

  return { allowed: true, retryAfter: 0 };
}

/**
 * Who is asking, as well as a proxy can tell us.
 *
 * The leftmost entry of `X-Forwarded-For` is the client as the first proxy saw
 * it, and it is trivially forgeable by that client — which is precisely why
 * this value only ever feeds the best-effort limiter above and never an
 * authorization decision. `unknown` lumps every un-attributable caller into one
 * bucket, which is the safe direction to fail: a shared allowance is stricter
 * than no allowance.
 */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip")?.trim() || "unknown";
}
