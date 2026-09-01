import React from "react";

/** Shared page header for every admin screen. */
export function AdminHeading({
  title,
  copy,
  action,
}: {
  title: string;
  copy?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-[28px] leading-tight text-ink">
          {title}
        </h1>
        {copy && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{copy}</p>}
      </div>
      {action}
    </div>
  );
}
