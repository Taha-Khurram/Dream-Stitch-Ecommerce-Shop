"use client";

import React from "react";
import { CUSTOM_SIZE_LIMITS, CUSTOM_SIZE_UNITS } from "@/lib/custom-size";
import type { CustomSizeUnit } from "@/types/ecommerce";

export interface CustomSizeDraft {
  width: string;
  height: string;
  unit: CustomSizeUnit;
}

/**
 * The width / height / unit controls for a made-to-measure order.
 *
 * Kept as its own component because two callers need it: a stocked product
 * that the buyer has switched into custom mode, and a made-to-order product
 * that has no stocked size run to offer in the first place.
 *
 * Validation lives in `lib/custom-size.ts` and runs again on the server — this
 * only collects the numbers and shows back whatever came out of it.
 */
export function CustomSizeFields({
  draft,
  onChange,
  error,
}: {
  draft: CustomSizeDraft;
  onChange: (next: CustomSizeDraft) => void;
  /** Shown once the buyer has tried to add an incomplete measurement. */
  error?: string | null;
}) {
  const limits = CUSTOM_SIZE_LIMITS[draft.unit];
  const errorId = error ? "custom-size-error" : undefined;

  return (
    <div className="border border-purple/30 bg-lilac/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="eyebrow text-ink">Your measurements</span>

        {/* Inches or centimetres changes what the numbers mean, so it sits
            beside them rather than in a settings menu somewhere. */}
        <div className="flex" role="group" aria-label="Unit">
          {CUSTOM_SIZE_UNITS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange({ ...draft, unit: option.value })}
              aria-pressed={draft.unit === option.value}
              className={`cursor-pointer border px-3 py-1.5 text-[11px] font-medium transition-colors ${
                draft.unit === option.value
                  ? "border-purple bg-purple text-white"
                  : "border-line bg-white text-ink-soft hover:border-purple"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Dimension
          id="custom-width"
          label="Width"
          value={draft.width}
          unit={draft.unit}
          limits={limits}
          invalid={Boolean(error)}
          describedBy={errorId}
          onChange={(width) => onChange({ ...draft, width })}
        />
        <Dimension
          id="custom-height"
          label="Height"
          value={draft.height}
          unit={draft.unit}
          limits={limits}
          invalid={Boolean(error)}
          describedBy={errorId}
          onChange={(height) => onChange({ ...draft, height })}
        />
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-3 text-[11px] text-sale">
          {error}
        </p>
      ) : (
        <p className="mt-3 text-[11px] leading-relaxed text-muted">
          Measure the mattress itself — we add the depth and the tuck when we cut.
        </p>
      )}
    </div>
  );
}

function Dimension({
  id,
  label,
  value,
  unit,
  limits,
  invalid,
  describedBy,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  unit: CustomSizeUnit;
  limits: { min: number; max: number };
  invalid: boolean;
  describedBy?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-[11px] font-medium text-ink-soft">
        {label}
      </label>
      <div
        className={`mt-1.5 flex items-center border bg-white transition-colors focus-within:border-purple ${
          invalid ? "border-sale" : "border-line"
        }`}
      >
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step="0.5"
          min={limits.min}
          max={limits.max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          placeholder={String(limits.min)}
          className="w-full border-0 bg-transparent px-3 py-2.5 text-[13px] tabular-nums text-ink outline-none"
        />
        <span className="pr-3 text-[11px] text-muted">{unit}</span>
      </div>
    </div>
  );
}
