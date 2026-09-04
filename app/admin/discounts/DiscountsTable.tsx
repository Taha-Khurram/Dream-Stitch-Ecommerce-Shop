import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DiscountStatusPill } from "@/components/admin/DiscountPills";
import { DiscountRowActions } from "@/components/admin/DiscountRowActions";
import { DiscountsNotInstalled } from "@/components/admin/DiscountsNotInstalled";
import { Pagination, PaginationSkeleton } from "@/components/admin/Pagination";
import { Skeleton } from "@/components/motion/Skeleton";
import { buildPageHref, lastPageFor, rangeFor, type PerPage } from "@/lib/pagination";
import { readDiscountUsage } from "@/lib/discounts/usage";
import {
  DISCOUNT_STATUSES,
  DISCOUNT_STATUS_COPY,
  describeDiscount,
  discountStatus,
  isDiscountKind,
} from "@/lib/discounts/lifecycle";
import { formatPrice } from "@/lib/format";
import type { DiscountUsage } from "@/types/ecommerce";

export const BASE_PATH = "/admin/discounts";

/** Everything, or one status. Derived, so a sixth status could not go missing. */
export const FILTERS = ["all", ...DISCOUNT_STATUSES] as const;
export type DiscountFilter = (typeof FILTERS)[number];

export function filterLabel(filter: DiscountFilter): string {
  return filter === "all" ? "All" : DISCOUNT_STATUS_COPY[filter].label;
}

export function filterParams(status: DiscountFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  return params;
}

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * The codes, and what each of them has actually cost.
 *
 * The one thing this screen does differently from every other admin list: the
 * rows arrive in a single aggregate — `admin_discount_usage()` joins each rule
 * to its ledger — and the filter and the page window are applied here rather
 * than in the query. That is a deliberate trade, and it is bounded by what the
 * data is: a store has tens of coupons, not tens of thousands, and one grouped
 * scan is cheaper than a filtered page plus a second round trip for the
 * totals. The strip above the table needs every row anyway.
 *
 * A code's *status* is the other reason. It is not a column — it is derived
 * from the off switch, the two dates and the redemption count together, all of
 * which change with the clock. Filtering on it in Postgres would mean
 * recomputing that expression in SQL and keeping it in step with
 * `discountStatus()`; one definition, applied where the rows are rendered, is
 * the version that cannot drift.
 */
export async function DiscountsTable({
  status,
  page,
  perPage,
}: {
  status: DiscountFilter;
  page: number;
  perPage: PerPage;
}) {
  const usage = await readDiscountUsage();

  if (usage.status === "not_installed") return <DiscountsNotInstalled />;

  if (usage.status === "failed") {
    return (
      <p className="mt-10 border border-sale/30 bg-sale/5 p-10 text-center text-sm text-sale">
        Could not load the codes. {usage.message}
      </p>
    );
  }

  const all = usage.rows.map((row) => ({ row, status: discountStatus(row, row.uses) }));
  const matching = status === "all" ? all : all.filter((entry) => entry.status === status);

  const total = matching.length;
  const lastPage = lastPageFor(total, perPage);
  const { from, to } = rangeFor(page, perPage);
  const visible = matching.slice(from, to + 1);

  if (visible.length === 0 && total > 0 && page > lastPage) {
    redirect(buildPageHref(BASE_PATH, filterParams(status), { page: lastPage, perPage }));
  }

  if (total === 0) {
    return (
      <p className="mt-10 border border-line bg-white p-12 text-center text-sm text-muted">
        {status === "all"
          ? "No codes yet. Create one and it can be typed into the bag straight away."
          : `No ${filterLabel(status).toLowerCase()} codes.`}
      </p>
    );
  }

  return (
    <>
      <UsageSummary rows={matching.map((entry) => entry.row)} scope={status} />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[60rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              {["Code", "Status", "Takes off", "Used", "Customers", "Given away", "Last used"].map(
                (head) => (
                  <th key={head} className="admin-th pb-3">
                    {head}
                  </th>
                )
              )}
              <th className="admin-th pb-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map(({ row, status: rowStatus }) => (
              <tr key={row.id} className="border-b border-line transition-colors hover:bg-frost">
                <td className="py-3.5">
                  <Link
                    href={`/admin/discounts/${row.id}`}
                    className="font-medium tracking-[0.06em] text-ink transition-colors hover:text-purple"
                  >
                    {row.code}
                  </Link>
                </td>

                <td className="py-3.5">
                  <DiscountStatusPill status={rowStatus} />
                </td>

                <td className="py-3.5 whitespace-nowrap text-ink-soft">
                  {isDiscountKind(row.kind) ? describeDiscount(row.kind, row.value) : row.kind}
                  {row.min_subtotal > 0 && (
                    <span className="admin-hint mt-1 block whitespace-nowrap">
                      Over {formatPrice(row.min_subtotal)}
                    </span>
                  )}
                </td>

                {/* The number the screen exists for. Against its cap where it
                    has one, because "43" and "43 of 50" are different facts. */}
                <td className="py-3.5 whitespace-nowrap tabular-nums text-ink">
                  {row.max_uses === null
                    ? row.uses.toLocaleString()
                    : `${row.uses.toLocaleString()} / ${row.max_uses.toLocaleString()}`}
                </td>

                <td className="py-3.5 tabular-nums text-ink-soft">
                  {row.customers.toLocaleString()}
                </td>

                <td className="py-3.5 whitespace-nowrap tabular-nums text-ink-soft">
                  {row.discounted > 0 ? formatPrice(row.discounted) : "—"}
                  {row.order_total > 0 && (
                    <span className="admin-hint mt-1 block whitespace-nowrap">
                      on {formatPrice(row.order_total)} of orders
                    </span>
                  )}
                </td>

                <td className="py-3.5 whitespace-nowrap text-muted">
                  {row.last_used_at ? shortDate(row.last_used_at) : "Never"}
                </td>

                <td className="py-3.5 text-right">
                  <DiscountRowActions
                    id={row.id}
                    code={row.code}
                    isActive={row.is_active}
                    uses={row.uses}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath={BASE_PATH}
        total={total}
        page={page}
        perPage={perPage}
        noun="code"
      />
    </>
  );
}

/**
 * What the filtered set adds up to.
 *
 * Above the table rather than under it, because the totals are the answer to
 * the question somebody opened this screen with — how much are the coupons
 * costing — and the rows are the working.
 */
function UsageSummary({ rows, scope }: { rows: DiscountUsage[]; scope: DiscountFilter }) {
  const uses = rows.reduce((sum, row) => sum + row.uses, 0);
  const discounted = rows.reduce((sum, row) => sum + row.discounted, 0);
  const orderTotal = rows.reduce((sum, row) => sum + row.order_total, 0);

  return (
    <dl className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <Figure label={scope === "all" ? "Codes" : `${filterLabel(scope)} codes`} value={String(rows.length)} />
      <Figure label="Redemptions" value={uses.toLocaleString()} />
      <Figure label="Given away" value={formatPrice(discounted)} />
      <Figure
        label="Orders behind them"
        value={formatPrice(orderTotal)}
        note={
          orderTotal > 0
            ? `${Math.round((discounted / orderTotal) * 100)}% of it discounted`
            : undefined
        }
      />
    </dl>
  );
}

function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border border-line bg-white p-4">
      <dt className="admin-label">{label}</dt>
      <dd className="mt-2 font-[family-name:var(--font-display)] text-[24px] leading-none tabular-nums text-ink">
        {value}
      </dd>
      {note && <p className="admin-hint mt-1.5">{note}</p>}
    </div>
  );
}

/* Capped rather than tracking `perPage`: see the note in ProductsTable. */
const SKELETON_ROWS = 10;

export function DiscountsTableSkeleton() {
  return (
    <>
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4" aria-hidden>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="border border-line bg-white p-4">
            <Skeleton className="h-2 w-20" />
            <Skeleton className="mt-3 h-6 w-24" />
          </div>
        ))}
      </div>
      <div className="mt-4 border border-line" aria-hidden>
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-soft px-4 py-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="ml-auto h-3 w-14" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
        ))}
      </div>
      <PaginationSkeleton />
    </>
  );
}
