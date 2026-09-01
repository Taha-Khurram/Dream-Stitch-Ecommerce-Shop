import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { BRAND } from "@/lib/constants";
import { IMG, img } from "@/lib/imagery";

export const metadata: Metadata = {
  title: `Our Story | ${BRAND.name} ${BRAND.suffix}`,
  description:
    "How Dream Stitch By Sk chooses its cloth, cuts every set to size and hand-finishes premium bedsheets in pure cotton, cotton zeen and cotton satin.",
};

/* Placeholder dates — swap for the real founding years before launch. */
const MILESTONES = [
  {
    year: "2018",
    title: "One table, one bolt of cotton",
    copy: "A single order of pure cotton, cut into forty sets and sold to neighbours who kept asking for more.",
  },
  {
    year: "2020",
    title: "The custom order that started it",
    copy: "A customer with an old wooden frame no standard sheet would fit. We cut to her numbers, and never stopped.",
  },
  {
    year: "2023",
    title: "Three fabrics, one standard",
    copy: "Cotton zeen and cotton satin join pure cotton — each chosen on the roll, not from a catalogue.",
  },
  {
    year: "2026",
    title: "Made to order, nationwide",
    copy: "Custom sizing shipped to every city in Pakistan, still cut and checked by the same hands.",
  },
];

const VALUES = [
  {
    title: "Fabric first",
    copy: "We buy the cloth before we design the print. Pure cotton, cotton zeen and cotton satin — three weaves we can name, source and stand behind, with no mystery blends and no filler.",
  },
  {
    title: "Cut to the bed, not to a chart",
    copy: "Standard sizes are a convenience, not a rule. If your mattress is deeper, your frame older or your drop longer, we cut to your measurements at no drama and no premium for being unusual.",
  },
  {
    title: "Made to survive the laundry",
    copy: "Colourfast dyes, double-stitched hems and reinforced corners, because a bedsheet is judged on its twentieth wash and not its first.",
  },
];

export default function AboutPage() {
  return (
    <div className="pb-8">
      {/* Hero */}
      <section className="relative h-[380px] w-full overflow-hidden bg-lilac sm:h-[480px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img(IMG.editorialCraft, 1900)}
          alt="Folded cotton on the cutting table"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-aubergine/55" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="eyebrow text-white/80">Our Story</span>
          <h1 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-[40px] leading-tight text-white sm:text-[54px]">
            Chosen, cut and finished by hand
          </h1>
        </div>
      </section>

      {/* Opening statement */}
      <section className="mx-auto max-w-2xl px-6 py-16 text-center sm:py-24">
        <p className="font-[family-name:var(--font-display)] text-[22px] leading-relaxed text-ink sm:text-[26px]">
          {BRAND.name} {BRAND.suffix} began with a simple frustration: bedsheets that looked
          beautiful in the shop and gave up after three washes.
        </p>
        <p className="mt-6 text-[14px] leading-[1.9] text-ink-soft">
          So we started choosing our own fabric, cutting our own sizes, and finishing every seam
          ourselves. What you get is a bedsheet that fits your bed properly, holds its colour, and
          gets softer instead of thinner. No mystery blends, no filler — just cotton we would put
          on our own beds.
        </p>
      </section>

      {/* Split image + values */}
      <section className="border-y border-line bg-frost">
        <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-12 px-6 py-16 lg:grid-cols-2 lg:gap-20 sm:py-24 xl:px-10">
          <div className="relative aspect-[4/5] overflow-hidden bg-lilac">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img(IMG.storyFabric, 1100)}
              alt="Cotton on the cutting table"
              className="h-full w-full object-cover object-center"
            />
          </div>

          <div className="flex flex-col justify-center">
            <span className="eyebrow text-purple">What We Hold To</span>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-tight text-ink sm:text-[40px]">
              Three rules we don&apos;t bend
            </h2>

            <div className="mt-10 space-y-9">
              {VALUES.map((value, i) => (
                <div key={value.title} className="flex gap-6">
                  <span className="font-[family-name:var(--font-display)] text-2xl text-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] text-xl text-ink">
                      {value.title}
                    </h3>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{value.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="mx-auto max-w-[1500px] px-6 py-16 sm:py-24 xl:px-10">
        <SectionHeading eyebrow="Milestones" title="How we got here" />

        <div
          className="mt-14 grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4"
          data-reveal-stagger
          suppressHydrationWarning
        >
          {MILESTONES.map((milestone) => (
            <div key={milestone.year} className="bg-white p-8">
              <span className="font-[family-name:var(--font-display)] text-[34px] text-purple">
                {milestone.year}
              </span>
              <h3 className="mt-3 text-[14px] text-ink">{milestone.title}</h3>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{milestone.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="relative">
        <div className="relative h-[360px] w-full overflow-hidden sm:h-[440px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img(IMG.editorialFinish, 1900)}
            alt=""
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-aubergine/60" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <h2 className="max-w-xl font-[family-name:var(--font-display)] text-[32px] leading-tight text-white sm:text-[42px]">
              See what came off the table this week
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/shop?sort=newest"
                className="label-track bg-white px-8 py-4 text-[11px] font-medium text-purple transition-colors hover:bg-ink hover:text-white"
              >
                Shop New In
              </Link>
              <Link
                href="/custom"
                className="label-track border border-white/70 px-8 py-4 text-[11px] font-medium text-white transition-colors hover:bg-white hover:text-purple"
              >
                Order a Custom Size
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
