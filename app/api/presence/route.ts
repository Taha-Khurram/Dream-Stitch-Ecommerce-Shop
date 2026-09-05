import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { PRESENCE_PATH, VISITOR_COOKIE, isVisitorId } from "@/lib/presence";

/** Never cached, never prerendered — it exists purely for its side effect. */
export const dynamic = "force-dynamic";

/**
 * "A tab is open on the storefront."
 *
 * Called on a timer by `PresenceBeacon` for as long as a storefront tab is
 * *visible*, and by nothing else. The middleware deliberately does not count
 * this as user activity — see `isPresencePing` in lib/presence.ts, which is
 * what stops an abandoned tab from keeping a signed-in session alive forever.
 *
 * One ping, two records, because the same hello answers two questions that
 * are kept apart everywhere else. `record_presence` maintains the row that
 * says this browser is here *now* and is pruned within the hour;
 * `record_visit` stamps the visitor-day that survives it, which is what
 * /admin/analytics counts a footfall out of. See visit_analytics.sql.
 *
 * The visitor id lives in an httpOnly session cookie minted here rather than
 * in the browser, for two reasons: the page's own JavaScript never needs to
 * read it, and an id the client chose would let one visitor claim to be many.
 * (A determined caller can still hit PostgREST's `/rpc/record_presence`
 * directly with invented uuids — this is a footfall number, not an audited
 * one. Rate limiting it is a different job.)
 *
 * POST, not GET: it writes, and it must never be prefetched or cached by
 * anything between here and the browser.
 */
export async function POST() {
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;

  /* A cookie that is not a uuid is a tampered or stale one; mint a fresh id
     rather than handing the malformed value to Postgres. */
  const visitor = isVisitorId(existing) ? existing : crypto.randomUUID();

  const supabase = await createClient();

  /* Together rather than in sequence: they touch different tables, neither
     reads the other's result, and the beacon is a background request whose
     latency is a visitor's to pay. Two round trips at once cost one. */
  const [presence, visit] = await Promise.all([
    supabase.rpc("record_presence", { p_visitor: visitor }),
    supabase.rpc("record_visit", { p_visitor: visitor }),
  ]);

  const response = presenceResponse(presence.error, visit.error);

  /**
   * Attached whatever happened above, not only on success.
   *
   * Setting it only on a successful write looks tidier and is wrong: a visitor
   * behind a flaky connection would arrive without a cookie every time, mint a
   * different id on each attempt, and land in the table two or three times
   * over — one person counted as a small crowd. Settling the id on first
   * contact makes the row idempotent no matter how the write goes.
   *
   * No `maxAge`, so this is a session cookie and dies with the browser. The
   * path scopes it to this endpoint, so it rides on nothing else.
   */
  if (existing !== visitor) {
    response.cookies.set(VISITOR_COOKIE, visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: PRESENCE_PATH,
    });
  }

  return response;
}

/**
 * One status for two writes.
 *
 * The rule is "did this ping accomplish anything", not "did everything
 * succeed", because the two migrations behind them are independent and either
 * can be installed without the other. A store running presence_schema.sql but
 * not visit_analytics.sql is a supported state, and a 501 there would stop the
 * beacon for good (see PresenceBeacon) and take the live-visitor tile down
 * with it — a missing panel would have silenced a working one.
 *
 * So: anything landed, 204. Nothing landed because neither function exists,
 * 501 — there is genuinely nothing here to ping. Anything else is transient.
 */
function presenceResponse(
  ...errors: ({ code?: string; message?: string } | null)[]
): NextResponse {
  if (errors.some((error) => !error)) return new NextResponse(null, { status: 204 });

  /* Neither migration has been applied. Say so with a status the beacon
     recognises, so it stops pinging instead of retrying every thirty seconds
     for the life of the tab. */
  if (errors.every(isMissingFunction)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Presence is not installed. Run presence_schema.sql (and visit_analytics.sql).",
      },
      { status: 501 }
    );
  }

  /* Anything else is transient — a dropped connection, a pooler restart. 503
     keeps the beacon on its schedule. */
  return NextResponse.json(
    { success: false, error: "Could not record presence." },
    { status: 503 }
  );
}

/**
 * Tells "you have not run the SQL" apart from "the database hiccuped".
 *
 * PostgREST answers PGRST202 for an unknown RPC; Postgres itself uses 42883
 * for undefined_function. Either can surface depending on whether the schema
 * cache or the planner notices first.
 */
function isMissingFunction(error: { code?: string; message?: string } | null): boolean {
  return (
    !!error &&
    (error.code === "PGRST202" ||
      error.code === "42883" ||
      (error.message ?? "").includes("Could not find the function"))
  );
}
