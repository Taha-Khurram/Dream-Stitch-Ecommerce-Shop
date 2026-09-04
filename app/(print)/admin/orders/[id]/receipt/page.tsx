import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/api/settings";
import { getSiteContent } from "@/lib/api/content";
import { resolveCutSpec } from "@/lib/size-guide";
import { formatPrice } from "@/lib/format";
import { customerStatusLabel, orderReference } from "@/lib/orders/lifecycle";
import { readOrderDocument, orderTotals } from "@/lib/admin/order-document";
import {
  convertCustomSize,
  customSizeFromRow,
  formatDimension,
  otherUnit,
} from "@/lib/custom-size";
import { BRAND } from "@/lib/constants";
import { PrintButton } from "@/components/admin/PrintButton";
import type { SiteContent } from "@/lib/content/defaults";
import type { OrderItem } from "@/types/ecommerce";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Receipt ${orderReference(id)} | ${BRAND.name}` };
}

/**
 * The order as the customer's copy — the sheet that goes in the box with it.
 *
 * The packing slip next door is an instruction to the workroom. This is a
 * record for the person who paid, and the two are different documents rather
 * than one document with things hidden, because almost everything that makes
 * the slip useful is internal:
 *
 *   * the sign-off block — who cut, who checked, who packed. That is the
 *     shop's own audit trail, and printing the staff's initials on a customer's
 *     receipt tells them about a process they did not buy.
 *   * the Cut / Stitched / Pressed / Packed checkboxes, for the same reason.
 *   * "Do not cut yet" and the rest of the cutting language. A red warning
 *     about a measurement the shop needs to query is a note to a colleague; on
 *     a customer's copy it reads as a defect in what they have just received.
 *   * "Made to measure — 2 of 3 lines, cut to order", which is a handling
 *     instruction about how the order moves through the shop.
 *   * the internal status vocabulary — see `customerStatusLabel()`.
 *
 * And the thing the slip leaves out is the whole point of this one: money. A
 * packing slip carries no per-line prices on purpose; a receipt is the document
 * somebody checks their card statement against, so every line carries its unit
 * price and its total, and the foot reconciles items, discount and delivery to
 * the figure that was actually charged.
 *
 * The measurements stay. They are the customer's own specification, printed so
 * they can check the set they were sent is the set they ordered — the one thing
 * on the slip that belongs on both sheets, minus the instruction to cut to it.
 *
 * Admin-gated, like everything in this group: it is the shop that prints this
 * and puts it in the parcel. `app/(print)/layout.tsx` runs `requireAdmin()`.
 */
export default async function OrderReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [order, settings, content] = await Promise.all([
    readOrderDocument(supabase, id),
    getSettings(),
    getSiteContent(),
  ]);

  if (!order) notFound();

  const items = order.order_items ?? [];
  const address = order.shipping_address;
  const reference = orderReference(order.id);
  const { itemsTotal, discount, delivery, total } = orderTotals(order);

  return (
    <>
      {/* Screen only — the way back and the button that starts the print are
          not part of the sheet they act on. */}
      <div
        data-print-hide
        className="mx-auto mb-5 flex max-w-[210mm] flex-wrap items-center justify-between gap-4"
      >
        <Link
          href={`/admin/orders/${order.id}`}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-ink-soft transition-colors hover:text-purple"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Back to order {reference}
        </Link>
        <PrintButton label="Print receipt" />
      </div>

      <article className="slip mx-auto max-w-[210mm] bg-white p-10 shadow-[0_1px_3px_rgba(42,27,51,0.12)]">
        <header className="flex items-start justify-between gap-8 border-b-2 border-ink pb-4">
          <div className="min-w-0">
            <p className="font-[family-name:var(--font-script)] text-[26px] leading-none text-ink">
              {BRAND.name}
            </p>
            <p className="mt-1.5 text-[11px] uppercase tracking-[0.12em] text-ink-soft">
              {BRAND.suffix}
            </p>
            <address className="mt-3 max-w-[62mm] text-[11px] not-italic leading-relaxed text-muted">
              {settings.brand_address}
              <br />
              {[settings.brand_phone, settings.brand_email].filter(Boolean).join(" · ")}
            </address>
          </div>

          <div className="shrink-0 text-right">
            <p className="eyebrow text-purple">Receipt</p>
            <p className="mt-2 text-[24px] font-medium leading-none tabular-nums text-ink">
              {reference}
            </p>
            <dl className="mt-3 space-y-0.5 text-[11px] text-muted">
              <div>
                <dt className="inline">Placed </dt>
                <dd className="inline tabular-nums text-ink-soft">
                  {formatDate(order.created_at)}
                </dd>
              </div>
              <div>
                <dt className="inline">Status </dt>
                <dd className="inline text-ink-soft">
                  {customerStatusLabel(order.status)}
                </dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-5">
          <div className="border border-line p-4">
            <h2 className="eyebrow text-muted">Delivered to</h2>

            {address ? (
              <>
                <p className="mt-2.5 text-[15px] font-medium text-ink">
                  {address.fullName?.trim() || "Name not provided"}
                </p>
                {/* Run together as a postal block here, unlike the slip: on the
                    packing sheet the fields are labelled because a courier
                    label gets written off them and nothing may be guessed at.
                    The customer already knows their own address — they are
                    checking it, not transcribing it. */}
                <address className="mt-2 text-[12px] not-italic leading-relaxed text-ink">
                  {[
                    address.streetAddress,
                    address.city,
                    address.state,
                    address.postalCode,
                    address.country,
                  ]
                    .map((line) => line?.trim())
                    .filter(Boolean)
                    .join(", ")}
                </address>
                <dl className="mt-2.5 space-y-1">
                  {address.phone?.trim() && (
                    <ReceiptField label="Phone" value={address.phone} />
                  )}
                  {address.email?.trim() && (
                    <ReceiptField label="Email" value={address.email} />
                  )}
                </dl>
              </>
            ) : (
              /* Stated plainly rather than as the slip's dispatch warning: the
                 customer is not the person who decides whether to dispatch. */
              <p className="mt-2.5 text-[12px] text-muted">
                No delivery address was recorded against this order.
              </p>
            )}
          </div>

          <div className="border border-line p-4">
            <h2 className="eyebrow text-muted">Order summary</h2>
            <dl className="mt-2.5 space-y-1.5">
              <ReceiptField label="Reference" value={reference} />
              <ReceiptField label="Placed" value={formatDate(order.created_at)} />
              <ReceiptField label="Status" value={customerStatusLabel(order.status)} />
              <ReceiptField
                label="Items"
                value={`${items.reduce((n, i) => n + i.quantity, 0)} in ${items.length} ${
                  items.length === 1 ? "line" : "lines"
                }`}
              />
              {order.discount_code && (
                <ReceiptField label="Code" value={order.discount_code} />
              )}
            </dl>
          </div>
        </section>

        <section className="mt-7">
          <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-2">
            <h2 className="text-[15px] font-semibold tracking-[0.01em] text-ink">
              What you ordered
            </h2>
            {/* Says why there is no tax line to look for: shelf prices are
                GST-inclusive, so nothing is added at checkout. See
                lib/pricing.ts. */}
            <p className="text-[11px] text-muted">All prices include GST.</p>
          </div>

          <ol className="divide-y divide-line">
            {items.map((item, index) => (
              <ReceiptLine
                key={item.id ?? `${item.product_id}-${index}`}
                item={item}
                index={index + 1}
                content={content}
              />
            ))}
          </ol>
        </section>

        <section className="slip-foot mt-7 grid grid-cols-2 gap-8">
          <div className="text-[11px] leading-relaxed text-muted">
            <h2 className="eyebrow text-muted">Keep this receipt</h2>
            <p className="mt-3">
              It is your record of this order. Quote {reference} in any message about
              it and we can find it straight away.
            </p>
            <p className="mt-2.5">
              Something not right? Get in touch on{" "}
              <span className="text-ink">{settings.brand_phone ?? BRAND.phone}</span>
              {settings.brand_email ? (
                <>
                  {" "}
                  or at <span className="text-ink">{settings.brand_email}</span>
                </>
              ) : null}
              .
            </p>
          </div>

          <div>
            <h2 className="eyebrow text-muted">Total</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div className="flex justify-between gap-6">
                <dt className="text-muted">Items</dt>
                <dd className="tabular-nums text-ink">{formatPrice(itemsTotal)}</dd>
              </div>
              {discount > 0 && (
                <div className="flex justify-between gap-6">
                  <dt className="truncate text-muted">
                    Discount{order.discount_code ? ` · ${order.discount_code}` : ""}
                  </dt>
                  <dd className="shrink-0 tabular-nums text-ink">
                    −{formatPrice(discount)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-6">
                <dt className="text-muted">Delivery</dt>
                <dd className="tabular-nums text-ink">
                  {delivery > 0 ? formatPrice(delivery) : "Free"}
                </dd>
              </div>
              <div className="flex justify-between gap-6 border-t-2 border-ink pt-2">
                <dt className="font-medium text-ink">Total paid</dt>
                <dd className="text-[17px] font-medium tabular-nums text-ink">
                  {formatPrice(total)}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <footer className="mt-8 flex items-center justify-between gap-4 border-t border-line pt-3 text-[10px] text-muted">
          <span>
            {BRAND.name} {BRAND.suffix} · {reference}
          </span>
          <span>Thank you for your order.</span>
        </footer>
      </article>
    </>
  );
}

/**
 * One line, as something bought rather than something to make.
 *
 * Carries what the slip's equivalent does not — unit price and line total —
 * and drops what the slip's equivalent carries: the stage checkboxes, and the
 * instruction to cut to the figure. The dimensions themselves stay, because
 * "King Size" is no more checkable by the buyer than it is by the workroom.
 */
function ReceiptLine({
  item,
  index,
  content,
}: {
  item: OrderItem;
  index: number;
  content: SiteContent;
}) {
  const custom = customSizeFromRow(item);
  const spec = custom
    ? null
    : resolveCutSpec(content, item.product?.category?.slug, item.size);
  const unitPrice = Number(item.unit_price);

  return (
    <li className="slip-line py-3.5">
      <div className="flex items-start justify-between gap-5">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-ink text-[12px] font-medium tabular-nums text-ink">
            {index}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-medium leading-snug text-ink">
              {item.product?.name ?? "Item no longer in our catalogue"}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {[item.product?.fabric, item.product?.pieces].filter(Boolean).join(" · ") ||
                " "}
            </p>
            <p className="mt-1.5 text-[11px] text-ink-soft">{describeSize(custom, spec, item)}</p>
          </div>
        </div>

        {/* The money, right-aligned in one column so a reader can run down the
            page and reconcile it against the foot. */}
        <div className="shrink-0 text-right tabular-nums">
          <p className="text-[13px] font-medium leading-none text-ink">
            {formatPrice(unitPrice * item.quantity)}
          </p>
          <p className="mt-1.5 text-[11px] text-muted">
            {item.quantity} × {formatPrice(unitPrice)}
          </p>
        </div>
      </div>
    </li>
  );
}

/**
 * The size, in one line, for whichever of the three cases the row is.
 *
 * A made-to-measure set prints both units — the buyer measured with whichever
 * tape they own, and the receipt should be checkable against it. A stock size
 * prints its name and its finished dimensions from the same chart the product
 * page showed. A row with neither prints what was ordered and nothing more:
 * the slip's red "do not cut" panic is a note to the workroom, and on this
 * sheet it would only alarm somebody who cannot act on it.
 */
function describeSize(
  custom: ReturnType<typeof customSizeFromRow>,
  spec: ReturnType<typeof resolveCutSpec>,
  item: OrderItem
): string {
  if (custom) {
    const converted = convertCustomSize(custom, otherUnit(custom.unit));
    return (
      `Made to measure · ${formatDimension(custom.width, custom.unit)} × ` +
      `${formatDimension(custom.height, custom.unit)} ` +
      `(${formatDimension(converted.width, converted.unit)} × ` +
      `${formatDimension(converted.height, converted.unit)})`
    );
  }

  if (spec) {
    const finished = spec.spec.map((entry) => `${entry.label} ${entry.value}`).join(" · ");
    return finished ? `${spec.size} · ${finished}` : spec.size;
  }

  return item.size?.trim() || "Size not recorded";
}

/** A labelled field, matching the pairs on the slip. */
function ReceiptField({ label, value }: { label: string; value?: string | null }) {
  const text = value?.trim();

  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-[24mm] shrink-0 text-[11px] text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-[12px] text-ink">
        {text || <span className="text-faint">Not provided</span>}
      </dd>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
