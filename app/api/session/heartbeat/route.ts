import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/api";

/** Never cached, and never prerendered — it exists purely for its side effect. */
export const dynamic = "force-dynamic";

/**
 * "I am still here."
 *
 * The idle clock is stamped by the middleware on every real request, so this
 * route's body has nothing to do: by the time it runs, the stamp for *this*
 * request has already been written. What it provides is a request to make at
 * all, for the case where someone is plainly working but generating no
 * navigation — typing into a long form, reading a full order.
 *
 * `SessionGuard` only calls this when it has seen genuine input since the last
 * call, so an abandoned tab sends nothing and still times out.
 *
 * POST, not GET: it mutates session state, and it must never be prefetched or
 * cached by anything between here and the browser.
 */
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  return new NextResponse(null, { status: 204 });
}
