import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { BRAND } from "@/lib/constants";
import { getSiteContent } from "@/lib/api/content";

export const metadata: Metadata = {
  title: `Our Story | ${BRAND.name} ${BRAND.suffix}`,
  description:
    "How Dream Stitch By Sk chooses its cloth, cuts every set to size and hand-finishes premium bedsheets in pure cotton, cotton zeen and cotton satin.",
};

export const dynamic = "force-dynamic";

export default async function AboutPage() {
  const { hero, intro, values, closing } = (await getSiteContent()).about;

  return (
    <div>
      {/* Hero */}
      {hero.enabled && (
        <section className="relative h-[380px] w-full overflow-hidden bg-lilac sm:h-[480px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero.image}
            alt="Folded cotton on the cutting table"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-aubergine/55" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="eyebrow text-white/80">{hero.eyebrow}</span>
            <h1 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-[40px] leading-tight text-white sm:text-[54px]">
              {hero.title}
            </h1>
          </div>
        </section>
      )}

      {/* Opening statement */}
      {intro.enabled && (
        <section className="mx-auto max-w-2xl px-6 py-16 text-center sm:py-24">
          <p className="font-[family-name:var(--font-display)] text-[22px] leading-relaxed text-ink sm:text-[26px]">
            {intro.lead}
          </p>
          <p className="mt-6 text-[14px] leading-[1.9] text-ink-soft">{intro.copy}</p>
        </section>
      )}

      {/* Split image + values */}
      {values.enabled && (
        <section className="border-y border-line bg-frost">
          <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-12 px-6 py-16 lg:grid-cols-2 lg:gap-20 sm:py-24 xl:px-10">
            <div className="relative aspect-[4/5] overflow-hidden bg-lilac">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={values.image}
                alt="Cotton on the cutting table"
                className="h-full w-full object-cover object-center"
              />
            </div>

            <div className="flex flex-col justify-center">
              <span className="eyebrow text-purple">{values.eyebrow}</span>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-tight text-ink sm:text-[40px]">
                {values.title}
              </h2>

              <div className="mt-10 space-y-9">
                {values.items.map((value, i) => (
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
      )}

      {/* Closing CTA */}
      {closing.enabled && (
        <section className="relative">
          <div className="relative h-[360px] w-full overflow-hidden sm:h-[440px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={closing.image}
              alt=""
              className="h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-aubergine/60" />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
              <h2 className="max-w-xl font-[family-name:var(--font-display)] text-[32px] leading-tight text-white sm:text-[42px]">
                {closing.title}
              </h2>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {closing.cta_label && (
                  <Link
                    href={closing.cta_href || "/shop"}
                    className="label-track bg-white px-8 py-4 text-[11px] font-medium text-purple transition-colors hover:bg-ink hover:text-white"
                  >
                    {closing.cta_label}
                  </Link>
                )}
                {closing.secondary_label && (
                  <Link
                    href={closing.secondary_href || "/custom"}
                    className="label-track border border-white/70 px-8 py-4 text-[11px] font-medium text-white transition-colors hover:bg-white hover:text-purple"
                  >
                    {closing.secondary_label}
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
