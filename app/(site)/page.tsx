import React from "react";
import Link from "next/link";
import { getProducts, getCategories } from "@/lib/api/products";
import { ProductCard } from "@/components/products/ProductCard";
import { HeroCarousel, type HeroSlide } from "@/components/home/HeroCarousel";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Section, HEADING_GAP, GRID_GAP } from "@/components/layout/Section";
import { HomeClosing } from "@/components/home/HomeClosing";
import { FabricCarousel, type FabricTile } from "@/components/home/FabricCarousel";
import { IMG, img } from "@/lib/imagery";
import { Ruler, Droplets, Layers, Hand } from "lucide-react";

export const dynamic = "force-dynamic";

const HERO_SLIDES: HeroSlide[] = [
  {
    eyebrow: "Pure Cotton · Cotton Zeen · Cotton Satin",
    title: "Sleep Wrapped in\nSomething Softer",
    copy: "Premium bedsheets woven to stay soft wash after wash. Available in king and single, or made to your exact measurements.",
    cta: { label: "Shop the Collection", href: "/shop" },
    secondary: { label: "Order a Custom Size", href: "/custom" },
    image: img(IMG.heroCotton, 1900),
    align: "left",
  },
  {
    eyebrow: "Cotton Satin",
    title: "A Quiet Kind\nof Luxury",
    copy: "Cotton finished in a satin weave for a low, liquid sheen that catches the light without shouting. Cool to the touch, smooth against skin.",
    cta: { label: "Shop Cotton Satin", href: "/shop?category=cotton-satin" },
    image: img(IMG.heroSatin, 1900),
    align: "center",
  },
  {
    eyebrow: "Custom Demand",
    title: "Made for Your Bed.\nLiterally.",
    copy: "Odd frame, deeper mattress, extra drop? Send us the numbers and we cut a set to fit it exactly — same fabric, same finish.",
    cta: { label: "Start a Custom Order", href: "/custom" },
    image: img(IMG.heroCustom, 1900),
    align: "left",
  },
];

/* Falls back to this set when the database has no categories seeded yet. */
const CATEGORY_TILES = [
  { name: "Pure Cotton", slug: "pure-cotton", image: IMG.catPureCotton },
  { name: "Cotton Zeen", slug: "cotton-zeen", image: IMG.catCottonZeen },
  { name: "Cotton Satin", slug: "cotton-satin", image: IMG.catCottonSatin },
];

/* The rail is the fabric story, in weave order — not whatever the categories
   table happens to sort to. Anything unrecognised is left to the shop filter. */
const FABRIC_ORDER = CATEGORY_TILES.map((tile) => tile.slug);

const CATEGORY_IMAGE_BY_SLUG: Record<string, string> = {
  "pure-cotton": IMG.catPureCotton,
  "cotton-zeen": IMG.catCottonZeen,
  "cotton-satin": IMG.catCottonSatin,
};

/* One line each — the hook that makes a shopper pick a fabric over the others. */
const CATEGORY_BLURBS: Record<string, string> = {
  "pure-cotton": "Breathe easy, all night.",
  "cotton-zeen": "Soft where it counts.",
  "cotton-satin": "A quiet kind of luxury.",
};

const PROMISES = [
  {
    icon: Layers,
    title: "Fabric First",
    copy: "We buy the cloth before we design the print. Pure cotton, cotton zeen and cotton satin — nothing we cannot name.",
  },
  {
    icon: Ruler,
    title: "Made to Your Measurements",
    copy: "Odd bed? Old frame? Extra drop? Send us the numbers and we will cut to them.",
  },
  {
    icon: Droplets,
    title: "Colour That Stays",
    copy: "Dyed and finished to survive real laundry, not just a photoshoot.",
  },
  {
    icon: Hand,
    title: "Finished by Hand",
    copy: "Every hem, every corner, checked by a person before it is folded.",
  },
];

export default async function HomePage() {
  const [newArrivals, bestsellers, categories] = await Promise.all([
    getProducts({ limit: 8, sortBy: "newest" }),
    getProducts({ limit: 8, sortBy: "rating" }),
    getCategories(),
  ]);

  const newIn = newArrivals.slice(0, 4);
  const newInIds = new Set(newIn.map((product) => product.id));
  const topSellers = bestsellers.filter((product) => !newInIds.has(product.id)).slice(0, 4);

  const fabrics = categories
    .filter((c) => FABRIC_ORDER.includes(c.slug))
    .sort((a, b) => FABRIC_ORDER.indexOf(a.slug) - FABRIC_ORDER.indexOf(b.slug));

  const tiles: FabricTile[] = fabrics.length
    ? fabrics.map((c) => ({
        name: c.name,
        slug: c.slug,
        image: CATEGORY_IMAGE_BY_SLUG[c.slug] ?? IMG.catPureCotton,
        imageUrl: c.image_url,
        blurb: CATEGORY_BLURBS[c.slug] ?? "Woven to last.",
      }))
    : CATEGORY_TILES.map((t) => ({
        ...t,
        imageUrl: null,
        blurb: CATEGORY_BLURBS[t.slug] ?? "Woven to last.",
      }));

  return (
    <>
      <HeroCarousel slides={HERO_SLIDES} />

      {/* ── Shop by fabric ──────────────────────────────────── plain ── */}
      <Section>
        <SectionHeading
          eyebrow="Shop By"
          title="Fabric"
          copy="Three weaves, one standard. Photographed on the same bed, in the same light, so the cloth is the only thing that changes."
        />

        <div className={HEADING_GAP}>
          <FabricCarousel tiles={tiles} />
        </div>
      </Section>

      {/* ── New in ───────────────────────────────────────────── tint ── */}
      {newIn.length > 0 && (
        <Section surface="tint">
          <SectionHeading
            align="between"
            eyebrow="Just Landed"
            title="New In"
            copy="The most recent sets off the table, updated every week."
            action={{ label: "View All New In", href: "/shop?sort=newest" }}
          />

          <div
            className={`${HEADING_GAP} grid grid-cols-2 ${GRID_GAP} md:grid-cols-3 lg:grid-cols-4`}
          >
            {newIn.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Bestsellers ─────────────────────────────────────── plain ── */}
      {topSellers.length > 0 && (
        <Section>
          <SectionHeading
            align="between"
            eyebrow="Loved Most"
            title="Bestsellers"
            copy="The sets our customers come back for a second time."
            action={{ label: "Shop All", href: "/shop?sort=rating" }}
          />

          <div
            className={`${HEADING_GAP} grid grid-cols-2 ${GRID_GAP} md:grid-cols-3 lg:grid-cols-4`}
          >
            {topSellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Custom demand — full bleed, the loudest purple on the page ── */}
      <Section bleed>
        <div className="relative h-[420px] w-full overflow-hidden sm:h-[500px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img(IMG.editorialWide, 1900)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-purple/80" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="eyebrow text-white/75">Custom Demand</span>
            <h2 className="mt-5 max-w-2xl font-[family-name:var(--font-display)] text-[32px] leading-tight text-white sm:text-[46px]">
              Your bed isn&apos;t standard. Your sheet shouldn&apos;t be.
            </h2>
            <p className="mt-5 max-w-md text-[13px] leading-relaxed text-white/85">
              King, single, or something in between — send us your measurements and we will stitch
              a set to fit it exactly. Same fabrics, same finish, no compromise on the drop.
            </p>
            <Link
              href="/custom"
              className="label-track mt-9 bg-white px-9 py-4 text-[11px] font-medium text-purple transition-colors hover:bg-ink hover:text-white"
            >
              Start a Custom Order
            </Link>
          </div>
        </div>
      </Section>

      {/* ── Why choose us ───────────────────────────────────── tint ── */}
      <Section surface="tint">
        <SectionHeading
          eyebrow="Why Dream Stitch"
          title="Stitched With Intention"
          copy="We started because bedsheets that looked beautiful in the shop gave up after three washes. So we began choosing our own cloth."
        />

        <div
          className={`${HEADING_GAP} grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4`}
        >
          {PROMISES.map(({ icon: Icon, title, copy }) => (
            <div key={title} className="text-center">
              <Icon className="mx-auto h-6 w-6 text-purple" strokeWidth={1.2} />
              <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl text-ink">
                {title}
              </h3>
              <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-ink-soft">
                {copy}
              </p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Promises + newsletter ───────────────── plain, then tint ── */}
      <HomeClosing />
    </>
  );
}
