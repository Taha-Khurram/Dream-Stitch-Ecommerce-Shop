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
  readVisits,
  shareOf,
  type Breakdown,
  type BreakdownRow,
  type Panel,
  type VisitWindow,
} from "@/lib/admin/analytics";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/analytics";

/**
 * The trading questions the dashboard does not answer.
 *
 * /admin is a morning screen — what needs attention, and how much came in.
 * This is the one you open when nothing is on fire: **how many people came**,
 * **what sells**, **which part of the range earns it**, **how many of the
 * people who sign up go on to buy**, and **how many come back**.
 *
 * Same window control as the dashboard, reading the same `?range=` key through
 * the same parser, so moving between the two screens keeps the window you were
 * looking at and "the last 90 days" stays an address rather than a click. Every
 * figure below the visits panel is dated by `orders.created_at` and counts
 * fulfilled orders only, exactly as the revenue tile does.
 *
 * Visits are the one panel the range tabs do not reach, and that is the point
 * of it: "how many came today, this week, this month" is three fixed windows
 * asked at once, not one window you have to click between. It sits at the top
 * because it is the top of the funnel the two rates below it measure.
 *
 * Four regions, four Suspense boundaries — the counts land first, and no panel
 * holds up another or the page frame.
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
        copy="How many people come, what sells, where the money comes from, and how many come back."
        action={<RangeTabs active={range} basePath={BASE_PATH} />}
      />

      {/* Unkeyed, alone on this page: its three windows are fixed, so a range
          switch has nothing to invalidate and re-rendering a skeleton over
          numbers that are not about to change would be a lie about staleness. */}
      <Suspense fallback={<VisitsSkeleton />}>
        <Visits />
      </Suspense>

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
function PanelNotice({
  missing,
  empty,
  file = "analytics_schema.sql",
  note = "Nothing is backfilled — the figures are read out of the orders you already have.",
}: {
  missing: boolean;
  empty: string;
  /** Which migration this panel needs. Most of them need the same one. */
  file?: string;
  /** What running it will and will not produce. */
  note?: string;
}) {
  if (missing) {
    return (
      <div className="mt-4 border border-line bg-white p-8 text-center">
        <p className="text-sm text-ink">This panel is not installed yet.</p>
        <p className="admin-hint mx-auto mt-2 max-w-md">
          Run <code className="text-ink">{file}</code> in the Supabase SQL editor, then
          reload. {note}
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

/**
 * The heading every panel wears, with the window it covers spelled out.
 *
 * `first` is the one that sits directly under the page heading, which brings
 * its own bottom rule and padding — the full gap on top of that reads as a
 * hole rather than as separation.
 */
function PanelHeading({ title, note, first }: { title: string; note: string; first?: boolean }) {
  return (
    <div className={first ? "mt-8" : "mt-12"}>
      <h2 className="admin-section-title">{title}</h2>
      <p className="admin-hint mt-1.5">{note}</p>
    </div>
  );
}

/* ── Visits ─────────────────────────────────────────────────────────────── */

/**
 * What each window is called on screen.
 *
 * Spelled out rather than derived, because "week" and "month" are the words
 * the question was asked in and "the last 7 days" is what the number actually
 * means. A tile labelled "This month" would be claiming a calendar month, and
 * on the 2nd that is a very different figure from the one being shown.
 */
const VISIT_LABELS: Record<string, string> = {
  day: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
};

function visitLabel({ bucket, days }: VisitWindow): string {
  return VISIT_LABELS[bucket] ?? `Last ${days} days`;
}

/**
 * Footfall, at the three lengths the question is usually asked in.
 *
 * The headline on every tile is *visitors* and the line beneath it is
 * *visits*, which counts the same visitor once for each day they came. Both,
 * on every tile, because over a week the two are genuinely different facts
 * and a panel showing only one of them invites the reader to take it for the
 * other. On the daily tile they coincide, which is the definitions agreeing
 * rather than a bug: a hundred people today is a hundred visitors and a
 * hundred visits.
 *
 * Zeroes are rendered, not hidden. A day on which nobody came is a real
 * answer, and the only state that gets a notice instead is the migration not
 * having been run — see visit_analytics.sql, and PanelNotice.
 */
async function Visits() {
  const { data, missing } = await readVisits();

  if (!data || data.length === 0) {
    return (
      <section>
        <PanelHeading
          title="Visits"
          note="How many people came to the storefront, daily, weekly and monthly."
          first
        />
        <PanelNotice
          missing={missing}
          empty="The visit figures could not be read."
          file="visit_analytics.sql"
          note="Nothing is backfilled — counting starts from the moment it is applied."
        />
      </section>
    );
  }

  return (
    <section>
      <PanelHeading
        title="Visits"
        note="Storefront footfall, counted once per browser per day. The headline is distinct visitors; the line beneath counts every day each of them came. A browser that has been closed since arrives as a new visitor, so the longer windows lean generous."
        first
      />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {data.map((entry) => (
          <Stat
            key={entry.bucket}
            label={visitLabel(entry)}
            value={entry.visitors.toLocaleString()}
            delta={
              <Delta current={entry.visitors} previous={entry.priorVisitors} days={entry.days} />
            }
            note={`${entry.visits.toLocaleString()} ${
              entry.visits === 1 ? "visit" : "visits"
            } in all, ${entry.signedIn.toLocaleString()} signed in`}
          />
        ))}
      </div>
    </section>
  );
}

/** Three tiles, sized like the real ones, so the swap is a fill and not a jump. */
function VisitsSkeleton() {
  return (
    <section className="mt-8" aria-hidden>
      <Skeleton className="h-3.5 w-20" />
      <Skeleton className="mt-2 h-2.5 w-80" />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="border border-line bg-white p-5">
            <Skeleton className="h-2 w-20" />
            <Skeleton className="mt-4 h-7 w-14" />
            <Skeleton className="mt-3.5 h-3.5 w-32" />
            <Skeleton className="mt-3 h-2.5 w-40" />
          </div>
        ))}
      </div>
    </section>
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
      <section>
        <RatesHeading span={span} />
        <PanelNotice missing={missing} empty="The conversion figures could not be read." />
      </section>
    );
  }

  const conversion = rate(data.converted, data.signups);
  const priorConversion = rate(data.priorConverted, data.priorSignups);
  const repeat = rate(data.repeatBuyers, data.buyers);
  const priorRepeat = rate(data.priorRepeatBuyers, data.priorBuyers);

  return (
    <section>
      <RatesHeading span={span} />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
    </section>
  );
}

/**
 * Named, now that it is no longer the first thing under the page heading.
 *
 * Untitled tiles read as belonging to whatever panel is above them, and the
 * one above them counts visitors — two rates about customers sitting loose
 * under a visits heading would invite exactly the wrong reading of both.
 */
function RatesHeading({ span }: { span: string }) {
  return (
    <PanelHeading
      title="Shoppers"
      note={`Of the people who signed up in ${span}, how many went on to buy — and of those who bought, how many had bought before.`}
    />
  );
}

function RatesSkeleton() {
  return (
    <section className="mt-12" aria-hidden>
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-2 h-2.5 w-80" />
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
    </section>
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
