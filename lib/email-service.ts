/**
 * Order email. **Server-only** — it holds the service-role client and the SMTP
 * password, and `server-only` makes importing it from a Client Component a
 * build error.
 *
 * Two messages per order: an itemised invoice to the customer and a
 * notification to the shop. They are sent independently and reported
 * independently, because they fail for unrelated reasons — a customer's
 * mailbox being full says nothing about whether the owner heard about the
 * order, and one bouncing must never suppress the other.
 *
 * Nothing here throws. The caller is a fire-and-forget hook on a checkout that
 * has already succeeded; an exception escaping this module would, at best, be
 * an unhandled rejection in a request that has already returned, and at worst
 * take down the order it is reporting on.
 */

import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import { fromAddress, ownerAddress, transporter } from "@/lib/nodemailer";
import { BRAND } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { SITE_URL } from "@/lib/site-url";
import {
  DEFAULT_RATES,
  calcShipping,
  calcTax,
  payableSubtotal,
  type DeliveryRates,
} from "@/lib/pricing";
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
   Derived from types/ecommerce.ts rather than a generated `Database` type:
   this project has no types/supabase.ts, and these interfaces are the
   hand-maintained mirror of the schema. Picking from them keeps this module
   honest about the columns it reads and keeps `any` out entirely. */

/** One line, with just enough of its product to print a row. */
type EmailOrderItem = Pick<OrderItem, "quantity" | "unit_price" | "size"> & {
  /* PostgREST returns a to-one embed as an object or as a one-element array
     depending on what it can prove about the relationship — the same quirk
     `productCost()` documents in lib/admin/cost.ts. Both are accepted. */
  product: { name: string } | { name: string }[] | null;
};

type EmailOrder = Pick<
  Order,
  "id" | "status" | "total_amount" | "created_at" | "shipping_address"
> & {
  discount_code: string | null;
  discount_amount: number | null;
  order_items: EmailOrderItem[] | null;
  customer: { name: string; email: string } | { name: string; email: string }[] | null;
};

/** Flatten PostgREST's object-or-array embed to the single row it means. */
function one<T>(embed: T | T[] | null | undefined): T | null {
  if (!embed) return null;
  return Array.isArray(embed) ? embed[0] ?? null : embed;
}

/** A line resolved into the four values a table row needs. */
interface InvoiceLine {
  name: string;
  size: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface Invoice {
  lines: InvoiceLine[];
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  /** What was actually charged — the stored figure, not a recomputation. */
  total: number;
}

/**
 * Rebuild the money breakdown from the line items.
 *
 * `orders` stores only `total_amount` and `discount_amount` — there is no
 * subtotal, tax or shipping column — so an invoice has to derive them, and it
 * derives them through lib/pricing so the email, the cart drawer and the
 * checkout route cannot disagree about how a total is composed. The total
 * itself is *not* recomputed: it is what the customer was charged, and if a
 * derived figure ever contradicts it the stored one is the truth.
 */
function buildInvoice(order: EmailOrder, rates: DeliveryRates): Invoice {
  const lines: InvoiceLine[] = (order.order_items ?? []).map((item) => {
    const unitPrice = Number(item.unit_price) || 0;
    const quantity = Number(item.quantity) || 0;
    return {
      name: one(item.product)?.name ?? "Item",
      size: item.size ?? null,
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
    };
  });

  const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const itemCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const discount = Number(order.discount_amount) || 0;
  const payable = payableSubtotal(subtotal, discount);

  return {
    lines,
    subtotal,
    discount,
    tax: calcTax(payable),
    shipping: calcShipping(payable, itemCount, rates),
    total: Number(order.total_amount) || 0,
  };
}

/**
 * Delivery rates, read with the service client rather than through
 * `getSettings()`.
 *
 * `getSettings()` builds a cookie-backed client, and `cookies()` is only valid
 * inside a request scope — which this is not, once the checkout response has
 * been flushed and the send is running on its own. Falling back to the
 * compiled-in rates matches what `lib/api/settings.ts` does when the table is
 * unreadable, so a missing `store_settings` row costs a correct shipping line
 * rather than the whole email.
 */
async function deliveryRates(): Promise<DeliveryRates> {
  try {
    // `store_settings` is world-readable ("Anyone reads store settings"), so the
    // service role grants nothing extra here — it is just the client we have.
    const { data } = await createServiceClient()
      .from("store_settings")
      .select("free_shipping_threshold, shipping_fee")
      .maybeSingle<{ free_shipping_threshold: number; shipping_fee: number }>();

    if (!data) return DEFAULT_RATES;

    return {
      freeShippingThreshold: Number(data.free_shipping_threshold),
      shippingFee: Number(data.shipping_fee),
    };
  } catch {
    return DEFAULT_RATES;
  }
}

/** Short, human order reference. The id is a UUID; nobody reads one aloud. */
function orderNumber(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function orderDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "long",
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

/* ── Templates ─────────────────────────────────────────────────────────────
   Inline styles and table-based layout, single column, no external CSS and no
   web fonts. Not a stylistic choice: Gmail and Outlook strip <style> blocks and
   ignore most modern CSS, so anything not written inline does not survive the
   trip. Max width 600px is the width every mail client renders without
   horizontal scrolling on a phone. */

const WRAP_OPEN = `<div style="margin:0;padding:24px 12px;background:#f6f5f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1917;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;border:1px solid #e7e5e4;">
    <tr><td style="padding:28px 28px 20px;">`;

const WRAP_CLOSE = `    </td></tr>
  </table>
</div>`;

function lineRows(lines: InvoiceLine[]): string {
  return lines
    .map(
      (line) => `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #f0efed;font-size:14px;line-height:1.4;">
          ${esc(line.name)}${line.size ? `<br><span style="color:#78716c;font-size:12px;">${esc(line.size)}</span>` : ""}
        </td>
        <td align="center" style="padding:10px 8px;border-bottom:1px solid #f0efed;font-size:14px;white-space:nowrap;">${line.quantity}</td>
        <td align="right" style="padding:10px 0 10px 8px;border-bottom:1px solid #f0efed;font-size:14px;white-space:nowrap;">${esc(formatPrice(line.unitPrice))}</td>
        <td align="right" style="padding:10px 0 10px 12px;border-bottom:1px solid #f0efed;font-size:14px;white-space:nowrap;font-weight:600;">${esc(formatPrice(line.lineTotal))}</td>
      </tr>`
    )
    .join("");
}

function totalRow(label: string, value: string, strong = false): string {
  const size = strong ? "16px" : "14px";
  const emphasis = strong
    ? "font-weight:700;padding-top:10px;border-top:1px solid #e7e5e4;"
    : "";

  return `<tr>
    <td style="padding:4px 0;font-size:${size};color:${strong ? "#1c1917" : "#57534e"};${emphasis}">${esc(label)}</td>
    <td align="right" style="padding:4px 0;font-size:${size};white-space:nowrap;${emphasis}">${esc(value)}</td>
  </tr>`;
}

function totalsBlock(invoice: Invoice, discountCode: string | null): string {
  const rows = [
    totalRow("Subtotal", formatPrice(invoice.subtotal)),
    invoice.discount > 0
      ? totalRow(
          discountCode ? `Discount (${discountCode})` : "Discount",
          `- ${formatPrice(invoice.discount)}`
        )
      : "",
    /* Shelf prices are GST-inclusive in this store (`TAX_RATE = 0` in
       lib/pricing.ts), so the tax line prints only if a rate is ever
       introduced. A permanent "Tax: PKR 0" row invites the question it exists
       to answer. */
    invoice.tax > 0 ? totalRow("Tax", formatPrice(invoice.tax)) : "",
    totalRow("Delivery", invoice.shipping === 0 ? "Free" : formatPrice(invoice.shipping)),
    totalRow("Total", formatPrice(invoice.total), true),
  ].join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:14px;">${rows}</table>`;
}

function addressBlock(address: ShippingAddress | null): string {
  if (!address) return "";

  const parts = [
    address.fullName,
    address.streetAddress,
    [address.city, address.state].filter(Boolean).join(", "),
    address.postalCode,
    address.country,
    address.phone,
  ].filter((part) => Boolean(part && String(part).trim()));

  return `<p style="margin:22px 0 0;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#78716c;">Delivering to</p>
    <p style="margin:6px 0 0;font-size:14px;line-height:1.6;color:#44403c;">${parts.map(esc).join("<br>")}</p>`;
}

function itemsTable(lines: InvoiceLine[]): string {
  const th =
    "padding-bottom:8px;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:#78716c;font-weight:600;";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;border-collapse:collapse;">
    <tr>
      <th align="left" style="${th}">Item</th>
      <th align="center" style="${th}">Qty</th>
      <th align="right" style="${th}">Price</th>
      <th align="right" style="${th}">Total</th>
    </tr>
    ${lineRows(lines)}
  </table>`;
}

function customerHtml(order: EmailOrder, invoice: Invoice, customerName: string): string {
  const address = (order.shipping_address ?? null) as ShippingAddress | null;
  const firstName = customerName.split(" ")[0] ?? "";

  return `${WRAP_OPEN}
      <p style="margin:0;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#a8a29e;">${esc(STORE_NAME)}</p>
      <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;font-weight:700;">Thank you${firstName ? `, ${esc(firstName)}` : ""}</h1>
      <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#57534e;">
        We have your order and it is being prepared. Here is what you ordered.
      </p>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px;background:#faf9f8;border-radius:8px;">
        <tr>
          <td style="padding:12px 14px;font-size:13px;color:#57534e;">Order <strong style="color:#1c1917;">${esc(orderNumber(order.id))}</strong></td>
          <td align="right" style="padding:12px 14px;font-size:13px;color:#57534e;">${esc(orderDate(order.created_at))}</td>
        </tr>
      </table>

      ${itemsTable(invoice.lines)}
      ${totalsBlock(invoice, order.discount_code)}
      ${addressBlock(address)}

      <p style="margin:26px 0 0;font-size:13px;line-height:1.6;color:#78716c;">
        Questions about this order? Reply to this email or write to
        <a href="mailto:${esc(BRAND.email)}" style="color:#1c1917;">${esc(BRAND.email)}</a>.
      </p>
${WRAP_CLOSE}`;
}

function ownerHtml(
  order: EmailOrder,
  invoice: Invoice,
  customerName: string,
  customerEmail: string
): string {
  const address = (order.shipping_address ?? null) as ShippingAddress | null;
  const adminUrl = `${SITE_URL}/admin/orders/${order.id}`;

  return `${WRAP_OPEN}
      <p style="margin:0;font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#a8a29e;">New order</p>
      <h1 style="margin:10px 0 0;font-size:22px;line-height:1.3;font-weight:700;">${esc(orderNumber(order.id))} — ${esc(formatPrice(invoice.total))}</h1>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:18px;background:#faf9f8;border-radius:8px;">
        <tr><td style="padding:12px 14px;font-size:14px;line-height:1.7;color:#44403c;">
          <strong style="color:#1c1917;">${esc(customerName || "Customer")}</strong><br>
          <a href="mailto:${esc(customerEmail)}" style="color:#44403c;">${esc(customerEmail)}</a>
          ${address?.phone ? `<br>${esc(address.phone)}` : ""}<br>
          <span style="color:#78716c;font-size:13px;">Placed ${esc(orderDate(order.created_at))} · status ${esc(order.status)}</span>
        </td></tr>
      </table>

      ${itemsTable(invoice.lines)}
      ${totalsBlock(invoice, order.discount_code)}
      ${addressBlock(address)}

      <p style="margin:26px 0 0;">
        <a href="${esc(adminUrl)}" style="display:inline-block;padding:11px 20px;background:#1c1917;color:#ffffff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:600;">Open in admin</a>
      </p>
      <p style="margin:12px 0 0;font-size:12px;color:#a8a29e;word-break:break-all;">${esc(adminUrl)}</p>
${WRAP_CLOSE}`;
}

/** Plain-text alternative. Some clients prefer it, and spam filters expect it. */
function plainText(order: EmailOrder, invoice: Invoice): string {
  const lines = invoice.lines
    .map(
      (line) =>
        `  ${line.quantity} x ${line.name}${line.size ? ` (${line.size})` : ""} — ${formatPrice(line.lineTotal)}`
    )
    .join("\n");

  return [
    STORE_NAME,
    `Order ${orderNumber(order.id)} — ${orderDate(order.created_at)}`,
    "",
    lines,
    "",
    `Subtotal: ${formatPrice(invoice.subtotal)}`,
    invoice.discount > 0 ? `Discount: -${formatPrice(invoice.discount)}` : "",
    `Delivery: ${invoice.shipping === 0 ? "Free" : formatPrice(invoice.shipping)}`,
    `Total: ${formatPrice(invoice.total)}`,
  ]
    .filter(Boolean)
    .join("\n");
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
  message: { to: string; subject: string; html: string; text: string }
): Promise<boolean> {
  try {
    await transporter().sendMail({
      from: `"${STORE_NAME}" <${fromAddress()}>`,
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

  let order: EmailOrder | null = null;

  try {
    /* Service role bypasses RLS — this client must never be imported into a
       Client Component. Required rather than convenient: `customers` is
       admin-only ("Admins view all customers", dashboard_schema.sql), and this
       runs with no session at all once the checkout response has been sent. */
    const { data, error } = await createServiceClient()
      .from("orders")
      .select(
        `id, status, total_amount, created_at, shipping_address,
         discount_code, discount_amount,
         order_items ( quantity, unit_price, size, product:products ( name ) ),
         customer:customers ( name, email )`
      )
      .eq("id", orderId)
      .maybeSingle<EmailOrder>();

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

  const invoice = buildInvoice(order, await deliveryRates());
  const text = plainText(order, invoice);
  const number = orderNumber(order.id);

  /* Settled independently on purpose. `send()` never rejects, so this cannot
     short-circuit — which is the point: the two results are reported
     separately, and one failing must not decide the other's fate. */
  const [customerSent, ownerSent] = await Promise.all([
    send("customer", order.id, {
      to: customerEmail,
      subject: `Your ${STORE_NAME} order ${number}`,
      html: customerHtml(order, invoice, customerName),
      text,
    }),
    send("owner", order.id, {
      to: ownerAddress(),
      subject: `New order ${number} — ${formatPrice(invoice.total)}`,
      html: ownerHtml(order, invoice, customerName, customerEmail),
      text,
    }),
  ]);

  return { customerSent, ownerSent };
}
