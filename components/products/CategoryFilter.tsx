"use client";

import React, { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/types/ecommerce";
import { FILTER_SIZES } from "@/lib/constants";
import { CURRENCY } from "@/lib/format";
import { X } from "lucide-react";

interface CategoryFilterProps {
  categories: Category[];
  /** Rendered inside the mobile filter sheet, which supplies its own chrome. */
  onNavigate?: () => void;
}

const PRICE_BANDS = [
  { label: `Under ${CURRENCY} 3,000`, min: 0, max: 3000 },
  { label: `${CURRENCY} 3,000 – 6,000`, min: 3000, max: 6000 },
  { label: `${CURRENCY} 6,000 – 12,000`, min: 6000, max: 12000 },
  { label: `${CURRENCY} 12,000 & above`, min: 12000, max: null as number | null },
];

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

function FilterRail({ categories, onNavigate }: CategoryFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeCategory = searchParams.get("category") ?? "all";
  const activeSize = searchParams.get("size");
  const activeMin = searchParams.get("min");
  const activeMax = searchParams.get("max");
  const activeSearch = searchParams.get("search");
  const activeSale = searchParams.get("sale") === "true";

  /** Rebuild the query string, dropping any param set back to null. */
  const buildHref = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (value === null) next.delete(key);
      else next.set(key, value);
    });
    const qs = next.toString();
    return `/shop${qs ? `?${qs}` : ""}`;
  };

  const push = (patch: Record<string, string | null>) => {
    router.push(buildHref(patch));
    onNavigate?.();
  };

  const activeChips: { label: string; clear: Record<string, string | null> }[] = [];
  if (activeCategory !== "all") {
    const name = categories.find((c) => c.slug === activeCategory)?.name ?? activeCategory;
    activeChips.push({ label: name, clear: { category: null } });
  }
  if (activeSale) activeChips.push({ label: "On sale", clear: { sale: null } });
  if (activeSearch) activeChips.push({ label: `“${activeSearch}”`, clear: { search: null } });
  if (activeSize) activeChips.push({ label: activeSize, clear: { size: null } });
  if (activeMin || activeMax) {
    const band = PRICE_BANDS.find(
      (b) => String(b.min) === activeMin && String(b.max ?? "") === (activeMax ?? "")
    );
    activeChips.push({
      label: band ? band.label : "Custom price",
      clear: { min: null, max: null },
    });
  }

  const listLink = (selected: boolean) =>
    `text-left transition-colors hover:text-purple ${
      selected ? "text-ink underline underline-offset-4" : "text-ink-soft"
    }`;

  return (
    <div className="text-[13px]">
      {activeChips.length > 0 && (
        <div className="border-b border-line pb-5">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-muted">Applied</span>
            <Link href="/shop" onClick={onNavigate} className="eyebrow link-underline text-purple">
              Clear All
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.label}
                onClick={() => push(chip.clear)}
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
            <Link
              href={buildHref({ category: null })}
              onClick={onNavigate}
              className={listLink(activeCategory === "all")}
            >
              All Fabrics
            </Link>
          </li>
          {categories.map((cat) => (
            <li key={cat.id}>
              <Link
                href={buildHref({ category: cat.slug })}
                onClick={onNavigate}
                className={listLink(activeCategory === cat.slug)}
              >
                {cat.name}
              </Link>
            </li>
          ))}
        </ul>
      </FilterGroup>

      <FilterGroup title="Bed Size">
        <div className="flex flex-wrap gap-2">
          {FILTER_SIZES.map((size) => {
            const selected = activeSize === size;
            return (
              <button
                key={size}
                onClick={() => push({ size: selected ? null : size })}
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
            checked={activeSale}
            onChange={() => push({ sale: activeSale ? null : "true" })}
            className="h-3.5 w-3.5 cursor-pointer accent-[color:var(--color-purple)]"
          />
          <span className={activeSale ? "text-ink" : "text-ink-soft"}>Reduced items only</span>
        </label>

        <ul className="space-y-2.5">
          {PRICE_BANDS.map((band) => {
            const selected =
              String(band.min) === activeMin && String(band.max ?? "") === (activeMax ?? "");
            return (
              <li key={band.label}>
                <button
                  onClick={() =>
                    push(
                      selected
                        ? { min: null, max: null }
                        : { min: String(band.min), max: band.max ? String(band.max) : null }
                    )
                  }
                  className={`cursor-pointer ${listLink(selected)}`}
                >
                  {band.label}
                </button>
              </li>
            );
          })}
        </ul>
      </FilterGroup>
    </div>
  );
}

export function CategoryFilter(props: CategoryFilterProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse bg-lilac" />
          ))}
        </div>
      }
    >
      <FilterRail {...props} />
    </Suspense>
  );
}
