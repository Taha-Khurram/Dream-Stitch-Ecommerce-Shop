"use client";

import React, { useCallback, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { startRouteProgress } from "@/components/motion/RouteProgress";
import {
  PER_PAGE_OPTIONS,
  buildPageHref,
  clampPage,
  lastPageFor,
  pageAfterResize,
  pageWindow,
  parsePerPage,
  summarize,
  type PerPage,
} from "@/lib/pagination";

/**
 * The pager for every admin list.
 *
 * Two rules shape it:
 *
 * 1. **Every page is a URL.** The numbers are real `<Link>`s, so they honour
 *    middle-click, they prefetch on hover, and the back button walks the pages
 *    you actually read. `useSearchParams()` is the reason the control needs no
 *    props about filters: whatever else is in the query string — a search term,
 *    a status filter — rides along untouched, so no screen has to remember to
 *    forward its own state.
 *
 * 2. **It never lies about what it is showing.** The row count, the window and
 *    the last page all come from the same `total` the query returned, through
 *    the same helpers the query used to build its range.
 *
 * The rows-per-page control is the one piece that cannot be a link — a `<select>`
 * has no href — so it pushes the URL itself, inside a transition, and pokes the
 * global progress bar the way an anchor click would.
 */

const STEP =
  "inline-flex h-9 items-center gap-1.5 border border-line px-3 text-[13px] font-medium text-ink-soft transition-colors hover:border-purple hover:bg-lilac hover:text-purple";

const STEP_OFF =
  "inline-flex h-9 cursor-not-allowed items-center gap-1.5 border border-line-soft px-3 text-[13px] font-medium text-faint";

const NUMBER =
  "inline-flex h-9 min-w-9 items-center justify-center border px-2 text-[13px] tabular-nums transition-colors";

export function Pagination({
  basePath,
  total,
  page: requestedPage,
  perPage,
  noun,
  plural,
}: {
  /** The list's own route, e.g. `/admin/products`. */
  basePath: string;
  /** Row count for the *whole* filtered set, not this page. */
  total: number;
  page: number;
  perPage: PerPage;
  /** Singular noun for the summary line — "product", "order". */
  noun: string;
  plural?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const lastPage = lastPageFor(total, perPage);
  /* Everything below reads `page` — so it is pinned to a page that exists once,
     here, rather than each of the summary, the arrows and the window guessing
     separately at what a stale `?page=` was supposed to mean. */
  const page = clampPage(requestedPage, total, perPage);

  const href = useCallback(
    (n: number) => buildPageHref(basePath, searchParams, { page: n, perPage }),
    [basePath, searchParams, perPage]
  );

  const onResize = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = parsePerPage(event.target.value);
    if (next === perPage) return;

    const target = buildPageHref(basePath, searchParams, {
      page: pageAfterResize(page, perPage, next),
      perPage: next,
    });

    /* The bar is wired to anchor clicks; a programmatic push has to say so. */
    startRouteProgress();
    startTransition(() => router.push(target));
  };

  return (
    <div
      /* Dimmed only while a resize is in flight — page links get the Suspense
         skeleton instead, which is a better signal than a faded table. */
      aria-busy={isPending || undefined}
      className={`mt-6 flex flex-col gap-4 border-t border-line pt-4 transition-opacity duration-[var(--duration-fast)] sm:flex-row sm:items-center sm:justify-between ${
        isPending ? "opacity-60" : "opacity-100"
      }`}
    >
      <p className="admin-hint order-2 sm:order-1" role="status" aria-live="polite">
        {summarize({ total, page, perPage }, noun, plural)}
      </p>

      <div className="order-1 flex flex-wrap items-center gap-x-5 gap-y-3 sm:order-2 sm:justify-end">
        <PerPageSelect value={perPage} onChange={onResize} />

        {lastPage > 1 && (
          <nav aria-label="Pagination" className="flex items-center gap-1.5">
            {page > 1 ? (
              <Link href={href(page - 1)} rel="prev" className={STEP} aria-label="Previous page">
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">Prev</span>
              </Link>
            ) : (
              <span className={STEP_OFF} aria-hidden>
                <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
                <span className="hidden sm:inline">Prev</span>
              </span>
            )}

            {pageWindow(page, lastPage).map((token, i) =>
              token === "gap" ? (
                <span
                  key={`gap-${i}`}
                  aria-hidden
                  className="px-1 text-[13px] leading-none text-faint"
                >
                  …
                </span>
              ) : token === page ? (
                <span
                  key={token}
                  aria-current="page"
                  className={`${NUMBER} border-purple bg-purple font-medium text-white`}
                >
                  {token}
                </span>
              ) : (
                <Link
                  key={token}
                  href={href(token)}
                  aria-label={`Page ${token}`}
                  className={`${NUMBER} border-line text-ink-soft hover:border-purple hover:bg-lilac hover:text-purple`}
                >
                  {token}
                </Link>
              )
            )}

            {page < lastPage ? (
              <Link href={href(page + 1)} rel="next" className={STEP} aria-label="Next page">
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            ) : (
              <span className={STEP_OFF} aria-hidden>
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

/**
 * Rows per page.
 *
 * Rendered whether or not there is more than one page: it is a preference, not
 * a navigation control, and hiding it on short lists would mean it vanishes
 * exactly when someone narrows a search and then wants to widen the window
 * again.
 *
 * Deliberately NOT disabled while the navigation it started is in flight. A
 * disabled control drops keyboard focus to <body>, and on Windows a native
 * select commits on each arrow press — so a keyboard user would be thrown out
 * of the control the instant they used it. A superseded router.push is
 * harmless; the dimmed pager and the progress bar carry the pending state.
 */
function PerPageSelect({
  value,
  onChange,
}: {
  value: PerPage;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
}) {
  return (
    <label className="admin-hint flex shrink-0 items-center gap-2">
      <span>Rows</span>
      <select
        value={value}
        onChange={onChange}
        aria-label="Rows per page"
        className="h-9 cursor-pointer border border-line bg-white px-2 text-[13px] tabular-nums text-ink transition-colors hover:border-faint focus:border-purple focus:ring-2 focus:ring-purple/15 focus:outline-none"
      >
        {PER_PAGE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * The pager's footprint, for the loading skeletons.
 *
 * Reserving the height keeps the rows from sliding down when the real control
 * arrives — the last thing you want under a table you are about to click.
 */
export function PaginationSkeleton() {
  return <div className="mt-6 h-[3.25rem] border-t border-line" aria-hidden />;
}
