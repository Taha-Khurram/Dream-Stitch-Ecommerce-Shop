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
        <h1 className="font-[family-name:var(--font-display)] text-[26px] leading-tight text-ink">
          {title}
        </h1>
        {copy && <p className="mt-1.5 max-w-xl text-[13px] text-ink-soft">{copy}</p>}
      </div>
      {action}
    </div>
  );
}
