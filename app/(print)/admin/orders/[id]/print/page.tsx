import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/api/settings";
import { getSiteContent } from "@/lib/api/content";
import { resolveCutSpec, type CutSpec } from "@/lib/size-guide";
import { formatPrice } from "@/lib/format";
import { orderReference, statusLabel } from "@/lib/orders/lifecycle";
import {
  convertCustomSize,
  customSizeFromRow,
  formatDimension,
  otherUnit,
} from "@/lib/custom-size";
import { BRAND } from "@/lib/constants";
import { PrintButton } from "@/components/admin/PrintButton";
import type { SiteContent } from "@/lib/content/defaults";
import type { CustomSize, Order, OrderItem } from "@/types/ecommerce";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

/* The browser prints the document title in the page header and offers it as
   the filename when someone prints to PDF, so it is worth being the order
   reference rather than the site name. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Packing slip ${orderReference(id)} | ${BRAND.name}` };
}

const ORDER_COLUMNS = "id, status, total_amount, created_at, shipping_address";

const ITEMS_EMBED =
  "order_items(id, product_id, quantity, unit_price, size, custom_width, custom_height, custom_unit, " +
  "product:products(id, name, fabric, pieces, category:categories(slug)))";

/**
 * The order as a sheet of paper.
 *
 * A stocked set is picked off a shelf; a made-to-measure set is cut, and the
 * numbers it is cut to live in a database the person holding the scissors does
 * not have open. This page is the bridge — everything the workroom needs to
 * make and send one order, in the order they need it: who it goes to, what to
 * cut and to what dimensions, what to put in the box, what it came to.
 *
 * The measurements are therefore the loudest thing on it. They are set at a
 * size that reads from arm's length at a cutting table, split under the words
 * Width and Height rather than run together as 82 x 78 — which is only
 * unambiguous to whoever typed it — and printed in both units, with the
 * ordered one marked as the one to cut to.
 */
export default async function OrderPackingSlipPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  /* The chart and the store details are as much a part of the sheet as the
     order is, and none of the three needs either of the others. */
  const [{ data }, settings, content] = await Promise.all([
    /* The two discount columns arrive with discount_codes.sql, and PostgREST
       rejects the whole select if either is unknown — so they are asked for,
       and a failure falls back to the shape this sheet has always read. Same
       contract as the order screen this prints from. */
    (async () => {
      const withDiscount = await supabase
        .from("orders")
        .select(`${ORDER_COLUMNS}, discount_code, discount_amount, ${ITEMS_EMBED}`)
        .eq("id", id)
        .single();

      if (!withDiscount.error) return withDiscount;

      return supabase
        .from("orders")
        .select(`${ORDER_COLUMNS}, ${ITEMS_EMBED}`)
        .eq("id", id)
        .single();
    })(),
    getSettings(),
    getSiteContent(),
  ]);

  if (!data) notFound();

  const order = data as unknown as Order;
  const items = order.order_items ?? [];
  const address = order.shipping_address;
  const reference = orderReference(order.id);

  const itemsTotal = items.reduce(
    (sum, item) => sum + Number(item.unit_price) * item.quantity,
    0
  );
  const discount = Number(order.discount_amount ?? 0);
  /* Derived, and the discount has to come back out of it: `total_amount` is
     net of the code (see types/ecommerce.ts), so subtracting the line total
     alone reports a negative delivery charge on every discounted order — which
     prints as "Free" on a sheet whose figures then do not add up. */
  const delivery = Number(order.total_amount) - itemsTotal + discount;
  const pieces = items.reduce((count, item) => count + item.quantity, 0);
  const toMeasure = items.filter((item) => customSizeFromRow(item)).length;

  return (
    <>
      {/* Screen only. The sheet below is exactly what comes out of the
          printer, so nothing that belongs to the browsing of it — the way
          back, the button that prints — is part of it. */}
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
        <PrintButton label="Print slip" />
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
            <p className="eyebrow text-purple">Packing slip</p>
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
                <dt className="inline">Printed </dt>
                <dd className="inline tabular-nums text-ink-soft">
                  {formatDate(new Date().toISOString())}
                </dd>
              </div>
            </dl>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-5">
          <div className="border border-line p-4">
            <h2 className="eyebrow text-muted">Deliver to</h2>

            {address ? (
              <>
                <p className="mt-2.5 text-[15px] font-medium text-ink">
                  {address.fullName?.trim() || "Name not provided"}
                </p>
                {/* Field by field, under the labels the buyer filled in at
                    checkout — the same call the order screen makes, and for
                    the same reason: run together as one postal block, nothing
                    says which line was typed as the city, and the courier
                    label gets written off this sheet. */}
                <dl className="mt-3 space-y-1.5">
                  <SlipField label="Address" value={address.streetAddress} />
                  <SlipField label="City" value={address.city} />
                  <SlipField label="Province" value={address.state} />
                  <SlipField label="Postal code" value={address.postalCode} />
                  <SlipField label="Country" value={address.country} />
                  <SlipField label="Phone" value={address.phone} />
                  <SlipField label="Email" value={address.email} />
                </dl>
              </>
            ) : (
              <p className="mt-2.5 text-[12px] text-sale">
                No address recorded. Do not dispatch — confirm with the customer.
              </p>
            )}
          </div>

          <div className="border border-line p-4">
            <h2 className="eyebrow text-muted">This order</h2>
            <dl className="mt-2.5 space-y-1.5">
              <SlipField label="Reference" value={reference} />
              <SlipField label="Status" value={statusLabel(order.status)} />
              <SlipField
                label="Lines"
                value={`${items.length} ${items.length === 1 ? "line" : "lines"}`}
              />
              <SlipField
                label="Pieces"
                value={`${pieces} ${pieces === 1 ? "piece" : "pieces"}`}
              />
              {/* Called out on its own line because it changes how the order is
                  handled, not just what is in it: a slip with a count here
                  cannot be picked off a shelf. */}
              <SlipField
                label="Made to measure"
                value={
                  toMeasure > 0
                    ? `${toMeasure} of ${items.length} ${
                        items.length === 1 ? "line" : "lines"
                      } — cut to order`
                    : "None — all stock sizes"
                }
              />
            </dl>
          </div>
        </section>

        <section className="mt-7">
          <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-2">
            <h2 className="text-[15px] font-semibold tracking-[0.01em] text-ink">
              Cutting sheet
            </h2>
            <p className="text-[11px] text-muted">
              Cut to the ordered figure. Query anything marked in red before cutting.
            </p>
          </div>

          <ol className="divide-y divide-line">
            {items.map((item, index) => (
              <SlipLine
                key={item.id ?? `${item.product_id}-${index}`}
                item={item}
                index={index + 1}
                content={content}
              />
            ))}
          </ol>
        </section>

        <section className="slip-foot mt-7 grid grid-cols-2 gap-8">
          <div>
            <h2 className="eyebrow text-muted">Signed off</h2>
            {/* Ruled lines rather than boxes: a workroom writes a name and a
                time on a slip, and the sheet should have somewhere to put it
                so the paper stays the record. */}
            <div className="mt-4 space-y-5">
              <SignOff label="Cut by" />
              <SignOff label="Checked by" />
              <SignOff label="Packed by" />
            </div>
          </div>

          <div>
            <h2 className="eyebrow text-muted">Total</h2>
            <dl className="mt-3 space-y-2 text-[13px]">
              <div className="flex justify-between gap-6">
                <dt className="text-muted">Items</dt>
                <dd className="tabular-nums text-ink">{formatPrice(itemsTotal)}</dd>
              </div>
              {/* Only when there was one. A slip is read against the money that
                  changed hands, so the sheet has to account for the gap between
                  the line total and what was charged. */}
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
                <dt className="font-medium text-ink">Order total</dt>
                <dd className="text-[17px] font-medium tabular-nums text-ink">
                  {formatPrice(order.total_amount)}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <footer className="mt-8 flex items-center justify-between gap-4 border-t border-line pt-3 text-[10px] text-muted">
          <span>
            {BRAND.name} {BRAND.suffix} · {reference}
          </span>
          <span>Questions about a measurement? {settings.brand_phone ?? BRAND.phone}</span>
        </footer>
      </article>
    </>
  );
}

/**
 * One line of the order, as something to make rather than something to bill.
 *
 * The block is kept whole across a page break (see `.slip-line` in
 * globals.css): a set whose width printed at the bottom of page one and whose
 * height printed at the top of page two is exactly the sort of thing that gets
 * cut wrong.
 */
function SlipLine({
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

  return (
    <li className="slip-line py-4">
      <div className="flex items-start justify-between gap-5">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border border-ink text-[12px] font-medium tabular-nums text-ink">
            {index}
          </span>
          <div className="min-w-0">
            <p className="text-[14px] font-medium leading-snug text-ink">
              {item.product?.name ?? "Product removed from catalogue"}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {[item.product?.fabric, item.product?.pieces].filter(Boolean).join(" · ") ||
                "No fabric or set contents on file"}
            </p>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="eyebrow text-muted">Qty</p>
          <p className="mt-1 text-[20px] font-medium leading-none tabular-nums text-ink">
            {item.quantity}
          </p>
        </div>
      </div>

      {custom ? (
        <CustomMeasurements size={custom} quantity={item.quantity} />
      ) : spec ? (
        <StockSize spec={spec} />
      ) : (
        <UnknownSize size={item.size} />
      )}

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-ink-soft">
        {["Cut", "Stitched", "Pressed", "Packed"].map((stage) => (
          <span key={stage} className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-3 w-3 border border-ink-soft" />
            {stage}
          </span>
        ))}
      </div>
    </li>
  );
}

/**
 * The numbers the set is cut to — the reason this page exists.
 *
 * Both units are printed, because the buyer measures with whichever tape they
 * own and the workroom has one. Only the ordered figure is authoritative,
 * which the note says outright: a conversion carries a rounding, and 208.3 cm
 * is a worse instruction than the 82 in it came from.
 */
function CustomMeasurements({ size, quantity }: { size: CustomSize; quantity: number }) {
  const converted = convertCustomSize(size, otherUnit(size.unit));

  return (
    <div className="mt-3 border-2 border-purple bg-lilac px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow text-purple">Cut to measure</p>
        {quantity > 1 && (
          <p className="text-[11px] font-medium text-purple">
            {quantity} sets to these dimensions
          </p>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-12 gap-y-3">
        <Dimension
          label="Width"
          ordered={formatDimension(size.width, size.unit)}
          converted={formatDimension(converted.width, converted.unit)}
        />
        <Dimension
          label="Height"
          ordered={formatDimension(size.height, size.unit)}
          converted={formatDimension(converted.height, converted.unit)}
        />
      </div>

      <p className="mt-3 text-[10px] leading-relaxed text-purple-deep">
        Ordered in {size.unit === "in" ? "inches" : "centimetres"} — cut to the large
        figure. The {size.unit === "in" ? "centimetre" : "inch"} line is converted, and
        rounded.
      </p>
    </div>
  );
}

/** One measurement, at reading-across-a-table size. */
function Dimension({
  label,
  ordered,
  converted,
}: {
  label: string;
  ordered: string;
  converted: string;
}) {
  return (
    <div>
      <p className="eyebrow text-purple/70">{label}</p>
      <p className="mt-1.5 text-[28px] font-medium leading-none tabular-nums text-ink">
        {ordered}
      </p>
      <p className="mt-1.5 text-[11px] tabular-nums text-muted">{converted}</p>
    </div>
  );
}

/**
 * A stock size, and what that word means in inches.
 *
 * "King Size" is not an instruction to anyone holding scissors. The finished
 * dimensions come from the same chart the buyer was shown before ordering, so
 * the sheet that gets cut and the page that sold it cannot disagree.
 */
function StockSize({ spec }: { spec: CutSpec }) {
  return (
    <div className="mt-3 border border-line bg-frost px-4 py-3">
      <div className="flex items-baseline gap-3">
        <p className="eyebrow text-muted">Stock size</p>
        <p className="text-[15px] font-medium leading-none text-ink">{spec.size}</p>
      </div>
      <dl className="mt-2.5 flex flex-wrap gap-x-8 gap-y-1.5 text-[12px]">
        {spec.spec.map((entry) => (
          <div key={entry.label} className="flex items-baseline gap-2">
            <dt className="text-muted">{entry.label}</dt>
            <dd className="font-medium tabular-nums text-ink">{entry.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[10px] text-muted">
        Finished dimensions, measured flat — the side drop is included.
      </p>
    </div>
  );
}

/**
 * A line nobody should cut from as it stands.
 *
 * Two ways to get here: a size the guide has no row for, and a line written
 * before `order_item_variants.sql` that recorded no size at all. Both print as
 * a question, in the one colour on the sheet that is not the house purple —
 * the failure to avoid is a workroom filling the blank in with whatever it
 * usually makes.
 */
function UnknownSize({ size }: { size?: string | null }) {
  const ordered = size?.trim();

  return (
    <div className="mt-3 border border-sale/40 bg-sale/5 px-4 py-3">
      <p className="eyebrow text-sale">Do not cut yet</p>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink">
        {ordered ? (
          <>
            Ordered as <span className="font-medium">{ordered}</span>, but the size guide
            has no finished dimensions for it.
          </>
        ) : (
          <>No size was recorded against this line.</>
        )}{" "}
        Confirm the measurements with the customer before cutting.
      </p>
    </div>
  );
}

/** A checkout field, blank shown as blank — a hole is worth seeing. */
function SlipField({ label, value }: { label: string; value?: string | null }) {
  const text = value?.trim();

  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-[26mm] shrink-0 text-[11px] text-muted">{label}</dt>
      <dd className="min-w-0 flex-1 break-words text-[12px] text-ink">
        {text || <span className="text-faint">Not provided</span>}
      </dd>
    </div>
  );
}

/** A ruled line to sign on, with room for the name and the day. */
function SignOff({ label }: { label: string }) {
  return (
    <div className="flex items-end gap-3">
      <span className="w-[22mm] shrink-0 text-[11px] text-muted">{label}</span>
      <span aria-hidden className="h-0 flex-1 border-b border-line-soft" />
      <span className="w-[20mm] shrink-0 border-b border-line-soft text-[10px] text-faint">
        Date
      </span>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
