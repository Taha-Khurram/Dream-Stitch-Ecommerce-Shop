"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";
import { PER_PAGE_OPTIONS } from "@/lib/pagination";
import { getSiteContent } from "@/lib/api/content";
import { DEFAULT_CONTENT, type SiteContent } from "@/lib/content/defaults";
import { parseContentForm } from "@/lib/content/merge";
import { findTab } from "@/lib/content/fields";
import { isMissingInstall } from "@/lib/inbox/install";
import {
  DISCOUNTS_NOT_INSTALLED,
  isDiscountKind,
  isValidCode,
  normalizeCode,
} from "@/lib/discounts/lifecycle";
import {
  ACCEPTED_STATUS,
  INTAKE_STATUS,
  STATUS_COPY,
  hasShipped,
  isOrderStatus,
  statusLabel,
  type OrderStatus,
} from "@/lib/orders/lifecycle";

/**
 * Every mutation runs through the caller's own Supabase session, so the RLS
 * policies in `admin_schema.sql` are the enforcement point. `requireAdmin()`
 * here fails fast with a readable message; Postgres refuses the write anyway.
 *
 * There is no service-role key in this app on purpose — one security model,
 * one place to audit it.
 */

export interface ActionResult {
  ok: boolean;
  message: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

/** Textarea of one value per line → a clean array. */
function lines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Comma-separated field → a clean array. */
function commas(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function num(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function text(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

/**
 * A write that Postgres accepted but that touched no row. RLS filters rather
 * than raises, so this is what a rejected policy looks like from here — and
 * reporting it beats the alternative the settings form used to show: "saved",
 * followed by the old values on the next render.
 */
const NOT_WRITTEN =
  "Saved nothing — the database refused the write. Check that you are signed in as an admin.";

/* ── Bulk selections ────────────────────────────────────────────────────── */

/**
 * A selection is at most one page of rows, so the largest page size is the cap.
 *
 * Not a guard against the admin — the checkboxes cannot tick more than a page —
 * but against the argument arriving from anywhere else. A server action is a
 * public endpoint, and `.in()` with an unbounded list is a URL long enough to
 * be refused by PostgREST rather than by us.
 */
const MAX_BULK = Math.max(...PER_PAGE_OPTIONS);

/** Ids off the wire, deduplicated, emptied of blanks and capped. */
function bulkIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const clean = ids.filter((id): id is string => typeof id === "string" && id.length > 0);
  return [...new Set(clean)].slice(0, MAX_BULK);
}

/** `1 order` / `4 orders` — a count and its noun, agreed. */
function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/** What a batch of order writes stales: the list, the dashboard, each detail. */
function revalidateOrders(ids: string[]): void {
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  for (const id of ids) revalidatePath(`/admin/orders/${id}`);
}

/* ── Products ───────────────────────────────────────────────────────────── */

export async function saveProduct(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  const price = num(formData.get("price"));

  if (!name) return { ok: false, message: "Name is required." };
  if (price === null || price < 0) return { ok: false, message: "Enter a valid price." };

  /* Blank is a real answer — a product nobody has costed yet sells perfectly
     well and simply sits outside the profit figures. A negative one is not,
     and the CHECK in product_cost_price.sql would refuse it with a message
     nobody could act on. Selling below cost is deliberately allowed: the form
     says so in red as it is typed, and a loss-leader is the shop's call. */
  const costPrice = num(formData.get("cost_price"));
  if (costPrice !== null && costPrice < 0) {
    return { ok: false, message: "Cost to make cannot be negative." };
  }

  const categoryId = text(formData.get("category_id"));
  const gallery = lines(formData.get("images"));
  const primary = text(formData.get("image_url")) || gallery[0] || null;

  const payload = {
    name,
    slug: slugify(text(formData.get("slug")) || name),
    description: text(formData.get("description")) || null,
    price,
    compare_at_price: num(formData.get("compare_at_price")),
    stock: num(formData.get("stock")) ?? 0,
    category_id: categoryId || null,
    image_url: primary,
    images: gallery.length ? gallery : primary ? [primary] : null,
    sizes: commas(formData.get("sizes")),
    fabric: text(formData.get("fabric")) || null,
    pieces: text(formData.get("pieces")) || null,
    is_featured: formData.get("is_featured") === "on",
    updated_at: new Date().toISOString(),
  };

  /* The id comes back on both branches now, because the cost is written to a
     second table keyed by it and a brand-new product has no id until Postgres
     hands one over. */
  const { data: saved, error } = id
    ? await supabase.from("products").update(payload).eq("id", id).select("id").maybeSingle()
    : await supabase.from("products").insert(payload).select("id").single();

  if (error) {
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "That slug is already taken by another product."
          : `Could not save: ${error.message}`,
    };
  }

  /* An update that matched nothing is RLS refusing the write — it filters
     rather than raises — and reporting it beats "Saved" over unchanged
     values. It also matters here specifically: the cost write below would go
     through on its own policy and leave a costed product that was never
     actually edited. */
  if (!saved) return { ok: false, message: NOT_WRITTEN };

  const costProblem = await saveProductCost(supabase, saved.id, costPrice);

  /* Revalidated either way: the product itself went in, and leaving the list
     showing yesterday's name because the cost table is missing would compound
     one problem with a second. */
  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/shop");
  revalidatePath("/");

  if (costProblem) return costProblem;

  return { ok: true, message: id ? "Product updated." : "Product created." };
}

/**
 * The cost, into the admin-only table that holds it.
 *
 * A second write rather than another column, because `products` is
 * world-readable and `product_costs` is not — see product_cost_price.sql. It
 * follows the product write rather than sharing it, so a failure here means a
 * saved product with a stale cost rather than a lost edit, and the message
 * says which half went in.
 *
 * A blank box deletes the row. That is the same "not costed" state a product
 * starts life in, and leaving the old figure behind would quietly keep costing
 * a set against a number somebody had just cleared.
 *
 * Returns null when there is nothing to report. Every other answer is `ok:
 * false`, including the missing-migration one: the product genuinely saved, so
 * "failed" is not quite true, but the form redirects away on success and this
 * is a sentence the shop owner needs to be left looking at.
 */
async function saveProductCost(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  cost: number | null
): Promise<ActionResult | null> {
  const { error } =
    cost === null
      ? await supabase.from("product_costs").delete().eq("product_id", productId)
      : await supabase
          .from("product_costs")
          .upsert(
            {
              product_id: productId,
              cost_price: cost,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "product_id" }
          );

  if (!error) return null;

  /* Clearing a cost from a database that has no cost table is not a failure,
     it is a no-op that already happened. Saying otherwise would put a
     migration warning on every single product save until the file is run,
     including on the ones nobody typed a cost into. */
  if (cost === null && isMissingInstall(error)) return null;

  /* The table arrives with product_cost_price.sql and nothing else in the app
     depends on it, so a product saved against a database without it is saved —
     it simply has no cost, which is a state the profit panel already knows how
     to describe. Naming the file beats "Could not find the table
     'public.product_costs' in the schema cache". */
  if (isMissingInstall(error)) {
    return {
      ok: false,
      message:
        "The product saved, but the cost did not: run product_cost_price.sql in the Supabase SQL editor.",
    };
  }

  return { ok: false, message: `The product saved, but the cost did not: ${error.message}` };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    // order_items is ON DELETE RESTRICT, so anything ever ordered is protected.
    return {
      ok: false,
      message:
        error.code === "23503"
          ? "This product appears on a placed order, so it cannot be deleted. Set its stock to 0 instead."
          : `Could not delete: ${error.message}`,
    };
  }

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  return { ok: true, message: "Product deleted." };
}

/**
 * Delete a ticked selection of products.
 *
 * `order_items` is ON DELETE RESTRICT and a DELETE is one statement, so a
 * single product that has ever been ordered would take the whole batch down
 * with a foreign-key error and nothing at all would go. The protected ones are
 * therefore found first and left where they are: removing the other nine and
 * naming the one that stayed is worth more than refusing all ten.
 */
export async function bulkDeleteProducts(ids: string[]): Promise<ActionResult> {
  await requireAdmin();

  const targets = bulkIds(ids);
  if (targets.length === 0) return { ok: false, message: "Nothing selected." };

  const supabase = await createClient();

  const { data: lines, error: linesError } = await supabase
    .from("order_items")
    .select("product_id")
    .in("product_id", targets);

  if (linesError) {
    return { ok: false, message: `Could not check for orders: ${linesError.message}` };
  }

  const onOrders = new Set((lines ?? []).map((line) => (line as { product_id: string }).product_id));
  const removable = targets.filter((id) => !onOrders.has(id));

  if (removable.length === 0) {
    return {
      ok: false,
      message: `Nothing deleted — ${
        onOrders.size === 1 ? "that product appears" : "all of these appear"
      } on placed orders. Set the stock to 0 instead.`,
    };
  }

  const { data: gone, error } = await supabase
    .from("products")
    .delete()
    .in("id", removable)
    .select("id");

  if (error) return { ok: false, message: `Could not delete: ${error.message}` };

  const deleted = gone?.length ?? 0;
  if (deleted === 0) return { ok: false, message: NOT_WRITTEN };

  revalidatePath("/admin/products");
  revalidatePath("/shop");

  return {
    ok: true,
    message:
      `${plural(deleted, "product")} deleted.` +
      (onOrders.size > 0
        ? ` ${plural(onOrders.size, "product")} kept — ${
            onOrders.size === 1 ? "it appears" : "they appear"
          } on placed orders.`
        : ""),
  };
}

/* ── Categories ─────────────────────────────────────────────────────────── */

export async function saveCategory(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  if (!name) return { ok: false, message: "Name is required." };

  const payload = {
    name,
    slug: slugify(text(formData.get("slug")) || name),
    description: text(formData.get("description")) || null,
    image_url: text(formData.get("image_url")) || null,
    updated_at: new Date().toISOString(),
  };

  const { error } = id
    ? await supabase.from("categories").update(payload).eq("id", id)
    : await supabase.from("categories").insert(payload);

  if (error) {
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "That slug is already taken by another category."
          : `Could not save: ${error.message}`,
    };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true, message: id ? "Category updated." : "Category created." };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", id);

  if (count && count > 0) {
    return {
      ok: false,
      message: `${count} product${count === 1 ? "" : "s"} still sit in this category. Move them first.`,
    };
  }

  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, message: `Could not delete: ${error.message}` };

  revalidatePath("/admin/categories");
  revalidatePath("/shop");
  return { ok: true, message: "Category deleted." };
}

/* ── Orders ─────────────────────────────────────────────────────────────── */

/**
 * The status vocabulary lives in `lib/orders/lifecycle.ts` — shared with the
 * pill, the filter rail and the dashboard so none of them can drift from the
 * CHECK constraint in `order_lifecycle.sql`.
 */
export type { OrderStatus };

type AdminClient = Awaited<ReturnType<typeof createClient>>;

/** The one field every order action has to branch on, read once. */
async function readOrder(
  supabase: AdminClient,
  id: string
): Promise<{ id: string; status: string } | null> {
  const { data } = await supabase.from("orders").select("id, status").eq("id", id).single();
  return (data as { id: string; status: string }) ?? null;
}

/**
 * Accept a newly received order into the workflow.
 *
 * The `status` guard on the UPDATE is what makes this safe to click twice, or
 * to click from two browsers at once: acceptance is only ever the transition
 * out of `new`, so a second write matches no row instead of resetting an order
 * someone has already moved along.
 */
export async function acceptOrder(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("orders")
    .update({ status: ACCEPTED_STATUS, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", INTAKE_STATUS)
    .select("id");

  if (error) return { ok: false, message: `Could not accept: ${error.message}` };

  if (!data || data.length === 0) {
    /* Nothing moved. Either the order is gone or it was never `new` — say
       which, because "no rows affected" is not an answer anyone can act on. */
    const current = await readOrder(supabase, id);
    if (!current) return { ok: false, message: "That order no longer exists." };
    return {
      ok: false,
      message: `This order has already been accepted — it is ${statusLabel(
        current.status
      ).toLowerCase()}.`,
    };
  }

  revalidateOrders([id]);

  const stage = STATUS_COPY[ACCEPTED_STATUS].label.toLowerCase();
  return { ok: true, message: `Order accepted — now ${stage}.` };
}

/**
 * Erase an order and its lines.
 *
 * Deleting is not cancelling. A cancelled order stays on the book as the
 * record of something that was called off; a deleted one is a row that should
 * never have been there — a test order, a duplicate, an obvious fake.
 *
 * So the units it took out of the catalogue go back. Checkout decrements stock
 * the moment the order is written, and an order being erased has no claim on
 * that stock at all. The exception is an order that already shipped, where the
 * goods really did leave: there the record is being tidied away rather than
 * undone, and adding the stock back would invent inventory that does not exist.
 */
export async function deleteOrder(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const order = await readOrder(supabase, id);
  if (!order) return { ok: false, message: "That order no longer exists." };

  /* Read the lines before the row goes: order_items is ON DELETE CASCADE, so
     afterwards nothing is left to say what to put back. */
  const returnsStock = !hasShipped(order.status);
  const lines = returnsStock
    ? (await supabase.from("order_items").select("product_id, quantity").eq("order_id", id)).data
    : [];

  const { data: deleted, error } = await supabase
    .from("orders")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, message: `Could not delete: ${error.message}` };

  if (!deleted || deleted.length === 0) {
    /* A DELETE that no policy allows is not an error in PostgREST — it simply
       matches nothing. Without this check the button would report success. */
    return {
      ok: false,
      message:
        "The database refused the delete. Run order_lifecycle.sql to add the admin delete policy.",
    };
  }

  const returned = returnsStock ? await restoreStock(supabase, lines ?? []) : 0;

  revalidateOrders([]);
  revalidatePath("/shop");

  return {
    ok: true,
    message:
      returned > 0
        ? `Order deleted. ${returned} unit${returned === 1 ? "" : "s"} returned to stock.`
        : "Order deleted.",
  };
}

/**
 * Put an erased order's units back on the shelf, and report how many landed.
 *
 * Read-then-write per product, like the decrement in the checkout route — the
 * same trade for the same reason: there is no RPC to add stock in place. Two
 * lines of one order can name the same product, so the quantities are summed
 * first and each product is written exactly once.
 */
async function restoreStock(
  supabase: AdminClient,
  lines: { product_id: string; quantity: number }[]
): Promise<number> {
  if (lines.length === 0) return 0;

  const owed = new Map<string, number>();
  for (const line of lines) {
    owed.set(line.product_id, (owed.get(line.product_id) ?? 0) + line.quantity);
  }

  const { data: products } = await supabase
    .from("products")
    .select("id, stock")
    .in("id", [...owed.keys()]);

  let returned = 0;
  for (const product of (products ?? []) as { id: string; stock: number }[]) {
    const quantity = owed.get(product.id) ?? 0;
    const { error } = await supabase
      .from("products")
      .update({ stock: product.stock + quantity, updated_at: new Date().toISOString() })
      .eq("id", product.id);
    if (!error) returned += quantity;
  }

  return returned;
}

/**
 * Move an accepted order to another stage.
 *
 * Two things are refused rather than written. `new` is not a destination — an
 * order cannot be un-received, and acceptance is `acceptOrder`'s job. And an
 * order still sitting at `new` cannot be dropped into the middle of the
 * workflow, so the triage step cannot be skipped by an admin who deep-links to
 * the detail page.
 */
export async function updateOrderStatus(id: string, status: string): Promise<ActionResult> {
  await requireAdmin();

  if (!isOrderStatus(status)) {
    return { ok: false, message: "Unknown order status." };
  }

  if (status === INTAKE_STATUS) {
    return { ok: false, message: "An order cannot be moved back to awaiting review." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", INTAKE_STATUS)
    .select("id");

  if (error) return { ok: false, message: `Could not update: ${error.message}` };

  if (!data || data.length === 0) {
    const current = await readOrder(supabase, id);
    if (!current) return { ok: false, message: "That order no longer exists." };
    return { ok: false, message: "Accept this order before setting a status." };
  }

  revalidateOrders([id]);
  return { ok: true, message: `Order marked ${statusLabel(status).toLowerCase()}.` };
}

/* ── Orders in bulk ─────────────────────────────────────────────────────── */

/**
 * The three below are the row actions above, applied to a ticked selection —
 * and deliberately nothing more. Every guard the single-row version enforces
 * is enforced here by the same `WHERE` clause, so a bulk action can never
 * reach a transition an admin could not have made one row at a time. What
 * changes is only the reporting: a batch can be partly refused, and saying
 * "6 marked, 2 skipped" is the whole point of running it as a batch.
 */

/** Accept every selection still awaiting review. Mirrors `acceptOrder`. */
export async function bulkAcceptOrders(ids: string[]): Promise<ActionResult> {
  await requireAdmin();

  const targets = bulkIds(ids);
  if (targets.length === 0) return { ok: false, message: "Nothing selected." };

  const supabase = await createClient();

  /* Same `status` guard as the single accept, so this stays safe to click
     twice and safe to run against a selection someone else is working on:
     acceptance is only ever the transition out of `new`. */
  const { data, error } = await supabase
    .from("orders")
    .update({ status: ACCEPTED_STATUS, updated_at: new Date().toISOString() })
    .in("id", targets)
    .eq("status", INTAKE_STATUS)
    .select("id");

  if (error) return { ok: false, message: `Could not accept: ${error.message}` };

  const accepted = (data ?? []).map((row) => (row as { id: string }).id);
  if (accepted.length === 0) {
    return {
      ok: false,
      message: "Nothing to accept — none of these is still awaiting review.",
    };
  }

  revalidateOrders(accepted);

  const already = targets.length - accepted.length;
  const stage = STATUS_COPY[ACCEPTED_STATUS].label.toLowerCase();
  return {
    ok: true,
    message:
      `${plural(accepted.length, "order")} accepted — now ${stage}.` +
      (already > 0 ? ` ${plural(already, "order")} had already been accepted.` : ""),
  };
}

/** Move a selection along the status track. Mirrors `updateOrderStatus`. */
export async function bulkSetOrderStatus(ids: string[], status: string): Promise<ActionResult> {
  await requireAdmin();

  if (!isOrderStatus(status)) return { ok: false, message: "Unknown order status." };
  if (status === INTAKE_STATUS) {
    return { ok: false, message: "An order cannot be moved back to awaiting review." };
  }

  const targets = bulkIds(ids);
  if (targets.length === 0) return { ok: false, message: "Nothing selected." };

  const supabase = await createClient();

  /* `.neq(INTAKE_STATUS)` is what keeps triage from being skipped in bulk: an
     order still sitting at `new` is passed over rather than dropped into the
     middle of the workflow, exactly as the single-row action refuses it. */
  const { data, error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .in("id", targets)
    .neq("status", INTAKE_STATUS)
    .select("id");

  if (error) return { ok: false, message: `Could not update: ${error.message}` };

  const moved = (data ?? []).map((row) => (row as { id: string }).id);
  if (moved.length === 0) {
    return { ok: false, message: "Nothing moved — accept these orders before setting a status." };
  }

  revalidateOrders(moved);

  const skipped = targets.length - moved.length;
  return {
    ok: true,
    message:
      `${plural(moved.length, "order")} marked ${statusLabel(status).toLowerCase()}.` +
      (skipped > 0 ? ` ${plural(skipped, "order")} skipped — accept those first.` : ""),
  };
}

/**
 * Erase a selection of orders, returning the stock they were holding.
 *
 * Same rule as the single delete, applied per order rather than to the batch:
 * an order that has not shipped gives its units back, and one that has does
 * not — the goods really did leave, and crediting them would invent inventory.
 * So the lines are read before the delete (order_items is ON DELETE CASCADE,
 * and afterwards there is nothing left to say what to put back) and then
 * narrowed to the orders that actually went.
 */
export async function bulkDeleteOrders(ids: string[]): Promise<ActionResult> {
  await requireAdmin();

  const targets = bulkIds(ids);
  if (targets.length === 0) return { ok: false, message: "Nothing selected." };

  const supabase = await createClient();

  const { data: rows } = await supabase.from("orders").select("id, status").in("id", targets);
  const orders = (rows ?? []) as { id: string; status: string }[];
  if (orders.length === 0) return { ok: false, message: "Those orders no longer exist." };

  const restorable = orders.filter((order) => !hasShipped(order.status)).map((order) => order.id);
  const { data: lines } = restorable.length
    ? await supabase
        .from("order_items")
        .select("order_id, product_id, quantity")
        .in("order_id", restorable)
    : { data: [] };

  const { data: gone, error } = await supabase
    .from("orders")
    .delete()
    .in(
      "id",
      orders.map((order) => order.id)
    )
    .select("id");

  if (error) return { ok: false, message: `Could not delete: ${error.message}` };

  const deleted = new Set((gone ?? []).map((row) => (row as { id: string }).id));
  if (deleted.size === 0) {
    /* A DELETE no policy allows matches nothing rather than raising, so
       without this the bar would report a batch that never happened. */
    return {
      ok: false,
      message:
        "The database refused the delete. Run order_lifecycle.sql to add the admin delete policy.",
    };
  }

  const returned = await restoreStock(
    supabase,
    ((lines ?? []) as { order_id: string; product_id: string; quantity: number }[]).filter((line) =>
      deleted.has(line.order_id)
    )
  );

  revalidateOrders([]);
  revalidatePath("/shop");

  const missed = targets.length - deleted.size;
  return {
    ok: true,
    message:
      `${plural(deleted.size, "order")} deleted.` +
      (returned > 0 ? ` ${plural(returned, "unit")} returned to stock.` : "") +
      (missed > 0 ? ` ${plural(missed, "order")} could not be deleted.` : ""),
  };
}

/* ── Discount codes ─────────────────────────────────────────────────────── */

/**
 * The rules are written here; the ledger is never touched.
 *
 * There is no action for adding or removing a redemption, and that is
 * deliberate. A redemption is not a record somebody keeps — it is what
 * spending a code left behind, written by `redeem_discount()` under a lock,
 * and it is the only thing the caps are counted from. An admin who could edit
 * it could quietly change how many uses a coupon has left, which is exactly
 * the number the lock exists to protect. Giving a use back is done by deleting
 * the order, which cascades. See discount_codes.sql.
 */

/** `datetime-local` → an ISO instant, read in the admin's own timezone. */
function when(value: FormDataEntryValue | null): string | null | false {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? false : parsed.toISOString();
}

/** A blank optional limit means unlimited, which is null and not zero. */
function limit(value: FormDataEntryValue | null): number | null | false {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : false;
}

/** What a write says when discount_codes.sql has not been run. */
function discountWriteError(error: { code?: string; message?: string }): string {
  if (isMissingInstall(error)) return DISCOUNTS_NOT_INSTALLED;
  if (error.code === "23505") return "That code already exists. Codes are unique.";
  /* The CHECK constraints — the shape of the code, the percentage range, a
     window that closes before it opens. Everything below is validated here
     first, so reaching this means the two disagree about a rule. */
  if (error.code === "23514") return "The database rejected those values. Check the code and its window.";
  return `Could not save: ${error.message}`;
}

export async function saveDiscount(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const id = text(formData.get("id"));
  const code = normalizeCode(text(formData.get("code")));
  const kind = text(formData.get("kind"));
  const value = num(formData.get("value"));

  if (!isValidCode(code)) {
    return {
      ok: false,
      message:
        "A code is 3–32 characters of letters, digits, dashes and underscores, starting with a letter or digit.",
    };
  }

  if (!isDiscountKind(kind)) return { ok: false, message: "Pick what the code takes off." };

  if (value === null || value <= 0) {
    return { ok: false, message: "Enter an amount greater than zero." };
  }

  if (kind === "percent" && value > 100) {
    return { ok: false, message: "A percentage cannot be more than 100." };
  }

  const minSubtotal = num(formData.get("min_subtotal")) ?? 0;
  if (minSubtotal < 0) return { ok: false, message: "The minimum cannot be negative." };

  const maxUses = limit(formData.get("max_uses"));
  if (maxUses === false) {
    return { ok: false, message: "Total uses must be a whole number above zero, or blank for unlimited." };
  }

  const perCustomer = limit(formData.get("per_customer_limit"));
  if (perCustomer === false) {
    return {
      ok: false,
      message: "Uses per customer must be a whole number above zero, or blank for unlimited.",
    };
  }

  const startsAt = when(formData.get("starts_at"));
  const expiresAt = when(formData.get("expires_at"));

  if (startsAt === false || expiresAt === false) {
    return { ok: false, message: "One of those dates could not be read." };
  }

  if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) {
    return { ok: false, message: "The end date has to come after the start date." };
  }

  const payload = {
    code,
    kind,
    value,
    min_subtotal: minSubtotal,
    max_uses: maxUses,
    per_customer_limit: perCustomer,
    starts_at: startsAt,
    expires_at: expiresAt,
    is_active: formData.get("is_active") === "on",
    description: text(formData.get("description")) || null,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error } = id
    ? await supabase.from("discount_codes").update(payload).eq("id", id).select("id")
    : await supabase.from("discount_codes").insert(payload).select("id");

  if (error) return { ok: false, message: discountWriteError(error) };
  if (!saved || saved.length === 0) return { ok: false, message: NOT_WRITTEN };

  revalidateDiscounts();
  return { ok: true, message: id ? "Code updated." : "Code created." };
}

/**
 * The off switch, on its own.
 *
 * Separate from the form because pausing a code is a one-click decision made
 * from a list — usually because it is being abused, and usually in a hurry.
 * It leaves the dates alone: "stop this now" and "this was always going to end
 * on Sunday" are different facts, and a code that is switched back on should
 * come back to the schedule it had.
 */
export async function setDiscountActive(id: string, active: boolean): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { data: saved, error } = await supabase
    .from("discount_codes")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id");

  if (error) return { ok: false, message: discountWriteError(error) };
  if (!saved || saved.length === 0) return { ok: false, message: NOT_WRITTEN };

  revalidateDiscounts();
  return { ok: true, message: active ? "Code resumed." : "Code paused." };
}

/**
 * Deleting a code takes its redemptions with it — `discount_redemptions` is
 * ON DELETE CASCADE from the rule. The orders themselves are untouched and
 * keep their own `discount_code` and `discount_amount`, which is the whole
 * reason those two columns are on the order: what somebody was charged has to
 * stay legible after the coupon that did it is gone.
 *
 * Which is also why pausing is offered beside this on every row. Deleting a
 * code that has been used loses the usage history; pausing it loses nothing.
 */
export async function deleteDiscount(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("discount_codes").delete().eq("id", id);

  if (error) {
    return {
      ok: false,
      message: isMissingInstall(error)
        ? DISCOUNTS_NOT_INSTALLED
        : `Could not delete: ${error.message}`,
    };
  }

  revalidateDiscounts();
  return { ok: true, message: "Code deleted." };
}

/** The list, and the dashboard panel that reads the same aggregates. */
function revalidateDiscounts(): void {
  revalidatePath("/admin/discounts");
  revalidatePath("/admin");
}

/* ── Settings ───────────────────────────────────────────────────────────── */

export async function saveSettings(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const threshold = num(formData.get("free_shipping_threshold"));
  const fee = num(formData.get("shipping_fee"));

  if (threshold === null || threshold < 0) {
    return { ok: false, message: "Enter a valid free-delivery threshold." };
  }
  if (fee === null || fee < 0) {
    return { ok: false, message: "Enter a valid delivery fee." };
  }

  const announcements = lines(formData.get("announcements"));
  if (announcements.length === 0) {
    return { ok: false, message: "Keep at least one announcement line." };
  }

  // Upsert, not update: a database whose `store_settings` seed never ran has
  // no row 1, and `UPDATE ... WHERE id = 1` against it matches nothing and
  // reports no error — the save looked fine and the form came back showing
  // the compiled-in defaults again.
  const { data: saved, error } = await supabase
    .from("store_settings")
    .upsert(
      {
        id: 1,
        brand_email: text(formData.get("brand_email")) || null,
        brand_phone: text(formData.get("brand_phone")) || null,
        brand_whatsapp: text(formData.get("brand_whatsapp")) || null,
        brand_address: text(formData.get("brand_address")) || null,
        free_shipping_threshold: threshold,
        shipping_fee: fee,
        announcements,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    )
    .select("id");

  if (error) return { ok: false, message: `Could not save: ${error.message}` };
  if (!saved || saved.length === 0) {
    return { ok: false, message: NOT_WRITTEN };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}

/* ── Page content ───────────────────────────────────────────────────────── */

/**
 * `store_settings.content` is one jsonb document, and each tab of the editor
 * posts only its own fields — so the write is always "current content, with
 * this form's fields applied", never a partial document.
 */
async function writeContent(content: SiteContent, message: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: saved, error } = await supabase
    .from("store_settings")
    .upsert({ id: 1, content, updated_at: new Date().toISOString() }, { onConflict: "id" })
    .select("id");

  if (error) {
    return {
      ok: false,
      message:
        error.code === "42703" || error.code === "PGRST204"
          ? "The content column is missing — run admin_schema.sql against this database first."
          : `Could not save: ${error.message}`,
    };
  }

  if (!saved || saved.length === 0) {
    return { ok: false, message: NOT_WRITTEN };
  }

  // Header, footer and every page read this, so the whole tree is stale.
  revalidatePath("/", "layout");
  return { ok: true, message };
}

export async function saveContent(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const current = await getSiteContent();
  return writeContent(parseContentForm(formData, current), "Content saved.");
}

/** Put one tab of the editor back to the values compiled into the app. */
export async function resetContent(tabKey: string): Promise<ActionResult> {
  await requireAdmin();

  const tab = findTab(tabKey);
  if (!tab) return { ok: false, message: "Unknown settings tab." };

  const next = structuredClone(await getSiteContent()) as Record<string, unknown>;
  for (const section of tab.sections) {
    assign(next, section.path, at(DEFAULT_CONTENT, section.path));
  }

  return writeContent(next as SiteContent, `${tab.label} restored to defaults.`);
}

/** Read a dotted path out of a content tree. */
function at(tree: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], tree);
}

/** Write a dotted path into a content tree, cloning what it puts there. */
function assign(tree: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split(".");
  const last = keys.pop()!;
  let node = tree;
  for (const key of keys) node = node[key] as Record<string, unknown>;
  node[last] = structuredClone(value);
}
