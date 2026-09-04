import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { discountPreviewSchema } from "@/lib/validations/checkout";
import { priceCart } from "@/lib/api/cart";
import { previewDiscount } from "@/lib/discounts/api";
import { DISCOUNTS_NOT_INSTALLED, outcomeMessage } from "@/lib/discounts/lifecycle";
import { clientKey, take } from "@/lib/inbox/throttle";

/** It reads live rules and a live ledger. Never cached by anything between. */
export const dynamic = "force-dynamic";

/**
 * "Does this code work on this bag?"
 *
 * The one endpoint behind the promo field in the cart drawer. It never spends
 * anything — `/api/checkout` does that, under a lock, and re-checks every rule
 * on the way. What this buys is that a shopper finds out at the moment they
 * type the code rather than at the moment they press Place Order.
 *
 * Public and unauthenticated on purpose, matching /api/newsletter: asking
 * someone to hold an account before they can find out whether the card in
 * their hand is worth anything is the wrong trade. What replaces the session as
 * a boundary is that the caller cannot read the table — it hands one code to
 * `preview_discount()`, which answers about that code and never enumerates.
 * There is no SELECT policy on `discount_codes` for anyone. See
 * discount_codes.sql.
 *
 * The per-customer limit is the one rule this cannot check for a signed-out
 * browser, because there is no identity to count against yet. Checkout applies
 * it for real. A shopper can therefore be told a once-per-customer code is
 * good and then be refused at the last step — which is the correct order for
 * that particular disappointment, since signing in is what changes the answer.
 */

/** Generous for a person typing a code off a card, stingy for a loop. */
const RATE_LIMIT = { limit: 20, windowMs: 60_000 };

export async function POST(request: Request) {
  const throttle = take("discount", clientKey(request.headers), RATE_LIMIT);

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

  const parsed = discountPreviewSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        /* The rule that was actually broken, phrased for the person who broke
           it — the same contract /api/checkout honours. */
        error: parsed.error.issues[0]?.message ?? "That code could not be checked.",
      },
      { status: 400 }
    );
  }

  const { code, items } = parsed.data;
  const supabase = await createClient();

  /* Priced from the catalogue, never from the payload. A subtotal the browser
     chose would let anyone quote themselves a discount against a bag they do
     not have. See lib/api/cart.ts. */
  const cart = await priceCart(supabase, items);

  if (!cart.ok) {
    return NextResponse.json({ success: false, error: cart.error }, { status: cart.status });
  }

  const preview = await previewDiscount(supabase, code, cart.subtotal);

  if (preview.status === "not_installed") {
    /* 501 rather than 500: the request was fine, the feature is simply not
       installed on this deployment. Same answer the inbox endpoints give. */
    return NextResponse.json(
      { success: false, error: DISCOUNTS_NOT_INSTALLED },
      { status: 501 }
    );
  }

  if (preview.status === "failed") {
    return NextResponse.json(
      { success: false, error: "Could not check that code just now. Please try again." },
      { status: 503 }
    );
  }

  const result = preview.value;

  if (result.outcome !== "ok") {
    return NextResponse.json(
      {
        success: false,
        outcome: result.outcome,
        error: outcomeMessage(result.outcome, { minSubtotal: result.minSubtotal }),
      },
      /* 422, not 400: the request was well-formed and understood, and the
         answer is about the code rather than about the request. */
      { status: 422, headers: { "Cache-Control": "no-store" } }
    );
  }

  return NextResponse.json(
    {
      success: true,
      outcome: result.outcome,
      /* Exactly what `AppliedDiscount` needs and nothing more — the cap, the
         per-customer limit and the dates are the panel's business, and the
         drawer can recompute the reduction from these four as the bag
         changes. See lib/discounts/lifecycle.ts. */
      discount: {
        code: result.code,
        kind: result.kind,
        value: result.value,
        minSubtotal: result.minSubtotal ?? 0,
      },
      amount: result.amount,
      subtotal: cart.subtotal,
      message: outcomeMessage("ok"),
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
