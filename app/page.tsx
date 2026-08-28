import React from "react";
import Link from "next/link";
import { getProducts, getCategories } from "@/lib/api/products";
import { ProductCard } from "@/components/products/ProductCard";
import { HeroCarousel, type HeroSlide } from "@/components/home/HeroCarousel";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { IMG, img } from "@/lib/imagery";
import { Instagram, Scissors, Sparkles, Leaf } from "lucide-react";

export const dynamic = "force-dynamic";

const HERO_SLIDES: HeroSlide[] = [
  {
    eyebrow: "New In · Summer '26",
    title: "Sawan Lawn\nVolume One",
    copy: "Hand-drawn florals on featherweight lawn, cut for the long Karachi summer. Available unstitched and ready to wear.",
    cta: { label: "Shop the Collection", href: "/shop?sort=newest" },
    secondary: { label: "View Lookbook", href: "/about" },
    image: img(IMG.heroLawn, 1900),
    align: "left",
  },
  {
    eyebrow: "Khaas · Festive",
    title: "Zari, Organza\n& Evening Light",
    copy: "Formal three-pieces finished with hand-worked zari, sequin and thread embroidery for the occasions that matter.",
    cta: { label: "Shop Festive", href: "/shop?category=festive" },
    image: img(IMG.heroFestive, 1900),
    align: "center",
  },
  {
    eyebrow: "Everyday Pret",
    title: "Kurtas Made\nfor Real Days",
    copy: "Breathable cambric and khaddar in an easy, unfussy cut. Stitched, pressed and ready to wear out of the box.",
    cta: { label: "Shop Ready to Wear", href: "/shop?category=ready-to-wear" },
    image: img(IMG.heroPret, 1900),
    align: "left",
  },
];

/* Falls back to a curated set when the database has no categories seeded yet. */
const CATEGORY_TILES = [
  { name: "Ready to Wear", slug: "ready-to-wear", image: IMG.catReadyToWear },
  { name: "Unstitched", slug: "fabrics", image: IMG.catFabrics },
  { name: "Festive", slug: "festive", image: IMG.catFestive },
  { name: "Menswear", slug: "men", image: IMG.catMen },
  { name: "Kids", slug: "kids", image: IMG.catKids },
  { name: "Home", slug: "home", image: IMG.catHome },
];

const CATEGORY_IMAGE_BY_SLUG: Record<string, string> = {
  "ready-to-wear": IMG.catReadyToWear,
  fabrics: IMG.catFabrics,
  festive: IMG.catFestive,
  men: IMG.catMen,
  kids: IMG.catKids,
  home: IMG.catHome,
  fragrances: IMG.catFragrance,
  accessories: IMG.catAccessories,
};

export default async function HomePage() {
  const [newArrivals, bestsellers, categories] = await Promise.all([
    getProducts({ limit: 8, sortBy: "newest" }),
    getProducts({ limit: 8, sortBy: "rating" }),
    getCategories(),
  ]);

  const tiles = categories.length
    ? categories.slice(0, 6).map((c) => ({
        name: c.name,
        slug: c.slug,
        image: CATEGORY_IMAGE_BY_SLUG[c.slug] ?? IMG.catReadyToWear,
        imageUrl: c.image_url,
      }))
    : CATEGORY_TILES.map((t) => ({ ...t, imageUrl: null }));

  return (
    <>
      <HeroCarousel slides={HERO_SLIDES} />

      {/* ── Shop by category ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1500px] px-6 py-16 sm:py-20 xl:px-10">
        <SectionHeading
          eyebrow="Shop By"
          title="Categories"
          copy="From unstitched yardage to festive formals — find your way in."
        />

        <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-6">
          {tiles.map((tile) => (
            <Link key={tile.slug} href={`/shop?category=${tile.slug}`} className="group text-center">
              <div className="relative aspect-[3/4] overflow-hidden bg-sand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={tile.imageUrl ?? img(tile.image, 500)}
                  alt={tile.name}
                  loading="lazy"
                  className="h-full w-full object-cover object-center transition-transform duration-[1400ms] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-ink/0 transition-colors duration-500 group-hover:bg-ink/10" />
              </div>
              <h3 className="eyebrow mt-4 text-ink transition-colors group-hover:text-clay">
                {tile.name}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      {/* ── New in ───────────────────────────────────────────────────── */}
      {newArrivals.length > 0 && (
        <section className="border-t border-line bg-cream">
          <div className="mx-auto max-w-[1500px] px-6 py-16 sm:py-20 xl:px-10">
            <SectionHeading
              align="between"
              eyebrow="Just Landed"
              title="New In"
              copy="The most recent additions to the studio, updated every week."
              action={{ label: "View All New In", href: "/shop?sort=newest" }}
            />

            <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
              {newArrivals.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Split editorial: unstitched vs pret ──────────────────────── */}
      <section className="mx-auto grid max-w-[1500px] grid-cols-1 gap-4 px-6 py-16 sm:py-20 lg:grid-cols-2 xl:px-10">
        {[
          {
            eyebrow: "Unstitched",
            title: "Buy the cloth,\nchoose the cut",
            copy: "Two and three-piece lawn, cambric and khaddar suits — with our stitching service one click away.",
            href: "/shop?category=fabrics",
            label: "Shop Fabrics",
            image: IMG.editorialUnstitched,
          },
          {
            eyebrow: "Ready to Wear",
            title: "Stitched, pressed,\nout the door",
            copy: "Everyday kurtas and co-ord sets in a relaxed AASHNA fit, finished in our Karachi atelier.",
            href: "/shop?category=ready-to-wear",
            label: "Shop Pret",
            image: IMG.editorialPret,
          },
        ].map((panel) => (
          <Link key={panel.title} href={panel.href} className="group relative block overflow-hidden">
            <div className="aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/5]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img(panel.image, 1100)}
                alt={panel.eyebrow}
                loading="lazy"
                className="h-full w-full object-cover object-center transition-transform duration-[1600ms] group-hover:scale-105"
              />
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-8 sm:p-10">
              <span className="eyebrow text-white/80">{panel.eyebrow}</span>
              <h3 className="mt-3 whitespace-pre-line font-[family-name:var(--font-display)] text-[30px] leading-[1.1] text-white sm:text-[36px]">
                {panel.title}
              </h3>
              <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-white/80">{panel.copy}</p>
              <span className="eyebrow link-underline mt-5 inline-block text-white">
                {panel.label}
              </span>
            </div>
          </Link>
        ))}
      </section>

      {/* ── Bestsellers ──────────────────────────────────────────────── */}
      {bestsellers.length > 0 && (
        <section className="border-y border-line bg-cream">
          <div className="mx-auto max-w-[1500px] px-6 py-16 sm:py-20 xl:px-10">
            <SectionHeading
              align="between"
              eyebrow="Loved Most"
              title="Bestsellers"
              copy="The pieces our customers keep coming back for."
              action={{ label: "Shop All", href: "/shop?sort=rating" }}
            />

            <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
              {bestsellers.slice(0, 8).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Wide editorial banner ────────────────────────────────────── */}
      <section className="relative">
        <div className="relative h-[420px] w-full overflow-hidden sm:h-[520px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img(IMG.editorialWide, 1900)}
            alt="The Eid edit"
            loading="lazy"
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-ink/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="eyebrow text-white/80">The Eid Edit</span>
            <h2 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-[36px] leading-tight text-white sm:text-[50px]">
              Dressing for the days that gather everyone
            </h2>
            <p className="mt-4 max-w-md text-[13px] leading-relaxed text-white/85">
              Formals in organza, jacquard and raw silk — cut generously, embroidered by hand, and
              made to be photographed.
            </p>
            <Link
              href="/shop?category=festive"
              className="label-track mt-8 bg-white px-9 py-4 text-[11px] font-medium text-ink transition-colors hover:bg-clay hover:text-white"
            >
              Explore Festive
            </Link>
          </div>
        </div>
      </section>

      {/* ── House promises ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1500px] px-6 py-16 sm:py-20 xl:px-10">
        <SectionHeading eyebrow="The House" title="Why AASHNA" />

        <div className="mt-12 grid grid-cols-1 gap-10 md:grid-cols-3">
          {[
            {
              icon: Leaf,
              title: "Woven Responsibly",
              copy: "Cotton sourced from Punjab mills we visit ourselves, dyed with low-impact pigments and finished in-house.",
            },
            {
              icon: Scissors,
              title: "Stitched to You",
              copy: "Add stitching to any unstitched suit at checkout and choose your fit, length and sleeve.",
            },
            {
              icon: Sparkles,
              title: "Hand-Finished",
              copy: "Every embroidered panel is inspected, pressed and packed by hand before it leaves the studio.",
            },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="text-center">
              <Icon className="mx-auto h-6 w-6 text-clay" strokeWidth={1.2} />
              <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl text-ink">{title}</h3>
              <p className="mx-auto mt-3 max-w-xs text-[13px] leading-relaxed text-ink-soft">{copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Community grid ───────────────────────────────────────────── */}
      <section className="border-t border-line bg-cream">
        <div className="mx-auto max-w-[1500px] px-6 py-16 sm:py-20 xl:px-10">
          <SectionHeading
            eyebrow="@aashna.pk"
            title="Styled by You"
            copy="Tag #AashnaEdit for a chance to be featured."
          />

          <div className="mt-10 grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6">
            {IMG.lookbook.map((id, i) => (
              <a
                key={id}
                href="#"
                aria-label={`Community photo ${i + 1}`}
                className="group relative aspect-square overflow-hidden bg-sand"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img(id, 500)}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover object-center transition-transform duration-[1200ms] group-hover:scale-110"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-ink/0 text-white opacity-0 transition-all duration-300 group-hover:bg-ink/35 group-hover:opacity-100">
                  <Instagram className="h-5 w-5" strokeWidth={1.4} />
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
