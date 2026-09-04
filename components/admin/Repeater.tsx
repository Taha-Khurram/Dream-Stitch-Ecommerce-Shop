"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { inputClass } from "@/components/admin/field-styles";
import { MediaUploadButton } from "@/components/admin/MediaField";
import { ImageGuidance } from "@/components/admin/MediaGuidance";
import { siteFolder } from "@/lib/supabase/storage";
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
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-baseline gap-2.5">
                <span className="admin-th shrink-0 text-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {/* Six identical numbered cards are impossible to tell apart —
                    echo the row's own first filled value as its title. */}
                <span className="truncate text-[13px] text-ink-soft">
                  {preview(row, columns) || <em className="text-faint not-italic">Empty row</em>}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <IconButton
                  label="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="Remove"
                  onClick={() => {
                    // One click otherwise deletes a whole hero slide silently.
                    if (window.confirm("Remove this row?")) remove(index);
                  }}
                  danger
                >
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
              {columns.map((column) => (
                <label key={column.key} className={`block ${SPAN[column.span ?? 2]}`}>
                  <span className="admin-label">{column.label}</span>
                  {column.kind === "textarea" ? (
                    <textarea
                      rows={2}
                      value={row[column.key] ?? ""}
                      onChange={(e) => update(index, column.key, e.target.value)}
                      className={`${inputClass} mt-1.5 resize-y`}
                    />
                  ) : column.kind === "image" ? (
                    /* The picture it points at, plus a way to put one there —
                       and, in a cell this narrow, one line of what fits. */
                    <>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="h-9 w-12 shrink-0 overflow-hidden border border-line bg-lilac">
                          {row[column.key] && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={row[column.key]}
                              alt=""
                              className="h-full w-full object-cover object-center"
                            />
                          )}
                        </span>
                        <input
                          value={row[column.key] ?? ""}
                          onChange={(e) => update(index, column.key, e.target.value)}
                          placeholder="https://… or upload"
                          className={`${inputClass} text-[12px]`}
                        />
                        <MediaUploadButton
                          folder={siteFolder(name)}
                          spec={column.image}
                          onUploaded={(url) => update(index, column.key, url)}
                        />
                      </span>
                      <ImageGuidance spec={column.image} variant="inline" className="mt-1" />
                    </>
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
          <p className="admin-hint border border-dashed border-line px-4 py-6 text-center">
            Nothing here — this block is hidden until you add a row.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => setItems((current) => [...current, blank()])}
        className="mt-3 flex cursor-pointer items-center gap-1.5 border border-line px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-purple hover:bg-lilac hover:text-purple"
      >
        <Plus className="h-4 w-4" />
        {addLabel}
      </button>
    </div>
  );
}

/** The row's first filled value, used as its heading in the card. */
function preview(row: Record<string, string>, columns: ColumnSpec[]): string {
  for (const column of columns) {
    const value = row[column.key]?.trim();
    if (value) return value.length > 60 ? `${value.slice(0, 60)}…` : value;
  }
  return "";
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
      className={`flex h-8 w-8 cursor-pointer items-center justify-center border border-line text-muted transition-colors disabled:cursor-default disabled:opacity-35 ${
        danger ? "hover:border-sale hover:text-sale" : "hover:border-purple hover:text-purple"
      }`}
    >
      {children}
    </button>
  );
}
