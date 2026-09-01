"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/admin";

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

const ORDER_STATUSES = ["pending", "processing", "completed", "cancelled"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export async function updateOrderStatus(id: string, status: string): Promise<ActionResult> {
  await requireAdmin();

  if (!ORDER_STATUSES.includes(status as OrderStatus)) {
    return { ok: false, message: "Unknown order status." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { ok: false, message: `Could not update: ${error.message}` };

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true, message: `Order marked ${status}.` };
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

  const { error } = await supabase
    .from("store_settings")
    .update({
      brand_email: text(formData.get("brand_email")) || null,
      brand_phone: text(formData.get("brand_phone")) || null,
      brand_whatsapp: text(formData.get("brand_whatsapp")) || null,
      brand_address: text(formData.get("brand_address")) || null,
      free_shipping_threshold: threshold,
      shipping_fee: fee,
      announcements,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) return { ok: false, message: `Could not save: ${error.message}` };

  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}
