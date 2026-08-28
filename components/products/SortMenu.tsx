"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Check } from "lucide-react";

const OPTIONS = [
  { key: "newest", label: "Newest First" },
  { key: "rating", label: "Most Loved" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
] as const;

function SortMenuInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = searchParams.get("sort") ?? "newest";
  const activeLabel = OPTIONS.find((o) => o.key === active)?.label ?? "Newest First";

  useEffect(() => {
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickAway);
    return () => document.removeEventListener("mousedown", onClickAway);
  }, []);

  const select = (key: string) => {
    const next = new URLSearchParams(searchParams.toString());
    if (key === "newest") next.delete("sort");
    else next.set("sort", key);
    const qs = next.toString();
    setOpen(false);
    router.push(`/shop${qs ? `?${qs}` : ""}`);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="eyebrow flex cursor-pointer items-center gap-2 text-ink transition-colors hover:text-clay"
      >
        Sort: <span className="text-muted">{activeLabel}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 top-full z-40 mt-3 w-56 border border-line bg-white py-2 shadow-[0_20px_40px_-30px_rgba(27,26,24,0.6)]"
        >
          {OPTIONS.map((option) => (
            <li key={option.key}>
              <button
                role="option"
                aria-selected={active === option.key}
                onClick={() => select(option.key)}
                className={`flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-cream ${
                  active === option.key ? "text-ink" : "text-ink-soft"
                }`}
              >
                {option.label}
                {active === option.key && <Check className="h-3.5 w-3.5 text-clay" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function SortMenu() {
  return (
    <Suspense fallback={<span className="eyebrow text-muted">Sort</span>}>
      <SortMenuInner />
    </Suspense>
  );
}
