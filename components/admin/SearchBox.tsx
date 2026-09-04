import React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { DEFAULT_PER_PAGE, PER_PAGE_PARAM, buildPageHref, type PerPage } from "@/lib/pagination";
import { SEARCH_PARAM } from "@/lib/admin/search";

/**
 * The search box every admin list wears.
 *
 * A plain GET form: no client JavaScript, and every result set stays a real URL
 * that can be bookmarked or reloaded. Submitting rebuilds the query string from
 * these fields alone, which is exactly right for `page` — a new search belongs
 * at the top — and exactly wrong for everything else on the screen, hence the
 * hidden fields carrying the row count and any filter across.
 */
export function SearchBox({
  action,
  query,
  perPage,
  placeholder,
  label,
  keep,
}: {
  /** The list's own route, e.g. `/admin/orders`. */
  action: string;
  /** The term currently in force, straight out of the URL. */
  query: string;
  perPage: PerPage;
  placeholder: string;
  /** What the field is called to a screen reader, e.g. "Search orders". */
  label: string;
  /** The screen's other filters, which a new search must not silently drop. */
  keep?: URLSearchParams;
}) {
  return (
    <form className="mt-6 flex flex-wrap items-center gap-3" action={action}>
      {perPage !== DEFAULT_PER_PAGE && (
        <input type="hidden" name={PER_PAGE_PARAM} value={perPage} />
      )}
      {[...(keep ?? [])].map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <div className="relative w-full max-w-sm">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
          strokeWidth={1.5}
        />
        <input
          type="search"
          name={SEARCH_PARAM}
          defaultValue={query}
          placeholder={placeholder}
          aria-label={label}
          className="w-full border border-line bg-white py-2.5 pl-9 pr-3 text-sm text-ink transition-colors placeholder-faint hover:border-faint focus:border-purple focus:ring-2 focus:ring-purple/15 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="cursor-pointer border border-line px-4 py-2.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-purple hover:bg-lilac hover:text-purple"
      >
        Search
      </button>
      {query && (
        /* Clears the term and nothing else: the filter you were reading under
           is still the filter you want, minus the search. */
        <Link
          href={buildPageHref(action, keep, { page: 1, perPage })}
          className="text-[13px] text-muted hover:text-purple"
        >
          Clear
        </Link>
      )}
    </form>
  );
}
