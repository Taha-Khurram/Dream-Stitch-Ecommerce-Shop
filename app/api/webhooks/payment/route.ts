/**
 * Payment webhook — where a card order is actually confirmed.
 *
 * The Server Action in app/(checkout)/actions.ts emails on *placement*, which
 * is correct for cash on delivery (the only method `AVAILABLE_METHODS`
 * currently allows) because placing the order is the commitment. It is wrong
 * for a card: an order is not confirmed until money moves, and money moves
 * after the shopper leaves the checkout page. So for card payments the receipt
 * belongs here, on the provider's callback, not on the button press.
 *
 * The request is unauthenticated and arrives from the open internet. Its only
 * credential is the signature, so verification is not a formality — without it
 * anyone who guesses this URL can mark any order paid and make the shop email a
 * receipt for money it never received.
 *
 * Stripe-shaped by convention (`t=…,v1=…`, HMAC-SHA256 over `${t}.${body}`),
 * implemented against Web Crypto rather than the `stripe` SDK so the project
 * takes no new dependency. Swapping providers means changing `verifySignature`
 * and `extractOrderId`; nothing below them cares.
 */

import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendOrderEmails } from "@/lib/email-service";

/** The raw body is needed for the HMAC, so the route must not be static. */
export const dynamic = "force-dynamic";

/** Replays older than this are rejected even if the signature is good. */
const TOLERANCE_SECONDS = 5 * 60;

/**
 * Constant-time comparison.
 *
 * `===` on a signature leaks, through timing, how many leading bytes were
 * right — enough, over many attempts, to forge one. The loop always runs to
 * the end and always compares the same number of bytes.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify `Stripe-Signature` against the raw body.
 *
 * The body must be the exact bytes that were signed — parse it before this and
 * re-serialising will change the whitespace and every signature will fail.
 */
async function verifySignature(
  rawBody: string,
  header: string | null,
  secret: string
): Promise<boolean> {
  if (!header) return false;

  const parts = new Map(
    header.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")] as const;
    })
  );

  const timestamp = parts.get("t");
  const signature = parts.get("v1");

  if (!timestamp || !signature) return false;

  /* A signature stays valid forever; a captured request must not. Without this
     window an attacker who recorded one legitimate callback could replay it
     indefinitely. */
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`)
  );

  return timingSafeEqual(toHex(digest), signature);
}

/** The provider's event envelope, narrowed to what this route reads. */
interface PaymentEvent {
  id?: string;
  type?: string;
  data?: {
    object?: {
      id?: string;
      metadata?: Record<string, string> | null;
      client_reference_id?: string | null;
    };
  };
}

/**
 * The order this event is about.
 *
 * `metadata.order_id` is set when the payment intent is created; Stripe's
 * Checkout also carries `client_reference_id`. Either identifies our order —
 * the provider's own id identifies theirs, which is not the same thing.
 */
function extractOrderId(event: PaymentEvent): string | null {
  const object = event.data?.object;
  return object?.metadata?.order_id ?? object?.client_reference_id ?? null;
}

export async function POST(request: Request) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET?.trim();

  if (!secret) {
    /* Refuse rather than skip verification. A deployment missing its secret
       must not silently accept unsigned callbacks — that is the failure mode
       this whole route exists to prevent. */
    console.error("[webhook] PAYMENT_WEBHOOK_SECRET is not set — refusing callback");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  // Read as text, not JSON: the HMAC covers the exact bytes as sent.
  const rawBody = await request.text();

  const verified = await verifySignature(
    rawBody,
    request.headers.get("stripe-signature"),
    secret
  );

  if (!verified) {
    console.error("[webhook] rejected a callback with a bad or missing signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: PaymentEvent;

  try {
    event = JSON.parse(rawBody) as PaymentEvent;
  } catch {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  /* Everything else is acknowledged rather than refused. A 4xx makes the
     provider retry with backoff and eventually alert, which is the wrong
     response to an event we simply do not act on. */
  const SUCCESS_EVENTS = ["payment_intent.succeeded", "checkout.session.completed"];

  if (!event.type || !SUCCESS_EVENTS.includes(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type ?? "unknown" });
  }

  const orderId = extractOrderId(event);

  if (!orderId) {
    console.error("[webhook] %s carried no order id — nothing to mark paid", event.type);
    return NextResponse.json({ received: true, ignored: "no_order_id" });
  }

  /* Service role bypasses RLS — this module must never be imported into a
     Client Component. Required here because a webhook has no session at all:
     `orders` grants UPDATE only to admins (admin_schema.sql), and the caller is
     a payment provider, not a person. The signature check above is the
     authorisation this replaces. */
  const supabase = createServiceClient();

  /* `.eq("status", "new")` is what makes this idempotent, and providers retry
     freely — a duplicate delivery matches no row the second time, so the order
     is not re-stamped and, more to the point, the receipt is not sent twice.
     The guard is in the WHERE clause rather than in a prior read because two
     concurrent retries would both pass a read-then-write check. */
  const { data: updated, error } = await supabase
    .from("orders")
    .update({ status: "paid", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("status", "new")
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    console.error("[webhook] could not mark order %s paid:", orderId, error.message);
    /* A 500 asks the provider to retry, which is right: the payment is real
       and the order is not yet marked. */
    return NextResponse.json({ error: "Could not record payment" }, { status: 500 });
  }

  if (!updated) {
    // Already paid, or no such order. Either way there is nothing left to do.
    console.warn("[webhook] order %s was not in 'new' — treating as already handled", orderId);
    return NextResponse.json({ received: true, ignored: "already_processed" });
  }

  /* Only now is the receipt honest: the money has moved and the row says so.
     After the 200, so the provider is not kept waiting on Gmail — a webhook
     that answers slowly gets retried, which would send the receipt twice. */
  after(async () => {
    const sent = await sendOrderEmails(orderId);

    if (!sent.customerSent || !sent.ownerSent) {
      console.error(
        "[webhook] order %s marked paid but email incomplete: customer=%s owner=%s%s",
        orderId,
        sent.customerSent,
        sent.ownerSent,
        sent.reason ? ` (${sent.reason})` : ""
      );
    }
  });

  return NextResponse.json({ received: true, orderId });
}
