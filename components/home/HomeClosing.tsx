import React from "react";
import { Section } from "@/components/layout/Section";
import type { SiteContent } from "@/lib/content/defaults";
import { ArrowRight } from "lucide-react";

/**
 * The newsletter — the homepage's closing note.
 *
 * This used to sit in the global footer and so repeated on every page.
 */
export function HomeClosing({ content }: { content: SiteContent["home"]["newsletter"] }) {
  return (
    <Section>
      <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:justify-between lg:gap-16 lg:text-left">
        <div className="max-w-md">
          <h2 className="font-[family-name:var(--font-display)] text-[26px] leading-tight text-ink">
            {content.title}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{content.copy}</p>
        </div>

        <form className="flex w-full max-w-md items-center border-b border-ink" action="#">
          <input
            type="email"
            placeholder={content.placeholder}
            aria-label="Email address"
            className="w-full bg-transparent py-3 text-[13px] text-ink placeholder-muted focus:outline-none"
          />
          <button
            type="submit"
            className="eyebrow flex shrink-0 cursor-pointer items-center gap-1.5 py-3 pl-4 text-ink transition-colors hover:text-purple"
          >
            {content.button_label} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </Section>
  );
}
