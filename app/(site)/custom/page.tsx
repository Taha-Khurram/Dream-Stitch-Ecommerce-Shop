import React from "react";
import Link from "next/link";
import { BRAND } from "@/lib/constants";
import { IMG, img } from "@/lib/imagery";
import { MessageCircle, Ruler, Scissors, Truck } from "lucide-react";

/**
 * Custom Demand — the made-to-measure service. This is the one thing the
 * high-street cannot match, so it gets its own route rather than a line in an
 * FAQ.
 */

/* A real sequence: the customer measures, we quote, we cut. Hence the numbering. */
const STEPS = [
  {
    icon: Ruler,
    title: "Send three numbers",
    copy: "Mattress width, mattress length, and the drop you want hanging over each side. A tape measure and two minutes is all it takes.",
  },
  {
    icon: MessageCircle,
    title: "We confirm the price",
    copy: "We reply the same working day with the exact price for your size in the fabric you picked. Nothing is cut until you say yes.",
  },
  {
    icon: Scissors,
    title: "Cut, stitched, dispatched",
    copy: "Your set is cut to your numbers, double-hemmed, checked by hand and dispatched within 7–10 working days.",
  },
];

export default function CustomOrderPage() {
  return (
    <div className="pb-8">
      {/* Hero */}
      <section className="relative h-[320px] w-full overflow-hidden bg-lilac sm:h-[420px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img(IMG.editorialCustom, 1900)}
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-purple/80" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="eyebrow text-white/75">Custom Demand</span>
          <h1 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-[36px] leading-tight text-white sm:text-[50px]">
            Your bed isn&apos;t standard. Your sheet shouldn&apos;t be.
          </h1>
          <p className="mt-5 max-w-lg text-[13px] leading-relaxed text-white/85">
            King, single, or something in between — send us your measurements and we will stitch a
            set to fit it exactly. Same fabrics, same finish, no premium for being unusual.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="mx-auto max-w-[1500px] px-6 py-16 sm:py-20 xl:px-10 scroll-mt-28"
      >
        <div className="text-center">
          <span className="eyebrow text-purple">How It Works</span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink sm:text-[38px]">
            Three steps, one bed
          </h2>
        </div>

        <ol className="mt-14 grid grid-cols-1 gap-px bg-line md:grid-cols-3" data-reveal-stagger suppressHydrationWarning>
          {STEPS.map(({ icon: Icon, title, copy }, i) => (
            <li key={title} className="bg-white p-8">
              <div className="flex items-center gap-4">
                <span className="font-[family-name:var(--font-display)] text-[30px] leading-none text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Icon className="h-5 w-5 text-purple" strokeWidth={1.3} />
              </div>
              <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl text-ink">
                {title}
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{copy}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Request CTA */}
      <section id="request" className="bg-lilac scroll-mt-28">
        <div className="mx-auto max-w-2xl px-6 py-16 text-center sm:py-20">
          <span className="eyebrow text-purple">Start Here</span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink sm:text-[38px]">
            Request your size
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[13px] leading-relaxed text-ink-soft">
            Every bedsheet we make can be cut to your own measurements — no premium for an odd
            size. Browse the range, pick the fabric and finish you want, then send us your width,
            length and drop. We confirm the price the same working day, before anything is cut.
          </p>
          <p className="mx-auto mt-3 max-w-md text-[12px] leading-relaxed text-muted">
            Prefer to talk it through? Message us on WhatsApp at {BRAND.whatsapp}.
          </p>

          <Link href="/shop" className="btn-primary mt-9 inline-flex">
            Order a Custom Size
          </Link>
        </div>
      </section>

      {/* Reassurance strip */}
      <section className="border-t border-line bg-frost">
        <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-px bg-line sm:grid-cols-3">
          {[
            { icon: Scissors, title: "No premium for odd sizes", copy: "You pay for cloth, not for being unusual." },
            { icon: Truck, title: "7–10 working days", copy: "Cut, finished and dispatched from Karachi." },
            { icon: Ruler, title: "We check your numbers", copy: "If something looks off, we call before cutting." },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="flex flex-col items-center gap-2 bg-frost px-6 py-10 text-center">
              <Icon className="h-5 w-5 text-purple" strokeWidth={1.3} />
              <h3 className="eyebrow mt-1 text-ink">{title}</h3>
              <p className="text-[12px] text-muted">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
