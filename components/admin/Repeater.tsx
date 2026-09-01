"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { inputClass } from "@/components/admin/ActionForm";
import type { ColumnSpec } from "@/lib/content/fields";

/**
 * A repeatable list of flat rows — hero slides, footer links, FAQs.
 *
 * The rows live in React state and ride to the server as JSON in one hidden
 * field, which is what keeps the content walk in `lib/content/merge` free of
 * index-mangling names like `home.hero.slides.2.title`.
 */
export function Repeater({
  name,
  columns,
  rows,
  addLabel = "Add row",
}: {
  name: string;
  columns: ColumnSpec[];
  rows: Record<string, string>[];
  addLabel?: string;
}) {
  const [items, setItems] = useState<Record<string, string>[]>(rows);

  const blank = () => Object.fromEntries(columns.map((column) => [column.key, ""]));

  const update = (index: number, key: string, value: string) =>
    setItems((current) =>
      current.map((row, i) => (i === index ? { ...row, [key]: value } : row))
    );

  const move = (index: number, delta: number) =>
    setItems((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const remove = (index: number) =>
    setItems((current) => current.filter((_, i) => i !== index));

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(items)} />

      <div className="space-y-3">
        {items.map((row, index) => (
          <div key={index} className="border border-line bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-faint">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="flex items-center gap-1">
                <IconButton
                  label="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </IconButton>
                <IconButton label="Remove" onClick={() => remove(index)} danger>
                  <X className="h-3.5 w-3.5" />
                </IconButton>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
              {columns.map((column) => (
                <label key={column.key} className={`block ${SPAN[column.span ?? 2]}`}>
                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                    {column.label}
                  </span>
                  {column.kind === "textarea" ? (
                    <textarea
                      rows={2}
                      value={row[column.key] ?? ""}
                      onChange={(e) => update(index, column.key, e.target.value)}
                      className={`${inputClass} mt-1.5 resize-y`}
                    />
                  ) : (
                    <input
                      value={row[column.key] ?? ""}
                      onChange={(e) => update(index, column.key, e.target.value)}
                      placeholder={column.kind === "url" ? "/shop" : undefined}
                      className={`${inputClass} mt-1.5`}
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <p className="border border-dashed border-line px-4 py-6 text-center text-[12px] text-faint">
            Nothing here — this block is hidden until you add a row.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setItems((current) => [...current, blank()])}
        className="mt-3 flex cursor-pointer items-center gap-1.5 border border-line px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft transition-colors hover:border-purple hover:text-purple"
      >
        <Plus className="h-3.5 w-3.5" />
        {addLabel}
      </button>
    </div>
  );
}

/** Six columns, so a row of thirds, halves or full-width fields all line up. */
const SPAN: Record<number, string> = {
  1: "sm:col-span-1",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
  5: "sm:col-span-5",
  6: "sm:col-span-6",
};

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 cursor-pointer items-center justify-center border border-line text-muted transition-colors disabled:cursor-default disabled:opacity-35 ${
        danger ? "hover:border-sale hover:text-sale" : "hover:border-purple hover:text-purple"
      }`}
    >
      {children}
    </button>
  );
}
