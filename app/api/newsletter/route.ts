import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { newsletterSubscribeSchema } from "@/lib/validations/inbox";
import { INBOX_NOT_INSTALLED, isMissingInstall } from "@/lib/inbox/install";
import { clientKey, take } from "@/lib/inbox/throttle";
import type { SubscribeOutcome } from "@/lib/inbox/lifecycle";

/** It writes. Never prerendered, never cached by anything in between. */
export const dynamic = "force-dynamic";

/**
 * "Put me on the newsletter list."
 *
 * Public and unauthenticated by design — asking someone to hold an account
 * before they can hear about a restock is the wrong trade. What replaces the
 * session as a boundary is that the caller cannot write a row: it hands two
 * values to `subscribe_to_newsletter()` and Postgres decides the rest. There
 * is no INSERT policy on the table for `anon` at all. See inbox_schema.sql.
 *
 * The interesting part of the contract is that "you are already subscribed" is
 * a success, not an error. It is what actually happened, the caller did nothing
 * wrong, and the form has something kind to say about it — telling someone who
 * joined last month that they have just been added is a small lie, and a red
 * error box for a harmless repeat is worse.
 */

/** Generous for a person, stingy for a loop. */
const RATE_LIMIT = { limit: 10, windowMs: 60_000 };

/** What each outcome means to the caller, and how it should read on the form. */
const OUTCOMES: Record<SubscribeOutcome, { status: number; message: string }> = {
  subscribed: {
    status: 201,
    message: "You are on the list. Look out for the first look.",
  },
  resubscribed: {
    status: 200,
    message: "Welcome back — you are on the list again.",
  },
  already_subscribed: {
    status: 200,
    message: "You are already on the list. Nothing more to do.",
  },
  /* Only reachable if Zod and the function disagree about what an address is,
     which would be a bug here rather than a caller's mistake. Answered as a
     400 anyway, because the one thing it is definitely not is a server fault. */
  invalid: {
    status: 400,
    message: "That does not look like an email address.",
  },
};

export async function POST(request: Request) {
  const throttle = take("newsletter", clientKey(request.headers), RATE_LIMIT);

  if (!throttle.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many attempts. Try again in a moment." },
      { status: 429, headers: { "Retry-After": String(throttle.retryAfter) } }
    );
  }

  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload provided" },
      { status: 400 }
    );
  }

  const parsed = newsletterSubscribeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { email, source } = parsed.data;
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("subscribe_to_newsletter", {
    p_email: email,
    p_source: source ?? "home",
  });

  if (error) {
    /* The migration has not been run. 501 rather than 500: the request was
       fine, the feature is simply not installed on this deployment. */
    if (isMissingInstall(error)) {
      console.error("Newsletter subscribe failed — inbox not installed:", error.message);
      return NextResponse.json({ success: false, error: INBOX_NOT_INSTALLED }, { status: 501 });
    }

    /* Anything else is ours, and the details are ours too — the caller gets a
       sentence it can show a visitor, the cause goes to the server log. */
    console.error("Newsletter subscribe failed:", error.message);
    return NextResponse.json(
      { success: false, error: "Could not subscribe you just now. Please try again." },
      { status: 503 }
    );
  }

  const outcome = String(data ?? "") as SubscribeOutcome;
  const resolved = OUTCOMES[outcome];

  /* An outcome this build has never heard of means the SQL is ahead of the
     app. The row was almost certainly written, so refusing to acknowledge it
     would be the wrong answer — treat it as a plain success. */
  if (!resolved) {
    console.warn(`Unrecognised subscribe outcome: ${outcome}`);
    return NextResponse.json({ success: true, status: "subscribed", message: "You are on the list." });
  }

  return NextResponse.json(
    {
      success: outcome !== "invalid",
      status: outcome,
      message: resolved.message,
      ...(outcome === "invalid" ? { error: resolved.message } : {}),
    },
    { status: resolved.status, headers: { "Cache-Control": "no-store" } }
  );
}
