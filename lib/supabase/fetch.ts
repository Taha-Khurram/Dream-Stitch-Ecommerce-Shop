/**
 * Supabase's transport, hardened against a dropped connection.
 *
 * A momentary blip surfaces from undici as `TypeError: fetch failed` — no
 * status, no body, nothing PostgREST actually said. Handed to a caller that
 * reads `{ data, error }`, it is indistinguishable from "no such row", so one
 * lost packet turns a perfectly good product page into a 404; and a socket
 * that stalls rather than fails hangs the render until undici gives up on its
 * own, which is how a product page came to take nineteen seconds to decide it
 * had nothing to show.
 *
 * So reads get a bounded wait and two more attempts. Only reads: a network
 * failure cannot tell "the request never arrived" from "it arrived, and the
 * reply was lost on the way back", and replaying an order on that guess is a
 * good deal worse than reporting the error. Anything that writes is passed
 * straight through.
 */

/** Long enough for the slowest honest query, short enough to still retry. */
const ATTEMPT_TIMEOUT_MS = 10_000;

/** Pauses before the second and third attempts. */
const BACKOFF_MS = [250, 750];

/**
 * A drop-in `fetch` for `createServerClient`'s `global.fetch`, retrying a read
 * that failed at the network layer. An HTTP error is *not* a failure here —
 * PostgREST answering "400" is an answer, and belongs to the caller.
 */
export const resilientFetch: typeof fetch = async (input, init) => {
  if (!isRead(input, init)) return fetch(input, init);

  let lastError: unknown;

  for (let attempt = 0; ; attempt++) {
    try {
      return await fetch(input, withTimeout(init));
    } catch (error) {
      // A caller that aborted meant it; only our own timeout is worth retrying.
      if (init?.signal?.aborted) throw error;

      lastError = error;
      if (attempt >= BACKOFF_MS.length) break;
      await sleep(BACKOFF_MS[attempt]);
    }
  }

  throw lastError;
};

/** GET and HEAD change nothing, so sending them twice costs only time. */
function isRead(input: RequestInfo | URL, init?: RequestInit): boolean {
  const method =
    init?.method ?? (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET");

  return method.toUpperCase() === "GET" || method.toUpperCase() === "HEAD";
}

/**
 * The caller's own signal wins if it has one — `AbortSignal.any` is the only
 * way to honour both, and it is missing on older runtimes, where a stalled
 * read simply keeps the behaviour it has today.
 */
function withTimeout(init?: RequestInit): RequestInit | undefined {
  if (typeof AbortSignal?.timeout !== "function") return init;

  const timeout = AbortSignal.timeout(ATTEMPT_TIMEOUT_MS);
  const caller = init?.signal;

  if (caller && typeof AbortSignal.any !== "function") return init;

  return {
    ...init,
    signal: caller ? AbortSignal.any([caller, timeout]) : timeout,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
