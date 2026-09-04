import { DEFAULT_CONTENT, type SiteContent } from "@/lib/content/defaults";

/**
 * Turns the two flat lists an admin edits under Settings → Product into the
 * one table a product page renders.
 *
 * The charts are stored flat — a list of headings tagged with a category, and
 * a list of rows tagged the same way — because a repeater row cannot itself
 * hold a repeater. Resolving them is therefore a lookup rather than a read:
 * take the chart and the rows carrying this product's category, and fall back
 * to the ones left on "Every category" when it has none of its own.
 */

/** The five cells a row can carry, in the order they are shown. */
const COLUMN_KEYS = ["size", "sheet", "pillow", "set", "fits"] as const;

type ColumnKey = (typeof COLUMN_KEYS)[number];
type Chart = SiteContent["product"]["size_guide"]["charts"][number];
type Row = SiteContent["product"]["size_guide"]["rows"][number];

export interface SizeGuide {
  /** The label on the link that opens it. */
  linkLabel: string;
  eyebrow: string;
  title: string;
  note: string;
  /** Headings of the columns that survived — never empty. */
  columns: string[];
  /** One array of cells per row, aligned to `columns`. */
  rows: string[][];
}

const FALLBACK_CHART = DEFAULT_CONTENT.product.size_guide.charts[0];

/**
 * The chart to show beside a product, or `null` when there is nothing worth
 * opening — the guide is switched off, no chart matches, or every row for it
 * is blank. Callers hide the link entirely on `null`.
 */
export function resolveSizeGuide(
  content: SiteContent,
  categorySlug?: string | null
): SizeGuide | null {
  const guide = content.product.size_guide;
  if (!guide.enabled) return null;

  const slug = (categorySlug ?? "").trim();
  const chart = pickChart(guide.charts ?? [], slug);
  if (!chart) return null;

  const rows = pickRows(guide.rows ?? [], slug);
  if (rows.length === 0) return null;

  // A column is shown only if it is both named and filled in, so a chart of
  // three columns needs no empty slots to say so.
  const headings = splitHeadings(chart.headings);
  const keys = COLUMN_KEYS.filter(
    (key, index) => headings[index] && rows.some((row) => cell(row, key))
  );
  if (keys.length === 0) return null;

  return {
    linkLabel: guide.link_label.trim() || "Size Guide",
    eyebrow: chart.eyebrow.trim(),
    title: chart.title.trim() || FALLBACK_CHART.title,
    note: chart.note.trim(),
    columns: keys.map((key) => headings[COLUMN_KEYS.indexOf(key)]),
    rows: rows.map((row) => keys.map((key) => cell(row, key))),
  };
}

/** The finished dimensions behind a named size. See `resolveCutSpec()`. */
export interface CutSpec {
  /** The size as the chart spells it, which may re-case what was ordered. */
  size: string;
  /** Heading/value pairs — bedsheet, pillow cover, set — in chart order. */
  spec: { label: string; value: string }[];
}

/**
 * What a stock size means in inches, for the packing slip.
 *
 * A made-to-measure line carries its own numbers; a line ordered as "King
 * Size" carries a word, and the person cutting it needs the inches that word
 * stands for. Those inches are already maintained in one place — the chart the
 * buyer was shown before they ordered — so the slip reads them from there
 * rather than keeping a second copy that can drift from it.
 *
 * `enabled` is deliberately not consulted: it governs whether the storefront
 * offers the guide as a link, which says nothing about whether the dimensions
 * in it are the ones being cut to.
 *
 * Returns null when the chart has no row for this size — an own-brand size the
 * guide never covered, or a legacy row. The slip then prints the size as
 * ordered and says the dimensions are not on file, which is a question worth
 * asking before cutting rather than a blank worth ignoring.
 */
export function resolveCutSpec(
  content: SiteContent,
  categorySlug: string | null | undefined,
  size: string | null | undefined
): CutSpec | null {
  const wanted = (size ?? "").trim().toLowerCase();
  if (!wanted) return null;

  const guide = content.product.size_guide;
  const slug = (categorySlug ?? "").trim();

  const row = pickRows(guide.rows ?? [], slug).find(
    (candidate) => cell(candidate, "size").toLowerCase() === wanted
  );
  if (!row) return null;

  const chart = pickChart(guide.charts ?? [], slug);
  const headings = splitHeadings(chart?.headings ?? FALLBACK_CHART.headings);

  /* `fits` is buyer-facing reassurance — which mattress the size suits — and
     is not something anyone cuts against, so it stays off the slip. */
  const spec = (["sheet", "pillow", "set"] as const)
    .map((key) => ({
      label: headings[COLUMN_KEYS.indexOf(key)] || key,
      value: cell(row, key),
    }))
    .filter((entry) => entry.label && entry.value);

  return spec.length > 0 ? { size: cell(row, "size"), spec } : null;
}

/** This category's chart, else the store-wide one, else whatever exists. */
function pickChart(charts: Chart[], slug: string): Chart | undefined {
  return (
    (slug ? charts.find((chart) => chart.category.trim() === slug) : undefined) ??
    charts.find((chart) => !chart.category.trim()) ??
    charts[0]
  );
}

/**
 * This category's rows, else the store-wide ones. A category with a chart of
 * its own but no rows yet still borrows the default table rather than opening
 * an empty dialog.
 */
function pickRows(rows: Row[], slug: string): Row[] {
  const filled = rows.filter((row) => COLUMN_KEYS.some((key) => cell(row, key)));
  const own = slug ? filled.filter((row) => row.category.trim() === slug) : [];
  return own.length > 0 ? own : filled.filter((row) => !row.category.trim());
}

/** "Size, Bedsheet, …" → five headings, blanks meaning "drop this column". */
function splitHeadings(headings: string): string[] {
  const named = headings.split(",").map((heading) => heading.trim());
  const fallback = FALLBACK_CHART.headings.split(",").map((heading) => heading.trim());

  return COLUMN_KEYS.map((_, index) =>
    // Nothing typed at all is the untouched case, and gets the defaults; a
    // list that simply runs out has deliberately dropped the rest.
    headings.trim() ? (named[index] ?? "") : fallback[index]
  );
}

function cell(row: Row, key: ColumnKey): string {
  return (row[key] ?? "").trim();
}
