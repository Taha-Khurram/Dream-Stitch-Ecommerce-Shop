import React from "react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/api/settings";
import { orderTotals } from "@/lib/admin/order-document";
import { formatPrice } from "@/lib/format";
import { customerStatusLabel, orderReference } from "@/lib/orders/lifecycle";
import {
  REFERENCE_PROBLEM_COPY,
  TRACKING_PARAM,
  findTrackedOrder,
  parseOrderReference,
  readRecentOrders,
  trackingJourney,
  type OrderSummary,
  type TrackedOrder,
} from "@/lib/orders/tracking";
import { customSizeFromRow, formatCustomSize } from "@/lib/custom-size";
import { OrderTimeline } from "@/components/orders/OrderTimeline";
import { BRAND } from "@/lib/constants";
import type { Order, OrderItem, ShippingAddress } from "@/types/ecommerce";
import { AlertCircle, ChevronRight, PackageSearch, Ruler, Search } from "lucide-react";

export const metadata: Metadata = {
  title: `Track Your Order | ${BRAND.name}`,
  description: `Follow a ${BRAND.name} order from the studio to your door using the order number on your confirmation.`,
  /* A page about one person's purchase, reachable only with their session.
     Same reasoning as /wishlist. */
  robots: { index: false },
};

/* Every read here is about the signed-in person and the moment they asked. */
export const dynamic = "force-dynamic";

interface TrackPageProps {
  /* Widened to what a URL can actually carry: `?order=a&order=b` arrives as an
     array, and a page that assumed a string would throw on a link anyone can
     type. `firstValue` below settles it before anything reads it. */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Where a customer finds out what has happened to their order.
 *
 * A plain GET form, in the house style of `components/admin/SearchBox.tsx`: no
 * client JavaScript, and a tracked order is a real URL that survives a reload
 * and can be sent to whoever is waiting in for the parcel.
 *
 * Signed in, always. Not for privacy theatre — the lookup is scoped to the
 * caller's own `user_id` and RLS scopes it again, so a session is what makes
 * the query answerable at all. Checkout requires an account, so every order
 * that exists has one behind it.
 *
 * The recent-orders list below the form is the other half of the feature. The
 * reference is eight characters printed once on a confirmation panel, and
 * "I have lost the number" is the likeliest reason somebody is on this page.
 */
export default async function TrackOrderPage({ searchParams }: TrackPageProps) {
  const params = await searchParams;
  const raw = firstValue(params[TRACKING_PARAM]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    /* Carry the reference through the sign-in so it is not typed twice. */
    const next = raw
      ? `/track?${TRACKING_PARAM}=${encodeURIComponent(raw)}`
      : "/track";
    redirect(`/signin?next=${encodeURIComponent(next)}`);
  }

  const parsed = parseOrderReference(raw);

  /* The lookup only runs for a reference that could match something. An empty
     field is the page's resting state, not a failed search. */
  const [result, recent, settings] = await Promise.all([
    parsed.ok ? findTrackedOrder(supabase, user.id, parsed.hex) : null,
    readRecentOrders(supabase, user.id),
    getSettings(),
  ]);

  const found = result?.status === "found" ? result.order : null;

  return (
    <div className="pb-20">
      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex max-w-[1500px] items-center gap-2 px-6 py-4 text-[11px] text-muted xl:px-10"
      >
        <Link href="/" className="transition-colors hover:text-ink">
          Home
        </Link>
        <ChevronRight className="h-3 w-3 text-faint" />
        <span className="text-ink">Track Order</span>
      </nav>

      <div className="mx-auto max-w-[1500px] px-6 xl:px-10">
        <header className="border-b border-line pb-8">
          <span className="eyebrow text-purple">Order Tracking</span>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink sm:text-[38px]">
            Track Your Order
          </h1>
          <p className="mt-3 max-w-lg text-[13px] leading-relaxed text-ink-soft">
            Enter the order number from your confirmation — it looks like{" "}
            <span className="font-medium tabular-nums text-ink">3F9A21C4</span> — and we
            will show you exactly where it has got to.
          </p>
        </header>

        <div className="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-14">
          <div className="min-w-0">
            <TrackForm defaultValue={raw ?? ""} />

            {/* Only what was actually asked gets answered. A first visit shows
                the form and the list, and says nothing about orders that were
                never looked for. */}
            {raw !== undefined && !parsed.ok && parsed.problem !== "empty" && (
              <Problem copy={REFERENCE_PROBLEM_COPY[parsed.problem]} />
            )}

            {result && result.status !== "found" && (
              <Problem copy={missCopy(result, raw ?? "")} />
            )}

            {found ? (
              <TrackedOrderView order={found} supportPhone={settings.brand_phone} supportEmail={settings.brand_email} />
            ) : (
              <EmptyState hasOrders={recent.length > 0} />
            )}
          </div>

          <aside className="min-w-0 lg:border-l lg:border-line lg:pl-10">
            <RecentOrders orders={recent} activeId={found?.id ?? null} />
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ── The form ──────────────────────────────────────────────────────────── */

function TrackForm({ defaultValue }: { defaultValue: string }) {
  return (
    <form action="/track" className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          strokeWidth={1.5}
        />
        <input
          type="search"
          name={TRACKING_PARAM}
          defaultValue={defaultValue}
          placeholder="Order number, e.g. 3F9A21C4"
          aria-label="Order number"
          autoComplete="off"
          spellCheck={false}
          className="w-full border border-line bg-white py-2.5 pl-9 pr-3 text-sm uppercase tracking-[0.08em] text-ink transition-colors placeholder-faint placeholder:normal-case placeholder:tracking-normal hover:border-faint focus:border-purple focus:outline-none focus:ring-2 focus:ring-purple/15"
        />
      </div>
      <button type="submit" className="btn-primary cursor-pointer">
        Track Order
      </button>
    </form>
  );
}

/** Anything that stopped a lookup, said in one line under the field. */
function Problem({ copy }: { copy: string }) {
  return (
    <p
      role="status"
      className="mt-4 flex items-start gap-2 border border-sale/30 bg-sale/5 p-3.5 text-[12px] leading-relaxed text-sale"
    >
      <AlertCircle className="mt-px h-4 w-4 shrink-0" strokeWidth={1.6} />
      {copy}
    </p>
  );
}

/**
 * Why a reference that parsed still found nothing.
 *
 * "Not found" is deliberately phrased as *your* orders rather than as the
 * order not existing: this lookup only ever sees the caller's own rows, so a
 * reference belonging to somebody else is indistinguishable from a typo, and
 * saying "no such order" would be a claim this page cannot make.
 */
function missCopy(result: TrackedOrder, raw: string): string {
  const typed = raw.trim().replace(/^#/, "").toUpperCase();

  switch (result.status) {
    case "ambiguous":
      return `More than one of your orders starts with ${typed}. Enter the full order number from your confirmation.`;
    case "failed":
      return "We could not look that up just now. Please try again in a moment.";
    default:
      return `No order of yours matches ${typed}. Check the number on your confirmation — it is the eight characters printed as the order number.`;
  }
}

function EmptyState({ hasOrders }: { hasOrders: boolean }) {
  return (
    <div className="mt-8 border border-line bg-frost px-6 py-12 text-center">
      <PackageSearch className="mx-auto h-7 w-7 text-faint" strokeWidth={1.2} />
      <p className="mt-4 text-[13px] leading-relaxed text-ink-soft">
        {hasOrders
          ? "Enter an order number above, or pick one of your recent orders."
          : "Once you place an order, its number appears on the confirmation — and this is where you follow it."}
      </p>
      {!hasOrders && (
        <Link href="/shop" className="btn-outline mt-6">
          Browse the collection
        </Link>
      )}
    </div>
  );
}

/* ── The order ─────────────────────────────────────────────────────────── */

function TrackedOrderView({
  order,
  supportPhone,
  supportEmail,
}: {
  order: Order;
  supportPhone: string | null;
  supportEmail: string | null;
}) {
  const items = order.order_items ?? [];
  const journey = trackingJourney(order.status);
  const { itemsTotal, discount, delivery, total } = orderTotals(order);
  const reference = orderReference(order.id);

  return (
    <section className="mt-8 border border-line bg-white">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div className="min-w-0">
          <span className="eyebrow text-muted">Order</span>
          <p className="mt-1.5 font-[family-name:var(--font-display)] text-[26px] leading-none tabular-nums text-ink">
            {reference}
          </p>
          <p className="mt-2 text-[12px] text-muted">
            Placed {formatDate(order.created_at)} · {countItems(items)}
          </p>
        </div>

        <div className="text-right">
          <span className="eyebrow text-muted">Status</span>
          <p className="mt-1.5 text-[15px] font-medium leading-none text-ink">
            {journey.headline}
          </p>
          {order.updated_at && (
            <p className="mt-2 text-[12px] text-muted">
              Updated {formatDate(order.updated_at)}
            </p>
          )}
        </div>
      </header>

      <div className="grid gap-8 px-6 py-6 sm:grid-cols-2 sm:gap-10">
        <div>
          <h2 className="eyebrow text-muted">Progress</h2>
          <OrderTimeline journey={journey} />
        </div>

        <div>
          <h2 className="eyebrow text-muted">Delivering to</h2>
          <DeliveryAddress address={order.shipping_address} />
        </div>
      </div>

      <div className="border-t border-line px-6 py-6">
        <h2 className="eyebrow text-muted">What you ordered</h2>
        <ul className="mt-4 divide-y divide-line-soft">
          {items.map((item, index) => (
            <TrackedLine key={item.id ?? `${item.product_id}-${index}`} item={item} />
          ))}
        </ul>

        <dl className="mt-5 space-y-2 border-t border-line pt-5 text-[13px]">
          <Figure label="Items" value={formatPrice(itemsTotal)} />
          {discount > 0 && (
            <Figure
              label={`Discount${order.discount_code ? ` · ${order.discount_code}` : ""}`}
              value={`−${formatPrice(discount)}`}
              tone="purple"
            />
          )}
          <Figure label="Delivery" value={delivery > 0 ? formatPrice(delivery) : "Free"} />
          <div className="flex items-baseline justify-between gap-6 border-t border-line pt-3">
            <dt className="font-medium text-ink">Total paid</dt>
            <dd className="text-[16px] font-medium tabular-nums text-ink">
              {formatPrice(total)}
            </dd>
          </div>
        </dl>
      </div>

      <footer className="border-t border-line bg-frost px-6 py-5 text-[12px] leading-relaxed text-ink-soft">
        Something not right with {reference}? Quote that number and get in touch on{" "}
        <span className="text-ink">{supportPhone ?? BRAND.phone}</span>
        {supportEmail ? (
          <>
            {" "}
            or at{" "}
            <a href={`mailto:${supportEmail}`} className="link-rule text-ink">
              {supportEmail}
            </a>
          </>
        ) : null}
        , or{" "}
        <Link href="/contact" className="link-rule text-ink">
          send us a message
        </Link>
        .
      </footer>
    </section>
  );
}

/**
 * One line of the order.
 *
 * Links back to the product where there is still a product to link to: a set
 * can be delisted between the order and the delivery, and the row on the order
 * outlives the row in the catalogue.
 */
function TrackedLine({ item }: { item: OrderItem }) {
  const custom = customSizeFromRow(item);
  const product = item.product;
  const href = product ? `/shop/${product.slug ?? item.product_id}` : null;
  const unitPrice = Number(item.unit_price);

  const body = (
    <>
      <span className="relative h-16 w-14 shrink-0 overflow-hidden bg-lilac">
        {product?.image_url && (
          <Image
            src={product.image_url}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium leading-snug text-ink">
          {product?.name ?? "Item no longer in our catalogue"}
        </span>
        {product && (
          <span className="mt-1 block text-[11px] text-muted">
            {[product.fabric, product.pieces].filter(Boolean).join(" · ")}
          </span>
        )}
        {custom ? (
          <span className="mt-1.5 inline-flex items-center gap-1.5 border border-purple/30 bg-lilac px-2 py-0.5 text-[11px] font-medium text-purple">
            <Ruler className="h-3 w-3" /> Cut to measure · {formatCustomSize(custom)}
          </span>
        ) : (
          <span className="mt-1 block text-[12px] text-ink-soft">
            {item.size ? `Size ${item.size}` : "Size not recorded"}
          </span>
        )}
      </span>

      <span className="shrink-0 text-right tabular-nums">
        <span className="block text-[13px] font-medium leading-none text-ink">
          {formatPrice(unitPrice * item.quantity)}
        </span>
        <span className="mt-1.5 block text-[11px] text-muted">
          {item.quantity} × {formatPrice(unitPrice)}
        </span>
      </span>
    </>
  );

  return (
    <li>
      {href ? (
        <Link href={href} className="flex items-start gap-4 py-4 transition-colors hover:bg-frost">
          {body}
        </Link>
      ) : (
        <div className="flex items-start gap-4 py-4">{body}</div>
      )}
    </li>
  );
}

function DeliveryAddress({ address }: { address: ShippingAddress | null }) {
  if (!address) {
    return (
      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        No delivery address was recorded against this order. Get in touch and we will
        put that right before it goes out.
      </p>
    );
  }

  const lines = [
    address.streetAddress,
    address.city,
    address.state,
    address.postalCode,
    address.country,
  ]
    .map((line) => line?.trim())
    .filter(Boolean);

  return (
    <div className="mt-4">
      <p className="text-[13px] font-medium text-ink">
        {address.fullName?.trim() || "Name not provided"}
      </p>
      <address className="mt-1.5 text-[12px] not-italic leading-relaxed text-ink-soft">
        {lines.join(", ")}
      </address>
      {address.phone?.trim() && (
        <p className="mt-2 text-[12px] tabular-nums text-muted">{address.phone}</p>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "purple";
}) {
  return (
    <div className="flex items-baseline justify-between gap-6">
      <dt className="truncate text-muted">{label}</dt>
      <dd className={`shrink-0 tabular-nums ${tone === "purple" ? "text-purple" : "text-ink"}`}>
        {value}
      </dd>
    </div>
  );
}

/* ── The shortcut ──────────────────────────────────────────────────────── */

function RecentOrders({
  orders,
  activeId,
}: {
  orders: OrderSummary[];
  activeId: string | null;
}) {
  if (orders.length === 0) return null;

  return (
    <div>
      <h2 className="eyebrow text-muted">Your recent orders</h2>
      <ul className="mt-4 divide-y divide-line-soft border-y border-line">
        {orders.map((order) => {
          const reference = orderReference(order.id);
          const active = order.id === activeId;

          return (
            <li key={order.id}>
              <Link
                href={`/track?${TRACKING_PARAM}=${order.id.slice(0, 8)}`}
                aria-current={active ? "true" : undefined}
                className={`flex items-baseline justify-between gap-4 py-3.5 transition-colors ${
                  active ? "text-purple" : "text-ink hover:text-purple"
                }`}
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium tabular-nums">
                    {reference}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted">
                    {formatDate(order.created_at)} · {customerStatusLabel(order.status)}
                  </span>
                </span>
                <span className="shrink-0 text-[12px] tabular-nums text-ink-soft">
                  {formatPrice(order.total_amount)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[11px] leading-relaxed text-muted">
        Older orders are still trackable — enter their number in the field.
      </p>
    </div>
  );
}

function countItems(items: OrderItem[]): string {
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  return `${units} ${units === 1 ? "item" : "items"}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
