/**
 * Order email. **Server-only** — it holds the service-role client and the SMTP
 * password, and `server-only` makes importing it from a Client Component a
 * build error.
 *
 * Two messages per order: the customer's receipt and a notification to the
 * shop. They are sent independently and reported independently, because they
 * fail for unrelated reasons — a customer's mailbox being full says nothing
 * about whether the owner heard about the order, and one bouncing must never
 * suppress the other.
 *
 * The customer's message is *the receipt* — the same document
 * `app/(print)/admin/orders/[id]/receipt/page.tsx` prints and puts in the
 * parcel, rebuilt in the table-and-inline-styles dialect a mail client will
 * render. Same masthead, same two panels, same numbered lines, same foot, same
 * words. It is emphatically not a second, looser rendering of the same order:
 * the sheet in the box and the mail in the inbox are one document, and the
 * customer will hold them side by side.
 *
 * Which is why the arithmetic comes from `orderTotals()` rather than being
 * re-derived from lib/pricing. The printed sheet fits its breakdown to
 * `orders.total_amount` — the figure actually charged, possibly under a
 * delivery rate the store has since changed — and an email that recomputed
 * delivery from today's rates would print a different foot for the same order.
 * One order, one set of figures, one function.
 *
 * Nothing here throws. The caller is a fire-and-forget hook on a checkout that
 * has already succeeded; an exception escaping this module would, at best, be
 * an unhandled rejection in a request that has already returned, and at worst
 * take down the order it is reporting on.
 */

import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { fromIdentity, ownerAddress, transporter } from "@/lib/nodemailer";
import { BRAND } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { SITE_URL } from "@/lib/site-url";
import { selectOrderColumns } from "@/lib/orders/columns";
import {
  ORDER_DOCUMENT_COLUMNS,
  ORDER_DOCUMENT_ITEMS,
  orderTotals,
  type OrderTotals,
} from "@/lib/admin/order-document";
import { customerStatusLabel, orderReference } from "@/lib/orders/lifecycle";
import { isCollectOnDelivery, paymentLabel, totalLabel } from "@/lib/orders/payment";
import { resolveCutSpec } from "@/lib/size-guide";
import {
  convertCustomSize,
  customSizeFromRow,
  formatDimension,
  otherUnit,
} from "@/lib/custom-size";
import { mergeContent } from "@/lib/content/merge";
import { DEFAULT_CONTENT, type SiteContent } from "@/lib/content/defaults";
import type { Order, OrderItem, ShippingAddress } from "@/types/ecommerce";

/** "Dream Stitch by Sk" — assembled from the one place the brand is defined. */
const STORE_NAME = `${BRAND.name} by ${BRAND.suffix.replace(/^by\s+/i, "")}`;

export interface OrderEmailResult {
  customerSent: boolean;
  ownerSent: boolean;
  /** Why nothing was sent, when neither was. Absent on a normal send. */
  reason?: "order_not_found" | "customer_email_missing" | "lookup_failed";
}

/* ── Shapes of what is actually selected ──────────────────────────────────
   The order itself is `Order`, read through the same columns and the same
   embed the printed sheets use, so the two documents cannot end up rendering
   different subsets of the same row. Only the customer embed is extra, and it
   is re-typed because PostgREST returns a to-one embed as an object or as a
   one-element array depending on what it can prove about the relationship —
   the same quirk `productCost()` documents in lib/admin/cost.ts. */

type CustomerEmbed = { name: string | null; email: string | null };

type ReceiptOrder = Omit<Order, "customer"> & {
  customer?: CustomerEmbed | CustomerEmbed[] | null;
};

/** Flatten PostgREST's object-or-array embed to the single row it means. */
function one<T>(embed: T | T[] | null | undefined): T | null {
  if (!embed) return null;
  return Array.isArray(embed) ? embed[0] ?? null : embed;
}

/** One line, resolved into exactly what a printed row shows. */
interface Line {
  name: string;
  /** `Pure Cotton · 1 sheet + 2 pillow covers`, or empty when unknown. */
  attributes: string;
  /** The size sentence — stock, made-to-measure, or "not recorded". */
  size: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

/**
 * The lines, described the way the receipt describes them.
 *
 * Deliberately more than name-and-size: the printed sheet carries the fabric,
 * the piece count and the finished dimensions behind a stock size, because
 * "King Size" is not something a buyer can check a parcel against and
 * `108" x 96"` is. Reproducing that here is most of the point of this change —
 * the old email printed the bare word and nothing else.
 */
function buildLines(order: ReceiptOrder, content: SiteContent): Line[] {
  return (order.order_items ?? []).map((item) => {
    const unitPrice = Number(item.unit_price) || 0;
    const quantity = Number(item.quantity) || 0;

    return {
      name: item.product?.name ?? "Item no longer in our catalogue",
      attributes: [item.product?.fabric, item.product?.pieces].filter(Boolean).join(" · "),
      size: describeSize(item, content),
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
    };
  });
}

/**
 * The size, in one line, for whichever of the three cases the row is.
 *
 * Mirrors `describeSize()` on the receipt page, and for its reasons: a
 * made-to-measure set prints both units because the buyer measured with
 * whichever tape they own; a stock size prints its name and the finished
 * dimensions from the same chart the product page showed; a row with neither
 * prints what was ordered and nothing more.
 */
function describeSize(item: OrderItem, content: SiteContent): string {
  const custom = customSizeFromRow(item);

  if (custom) {
    const converted = convertCustomSize(custom, otherUnit(custom.unit));
    return (
      `Made to measure · ${formatDimension(custom.width, custom.unit)} × ` +
      `${formatDimension(custom.height, custom.unit)} ` +
      `(${formatDimension(converted.width, converted.unit)} × ` +
      `${formatDimension(converted.height, converted.unit)})`
    );
  }

  const spec = resolveCutSpec(content, item.product?.category?.slug, item.size);

  if (spec) {
    const finished = spec.spec.map((entry) => `${entry.label} ${entry.value}`).join(" · ");
    return finished ? `${spec.size} · ${finished}` : spec.size;
  }

  return item.size?.trim() || "Size not recorded";
}

/* ── Reads that cannot go through the request-scoped helpers ───────────────
   `getSettings()` and `getSiteContent()` build a cookie-backed client, and
   `cookies()` is only valid inside a request scope — which this is not, once
   the checkout response has been flushed and the send is running on its own.
   Both read `store_settings`, which is world-readable ("Anyone reads store
   settings"), so the service role grants nothing extra here; it is simply the
   only client available. Each falls back exactly as its request-scoped twin
   does, so a missing row costs a masthead detail rather than the email. */

interface BrandContact {
  address: string;
  phone: string;
  email: string;
}

async function brandContact(): Promise<BrandContact> {
  const fallback: BrandContact = {
    address: BRAND.address,
    phone: BRAND.phone,
    email: BRAND.email,
  };

  try {
    const { data } = await createServiceClient()
      .from("store_settings")
      .select("brand_address, brand_phone, brand_email")
      .eq("id", 1)
      .maybeSingle<{
        brand_address: string | null;
        brand_phone: string | null;
        brand_email: string | null;
      }>();

    if (!data) return fallback;

    return {
      address: data.brand_address?.trim() || fallback.address,
      phone: data.brand_phone?.trim() || fallback.phone,
      email: data.brand_email?.trim() || fallback.email,
    };
  } catch {
    return fallback;
  }
}

async function siteContent(): Promise<SiteContent> {
  try {
    const { data } = await createServiceClient()
      .from("store_settings")
      .select("content")
      .eq("id", 1)
      .maybeSingle<{ content: unknown }>();

    if (!data) return DEFAULT_CONTENT;
    return mergeContent(data.content);
  } catch {
    return DEFAULT_CONTENT;
  }
}

/** `6 Sep 2026` — the receipt's format, not a second one. */
function orderDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Escape before interpolation. Every value below is customer-supplied — a name,
 * an address, a product title — and an unescaped `<` in any of them is a broken
 * email at best and injected markup at worst.
 */
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ── The sheet, in email dialect ───────────────────────────────────────────
   Inline styles and table-based layout, no external CSS and no web fonts. Not
   a stylistic choice: Gmail and Outlook strip <style> blocks and ignore most
   modern CSS, so the receipt's flex rows, grid columns and Tailwind tokens do
   not survive the trip and every one of them is rebuilt here as a table cell
   with the token's literal value. The palette below is app/globals.css,
   resolved — change one there and change it here, because a receipt that is
   the shop's purple on paper and stone grey in the inbox is two documents.

   640px is the widest measure every mail client renders without horizontal
   scrolling on a phone; the printed sheet is 210mm, and the proportions are
   kept rather than the millimetres. */

const INK = "#2a1b33";
const INK_SOFT = "#5a4d66";
const MUTED = "#786a85";
const FAINT = "#a99cb5";
const LINE = "#e5dcf0";
const PURPLE = "#5e2b8a";
const FROST = "#faf7fd";

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/* Great Vibes is the masthead face on the site and will not load in a mail
   client — no email may pull a web font. The stack degrades to whatever script
   the reader's system has and finally to Georgia, which is the closest thing to
   the right *feel* that is installed everywhere. */
const SCRIPT = "'Great Vibes','Segoe Script','Brush Script MT',Georgia,serif";

/** `.eyebrow` from globals.css, written out. */
const EYEBROW =
  "font-size:10px;line-height:1;font-weight:500;letter-spacing:.22em;text-transform:uppercase;";

/** The tinted ground and the white sheet on it — the receipt's screen preview. */
function sheet(preheader: string, body: string): string {
  return `<div style="margin:0;padding:24px 12px;background:${FROST};font-family:${SANS};color:${INK};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid ${LINE};">
    <tr><td style="padding:32px 30px;">
${body}
    </td></tr>
  </table>
</div>`;
}

/**
 * The masthead: who sent it on the left, what it is on the right, under the
 * heavy rule the printed sheet draws.
 *
 * `kind` is the only thing the two messages differ on up here — the customer's
 * copy is a Receipt, the shop's is a New order — so the brand block, the
 * reference, the date and the status are written once.
 */
function masthead(
  brand: BrandContact,
  order: ReceiptOrder,
  reference: string,
  kind: string
): string {
  const contact = [brand.phone, brand.email].filter(Boolean).join(" · ");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-bottom:2px solid ${INK};">
    <tr>
      <td valign="top" style="padding:0 16px 16px 0;">
        <div style="font-family:${SCRIPT};font-size:30px;line-height:1;color:${INK};">${esc(BRAND.name)}</div>
        <div style="margin-top:8px;font-size:11px;line-height:1;letter-spacing:.12em;text-transform:uppercase;color:${INK_SOFT};">${esc(BRAND.suffix)}</div>
        <div style="margin-top:12px;font-size:11px;line-height:1.7;color:${MUTED};">${esc(brand.address)}${
          contact ? `<br>${esc(contact)}` : ""
        }</div>
      </td>
      <td valign="top" align="right" style="padding:0 0 16px 16px;">
        <div style="${EYEBROW}color:${PURPLE};">${esc(kind)}</div>
        <div style="margin-top:10px;font-size:24px;line-height:1;font-weight:500;color:${INK};">${esc(reference)}</div>
        <div style="margin-top:12px;font-size:11px;line-height:1.8;color:${MUTED};white-space:nowrap;">
          Placed <span style="color:${INK_SOFT};">${esc(orderDate(order.created_at))}</span><br>
          Status <span style="color:${INK_SOFT};">${esc(customerStatusLabel(order.status))}</span>
        </div>
      </td>
    </tr>
  </table>`;
}

/** The inside of one of the two boxes under the masthead. */
function panel(title: string, body: string): string {
  return `<div style="${EYEBROW}color:${MUTED};">${esc(title)}</div>
      ${body}`;
}

/**
 * The pair of them, side by side, as the sheet has them.
 *
 * The border belongs to the cell rather than to a table nested inside it, and
 * the gap is a third cell rather than padding. Both are the same point: two
 * cells in one row are always the same height, and a box nested inside one is
 * not — `height:100%` on it resolves against nothing and the shorter box stops
 * early, which reads as a rendering fault rather than as a shorter address. The
 * printed sheet gets equal heights free from `grid-cols-2`; this is what that
 * costs in a mail client.
 */
const PANEL_CELL = `valign="top" width="49%" style="border:1px solid ${LINE};padding:14px;"`;

function panelRow(left: string, right: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:22px;">
    <tr>
      <td ${PANEL_CELL}>${left}</td>
      <td width="2%" style="font-size:0;line-height:0;">&nbsp;</td>
      <td ${PANEL_CELL}>${right}</td>
    </tr>
  </table>`;
}

/** A labelled field, matching the pairs on the sheet. */
function field(label: string, value?: string | null): string {
  const text = String(value ?? "").trim();

  return `<tr>
    <td valign="top" style="padding:3px 10px 3px 0;font-size:11px;line-height:1.5;color:${MUTED};">${esc(label)}</td>
    <td valign="top" style="padding:3px 0;font-size:12px;line-height:1.5;color:${INK};word-break:break-word;">${
      text ? esc(text) : `<span style="color:${FAINT};">Not provided</span>`
    }</td>
  </tr>`;
}

function fields(rows: string[]): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:8px;">${rows.join(
    ""
  )}</table>`;
}

/**
 * Where it is going.
 *
 * Run together as a postal block, as on the receipt and unlike the packing
 * slip: the customer already knows their own address — they are checking it,
 * not transcribing it.
 */
function deliveredTo(address: ShippingAddress | null): string {
  if (!address) {
    return panel(
      "Delivered to",
      `<div style="margin-top:10px;font-size:12px;line-height:1.6;color:${MUTED};">No delivery address was recorded against this order.</div>`
    );
  }

  const postal = [
    address.streetAddress,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");

  const extras = [
    address.phone?.trim() ? field("Phone", address.phone) : "",
    address.email?.trim() ? field("Email", address.email) : "",
  ].filter(Boolean);

  return panel(
    "Delivered to",
    `<div style="margin-top:10px;font-size:15px;line-height:1.3;font-weight:600;color:${INK};">${esc(
      address.fullName?.trim() || "Name not provided"
    )}</div>
      <div style="margin-top:8px;font-size:12px;line-height:1.7;color:${INK};">${esc(postal)}</div>
      ${extras.length ? fields(extras) : ""}`
  );
}

/** The facts about the order itself, as the sheet lists them. */
function orderSummary(
  order: ReceiptOrder,
  lines: Line[],
  reference: string
): string {
  const units = lines.reduce((sum, line) => sum + line.quantity, 0);

  return panel(
    "Order summary",
    fields([
      field("Reference", reference),
      field("Placed", orderDate(order.created_at)),
      field("Status", customerStatusLabel(order.status)),
      field("Items", `${units} in ${lines.length} ${lines.length === 1 ? "line" : "lines"}`),
      order.discount_code ? field("Code", order.discount_code) : "",
      order.payment_method ? field("Payment", paymentLabel(order.payment_method)) : "",
    ].filter(Boolean))
  );
}

/**
 * The lines, numbered, under the heavy rule.
 *
 * The GST note earns its place for the reason it does on paper: it says why
 * there is no tax line to look for. Shelf prices are GST-inclusive, so nothing
 * is added at checkout — see lib/pricing.ts.
 */
function itemsSection(lines: Line[]): string {
  const heading = `<tr><td style="padding-bottom:8px;border-bottom:2px solid ${INK};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td valign="bottom" style="font-size:15px;line-height:1.2;font-weight:600;color:${INK};">What you ordered</td>
        <td valign="bottom" align="right" style="font-size:11px;line-height:1.2;color:${MUTED};">All prices include GST.</td>
      </tr>
    </table>
  </td></tr>`;

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;">
    ${heading}
    ${lines.map((line, index) => itemRow(line, index + 1)).join("")}
  </table>`;
}

function itemRow(line: Line, index: number): string {
  return `<tr><td style="padding:14px 0;border-bottom:1px solid ${LINE};">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td valign="top" width="24" style="padding:1px 10px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${INK};">
            <tr><td align="center" width="22" height="22" style="width:22px;height:22px;font-size:12px;line-height:22px;font-weight:500;color:${INK};">${index}</td></tr>
          </table>
        </td>
        <td valign="top" style="padding-right:14px;">
          <div style="font-size:14px;line-height:1.35;font-weight:600;color:${INK};">${esc(line.name)}</div>
          ${
            line.attributes
              ? `<div style="margin-top:5px;font-size:11px;line-height:1.4;color:${MUTED};">${esc(line.attributes)}</div>`
              : ""
          }
          <div style="margin-top:6px;font-size:11px;line-height:1.5;color:${INK_SOFT};">${esc(line.size)}</div>
        </td>
        <td valign="top" align="right" style="white-space:nowrap;">
          <div style="font-size:13px;line-height:1.1;font-weight:600;color:${INK};">${esc(formatPrice(line.lineTotal))}</div>
          <div style="margin-top:6px;font-size:11px;line-height:1.2;color:${MUTED};">${line.quantity} × ${esc(
            formatPrice(line.unitPrice)
          )}</div>
        </td>
      </tr>
    </table>
  </td></tr>`;
}

function totalRow(label: string, value: string, strong = false): string {
  const shared = strong ? `border-top:2px solid ${INK};padding-top:8px;` : "";

  return `<tr>
    <td style="padding:5px 12px 5px 0;font-size:13px;line-height:1.3;color:${
      strong ? INK : MUTED
    };${strong ? `font-weight:500;${shared}` : ""}">${esc(label)}</td>
    <td align="right" style="padding:5px 0;font-size:${
      strong ? "17px" : "13px"
    };line-height:1.3;color:${INK};white-space:nowrap;${strong ? `font-weight:500;${shared}` : ""}">${esc(value)}</td>
  </tr>`;
}

/**
 * The money, reconciled to what was charged.
 *
 * Not always "paid" — see `totalLabel()`. This document can reach a customer
 * the moment the order lands, and on a cash order that is days before anyone
 * hands over anything; a receipt claiming otherwise is a receipt they could
 * reasonably wave at the courier.
 */
function totalsBlock(order: ReceiptOrder, totals: OrderTotals): string {
  const rows = [
    totalRow("Items", formatPrice(totals.itemsTotal)),
    totals.discount > 0
      ? totalRow(
          `Discount${order.discount_code ? ` · ${order.discount_code}` : ""}`,
          `−${formatPrice(totals.discount)}`
        )
      : "",
    totalRow("Delivery", totals.delivery > 0 ? formatPrice(totals.delivery) : "Free"),
    totalRow(totalLabel(order.payment_method), formatPrice(totals.total), true),
  ].join("");

  const cash = isCollectOnDelivery(order.payment_method)
    ? `<div style="margin-top:12px;border:1px solid ${LINE};padding:10px 12px;font-size:11px;line-height:1.7;color:${MUTED};">
        Please have <span style="font-weight:600;color:${INK};">${esc(
          formatPrice(totals.total)
        )}</span> in cash ready for the courier. We cannot take card at the door.
      </div>`
    : "";

  return `<div style="${EYEBROW}color:${MUTED};">Total</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:12px;">${rows}</table>
    ${cash}`;
}

/** The foot: something to read on the left, the figures on the right. */
function footSection(left: string, right: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:28px;">
    <tr>
      <td valign="top" width="50%" style="padding-right:16px;">${left}</td>
      <td valign="top" width="50%" style="padding-left:16px;">${right}</td>
    </tr>
  </table>`;
}

function footerBar(reference: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:32px;border-top:1px solid ${LINE};">
    <tr>
      <td style="padding:12px 12px 0 0;font-size:10px;line-height:1.4;color:${MUTED};">${esc(BRAND.name)} ${esc(
        BRAND.suffix
      )} · ${esc(reference)}</td>
      <td align="right" style="padding:12px 0 0 12px;font-size:10px;line-height:1.4;color:${MUTED};white-space:nowrap;">Thank you for your order.</td>
    </tr>
  </table>`;
}

function customerHtml(
  order: ReceiptOrder,
  lines: Line[],
  totals: OrderTotals,
  brand: BrandContact,
  customerName: string
): string {
  const address = (order.shipping_address ?? null) as ShippingAddress | null;
  const reference = orderReference(order.id);
  const firstName = customerName.trim().split(/\s+/)[0] ?? "";

  /* The one thing on this sheet that is not on the printed one, and it is a
     sentence rather than a section: a receipt in an inbox still has to open by
     addressing the person who opened it. Everything below it is the document. */
  const lead = `<p style="margin:20px 0 0;font-size:13px;line-height:1.7;color:${INK_SOFT};">
      Thank you${firstName ? `, ${esc(firstName)}` : ""} — we have your order and it is being prepared. Your receipt is below.
    </p>`;

  const keep = `<div style="${EYEBROW}color:${MUTED};">Keep this receipt</div>
    <p style="margin:12px 0 0;font-size:11px;line-height:1.8;color:${MUTED};">
      It is your record of this order. Quote ${esc(reference)} in any message about it and we can find it straight away.
    </p>
    <p style="margin:10px 0 0;font-size:11px;line-height:1.8;color:${MUTED};">
      Something not right? Get in touch on <span style="color:${INK};">${esc(brand.phone)}</span>${
        brand.email
          ? ` or at <a href="mailto:${esc(brand.email)}" style="color:${INK};text-decoration:none;">${esc(
              brand.email
            )}</a>`
          : ""
      }.
    </p>`;

  return sheet(
    `Receipt ${reference} — ${formatPrice(totals.total)}`,
    `${masthead(brand, order, reference, "Receipt")}
      ${lead}
      ${panelRow(deliveredTo(address), orderSummary(order, lines, reference))}
      ${itemsSection(lines)}
      ${footSection(keep, totalsBlock(order, totals))}
      ${footerBar(reference)}`
  );
}

/**
 * The shop's copy of the same sheet.
 *
 * Same document, two changes: the right of the masthead says what it is, and
 * the foot's left column is the way into the panel rather than a note to the
 * buyer. Everything the owner reads — the address, the lines, the sizes, the
 * figures — is byte-for-byte what the customer is reading, which is the whole
 * value of a notification: the two of you are looking at the same piece of
 * paper when the phone rings.
 */
function ownerHtml(
  order: ReceiptOrder,
  lines: Line[],
  totals: OrderTotals,
  brand: BrandContact,
  customerName: string,
  customerEmail: string
): string {
  const address = (order.shipping_address ?? null) as ShippingAddress | null;
  const reference = orderReference(order.id);
  const adminUrl = `${SITE_URL}/admin/orders/${order.id}`;

  const open = `<div style="${EYEBROW}color:${MUTED};">Who placed it</div>
    <p style="margin:12px 0 0;font-size:13px;line-height:1.7;color:${INK};">
      ${esc(customerName || "Customer")}<br>
      <a href="mailto:${esc(customerEmail)}" style="color:${INK_SOFT};text-decoration:none;">${esc(
        customerEmail
      )}</a>${address?.phone?.trim() ? `<br><span style="color:${INK_SOFT};">${esc(address.phone)}</span>` : ""}
    </p>
    <p style="margin:14px 0 0;">
      <a href="${esc(
        adminUrl
      )}" style="display:inline-block;padding:10px 18px;background:${PURPLE};color:#ffffff;text-decoration:none;font-size:13px;font-weight:600;">Open in admin</a>
    </p>
    <p style="margin:10px 0 0;font-size:10px;line-height:1.5;color:${FAINT};word-break:break-all;">${esc(adminUrl)}</p>`;

  return sheet(
    `New order ${reference} — ${formatPrice(totals.total)}`,
    `${masthead(brand, order, reference, "New order")}
      ${panelRow(deliveredTo(address), orderSummary(order, lines, reference))}
      ${itemsSection(lines)}
      ${footSection(open, totalsBlock(order, totals))}
      ${footerBar(reference)}`
  );
}

/**
 * Plain-text alternative. Some clients prefer it, and spam filters expect it.
 *
 * Laid out as the sheet is, in the order the sheet is, so the fallback is a
 * receipt too rather than a summary of one.
 */
function plainText(
  order: ReceiptOrder,
  lines: Line[],
  totals: OrderTotals,
  brand: BrandContact
): string {
  const reference = orderReference(order.id);
  const address = (order.shipping_address ?? null) as ShippingAddress | null;

  const items = lines.map(
    (line, index) =>
      `${index + 1}. ${line.name}\n` +
      (line.attributes ? `   ${line.attributes}\n` : "") +
      `   ${line.size}\n` +
      `   ${line.quantity} x ${formatPrice(line.unitPrice)} = ${formatPrice(line.lineTotal)}`
  );

  const delivery = address
    ? [
        "DELIVERED TO",
        address.fullName?.trim() || "Name not provided",
        [
          address.streetAddress,
          address.city,
          address.state,
          address.postalCode,
          address.country,
        ]
          .map((part) => part?.trim())
          .filter(Boolean)
          .join(", "),
        address.phone?.trim() ? `Phone: ${address.phone.trim()}` : null,
        "",
      ]
    : [];

  /* `null` is an omitted line and `""` is a deliberate blank one. They were
     the same value at first, and the filter that dropped the omissions took
     every section break with them - a receipt in one unbroken column. */
  const parts: (string | null)[] = [
    `${BRAND.name} ${BRAND.suffix}`,
    `Receipt ${reference}`,
    `Placed ${orderDate(order.created_at)} · ${customerStatusLabel(order.status)}`,
    order.payment_method ? `Payment: ${paymentLabel(order.payment_method)}` : null,
    "",
    ...delivery,
    "WHAT YOU ORDERED (all prices include GST)",
    ...items,
    "",
    `Items: ${formatPrice(totals.itemsTotal)}`,
    totals.discount > 0
      ? `Discount${order.discount_code ? ` (${order.discount_code})` : ""}: -${formatPrice(
          totals.discount
        )}`
      : null,
    `Delivery: ${totals.delivery > 0 ? formatPrice(totals.delivery) : "Free"}`,
    `${totalLabel(order.payment_method)}: ${formatPrice(totals.total)}`,
    isCollectOnDelivery(order.payment_method)
      ? `\nPlease have ${formatPrice(
          totals.total
        )} in cash ready for the courier. We cannot take card at the door.`
      : null,
    "",
    `Keep this receipt — quote ${reference} in any message about this order.`,
    [brand.phone, brand.email].filter(Boolean).join(" · "),
  ];

  return parts.filter((part) => part !== null).join("\n");
}

/**
 * Send one message, reporting rather than raising.
 *
 * Every failure mode of SMTP — a refused recipient, a dropped socket, a
 * rejected App Password — arrives here as a throw, and each one has to leave
 * the other email's fate untouched. The order id is in every log line because
 * a bare "email failed" cannot be reconciled against anything.
 */
async function send(
  label: "customer" | "owner",
  orderId: string,
  message: { to: string; subject: string; html: string; text: string; replyTo: string }
): Promise<boolean> {
  try {
    await transporter().sendMail({
      /* The object form, not a hand-built `"Name" <addr>` string: nodemailer
         does the RFC 5322 quoting and any encoding a non-ASCII display name
         needs, and it cannot produce a header with a non-address in the angle
         brackets — which is the bug that put these in spam to begin with. */
      from: fromIdentity(STORE_NAME),
      ...message,
    });
    return true;
  } catch (error) {
    console.error(
      `[email] ${label} email failed for order ${orderId}:`,
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

/**
 * Email both sides of an order.
 *
 * Never throws and never rolls anything back: by the time this runs the order
 * exists and the customer has been told it does. The return value says what
 * actually went out, so a caller that cares can retry or raise an alert —
 * `{ customerSent: false, ownerSent: true }` is a real and recoverable state,
 * not an error.
 */
export async function sendOrderEmails(orderId: string): Promise<OrderEmailResult> {
  const nothingSent: OrderEmailResult = { customerSent: false, ownerSent: false };

  let order: ReceiptOrder | null = null;

  try {
    /* Service role bypasses RLS — this client must never be imported into a
       Client Component. Required rather than convenient: `customers` is
       admin-only ("Admins view all customers", dashboard_schema.sql), and this
       runs with no session at all once the checkout response has been sent.

       Columns and item embed come from lib/admin/order-document so this reads
       exactly what the printed sheets read, and `selectOrderColumns` narrows to
       the widest set this deployment's database can actually answer — the
       discount and payment columns each arrive with a migration of their own. */
    const { data, error } = await selectOrderColumns((extra) =>
      createServiceClient()
        .from("orders")
        .select(
          `${ORDER_DOCUMENT_COLUMNS}${extra}, ${ORDER_DOCUMENT_ITEMS}, customer:customers ( name, email )`
        )
        .eq("id", orderId)
        .maybeSingle<ReceiptOrder>()
    );

    if (error) {
      console.error(`[email] order lookup failed for ${orderId}:`, error.message);
      return { ...nothingSent, reason: "lookup_failed" };
    }

    order = data;
  } catch (error) {
    /* A missing SUPABASE_SERVICE_ROLE_KEY throws out of the factory rather than
       returning an error, and it must not become an unhandled rejection in a
       request that has already returned 201. */
    console.error(
      `[email] could not reach Supabase for order ${orderId}:`,
      error instanceof Error ? error.message : error
    );
    return { ...nothingSent, reason: "lookup_failed" };
  }

  if (!order) {
    console.error(`[email] order ${orderId} not found — nothing sent`);
    return { ...nothingSent, reason: "order_not_found" };
  }

  const customer = one(order.customer);
  const address = (order.shipping_address ?? null) as ShippingAddress | null;

  /* Two places carry an address, and the shipping one is a fallback rather than
     a second choice: `customers` is linked only once dashboard_schema.sql has
     run and only for orders placed by an account, while every order validated
     by lib/validations/checkout carries an email in its shipping address.
     Either is a real address for this order. */
  const customerEmail = (customer?.email ?? address?.email ?? "").trim();
  const customerName = (customer?.name ?? address?.fullName ?? "").trim();

  if (!customerEmail) {
    console.error(
      `[email] order ${orderId} has no customer email (no customer record, no shipping address email) — nothing sent`
    );
    return { ...nothingSent, reason: "customer_email_missing" };
  }

  const [brand, content] = await Promise.all([brandContact(), siteContent()]);
  const lines = buildLines(order, content);
  const totals = orderTotals(order as Order);
  const text = plainText(order, lines, totals, brand);
  const reference = orderReference(order.id);

  /* Settled independently on purpose. `send()` never rejects, so this cannot
     short-circuit — which is the point: the two results are reported
     separately, and one failing must not decide the other's fate. */
  const [customerSent, ownerSent] = await Promise.all([
    send("customer", order.id, {
      to: customerEmail,
      subject: `Your ${STORE_NAME} order ${reference}`,
      html: customerHtml(order, lines, totals, brand, customerName),
      text,
      /* A receipt invites a reply, and a sender with no working reply path is
         both unhelpful and a small negative signal to a spam classifier. */
      replyTo: brand.email,
    }),
    send("owner", order.id, {
      to: ownerAddress(),
      subject: `New order ${reference} — ${formatPrice(totals.total)}`,
      html: ownerHtml(order, lines, totals, brand, customerName, customerEmail),
      text,
      // Replying to the notification should reach the customer, not ourselves.
      replyTo: customerEmail,
    }),
  ]);

  return { customerSent, ownerSent };
}
