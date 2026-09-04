import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/api";
import { statusPatchSchema } from "@/lib/validations/inbox";
import { INBOX_NOT_INSTALLED, isMissingInstall } from "@/lib/inbox/install";
import { isSubscriberStatus, subscriberStatusLabel } from "@/lib/inbox/lifecycle";

export const dynamic = "force-dynamic";

/**
 * One subscriber, from the panel's side. Same shape and same reasoning as the
 * contact-message handlers next door — see the note there on why the inbox
 * mutates through route handlers rather than server actions.
 */

const idSchema = z.string().uuid();

const BASE_PATH = "/admin/newsletter";

function revalidateList(): void {
  revalidatePath(BASE_PATH);
  revalidatePath("/admin");
}

/**
 * Take an address off the list, or put it back.
 *
 * `unsubscribed_at` is stamped and cleared alongside the status rather than
 * left to drift, so the column always answers "when did they leave" for the
 * rows that have left and nothing for the rows that have not.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, error: "Unknown subscriber." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = statusPatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "A status is required." }, { status: 400 });
  }

  const { status } = parsed.data;

  if (!isSubscriberStatus(status)) {
    return NextResponse.json({ success: false, error: "Unknown status." }, { status: 400 });
  }

  const now = new Date().toISOString();

  const { data, error } = await auth.supabase
    .from("newsletter_subscribers")
    .update({
      status,
      unsubscribed_at: status === "unsubscribed" ? now : null,
      updated_at: now,
    })
    .eq("id", id)
    .select("id, email, status");

  if (error) {
    if (isMissingInstall(error)) {
      return NextResponse.json({ success: false, error: INBOX_NOT_INSTALLED }, { status: 501 });
    }

    console.error("Subscriber update failed:", error.message);
    return NextResponse.json(
      { success: false, error: "Could not update the subscriber." },
      { status: 500 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, error: "That subscriber no longer exists." },
      { status: 404 }
    );
  }

  return revalidateAnd({
    success: true,
    status,
    message: `${data[0].email} marked ${subscriberStatusLabel(status).toLowerCase()}.`,
  });
}

/**
 * Erase the record entirely.
 *
 * Worth pausing over, because it is not the same as unsubscribing and the
 * screen says so before it happens. Unsubscribing keeps the address on file as
 * a suppression entry; deleting forgets it, so the same person subscribing
 * again out of habit — or the next import — quietly puts them back on the
 * list. Deleting is for a mistyped address or an erasure request, not for
 * tidying up.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, error: "Unknown subscriber." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("newsletter_subscribers")
    .delete()
    .eq("id", id)
    .select("id, email");

  if (error) {
    if (isMissingInstall(error)) {
      return NextResponse.json({ success: false, error: INBOX_NOT_INSTALLED }, { status: 501 });
    }

    console.error("Subscriber delete failed:", error.message);
    return NextResponse.json(
      { success: false, error: "Could not delete the subscriber." },
      { status: 500 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, error: "That subscriber no longer exists." },
      { status: 404 }
    );
  }

  return revalidateAnd({ success: true, message: `${data[0].email} removed from the list.` });
}

/** Both verbs end the same way: redraw the list, then answer. */
function revalidateAnd(payload: Record<string, unknown>): NextResponse {
  revalidateList();
  return NextResponse.json(payload);
}
