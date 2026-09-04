"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";
import { getSiteContent } from "@/lib/api/content";
import { DEFAULT_CONTENT, type SiteContent } from "@/lib/content/defaults";
import { parseContentForm } from "@/lib/content/merge";
import { findTab } from "@/lib/content/fields";
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

/* ── Products ───────────────────────────────────────────────────────────── */

export async function saveProduct(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();

  const id = text(formData.get("id"));
  const name = text(formData.get("name"));
  const price = num(formData.get("price"));

  if (!name) return { ok: false, message: "Name is required." };
  if (price === null || price < 0) return { ok: false, message: "Enter a valid price." };

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

  const { error } = id
    ? await supabase.from("products").update(payload).eq("id", id)
    : await supabase.from("products").insert(payload);

  if (error) {
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "That slug is already taken by another product."
          : `Could not save: ${error.message}`,
    };
  }

  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/");

  return { ok: true, message: id ? "Product updated." : "Product created." };
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

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");

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

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
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

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath("/admin");
  return { ok: true, message: `Order marked ${statusLabel(status).toLowerCase()}.` };
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
