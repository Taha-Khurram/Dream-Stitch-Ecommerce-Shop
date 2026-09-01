"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/types/ecommerce";
import { FILTER_SIZES } from "@/lib/constants";
import { CURRENCY } from "@/lib/format";
import { X } from "lucide-react";
import { startRouteProgress } from "@/components/motion/RouteProgress";

const PRICE_BANDS = [
  { label: `Under ${CURRENCY} 3,000`, min: 0, max: 3000 },
  { label: `${CURRENCY} 3,000 – 6,000`, min: 3000, max: 6000 },
  { label: `${CURRENCY} 6,000 – 12,000`, min: 6000, max: 12000 },
  { label: `${CURRENCY} 12,000 & above`, min: 12000, max: null as number | null },
];

/** The params the panel owns. Anything else in the URL — sort — is carried through. */
interface Draft {
  category: string | null;
  size: string | null;
  min: string | null;
  max: string | null;
  sale: boolean;
  search: string | null;
}

const readDraft = (params: URLSearchParams): Draft => ({
  category: params.get("category"),
  size: params.get("size"),
  min: params.get("min"),
  max: params.get("max"),
  sale: params.get("sale") === "true",
  search: params.get("search"),
});

/** How many filters are set — drives the count beside the Filter button. */
export function countActiveFilters(params: URLSearchParams) {
  const draft = readDraft(params);
  return (
    (draft.category ? 1 : 0) +
    (draft.size ? 1 : 0) +
    (draft.min || draft.max ? 1 : 0) +
    (draft.sale ? 1 : 0) +
    (draft.search ? 1 : 0)
  );
}

interface FilterPanelProps {
  categories: Category[];
  /** Called once the new query string has been pushed, so the sheet can close. */
  onApplied?: () => void;
}

/**
 * Groups are always open. With three or four options apiece there was nothing
 * to collapse — the accordions only added a chevron, a click, and the chance of
 * hiding a filter from someone who needed it.
 */
function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-line py-5 last:border-b-0">
      <span className="eyebrow text-ink">{title}</span>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

/**
 * Selections are held locally and only written to the URL on Apply, so picking a
 * fabric, a size and a price band costs one navigation instead of three.
 */
export function FilterPanel({ categories, onApplied }: FilterPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qs = searchParams.toString();

  const applied = useMemo(() => readDraft(new URLSearchParams(qs)), [qs]);
  const [draft, setDraft] = useState<Draft>(applied);

  // Re-seed when the URL changes underneath us — a header search, the sort menu,
  // or the browser's back button.
  useEffect(() => setDraft(applied), [applied]);

  const set = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));

  const dirty =
    draft.category !== applied.category ||
    draft.size !== applied.size ||
    draft.min !== applied.min ||
    draft.max !== applied.max ||
    draft.sale !== applied.sale ||
    draft.search !== applied.search;

  const apply = () => {
    const next = new URLSearchParams(qs);
    const write = (key: string, value: string | null) => {
      if (value === null) next.delete(key);
      else next.set(key, value);
    };
    write("category", draft.category);
    write("size", draft.size);
    write("min", draft.min);
    write("max", draft.max);
    write("search", draft.search);
    write("sale", draft.sale ? "true" : null);

    const query = next.toString();
    // Applying filters refetches the grid on the server; show the bar now
    // rather than leaving the sheet closing over an unchanged page.
    startRouteProgress();
    router.push(`/shop${query ? `?${query}` : ""}`);
    onApplied?.();
  };

  const clearAll = () =>
    set({ category: null, size: null, min: null, max: null, sale: false, search: null });

  const chips: { label: string; clear: Partial<Draft> }[] = [];
  if (draft.category) {
    const name = categories.find((c) => c.slug === draft.category)?.name ?? draft.category;
    chips.push({ label: name, clear: { category: null } });
  }
  if (draft.sale) chips.push({ label: "On sale", clear: { sale: false } });
  if (draft.search) chips.push({ label: `“${draft.search}”`, clear: { search: null } });
  if (draft.size) chips.push({ label: draft.size, clear: { size: null } });
  if (draft.min || draft.max) {
    const band = PRICE_BANDS.find(
      (b) => String(b.min) === draft.min && String(b.max ?? "") === (draft.max ?? "")
    );
    chips.push({
      label: band ? band.label : "Custom price",
      clear: { min: null, max: null },
    });
  }

  const optionButton = (selected: boolean) =>
    `cursor-pointer text-left transition-colors hover:text-purple ${
      selected ? "text-ink underline underline-offset-4" : "text-ink-soft"
    }`;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 text-[13px]">
        {chips.length > 0 && (
          <div className="border-b border-line py-5">
            <div className="flex items-center justify-between">
              <span className="eyebrow text-muted">Selected</span>
              <button
                onClick={clearAll}
                className="eyebrow link-underline cursor-pointer text-purple"
              >
                Clear All
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => set(chip.clear)}
                  className="flex cursor-pointer items-center gap-1.5 border border-line bg-lilac px-2.5 py-1.5 text-[11px] text-ink transition-colors hover:border-purple"
                >
                  {chip.label}
                  <X className="h-3 w-3 text-muted" />
                </button>
              ))}
            </div>
          </div>
        )}

        <FilterGroup title="Fabric">
          <ul className="space-y-2.5">
            <li>
              <button
                onClick={() => set({ category: null })}
                className={optionButton(draft.category === null)}
              >
                All Fabrics
              </button>
            </li>
            {categories.map((cat) => (
              <li key={cat.id}>
                <button
                  onClick={() => set({ category: cat.slug })}
                  className={optionButton(draft.category === cat.slug)}
                >
                  {cat.name}
                </button>
              </li>
            ))}
          </ul>
        </FilterGroup>

        <FilterGroup title="Bed Size">
          <div className="flex flex-wrap gap-2">
            {FILTER_SIZES.map((size) => {
              const selected = draft.size === size;
              return (
                <button
                  key={size}
                  onClick={() => set({ size: selected ? null : size })}
                  aria-pressed={selected}
                  className={`h-9 cursor-pointer border px-3 text-[11px] font-medium tracking-wider transition-colors ${
                    selected
                      ? "border-purple bg-purple text-white"
                      : "border-line text-ink-soft hover:border-purple"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>
        </FilterGroup>

        <FilterGroup title="Price">
          {/* The Shop dropdown used to be the only way to reach ?sale=true. */}
          <label className="mb-3.5 flex cursor-pointer items-center gap-2.5 border-b border-line-soft pb-3.5">
            <input
              type="checkbox"
              checked={draft.sale}
              onChange={() => set({ sale: !draft.sale })}
              className="h-3.5 w-3.5 cursor-pointer accent-[color:var(--color-purple)]"
            />
            <span className={draft.sale ? "text-ink" : "text-ink-soft"}>Reduced items only</span>
          </label>

          <ul className="space-y-2.5">
            {PRICE_BANDS.map((band) => {
              const selected =
                String(band.min) === draft.min && String(band.max ?? "") === (draft.max ?? "");
              return (
                <li key={band.label}>
                  <button
                    onClick={() =>
                      set(
                        selected
                          ? { min: null, max: null }
                          : { min: String(band.min), max: band.max ? String(band.max) : null }
                      )
                    }
                    className={optionButton(selected)}
                  >
                    {band.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </FilterGroup>
      </div>

      <div className="flex items-center gap-3 border-t border-line p-5">
        <button
          onClick={clearAll}
          disabled={chips.length === 0}
          className="btn-outline flex-1 cursor-pointer disabled:cursor-default disabled:opacity-40"
        >
          Clear
        </button>
        <button onClick={apply} className="btn-primary flex-[2] cursor-pointer">
          {dirty ? "Apply Filters" : "Show Results"}
        </button>
      </div>
    </div>
  );
}
