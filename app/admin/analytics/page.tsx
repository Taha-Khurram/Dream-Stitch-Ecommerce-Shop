import React, { Suspense } from "react";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { RangeTabs } from "@/components/admin/RangeTabs";
import { Delta } from "@/components/admin/Delta";
import { BreakdownTable, type BreakdownEntry } from "@/components/admin/BreakdownTable";
import { Skeleton } from "@/components/motion/Skeleton";
import { parseRange, rangeDays, rangeSpan } from "@/lib/admin/range";
import {
  TOP_PRODUCTS,
  formatRate,
  rate,
  readCategoryRevenue,
  readShopperStats,
  readTopProducts,
  shareOf,
  type Breakdown,
  type BreakdownRow,
  type Panel,
} from "@/lib/admin/analytics";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/analytics";

/**
 * The trading questions the dashboard does not answer.
 *
 * /admin is a morning screen — what needs attention, and how much came in.
 * This is the one you open when nothing is on fire: **what sells**, **which
 * part of the range earns it**, **how many of the people who sign up go on to
 * buy**, and **how many come back**. Four numbers, all of them already sitting
 * in the order book; see lib/admin/analytics.
 *
 * Same window control as the dashboard, reading the same `?range=` key through
 * the same parser, so moving between the two screens keeps the window you were
 * looking at and "the last 90 days" stays an address rather than a click. Every
 * figure here is dated by `orders.created_at` and counts fulfilled orders only,
 * exactly as the revenue tile does.
 *
 * Three regions, three Suspense boundaries — the rates land first because they
 * are two counts, and neither breakdown holds up the other or the page frame.
 */
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const range = parseRange((await searchParams).range);
  const days = rangeDays(range);
  const span = rangeSpan(range);

  return (
    <div>
      <AdminHeading
        title="Analytics"
        copy="What sells, where the money comes from, and how many people come back."
        action={<RangeTabs active={range} basePath={BASE_PATH} />}
      />

      {/* Keyed on the window, like the dashboard's tiles: switching to 90 days
          should put the skeleton back rather than leave last week's rates on
          screen under a tab that now says something else. */}
      <Suspense key={`rates:${range}`} fallback={<RatesSkeleton />}>
        <Rates days={days} span={span} />
      </Suspense>

      <Suspense key={`products:${range}`} fallback={<PanelSkeleton rows={TOP_PRODUCTS} />}>
        <TopProducts days={days} span={span} />
      </Suspense>

      <Suspense key={`categories:${range}`} fallback={<PanelSkeleton rows={3} />}>
        <CategoryRevenue days={days} span={span} />
      </Suspense>
    </div>
  );
}

/* ── Shared furniture ───────────────────────────────────────────────────── */

/**
 * What a panel says when it has nothing to show.
 *
 * Three outcomes, three sentences, and the difference between them is the
 * point: the migration has not been run, the read failed, or it worked and
 * the answer is genuinely nothing. Rendering the same empty table for all
 * three would tell an admin their best week sold nothing.
 */
function PanelNotice({ missing, empty }: { missing: boolean; empty: string }) {
  if (missing) {
    return (
      <div className="mt-4 border border-line bg-white p-8 text-center">
        <p className="text-sm text-ink">This panel is not installed yet.</p>
        <p className="admin-hint mx-auto mt-2 max-w-md">
          Run <code className="text-ink">analytics_schema.sql</code> in the Supabase SQL
          editor, then reload. Nothing is backfilled — the figures are read out of the
          orders you already have.
        </p>
      </div>
    );
  }

  return (
    <p className="mt-4 border border-line bg-white p-8 text-center text-sm text-muted">
      {empty}
    </p>
  );
}

/** The heading every panel wears, with the window it covers spelled out. */
function PanelHeading({ title, note }: { title: string; note: string }) {
  return (
    <div className="mt-12">
      <h2 className="admin-section-title">{title}</h2>
      <p className="admin-hint mt-1.5">{note}</p>
    </div>
  );
}

/* ── Conversion and repeat custom ───────────────────────────────────────── */

function Stat({
  label,
  value,
  delta,
  note,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
  note: string;
}) {
  return (
    <div className="border border-line bg-white p-5">
      <span className="admin-label">{label}</span>
      <p className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-none tabular-nums text-ink">
        {value}
      </p>
      {delta}
      <p className="admin-hint mt-2">{note}</p>
    </div>
  );
}

/**
 * The two rates, side by side.
 *
 * Both are quotients, and both are one count over another that is printed in
 * the note beneath — "4 of 37" — because a rate without its denominator is
 * unreadable at small volumes. One conversion out of two signups is 50%, and
 * a tile that says only "50%" invites a decision that a tile saying "1 of 2"
 * would not.
 *
 * Neither shows a comparison chip when the window before it had nothing in the
 * denominator. There is no honest way to render the movement of a rate that
 * did not exist, and `0 pts` would read as "unchanged" — see Delta.
 */
async function Rates({ days, span }: { days: number; span: string }) {
  const { data, missing } = await readShopperStats(days);

  if (!data) {
    return (
      <div className="mt-8">
        <PanelNotice missing={missing} empty="The conversion figures could not be read." />
      </div>
    );
  }

  const conversion = rate(data.converted, data.signups);
  const priorConversion = rate(data.priorConverted, data.priorSignups);
  const repeat = rate(data.repeatBuyers, data.buyers);
  const priorRepeat = rate(data.priorRepeatBuyers, data.priorBuyers);

  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Stat
        label="Signup conversion"
        value={formatRate(conversion)}
        delta={
          conversion !== null && priorConversion !== null ? (
            <Delta unit="points" current={conversion} previous={priorConversion} days={days} />
          ) : undefined
        }
        note={`${data.converted} of ${data.signups} who joined in ${span} have since ordered`}
      />
      <Stat
        label="Repeat customers"
        value={formatRate(repeat)}
        delta={
          repeat !== null && priorRepeat !== null ? (
            <Delta unit="points" current={repeat} previous={priorRepeat} days={days} />
          ) : undefined
        }
        note={`${data.repeatBuyers} of ${data.buyers} who bought in ${span} have ordered more than once`}
      />
    </div>
  );
}

function RatesSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2" aria-hidden>
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="border border-line bg-white p-5">
          <Skeleton className="h-2 w-24" />
          <Skeleton className="mt-4 h-7 w-16" />
          {/* Reserved on both, so the grid does not resettle when the chips
              arrive — or when one of them turns out to have nothing to
              compare against and never renders one. */}
          <Skeleton className="mt-3.5 h-3.5 w-32" />
          <Skeleton className="mt-3 h-2.5 w-44" />
        </div>
      ))}
    </div>
  );
}

/* ── The two breakdowns ─────────────────────────────────────────────────── */

/** Rows plus their share of the window, ready for the table. */
function toEntries(
  { rows, total }: Breakdown,
  href?: (row: BreakdownRow) => string | undefined
): BreakdownEntry[] {
  const share = shareOf(total);

  return rows.map((row) => ({
    key: row.id ?? row.name,
    name: row.name,
    href: href?.(row),
    units: row.units,
    orders: row.orders,
    revenue: row.revenue,
    share: share(row),
  }));
}

/** Shared shape of both breakdown sections, so the two differ only in content. */
function Breakdown({
  panel,
  title,
  note,
  caption,
  nameHead,
  empty,
  href,
}: {
  panel: Panel<Breakdown>;
  title: string;
  note: string;
  caption: string;
  nameHead: string;
  empty: string;
  href?: (row: BreakdownRow) => string | undefined;
}) {
  return (
    <section>
      <PanelHeading title={title} note={note} />
      {panel.data && panel.data.rows.length > 0 ? (
        <BreakdownTable rows={toEntries(panel.data, href)} caption={caption} nameHead={nameHead} />
      ) : (
        <PanelNotice missing={panel.missing} empty={empty} />
      )}
    </section>
  );
}

async function TopProducts({ days, span }: { days: number; span: string }) {
  const panel = await readTopProducts(days);

  return (
    <Breakdown
      panel={panel}
      title="Top products"
      note={`The ${TOP_PRODUCTS} biggest earners of ${span}, by revenue. Shares are of everything fulfilled in the window, so a top ${TOP_PRODUCTS} will not add up to 100%.`}
      caption={`The ${TOP_PRODUCTS} products with the highest revenue over ${span}, with units, orders and share of the total.`}
      nameHead="Product"
      empty={`Nothing has been fulfilled in ${span}.`}
      href={(row) => (row.id ? `/admin/products/${row.id}` : undefined)}
    />
  );
}

async function CategoryRevenue({ days, span }: { days: number; span: string }) {
  const panel = await readCategoryRevenue(days);

  return (
    <Breakdown
      panel={panel}
      title="Revenue by category"
      note={`Every category that earned in ${span}, uncategorised included. Goods only, so delivery is not attributed — and a product's current category, so re-filing one moves its history.`}
      caption={`Revenue over ${span} split by category, with units, orders and share of the total.`}
      nameHead="Category"
      empty={`Nothing has been fulfilled in ${span}.`}
    />
  );
}

/** Sized to the panel it stands in for, so the swap is a fill, not a reflow. */
function PanelSkeleton({ rows }: { rows: number }) {
  return (
    <section className="mt-12" aria-hidden>
      <Skeleton className="h-3.5 w-36" />
      <Skeleton className="mt-2 h-2.5 w-72" />
      <div className="mt-4 border border-line bg-white">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-soft px-4 py-3.5 last:border-b-0">
            <Skeleton className="h-3 w-40" />
            <Skeleton className="h-1.5 w-36" />
            <Skeleton className="ml-auto h-3 w-8" />
            <Skeleton className="h-3 w-8" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </section>
  );
}
