import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { StatusPill } from "@/components/admin/StatusPill";
import { OrderStatusControl } from "@/components/admin/OrderStatusControl";
import { formatPrice } from "@/lib/format";
import type { Order } from "@/types/ecommerce";

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
      "id, status, total_amount, created_at, updated_at, shipping_address, order_items(id, quantity, unit_price, product:products(id, name, image_url, fabric))"
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

  return (
    <div>
      <AdminHeading
        title={`Order #${order.id.slice(0, 8).toUpperCase()}`}
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
          <h2 className="eyebrow text-ink">Items</h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {items.map((item) => (
              <li key={item.id ?? item.product_id} className="flex items-center gap-4 py-4">
                <div className="h-16 w-14 shrink-0 overflow-hidden bg-lilac">
                  {item.product?.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={item.product.image_url}
                      alt=""
                      className="h-full w-full object-cover object-center"
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] text-ink">
                    {item.product?.name ?? "Product removed"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {item.product?.fabric} · {formatPrice(item.unit_price)} × {item.quantity}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] tabular-nums text-ink">
                  {formatPrice(Number(item.unit_price) * item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-6 ml-auto max-w-xs space-y-2 text-[13px]">
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
              <dd className="font-medium tabular-nums text-ink">
                {formatPrice(order.total_amount)}
              </dd>
            </div>
          </dl>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="eyebrow text-ink">Status</h2>
            <div className="mt-3">
              <StatusPill status={order.status} />
            </div>
            <div className="mt-4">
              <OrderStatusControl id={order.id} current={order.status} />
            </div>
          </section>

          <section>
            <h2 className="eyebrow text-ink">Deliver to</h2>
            {address ? (
              <address className="mt-3 space-y-1 text-[13px] not-italic leading-relaxed text-ink-soft">
                <p className="text-ink">{address.fullName}</p>
                <p>{address.streetAddress}</p>
                <p>
                  {address.city}
                  {address.state ? `, ${address.state}` : ""} {address.postalCode}
                </p>
                <p>{address.country}</p>
                {address.phone && <p className="pt-1">{address.phone}</p>}
                {address.email && (
                  <a href={`mailto:${address.email}`} className="link-rule block text-purple">
                    {address.email}
                  </a>
                )}
              </address>
            ) : (
              <p className="mt-3 text-[13px] text-muted">No address recorded.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
