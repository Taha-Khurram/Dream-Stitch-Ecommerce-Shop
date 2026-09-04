import React from "react";
import Link from "next/link";
import { getFeaturedProducts } from "@/lib/api/products";
import { getSiteContent } from "@/lib/api/content";
import { HeroCarousel, type HeroSlide } from "@/components/home/HeroCarousel";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Section, HEADING_GAP } from "@/components/layout/Section";
import { HomeClosing } from "@/components/home/HomeClosing";
import { FeaturedRail } from "@/components/home/FeaturedRail";
import { Ruler, Droplets, Layers, Hand } from "lucide-react";

export const dynamic = "force-dynamic";

/* The promise copy is editable; which icon sits above it is not. */
const PROMISE_ICONS = [Layers, Ruler, Droplets, Hand];

export default async function HomePage() {
  /* 12 is two full passes of the rail on the widest layout — past that the
     drift is long enough that nobody reaches the end anyway. */
  const [featured, content] = await Promise.all([
    getFeaturedProducts(12),
    getSiteContent(),
  ]);
  const { hero, featured: featuredCopy, custom_banner: banner, promises, newsletter } =
    content.home;

  const slides: HeroSlide[] = hero.slides.map((slide) => ({
    eyebrow: slide.eyebrow,
    // The editor is a single-line field, so a typed \n is a real line break.
    title: slide.title.replace(/\\n/g, "\n"),
    copy: slide.copy,
    cta: { label: slide.cta_label, href: slide.cta_href || "/shop" },
    secondary: slide.secondary_label
      ? { label: slide.secondary_label, href: slide.secondary_href || "/shop" }
      : undefined,
    image: slide.image,
    align: slide.align === "center" ? "center" : "left",
  }));

  return (
    <>
      {hero.enabled && slides.length > 0 && <HeroCarousel slides={slides} />}

      {/* ── Featured ────────────────────────────────────────── plain ── */}
      {/* Nothing featured means no rail — a heading over an empty track reads
          as a broken section, so the whole block sits out until a product is
          marked featured in the admin. */}
      {featuredCopy.enabled && featured.length > 0 && (
        <Section>
          <SectionHeading
            eyebrow={featuredCopy.eyebrow}
            title={featuredCopy.title}
            copy={featuredCopy.copy}
            /* Blank the label in the admin and the link goes away, rather
               than rendering an empty one. */
            action={
              featuredCopy.action_label
                ? { label: featuredCopy.action_label, href: "/shop" }
                : undefined
            }
          />

          <div className={HEADING_GAP} data-reveal="fade" suppressHydrationWarning>
            <FeaturedRail products={featured} />
          </div>
        </Section>
      )}

      {/* ── Custom demand — full bleed, the loudest purple on the page ── */}
      {banner.enabled && (
        <Section bleed>
          <div className="relative h-[420px] w-full overflow-hidden sm:h-[500px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner.image}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-purple/80" />
            <div
              className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
              data-reveal="up"
              suppressHydrationWarning
            >
              <span className="eyebrow text-white/75">{banner.eyebrow}</span>
              <h2 className="mt-5 max-w-2xl font-[family-name:var(--font-display)] text-[32px] leading-tight text-white sm:text-[46px]">
                {banner.title}
              </h2>
              <p className="mt-5 max-w-md text-[13px] leading-relaxed text-white/85">
                {banner.copy}
              </p>
              {banner.cta_label && (
                <Link
                  href={banner.cta_href || "/custom"}
                  className="label-track mt-9 bg-white px-9 py-4 text-[11px] font-medium text-purple transition-colors hover:bg-ink hover:text-white"
                >
                  {banner.cta_label}
                </Link>
              )}
            </div>
          </div>
        </Section>
      )}

      {/* ── Why choose us ───────────────────────────────────── tint ── */}
      {promises.enabled && promises.items.length > 0 && (
        <Section surface="tint">
          <SectionHeading
            eyebrow={promises.eyebrow}
            title={promises.title}
            copy={promises.copy}
          />

          {/* Stagger: the four promises ripple across each row rather than
              all arriving on the same frame. */}
          <div
            className={`${HEADING_GAP} grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4`}
            data-reveal-stagger
            suppressHydrationWarning
          >
            {promises.items.map((promise, i) => {
              const Icon = PROMISE_ICONS[i % PROMISE_ICONS.length];
              return (
                <div key={promise.title} className="text-center">
                  <Icon className="mx-auto h-6 w-6 text-purple" strokeWidth={1.2} />
                  <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl text-ink">
                    {promise.title}
                  </h3>
                  <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-ink-soft">
                    {promise.copy}
                  </p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Newsletter ──────────────────────────────────────── plain ── */}
      {newsletter.enabled && <HomeClosing content={newsletter} />}
    </>
  );
}
