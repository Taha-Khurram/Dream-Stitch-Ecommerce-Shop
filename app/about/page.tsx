import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { BRAND } from "@/lib/constants";
import { IMG, img } from "@/lib/imagery";

export const metadata: Metadata = {
  title: `Our Story | ${BRAND.name}`,
  description:
    "How AASHNA prints, weaves and hand-finishes Pakistani pret and unstitched fabric from its Karachi studio.",
};

const MILESTONES = [
  { year: "2014", title: "A single table in Karachi", copy: "Two block-printers, one lawn run of 60 suits, sold out of a friend's living room." },
  { year: "2017", title: "The first studio", copy: "A Korangi workshop with twenty artisans and our own dyeing line." },
  { year: "2021", title: "Ready to wear", copy: "Pret joins unstitched — every piece cut, stitched and pressed in-house." },
  { year: "2026", title: "Twelve stores, one studio", copy: "Stores across six cities, still printing every collection ourselves." },
];

const VALUES = [
  {
    title: "Cloth first",
    copy: "We buy greige from mills in Faisalabad and Punjab that we visit each season, and finish it ourselves rather than buying converted fabric.",
  },
  {
    title: "Hands over machines",
    copy: "Block printing, chikankari and zari work are done by artisans on piece rates we publish internally — no anonymous subcontracting.",
  },
  {
    title: "Made to last a decade",
    copy: "Colourfast dyes, generous seam allowances and a repair counter in every store, because a good kurta should outlive its season.",
  },
];

export default function AboutPage() {
  return (
    <div className="pb-8">
      {/* Hero */}
      <section className="relative h-[380px] w-full overflow-hidden bg-sand sm:h-[480px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img(IMG.editorialCraft, 1900)}
          alt="Inside the AASHNA studio"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-ink/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="eyebrow text-white/80">Our Story</span>
          <h1 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-[40px] leading-tight text-white sm:text-[54px]">
            Printed, dyed and stitched in Karachi
          </h1>
        </div>
      </section>

      {/* Opening statement */}
      <section className="mx-auto max-w-2xl px-6 py-16 text-center sm:py-24">
        <p className="font-[family-name:var(--font-display)] text-[22px] leading-relaxed text-ink sm:text-[26px]">
          {BRAND.name} began with a question we still ask every season: what would it take to make
          a lawn suit worth keeping?
        </p>
        <p className="mt-6 text-[14px] leading-[1.9] text-ink-soft">
          Twelve years on, the answer hasn&apos;t changed much. Buy honest cloth. Print it slowly.
          Pay the people who do the hand-work properly. Cut it generously enough that it still fits
          three summers later. Everything else — the stores, the collections, the website you&apos;re
          reading — is built around those four things.
        </p>
      </section>

      {/* Split image + values */}
      <section className="border-y border-line bg-cream">
        <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-12 px-6 py-16 lg:grid-cols-2 lg:gap-20 sm:py-24 xl:px-10">
          <div className="relative aspect-[4/5] overflow-hidden bg-sand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img(IMG.storyFabric, 1100)}
              alt="Fabric on the table"
              className="h-full w-full object-cover object-center"
            />
          </div>

          <div className="flex flex-col justify-center">
            <span className="eyebrow text-clay">What We Hold To</span>
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

        <div className="mt-14 grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          {MILESTONES.map((milestone) => (
            <div key={milestone.year} className="bg-white p-8">
              <span className="font-[family-name:var(--font-display)] text-[34px] text-clay">
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
            src={img(IMG.editorialStitching, 1900)}
            alt=""
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-ink/45" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <h2 className="max-w-xl font-[family-name:var(--font-display)] text-[32px] leading-tight text-white sm:text-[42px]">
              Come see what came off the table this week
            </h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/shop?sort=newest"
                className="label-track bg-white px-8 py-4 text-[11px] font-medium text-ink transition-colors hover:bg-clay hover:text-white"
              >
                Shop New In
              </Link>
              <Link
                href="/contact"
                className="label-track border border-white/70 px-8 py-4 text-[11px] font-medium text-white transition-colors hover:bg-white hover:text-ink"
              >
                Visit a Store
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
