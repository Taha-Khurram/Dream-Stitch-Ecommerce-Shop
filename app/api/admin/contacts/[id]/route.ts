import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/api";
import { statusPatchSchema } from "@/lib/validations/inbox";
import { INBOX_NOT_INSTALLED, isMissingInstall } from "@/lib/inbox/install";
import {
  isMessageStatus,
  messageReference,
  messageStatusLabel,
} from "@/lib/inbox/lifecycle";

export const dynamic = "force-dynamic";

/**
 * One message, from the panel's side.
 *
 * Route handlers rather than server actions, and it is worth saying why the
 * inbox breaks with the catalogue's convention. The screens here mutate from
 * three places that are not form submissions: the detail page marks a message
 * read the moment it is opened, the row actions fire from inside a table, and
 * a delete has to redirect afterwards. Each is a fetch with a result to render,
 * which is what `requireAdminUser()` in lib/auth/api.ts was written for — it
 * answers 401 and 403 as statuses, where `requireAdmin()` would redirect a
 * fetch to an HTML sign-in page and hand the client a 200 full of markup.
 *
 * The gate here is still not the security boundary. `is_admin()` guards every
 * policy in inbox_schema.sql, so a forged session that got past this would be
 * refused by Postgres. This exists to give the caller an honest status instead
 * of a silently empty result.
 */

const idSchema = z.string().uuid();

const BASE_PATH = "/admin/contacts";

/** Redraw the list, the message, and the dashboard tile that counts unread. */
function revalidateInbox(id: string): void {
  revalidatePath(BASE_PATH);
  revalidatePath(`${BASE_PATH}/${id}`);
  revalidatePath("/admin");
}

/**
 * Move a message along: read, replied, archived — or back to new, which is the
 * "actually, deal with this later" button and the one status the storefront
 * also writes. All four are allowed here on purpose; unlike an order, nothing
 * downstream depends on a message never going backwards.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, error: "Unknown message." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = statusPatchSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "A status is required." },
      { status: 400 }
    );
  }

  const { status } = parsed.data;

  if (!isMessageStatus(status)) {
    return NextResponse.json({ success: false, error: "Unknown status." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("contact_messages")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status");

  if (error) {
    if (isMissingInstall(error)) {
      return NextResponse.json({ success: false, error: INBOX_NOT_INSTALLED }, { status: 501 });
    }

    console.error("Contact message update failed:", error.message);
    return NextResponse.json(
      { success: false, error: "Could not update the message." },
      { status: 500 }
    );
  }

  /* No error and no row means RLS filtered it, or it is already gone. Both
     read the same from here, and "no longer exists" is the honest one — an
     admin who got this far is an admin. */
  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, error: "That message no longer exists." },
      { status: 404 }
    );
  }

  revalidateInbox(id);

  return NextResponse.json({
    success: true,
    status,
    message: `Marked ${messageStatusLabel(status).toLowerCase()}.`,
  });
}

/** Erase a message. There is no soft delete — `archived` is what that is for. */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, error: "Unknown message." }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("contact_messages")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    if (isMissingInstall(error)) {
      return NextResponse.json({ success: false, error: INBOX_NOT_INSTALLED }, { status: 501 });
    }

    console.error("Contact message delete failed:", error.message);
    return NextResponse.json(
      { success: false, error: "Could not delete the message." },
      { status: 500 }
    );
  }

  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, error: "That message no longer exists." },
      { status: 404 }
    );
  }

  revalidateInbox(id);

  return NextResponse.json({
    success: true,
    message: `Message ${messageReference(id)} deleted.`,
  });
}
