/**
 * Calling the inbox's admin endpoints from the browser.
 *
 * Five client components mutate a message or a subscriber, and without this
 * each one would carry its own copy of the same fetch: set the header, stringify
 * the body, try the JSON parse, work out whether it went through, invent a
 * sentence for the case where it did not. Copies drift, and the one that drifts
 * is always the error path — the branch nobody exercises while building the
 * happy one.
 *
 * So there is one of it. The contract is deliberately narrow: every endpoint
 * answers `{ success, message?, error? }`, and this turns any outcome, including
 * a thrown fetch, into the same `{ ok, message }` a component can render.
 */

export interface InboxResult {
  ok: boolean;
  /** Always populated — safe to render without a fallback at the call site. */
  message: string;
}

/**
 * `fallback` is what to say when the server fails without saying why: a 502
 * from a proxy, an HTML error page, a response that is not JSON at all. It
 * should name the action that did not happen ("Could not delete the message"),
 * because by the time it is shown the caller is the only one who still knows
 * what was being attempted.
 */
async function request(url: string, init: RequestInit, fallback: string): Promise<InboxResult> {
  try {
    const response = await fetch(url, init);
    const payload = (await response.json().catch(() => null)) as
      | { success?: boolean; message?: string; error?: string }
      | null;

    if (!response.ok || !payload?.success) {
      return { ok: false, message: payload?.error ?? fallback };
    }

    return { ok: true, message: payload.message ?? "Saved." };
  } catch {
    /* Never left the browser. Distinguished from a server error because the
       recovery is different — nothing was written, so simply try again. */
    return { ok: false, message: "No connection. Nothing was changed." };
  }
}

/** Move a message or a subscriber to `status`. */
export function setStatus(url: string, status: string, fallback: string): Promise<InboxResult> {
  return request(
    url,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
    fallback
  );
}

/** Erase a message or a subscriber. */
export function remove(url: string, fallback: string): Promise<InboxResult> {
  return request(url, { method: "DELETE" }, fallback);
}
