/**
 * Paging arithmetic for the admin list screens.
 *
 * Every list — products, orders, categories, customers — reads its window out
 * of the URL, so a result set is always a real address: bookmarkable, shareable,
 * survives a reload, and the browser's back button walks the pages you actually
 * visited. Nothing here holds state.
 *
 * The module is deliberately dependency-free so both sides of the React
 * boundary can share it: the server components turn `searchParams` into a
 * PostgREST range, and the client `Pagination` control uses the very same
 * functions to build its links. One implementation means the pager can never
 * disagree with the query that produced the rows.
 */

/** What the rows-per-page control offers. Any other value in the URL is ignored. */
export const PER_PAGE_OPTIONS = [20, 30, 40, 50] as const;

export type PerPage = (typeof PER_PAGE_OPTIONS)[number];

export const DEFAULT_PER_PAGE: PerPage = 20;

/* One name per concept, so no screen invents its own spelling. */
export const PAGE_PARAM = "page";
export const PER_PAGE_PARAM = "per";

/**
 * `?per=` → a size we are willing to serve.
 *
 * Whitelisted rather than clamped on purpose: `per` reaches Postgres as a
 * LIMIT, and an unbounded number in the URL is an invitation to ask for the
 * whole table. Anything unrecognised quietly becomes the default.
 */
export function parsePerPage(raw?: string | null): PerPage {
  const value = Number(raw);
  return (PER_PAGE_OPTIONS as readonly number[]).includes(value)
    ? (value as PerPage)
    : DEFAULT_PER_PAGE;
}

/** `?page=` → a 1-based page. Junk, zero and negatives all mean page one. */
export function parsePage(raw?: string | null): number {
  const value = Math.floor(Number(raw));
  return Number.isFinite(value) && value > 1 ? value : 1;
}

/** Both window values in one call — what a page component needs from the URL. */
export function parseWindow(params: {
  page?: string;
  per?: string;
}): { page: number; perPage: PerPage } {
  return { page: parsePage(params.page), perPage: parsePerPage(params.per) };
}

export function lastPageFor(total: number, perPage: number): number {
  return Math.max(1, Math.ceil(total / perPage));
}

/** Inclusive row bounds for PostgREST's `.range(from, to)`. */
export function rangeFor(page: number, perPage: number): { from: number; to: number } {
  const from = (page - 1) * perPage;
  return { from, to: from + perPage - 1 };
}

/**
 * Where you land when the rows-per-page changes.
 *
 * Resetting to page 1 is the usual answer and it is a small betrayal: you were
 * reading row 60 and asked for *more* rows, so being thrown back to the top is
 * the opposite of what you wanted. This keeps the first row you were looking at
 * on screen — 20→50 on page 4 lands you on page 2, which still contains row 61.
 */
export function pageAfterResize(page: number, perPage: number, nextPerPage: number): number {
  const firstVisibleRow = (page - 1) * perPage; // 0-based
  return Math.floor(firstVisibleRow / nextPerPage) + 1;
}

/**
 * The URL for one view, with every unrelated filter left intact.
 *
 * Defaults are omitted rather than spelled out, so page 1 at the default size
 * is the bare path. That keeps one canonical URL per view instead of
 * `?page=1&per=20` and `/admin/products` being the same screen twice.
 *
 * `current` is anything URL-ish — a real `URLSearchParams` on the server, or
 * Next's read-only flavour from `useSearchParams()` on the client.
 */
export function buildPageHref(
  basePath: string,
  current: { toString(): string } | undefined,
  { page, perPage }: { page: number; perPage: number }
): string {
  const params = new URLSearchParams(current?.toString() ?? "");

  if (page > 1) params.set(PAGE_PARAM, String(page));
  else params.delete(PAGE_PARAM);

  if (perPage !== DEFAULT_PER_PAGE) params.set(PER_PAGE_PARAM, String(perPage));
  else params.delete(PER_PAGE_PARAM);

  const search = params.toString();
  return search ? `${basePath}?${search}` : basePath;
}

/** A rendered page slot: a number to link, or an elided run. */
export type PageToken = number | "gap";

/**
 * The page numbers to render: the first, the last, and a span either side of
 * where you are, with `"gap"` standing in for the runs that are elided.
 *
 * Near the ends the window is padded outward so the control keeps a stable
 * width — otherwise the buttons shuffle sideways under the cursor as you page,
 * and the next click lands on the wrong number.
 */
export function pageWindow(page: number, lastPage: number, span = 1): PageToken[] {
  const width = 2 * span + 3; // first + last + current ± span, with no gaps
  const wanted = new Set<number>([1, lastPage]);

  const add = (from: number, to: number) => {
    for (let n = Math.max(1, from); n <= Math.min(lastPage, to); n++) wanted.add(n);
  };

  add(page - span, page + span);

  /* Pinned to an end: grow the run inward so the count stays constant. */
  if (page <= width - span - 1) add(1, width);
  if (page >= lastPage - width + span + 2) add(lastPage - width + 1, lastPage);

  const tokens: PageToken[] = [];
  let previous = 0;

  for (const n of [...wanted].sort((a, b) => a - b)) {
    if (previous && n - previous > 1) {
      /* A gap hiding exactly one page is worse than no gap: it costs the same
         width as the number and you cannot click it. Spell the number out. */
      tokens.push(n - previous === 2 ? n - 1 : "gap");
    }
    tokens.push(n);
    previous = n;
  }

  return tokens;
}

/**
 * Hold a page number inside the set that actually exists.
 *
 * The list screens redirect a stale `?page=` rather than render one, so this is
 * belt and braces — but it is what keeps the pager arithmetically honest for
 * any input. Without it `?page=999` over 137 rows reads "Showing 19,961–137".
 */
export function clampPage(page: number, total: number, perPage: number): number {
  return Math.min(Math.max(1, page), lastPageFor(total, perPage));
}

/** `"Showing 21–40 of 137 products"`, or `"1 product"` when that is all there is. */
export function summarize(
  { total, page, perPage }: { total: number; page: number; perPage: number },
  noun: string,
  plural = `${noun}s`
): string {
  const word = total === 1 ? noun : plural;
  if (total <= perPage) return `${total.toLocaleString()} ${word}`;

  const safePage = clampPage(page, total, perPage);
  const first = (safePage - 1) * perPage + 1;
  const last = Math.min(total, safePage * perPage);
  return `Showing ${first.toLocaleString()}–${last.toLocaleString()} of ${total.toLocaleString()} ${word}`;
}
