import React from "react";
import Link from "next/link";
import { getCategories } from "@/lib/api/products";
import { getSiteContent } from "@/lib/api/content";
import { HeroCarousel, type HeroSlide } from "@/components/home/HeroCarousel";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Section, HEADING_GAP } from "@/components/layout/Section";
import { HomeClosing } from "@/components/home/HomeClosing";
import { FabricCarousel, type FabricTile } from "@/components/home/FabricCarousel";
import { Ruler, Droplets, Layers, Hand } from "lucide-react";

export const dynamic = "force-dynamic";

/* The promise copy is editable; which icon sits above it is not. */
const PROMISE_ICONS = [Layers, Ruler, Droplets, Hand];

export default async function HomePage() {
  const [categories, content] = await Promise.all([getCategories(), getSiteContent()]);
  const { hero, fabrics, custom_banner: banner, promises, newsletter } = content.home;

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

  /* The rail is the categories table and nothing else — every card's name,
     blurb and photo is whatever /admin/categories holds, in the order
     `getCategories` returns (by name). A category with no image yet shows its
     card without one rather than borrowing a stock photo. */
  const tiles: FabricTile[] = categories.map((c) => ({
    name: c.name,
    slug: c.slug,
    imageUrl: c.image_url,
    blurb: c.description ?? "",
  }));

  return (
    <>
      {hero.enabled && slides.length > 0 && <HeroCarousel slides={slides} />}

      {/* ── Shop by fabric ──────────────────────────────────── plain ── */}
      {/* No categories means no rail — a heading over an empty track reads as
          a broken section, so the whole block sits out until one exists. */}
      {fabrics.enabled && tiles.length > 0 && (
        <Section>
          <SectionHeading eyebrow={fabrics.eyebrow} title={fabrics.title} copy={fabrics.copy} />

          <div className={HEADING_GAP} data-reveal="fade" suppressHydrationWarning>
            <FabricCarousel tiles={tiles} />
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
