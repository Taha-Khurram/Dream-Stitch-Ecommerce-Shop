import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { StatusPill } from "@/components/admin/StatusPill";
import { CustomerDeleteButton } from "@/components/admin/CustomerActions";
import { formatPrice } from "@/lib/format";
import { orderReference } from "@/lib/orders/lifecycle";
import {
  customerOrderFilter,
  distinctAddresses,
  summariseOrders,
  type CustomerAddress,
} from "@/lib/admin/customers";
import { SEARCH_PARAM } from "@/lib/admin/search";
import { Mail, MapPin, Phone, UserCheck } from "lucide-react";
import type { Customer, Order } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/customers";

/**
 * How many of a customer's orders are read to build this page.
 *
 * Every figure on the screen is folded out of these rows rather than out of an
 * aggregate, which keeps the page to two queries and the maths in one place —
 * but it does mean the cap is the horizon of what the money tiles can see. At
 * 200 that horizon is far beyond any real customer of this store, and the page
 * says so out loud on the day somebody reaches it rather than quietly printing
 * a lifetime value that is short by however many orders fell off the end.
 */
const ORDER_CAP = 200;

/** How many of those get a row. The rest are one click away, in the orders list. */
const HISTORY_LIMIT = 25;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fullDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The row a customer's order history needs. No line items — this is a ledger. */
type HistoryOrder = Pick<
  Order,
  "id" | "status" | "total_amount" | "created_at" | "shipping_address"
>;

/**
 * One customer, in full.
 *
 * The book listed everybody and answered nothing: a name, an address to write
 * to, and a bare order count that could not be clicked. This is the other half
 * — what they have spent, what they have bought, and where it went — arranged
 * the way the orders screen next door is, so drilling in from either list lands
 * somewhere that reads the same.
 *
 * Everything here is derived. There is no customer-level total in the database
 * and no address on the customer row; both are folded out of the orders, which
 * is the only place either fact was ever recorded. See `lib/admin/customers.ts`
 * for how an order is matched to a person — it is not simply the foreign key.
 */
export default async function AdminCustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  /* Refused before it reaches Postgres: an id that is not a uuid is a typo or
     a probe, and `.eq()` on a malformed uuid is an error rather than no rows. */
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customers")
    .select("id, user_id, name, email, phone, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  /* The table only exists once dashboard_schema.sql has been applied. The same
     sentence the list screen shows, because arriving here from a stale tab is
     exactly when it needs saying. */
  if (error?.code === "42P01") {
    return (
      <div>
        <AdminHeading
          title="Customers"
          copy="Everyone on the books, newest first."
          action={
            <Link href={BASE_PATH} className="btn-outline">
              Back
            </Link>
          }
        />
        <div className="mt-10 border border-line bg-white p-10 text-center">
          <p className="text-sm text-ink">The customers table is not there yet.</p>
          <p className="admin-hint mx-auto mt-2 max-w-md">
            Run <code className="text-ink">dashboard_schema.sql</code> in the Supabase SQL
            editor, then reload this page.
          </p>
        </div>
      </div>
    );
  }

  if (!data) notFound();

  const customer = data as Customer;

  /* Their whole history in one read, newest first. Failures are not fatal on
     purpose: the contact details above are worth showing even when the orders
     cannot be reached, and an empty history reads as "no orders" — so the
     difference is spelled out below rather than left to the reader. */
  const { data: orderRows, error: ordersError } = await supabase
    .from("orders")
    .select("id, status, total_amount, created_at, shipping_address")
    .or(customerOrderFilter(customer))
    .order("created_at", { ascending: false })
    .limit(ORDER_CAP);

  const orders = (orderRows ?? []) as HistoryOrder[];
  const summary = summariseOrders(orders);
  const addresses = distinctAddresses(orders);
  const history = orders.slice(0, HISTORY_LIMIT);
  const capped = orders.length === ORDER_CAP;

  /* The orders list searches the checkout email (see lib/admin/search.ts), so
     "every order" is a term this store already understands — no second screen
     to build, and the filtered list gets paging and bulk actions for free. */
  const allOrdersHref = `/admin/orders?${new URLSearchParams({
    [SEARCH_PARAM]: customer.email,
  })}`;

  return (
    <div>
      <AdminHeading
        title={customer.name || customer.email}
        copy={`Customer since ${fullDate(customer.created_at)}`}
        action={
          <Link href={BASE_PATH} className="btn-outline">
            Back
          </Link>
        }
      />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* ── What they have spent, and on what ────────────────────────── */}
        <div className="lg:col-span-2">
          <h2 className="admin-section-title">Lifetime</h2>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat
              label="Lifetime value"
              value={formatPrice(summary.lifetimeValue)}
              note={
                summary.fulfilled === 1
                  ? "1 fulfilled order"
                  : `${summary.fulfilled} fulfilled orders`
              }
            />
            <Stat
              label="Orders"
              value={String(summary.orders)}
              note={
                summary.open > 0
                  ? `${summary.open} still open · ${formatPrice(summary.inFlight)}`
                  : summary.cancelled > 0
                    ? `${summary.cancelled} cancelled`
                    : "All settled"
              }
            />
            <Stat
              label="Average order"
              value={
                summary.averageOrderValue === null
                  ? "—"
                  : formatPrice(summary.averageOrderValue)
              }
              note={summary.averageOrderValue === null ? "Nothing fulfilled yet" : "Across fulfilled orders"}
            />
          </div>

          {/* Says what the big number does and does not include, next to it.
              Lifetime value counting only fulfilled orders is the same rule the
              dashboard's revenue tile follows, and it is a rule worth stating
              on a page where an admin can see an open order for a large sum
              sitting directly underneath a total that excludes it. */}
          <p className="admin-hint mt-3">
            Lifetime value counts fulfilled orders only — money still in the workflow is
            shown beside the order count, not in the total.
            {capped && (
              <> Figures cover this customer&rsquo;s {ORDER_CAP} most recent orders.</>
            )}
          </p>

          <section className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <h2 className="admin-section-title">Order history</h2>
              {summary.orders > history.length && (
                <Link
                  href={allOrdersHref}
                  className="text-[12px] font-medium text-muted transition-colors hover:text-purple"
                >
                  See all {summary.orders}
                </Link>
              )}
            </div>

            {ordersError ? (
              <p className="mt-4 border border-line bg-white p-8 text-center text-sm text-muted">
                Their orders could not be loaded just now. The contact details are still
                accurate.
              </p>
            ) : history.length === 0 ? (
              <p className="mt-4 border border-line bg-white p-8 text-center text-sm text-muted">
                No orders yet.
              </p>
            ) : (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink">
                        {["Order", "Placed", "Status"].map((head) => (
                          <th key={head} className="admin-th pb-3">
                            {head}
                          </th>
                        ))}
                        <th className="admin-th pb-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((order) => (
                        <tr
                          key={order.id}
                          className="border-b border-line transition-colors hover:bg-frost"
                        >
                          <td className="py-3.5">
                            <Link
                              href={`/admin/orders/${order.id}`}
                              className="font-medium text-ink transition-colors hover:text-purple"
                            >
                              {orderReference(order.id)}
                            </Link>
                          </td>
                          <td className="py-3.5 text-muted">{shortDate(order.created_at)}</td>
                          <td className="py-3.5">
                            <StatusPill status={order.status} />
                          </td>
                          <td className="py-3.5 text-right tabular-nums text-ink">
                            {formatPrice(order.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {summary.orders > history.length && (
                  <p className="admin-hint mt-3">
                    Showing the {history.length} most recent of {summary.orders}.
                  </p>
                )}
              </>
            )}
          </section>

          {/* ── Where their parcels go ─────────────────────────────────── */}
          <section className="mt-10">
            <h2 className="admin-section-title">Addresses</h2>
            <p className="admin-hint mt-1">
              Taken from their orders — the store only ever asks for an address at
              checkout, so these are the ones they have actually used.
            </p>

            {addresses.length === 0 ? (
              <p className="mt-4 border border-line bg-white p-8 text-center text-sm text-muted">
                No address on file. One is recorded the first time they check out.
              </p>
            ) : (
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {addresses.map((entry, index) => (
                  <AddressCard
                    key={`${entry.lastUsedAt}-${index}`}
                    entry={entry}
                    /* The first card is the most recently used one — where the
                       next parcel would go if nothing changes. Worth marking,
                       because a list of three addresses in no stated order is
                       three guesses. */
                    latest={index === 0 && addresses.length > 1}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ── Who they are ─────────────────────────────────────────────── */}
        <div className="space-y-8">
          <section>
            <h2 className="admin-section-title">Contact</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="admin-label">Name</dt>
                <dd className="mt-0.5 break-words text-ink">{customer.name || "—"}</dd>
              </div>
              <div>
                <dt className="admin-label">Email</dt>
                <dd className="mt-0.5">
                  <a
                    href={`mailto:${customer.email}`}
                    className="flex items-center gap-1.5 break-all text-ink-soft transition-colors hover:text-purple"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                    {customer.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="admin-label">Phone</dt>
                <dd className="mt-0.5">
                  {customer.phone ? (
                    <a
                      href={`tel:${customer.phone.replace(/\s+/g, "")}`}
                      className="flex items-center gap-1.5 text-ink-soft transition-colors hover:text-purple"
                    >
                      <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                      {customer.phone}
                    </a>
                  ) : (
                    <span className="text-faint">Not provided</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="admin-label">Account</dt>
                <dd className="mt-0.5 text-ink-soft">
                  {/* `user_id` is the login link, not the identity — see the
                      note on Customer in types/ecommerce.ts. What it answers is
                      whether this person can sign in and see their own orders,
                      which decides whether "check your account" is useful
                      advice to give them on the phone. */}
                  {customer.user_id ? (
                    <span className="flex items-center gap-1.5 text-jade">
                      <UserCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                      Has a sign-in
                    </span>
                  ) : (
                    <span className="text-muted">No account — guest record</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="admin-label">On the books since</dt>
                <dd className="mt-0.5 text-ink-soft">{fullDate(customer.created_at)}</dd>
              </div>
            </dl>
          </section>

          {summary.orders > 0 && (
            <section className="border-t border-line pt-6">
              <h2 className="admin-section-title">Trading</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-6">
                  <dt className="text-muted">First order</dt>
                  <dd className="text-ink">
                    {summary.firstOrderAt ? shortDate(summary.firstOrderAt) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-6">
                  <dt className="text-muted">Last order</dt>
                  <dd className="text-ink">
                    {summary.lastOrderAt ? shortDate(summary.lastOrderAt) : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-6 border-t border-line pt-2">
                  <dt className="font-medium text-ink">Lifetime value</dt>
                  <dd className="text-base font-medium tabular-nums text-ink">
                    {formatPrice(summary.lifetimeValue)}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <section className="border-t border-line pt-6">
            <h2 className="admin-section-title">Danger zone</h2>
            <div className="mt-3">
              <CustomerDeleteButton
                id={customer.id}
                name={customer.name}
                email={customer.email}
                orderCount={summary.orders}
                onDeleted={BASE_PATH}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

/* ── Pieces ───────────────────────────────────────────────────────────────── */

/** Same shape as the dashboard tile, so a number reads the same wherever it is. */
function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border border-line bg-white p-5">
      <span className="admin-label">{label}</span>
      <p className="mt-3 font-[family-name:var(--font-display)] text-[24px] leading-none tabular-nums text-ink">
        {value}
      </p>
      {note && <p className="admin-hint mt-2">{note}</p>}
    </div>
  );
}

/**
 * One place this customer has had something sent.
 *
 * Laid out as a postal block rather than the labelled field grid the order
 * detail page uses, and for the opposite reason: there, one address is being
 * read off to pack a parcel and every line has to be unambiguous. Here several
 * addresses are being compared at a glance, and the shape of a block is what
 * makes two of them tell apart.
 */
function AddressCard({ entry, latest }: { entry: CustomerAddress; latest: boolean }) {
  const { address } = entry;

  const lines = [
    address.streetAddress,
    [address.city, address.state].filter(Boolean).join(", "),
    [address.postalCode, address.country].filter(Boolean).join(" "),
  ].filter((line) => line && line.trim());

  return (
    <li className="border border-line bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-ink">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={1.75} aria-hidden />
          <span className="truncate">{address.fullName || "No recipient named"}</span>
        </p>
        {latest && (
          <span className="shrink-0 border border-purple/30 bg-lilac px-1.5 py-0.5 text-[10px] font-medium text-purple">
            Latest
          </span>
        )}
      </div>

      <address className="mt-2 not-italic text-[13px] leading-relaxed text-ink-soft">
        {lines.length > 0 ? (
          lines.map((line, i) => <span key={i} className="block break-words">{line}</span>)
        ) : (
          <span className="text-faint">No street address recorded</span>
        )}
      </address>

      {address.phone && (
        <p className="admin-hint mt-2 flex items-center gap-1.5">
          <Phone className="h-3 w-3 shrink-0" strokeWidth={1.5} />
          {address.phone}
        </p>
      )}

      <p className="admin-hint mt-3 border-t border-line-soft pt-2">
        {entry.orders === 1 ? "1 order" : `${entry.orders} orders`} · last used{" "}
        {shortDate(entry.lastUsedAt)}
      </p>
    </li>
  );
}
