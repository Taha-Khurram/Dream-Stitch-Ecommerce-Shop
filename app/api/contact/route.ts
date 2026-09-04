import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { contactMessageSchema } from "@/lib/validations/inbox";
import { INBOX_NOT_INSTALLED, isMissingInstall } from "@/lib/inbox/install";
import { clientKey, take } from "@/lib/inbox/throttle";
import type { SubmitOutcome } from "@/lib/inbox/lifecycle";

/** It writes. Never prerendered, never cached by anything in between. */
export const dynamic = "force-dynamic";

/**
 * "Send a message" — the /contact form's destination.
 *
 * Public and unauthenticated, like the newsletter endpoint, and bounded the
 * same way: the caller hands four values to `submit_contact_message()` and the
 * function decides everything else, so a message cannot arrive pre-marked
 * `replied` or backdated. There is no INSERT policy on `contact_messages`.
 *
 * Two of the outcomes deserve their reasoning stated, because both look at
 * first glance like errors and neither is:
 *
 * - **duplicate** is a success. The same message from the same address inside
 *   five minutes is a double-clicked Send button or a replayed POST, and the
 *   person's intent — "this message should reach you" — has already been
 *   satisfied. The function hands back the id of the message that did land, so
 *   the form shows its thank-you panel and the inbox holds one copy.
 *
 * - **throttled** is a 429 with `Retry-After`, not a 400. The message was
 *   fine; there have simply been too many from that address this hour.
 */

/**
 * Well below the per-address cap in `submit_contact_message()`, because this
 * one counts attempts rather than messages: a form retried against a flaky
 * connection should be stopped here rather than eating the hourly allowance
 * of somebody who has a genuine problem.
 */
const RATE_LIMIT = { limit: 8, windowMs: 60_000 };

export async function POST(request: Request) {
  const throttle = take("contact", clientKey(request.headers), RATE_LIMIT);

  if (!throttle.allowed) {
    return NextResponse.json(
      { success: false, error: "Too many messages just now. Try again in a minute." },
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

  const parsed = contactMessageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Validation failed",
        /* Keyed by field name, which is what lets the form put each message
           under the input that caused it rather than in one box at the top. */
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const { name, email, subject, message } = parsed.data;
  const supabase = await createClient();

  /* `.maybeSingle()` because the function is `RETURNS TABLE` and so arrives as
     a one-row set, not a scalar. */
  const { data, error } = await supabase
    .rpc("submit_contact_message", {
      p_name: name,
      p_email: email,
      p_subject: subject,
      p_message: message,
    })
    .maybeSingle();

  if (error) {
    if (isMissingInstall(error)) {
      console.error("Contact submit failed — inbox not installed:", error.message);
      return NextResponse.json({ success: false, error: INBOX_NOT_INSTALLED }, { status: 501 });
    }

    console.error("Contact submit failed:", error.message);
    return NextResponse.json(
      { success: false, error: "Could not send your message just now. Please try again." },
      { status: 503 }
    );
  }

  const row = (data ?? {}) as { outcome?: string | null; message_id?: string | null };
  const outcome = String(row.outcome ?? "") as SubmitOutcome;

  if (outcome === "throttled") {
    return NextResponse.json(
      {
        success: false,
        status: outcome,
        error:
          "You have sent us several messages in the last hour. " +
          "We have them all — give us a little time to reply.",
      },
      { status: 429, headers: { "Retry-After": "3600" } }
    );
  }

  if (outcome === "invalid") {
    /* Zod passed and the function did not, which means the two disagree about
       a bound. A bug on this side, so it is logged like one — but the caller
       still gets an honest 400 rather than a 500. */
    console.error("Contact submit rejected by the database after passing validation");
    return NextResponse.json(
      { success: false, status: outcome, error: "Please check the form and try again." },
      { status: 400 }
    );
  }

  /* `accepted`, `duplicate`, and anything a newer migration invents — all of
     them mean the message is in the inbox. */
  return NextResponse.json(
    {
      success: true,
      status: outcome || "accepted",
      messageId: row.message_id ?? null,
    },
    { status: outcome === "accepted" ? 201 : 200, headers: { "Cache-Control": "no-store" } }
  );
}
