import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/api";

export const dynamic = "force-dynamic";

/**
 * One customer, from the panel's side. Same shape and reasoning as the
 * subscriber handler — a route handler rather than a server action, so the
 * row can report its own failure without the page navigating.
 */

const idSchema = z.string().uuid();

/**
 * Remove a customer record.
 *
 * Deliberately narrow. `orders.customer_id` is `ON DELETE SET NULL`, so the
 * orders themselves survive with their totals and shipping details intact —
 * they simply stop pointing at a customer row. Nothing here touches
 * `auth.users`, so a shopper with an account keeps it and can sign in again;
 * what goes is the book entry, not the person.
 *
 * The count of detached orders comes back in the message, because "deleted"
 * and "deleted, and unhooked eleven orders from the customer book" deserve
 * different reactions from whoever pressed the button.
 */
export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminUser();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;

  if (!idSchema.safeParse(id).success) {
    return NextResponse.json({ success: false, error: "Unknown customer." }, { status: 400 });
  }

  /* Counted before the delete, because afterwards the rows no longer point
     here and there is nothing left to count. */
  const { count: orderCount } = await auth.supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_id", id);

  const { data, error } = await auth.supabase
    .from("customers")
    .delete()
    .eq("id", id)
    .select("id, name, email");

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json(
        { success: false, error: "The customers table is not there yet. Run dashboard_schema.sql." },
        { status: 501 }
      );
    }

    console.error("Customer delete failed:", error.message);
    return NextResponse.json(
      { success: false, error: "Could not delete the customer." },
      { status: 500 }
    );
  }

  /* No rows came back from a delete that did not error: either it is already
     gone, or RLS declined it. `Admins delete customers` covers this caller,
     so in practice it is the former. */
  if (!data || data.length === 0) {
    return NextResponse.json(
      { success: false, error: "That customer no longer exists." },
      { status: 404 }
    );
  }

  const detached = orderCount ?? 0;
  const who = data[0].name || data[0].email;

  revalidatePath("/admin/customers");
  revalidatePath("/admin");

  return NextResponse.json({
    success: true,
    message:
      detached > 0
        ? `${who} removed. ${detached} order${detached === 1 ? "" : "s"} kept, now unassigned.`
        : `${who} removed from the customer book.`,
  });
}
