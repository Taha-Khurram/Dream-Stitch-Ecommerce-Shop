import React from "react";
import { Section } from "@/components/layout/Section";
import { Truck, RotateCcw, Scissors, Headphones, ArrowRight } from "lucide-react";

const SERVICES = [
  { icon: Truck, title: "Nationwide Delivery", copy: "Free above PKR 5,000" },
  { icon: RotateCcw, title: "7-Day Exchange", copy: "Unused, in original packing" },
  { icon: Scissors, title: "Any Size, Made to Order", copy: "Stitched to your measurements" },
  { icon: Headphones, title: "Customer Care", copy: "Mon–Sat, 9am – 9pm PKT" },
];

/**
 * Service promises and the newsletter — the homepage's closing pair.
 *
 * These used to sit in the global footer and so repeated on every page, which
 * put them directly beneath /custom's own promise strip: two near-identical
 * four-column icon rows, stacked.
 */
export function HomeClosing() {
  return (
    <>
      {/* Cells sit on white with a 1px grid gap showing the line colour through. */}
      <Section bleed>
        <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-px bg-line lg:grid-cols-4">
          {SERVICES.map(({ icon: Icon, title, copy }) => (
            <div
              key={title}
              className="flex flex-col items-center gap-2 bg-white px-4 py-10 text-center"
            >
              <Icon className="h-5 w-5 text-purple" strokeWidth={1.3} />
              <h3 className="eyebrow mt-1 text-ink">{title}</h3>
              <p className="text-[11px] text-muted">{copy}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section surface="tint">
        <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:justify-between lg:gap-16 lg:text-left">
          <div className="max-w-md">
            <h2 className="font-[family-name:var(--font-display)] text-[26px] leading-tight text-ink">
              First look, before anyone else
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
              New prints, restocks and the occasional quiet sale. One email, now and then — never a
              flood.
            </p>
          </div>

          <form className="flex w-full max-w-md items-center border-b border-ink" action="#">
            <input
              type="email"
              placeholder="Your email address"
              aria-label="Email address"
              className="w-full bg-transparent py-3 text-[13px] text-ink placeholder-muted focus:outline-none"
            />
            <button
              type="submit"
              className="eyebrow flex shrink-0 cursor-pointer items-center gap-1.5 py-3 pl-4 text-ink transition-colors hover:text-purple"
            >
              Subscribe <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </Section>
    </>
  );
}
