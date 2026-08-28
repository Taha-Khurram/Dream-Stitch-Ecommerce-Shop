"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/types/ecommerce";
import { DEFAULT_SIZES, COLOR_SWATCHES, swatchHex } from "@/lib/constants";
import { CURRENCY } from "@/lib/format";
import { ChevronDown, X } from "lucide-react";

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

const FABRICS = ["Lawn", "Cambric", "Khaddar", "Cotton Net", "Organza", "Raw Silk", "Jacquard"];

function Accordion({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line py-5">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="eyebrow flex w-full cursor-pointer items-center justify-between text-ink"
      >
        {title}
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && <div className="mt-4">{children}</div>}
    </div>
  );
}

function FilterRail({ categories, onNavigate }: CategoryFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeCategory = searchParams.get("category") ?? "all";
  const activeSize = searchParams.get("size");
  const activeColor = searchParams.get("color");
  const activeMin = searchParams.get("min");
  const activeMax = searchParams.get("max");
  const activeSearch = searchParams.get("search");

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
  if (activeSearch) activeChips.push({ label: `“${activeSearch}”`, clear: { search: null } });
  if (activeSize) activeChips.push({ label: `Size ${activeSize}`, clear: { size: null } });
  if (activeColor) activeChips.push({ label: activeColor, clear: { color: null } });
  if (activeMin || activeMax) {
    const band = PRICE_BANDS.find(
      (b) => String(b.min) === activeMin && String(b.max ?? "") === (activeMax ?? "")
    );
    activeChips.push({
      label: band ? band.label : "Custom price",
      clear: { min: null, max: null },
    });
  }

  return (
    <div className="text-[13px]">
      {activeChips.length > 0 && (
        <div className="border-b border-line pb-5">
          <div className="flex items-center justify-between">
            <span className="eyebrow text-muted">Applied</span>
            <Link href="/shop" onClick={onNavigate} className="eyebrow text-clay link-underline">
              Clear All
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeChips.map((chip) => (
              <button
                key={chip.label}
                onClick={() => push(chip.clear)}
                className="flex cursor-pointer items-center gap-1.5 border border-line bg-cream px-2.5 py-1.5 text-[11px] text-ink transition-colors hover:border-ink"
              >
                {chip.label}
                <X className="h-3 w-3 text-muted" />
              </button>
            ))}
          </div>
        </div>
      )}

      <Accordion title="Category">
        <ul className="space-y-2.5">
          <li>
            <Link
              href={buildHref({ category: null })}
              onClick={onNavigate}
              className={`transition-colors hover:text-clay ${
                activeCategory === "all" ? "text-ink underline underline-offset-4" : "text-ink-soft"
              }`}
            >
              All Products
            </Link>
          </li>
          {categories.map((cat) => (
            <li key={cat.id}>
              <Link
                href={buildHref({ category: cat.slug })}
                onClick={onNavigate}
                className={`transition-colors hover:text-clay ${
                  activeCategory === cat.slug
                    ? "text-ink underline underline-offset-4"
                    : "text-ink-soft"
                }`}
              >
                {cat.name}
              </Link>
            </li>
          ))}
        </ul>
      </Accordion>

      <Accordion title="Size">
        <div className="flex flex-wrap gap-2">
          {DEFAULT_SIZES.map((size) => {
            const selected = activeSize === size;
            return (
              <button
                key={size}
                onClick={() => push({ size: selected ? null : size })}
                aria-pressed={selected}
                className={`h-9 min-w-10 cursor-pointer border px-2 text-[11px] font-medium tracking-wider transition-colors ${
                  selected
                    ? "border-ink bg-ink text-white"
                    : "border-line text-ink-soft hover:border-ink"
                }`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </Accordion>

      <Accordion title="Colour">
        <div className="flex flex-wrap gap-2.5">
          {Object.keys(COLOR_SWATCHES).map((color) => {
            const selected = activeColor === color;
            return (
              <button
                key={color}
                title={color}
                aria-label={color}
                aria-pressed={selected}
                onClick={() => push({ color: selected ? null : color })}
                data-active={selected}
                className="swatch cursor-pointer"
                style={{ backgroundColor: swatchHex(color) }}
              />
            );
          })}
        </div>
      </Accordion>

      <Accordion title="Price">
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
                  className={`cursor-pointer transition-colors hover:text-clay ${
                    selected ? "text-ink underline underline-offset-4" : "text-ink-soft"
                  }`}
                >
                  {band.label}
                </button>
              </li>
            );
          })}
        </ul>
      </Accordion>

      <Accordion title="Fabric" defaultOpen={false}>
        <ul className="space-y-2.5">
          {FABRICS.map((fabric) => (
            <li key={fabric}>
              <Link
                href={buildHref({ search: fabric })}
                onClick={onNavigate}
                className={`transition-colors hover:text-clay ${
                  activeSearch === fabric ? "text-ink underline underline-offset-4" : "text-ink-soft"
                }`}
              >
                {fabric}
              </Link>
            </li>
          ))}
        </ul>
      </Accordion>
    </div>
  );
}

export function CategoryFilter(props: CategoryFilterProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse bg-sand" />
          ))}
        </div>
      }
    >
      <FilterRail {...props} />
    </Suspense>
  );
}
