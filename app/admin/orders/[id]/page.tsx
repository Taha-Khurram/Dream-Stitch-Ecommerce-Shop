import React from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { StatusPill } from "@/components/admin/StatusPill";
import { OrderStatusControl } from "@/components/admin/OrderStatusControl";
import {
  OrderDeleteButton,
  OrderIntakeActions,
} from "@/components/admin/OrderIntakeActions";
import { formatPrice } from "@/lib/format";
import { isAwaitingReview, orderReference } from "@/lib/orders/lifecycle";
import { customSizeFromRow, formatCustomSize } from "@/lib/custom-size";
import type { Order, OrderItem } from "@/types/ecommerce";
import { Ruler } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data } = await supabase
    .from("orders")
    .select(
      "id, status, total_amount, created_at, updated_at, shipping_address, order_items(id, quantity, unit_price, size, custom_width, custom_height, custom_unit, product:products(id, name, image_url, fabric))"
    )
    .eq("id", id)
    .single();

  if (!data) notFound();

  const order = data as unknown as Order;
  const items = order.order_items ?? [];
  const address = order.shipping_address;

  const itemsTotal = items.reduce(
    (sum, item) => sum + Number(item.unit_price) * item.quantity,
    0
  );
  const delivery = Number(order.total_amount) - itemsTotal;
  const awaitingReview = isAwaitingReview(order.status);

  return (
    <div>
      <AdminHeading
        title={`Order ${orderReference(order.id)}`}
        copy={`Placed ${new Date(order.created_at).toLocaleString("en-GB", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`}
        action={
          <Link href="/admin/orders" className="btn-outline">
            Back
          </Link>
        }
      />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="admin-section-title">Items</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {items.map((item) => (
              <li key={item.id ?? item.product_id} className="flex items-center gap-4 py-4">
                <div className="h-16 w-14 shrink-0 overflow-hidden bg-lilac">
                  {item.product?.image_url && (
                    <Image
                      src={item.product.image_url}
                      alt=""
                      width={56}
                      height={64}
                      sizes="56px"
                      className="h-full w-full object-cover object-center"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-ink">
                    {item.product?.name ?? "Product removed"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {item.product?.fabric} · {formatPrice(item.unit_price)} × {item.quantity}
                  </p>
                  <ItemVariant item={item} />
                </div>
                <span className="shrink-0 text-sm tabular-nums text-ink">
                  {formatPrice(Number(item.unit_price) * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <section className="mt-10 border-t border-line pt-6">
            <h2 className="admin-section-title">Deliver to</h2>
            {address ? (
              /* Field by field, under the labels the buyer filled in at
                 checkout. Run together as one postal block it reads fine in a
                 country you already know and is guesswork everywhere else —
                 "Test, Punjab 38000" does not say which line was typed as the
                 city, and whoever packs the parcel should not have to guess. */
              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                <AddressField label="Full Name" value={address.fullName} />
                <AddressField
                  label="Phone"
                  value={address.phone}
                  href={
                    address.phone ? `tel:${address.phone.replace(/\s+/g, "")}` : undefined
                  }
                />
                <AddressField
                  label="Email"
                  value={address.email}
                  href={address.email ? `mailto:${address.email}` : undefined}
                  className="sm:col-span-2"
                />
                <AddressField
                  label="Address"
                  value={address.streetAddress}
                  className="sm:col-span-2"
                />
                <AddressField label="City" value={address.city} />
                <AddressField label="Province" value={address.state} />
                <AddressField label="Postal Code" value={address.postalCode} />
                <AddressField label="Country" value={address.country} />
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted">No address recorded.</p>
            )}
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="admin-section-title">Status</h2>
            <div className="mt-3">
              <StatusPill status={order.status} />
            </div>

            {/* One decision at a time. Until an order is accepted the only
                things to do with it are accept or delete, so the status track
                is not shown yet — offering both at once invites skipping the
                triage step, which the server would refuse anyway. */}
            <div className="mt-4">
              {awaitingReview ? (
                <OrderIntakeActions id={order.id} variant="panel" onDeleted="/admin/orders" />
              ) : (
                <OrderStatusControl id={order.id} current={order.status} />
              )}
            </div>
          </section>

          {/* Accepting an order is a commitment to a number, so the number sits
              next to the button that does it rather than a scroll away in the
              items column. */}
          <section className="border-t border-line pt-6">
            <h2 className="admin-section-title">Summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-6">
                <dt className="text-muted">Items</dt>
                <dd className="tabular-nums text-ink">{formatPrice(itemsTotal)}</dd>
              </div>
              <div className="flex justify-between gap-6">
                <dt className="text-muted">Delivery</dt>
                <dd className="tabular-nums text-ink">
                  {delivery > 0 ? formatPrice(delivery) : "Free"}
                </dd>
              </div>
              <div className="flex justify-between gap-6 border-t border-line pt-2">
                <dt className="font-medium text-ink">Total</dt>
                <dd className="text-base font-medium tabular-nums text-ink">
                  {formatPrice(order.total_amount)}
                </dd>
              </div>
            </dl>
          </section>

          {/* Intake already offers a delete of its own, so this only shows for
              an order that is on the books — last in the column, behind a
              rule, because it is the one control here you cannot undo. */}
          {!awaitingReview && (
            <section className="border-t border-line pt-6">
              <h2 className="admin-section-title">Danger zone</h2>
              <div className="mt-3">
                <OrderDeleteButton
                  id={order.id}
                  status={order.status}
                  onDeleted="/admin/orders"
                />
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * One checkout field, under the label the buyer saw when they typed it.
 *
 * A field left blank is shown as blank rather than dropped — a hole in the
 * record is worth seeing before you ring someone up, and a list that silently
 * omits what it does not have looks identical to a complete one.
 */
function AddressField({
  label,
  value,
  href,
  className,
}: {
  label: string;
  value?: string | null;
  href?: string;
  className?: string;
}) {
  const text = value?.trim();

  return (
    <div className={className}>
      <dt className="admin-label">{label}</dt>
      <dd className="mt-1 break-words text-sm text-ink">
        {!text ? (
          <span className="text-faint">Not provided</span>
        ) : href ? (
          <a href={href} className="link-rule text-purple">
            {text}
          </a>
        ) : (
          text
        )}
      </dd>
    </div>
  );
}

/**
 * What was actually ordered on this line.
 *
 * Measurements are the whole point of a made-to-measure order, so they are
 * called out rather than tucked into the grey subtitle — this is the number
 * someone reads off the screen and cuts against. Lines from before
 * `order_item_variants.sql` carry no size at all, and say so instead of
 * silently implying a standard one.
 */
function ItemVariant({ item }: { item: OrderItem }) {
  const custom = customSizeFromRow(item);

  if (custom) {
    return (
      <p className="mt-1.5 inline-flex items-center gap-1.5 border border-purple/30 bg-lilac px-2 py-1 text-[11px] font-medium text-purple">
        <Ruler className="h-3 w-3" />
        Cut to measure · {formatCustomSize(custom)}
      </p>
    );
  }

  if (item.size) {
    return <p className="mt-1 text-[12px] text-ink-soft">Size {item.size}</p>;
  }

  return <p className="mt-1 text-[12px] text-faint">Size not recorded</p>;
}
