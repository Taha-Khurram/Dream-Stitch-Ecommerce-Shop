import React from "react";
import Link from "next/link";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  copy?: string;
  action?: { label: string; href: string };
  align?: "center" | "between";
  className?: string;
}

/** The standard editorial section header used across the storefront. */
export function SectionHeading({
  eyebrow,
  title,
  copy,
  action,
  align = "center",
  className = "",
}: SectionHeadingProps) {
  if (align === "center") {
    return (
      <div className={`text-center ${className}`}>
        {eyebrow && <span className="eyebrow block text-purple">{eyebrow}</span>}
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink sm:text-[38px]">
          {title}
        </h2>
        {copy && (
          <p className="mx-auto mt-3 max-w-lg text-[13px] leading-relaxed text-ink-soft">{copy}</p>
        )}
        {action && (
          <Link
            href={action.href}
            className="eyebrow link-underline mt-5 inline-block text-ink transition-colors hover:text-purple"
          >
            {action.label}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`}>
      <div>
        {eyebrow && <span className="eyebrow block text-purple">{eyebrow}</span>}
        <h2 className="mt-3 font-[family-name:var(--font-display)] text-[28px] leading-tight text-ink sm:text-[34px]">
          {title}
        </h2>
        {copy && <p className="mt-2 max-w-lg text-[13px] leading-relaxed text-ink-soft">{copy}</p>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="eyebrow link-underline shrink-0 text-ink transition-colors hover:text-purple"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
