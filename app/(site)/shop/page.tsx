import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { getProducts, getCategories } from "@/lib/api/products";
import { getSiteContent } from "@/lib/api/content";
import { ProductCard } from "@/components/products/ProductCard";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Section, HEADING_GAP, GRID_GAP } from "@/components/layout/Section";
import { FilterSheet } from "@/components/products/FilterSheet";
import { SortMenu } from "@/components/products/SortMenu";
import { productSizes } from "@/lib/product-attributes";
import { IMG, img } from "@/lib/imagery";
import { BRAND } from "@/lib/constants";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

type SortKey = "newest" | "price-asc" | "price-desc" | "rating";

interface ShopPageProps {
  searchParams: Promise<{
    category?: string;
    search?: string;
    sort?: SortKey;
    size?: string;
    min?: string;
    max?: string;
    sale?: string;
  }>;
}

/**
 * The filter rail writes its state into the query string, so one catalogue is
 * reachable at thousands of addresses — `?sort=price-asc&size=King` and its
 * permutations. robots.txt closes those to crawling; this closes the gap for
 * the ones already crawled or linked from elsewhere, by pointing every
 * filtered view back at the collection it filters.
 *
 * `?category=` is the exception, and is kept: those are real collection pages
 * with their own banner and copy, and they are listed in the sitemap as such.
 */
export async function generateMetadata({ searchParams }: ShopPageProps): Promise<Metadata> {
  const { category } = await searchParams;

  return {
    title: `Shop Bedsheets | ${BRAND.name} ${BRAND.suffix}`,
    description:
      "Browse pure cotton, cotton zeen and cotton satin bedsheet sets in king and single sizes — or order a set cut to your own measurements.",
    alternates: {
      canonical: category ? `/shop?category=${encodeURIComponent(category)}` : "/shop",
    },
  };
}

const COLLECTION_BANNER: Record<string, { image: string; copy: string }> = {
  "pure-cotton": {
    image: IMG.catPureCotton,
    copy: "Densely woven pure cotton that stays cool through summer and softens with every wash.",
  },
  "cotton-zeen": {
    image: IMG.catCottonZeen,
    copy: "Smooth, close-woven cotton zeen with a gentle drape and a forgiving, crease-resistant finish.",
  },
  "cotton-satin": {
    image: IMG.catCottonSatin,
    copy: "Cotton finished in a satin weave for a low sheen that catches the light without shouting.",
  },
};

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const categorySlug = params.category;
  const searchQuery = params.search;
  const sortBy: SortKey = params.sort ?? "newest";

  const minPrice = params.min ? Number(params.min) : undefined;
  const maxPrice = params.max ? Number(params.max) : undefined;

  const [fetched, categories, newArrivals, bestsellers, content] = await Promise.all([
    getProducts({
      categorySlug,
      query: searchQuery,
      sortBy,
      minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
      limit: 60,
    }),
    getCategories(),
    getProducts({ limit: 8, sortBy: "newest" }),
    getProducts({ limit: 8, sortBy: "rating" }),
    getSiteContent(),
  ]);

  const { banner: bannerCopy, empty, new_in: newInCopy, bestsellers: bestsellersCopy } =
    content.shop;

  // The two rails are curated across the whole catalogue, not the current
  // filter, so a shopper who has narrowed to nothing still has somewhere to go.
  const newIn = newArrivals.slice(0, 4);
  const newInIds = new Set(newIn.map((product) => product.id));
  const topSellers = bestsellers.filter((product) => !newInIds.has(product.id)).slice(0, 4);

  // Size and markdowns live in optional columns, so they are narrowed here
  // rather than in the query — this keeps working before the migration runs.
  const onSale = params.sale === "true";
  const products = fetched.filter((product) => {
    if (params.size && !productSizes(product).includes(params.size)) return false;
    if (onSale && !(Number(product.compare_at_price ?? 0) > Number(product.price))) return false;
    return true;
  });

  const activeCategory = categories.find((c) => c.slug === categorySlug);
  const banner = categorySlug ? COLLECTION_BANNER[categorySlug] : undefined;

  const heading = onSale
    ? "Sale"
    : activeCategory
      ? activeCategory.name
      : searchQuery
        ? `Search: ${searchQuery}`
        : bannerCopy.title;

  const description = onSale
    ? "Sets currently reduced from their original price. Same cloth, same finish."
    : (banner?.copy ?? activeCategory?.description ?? bannerCopy.copy);

  return (
    <div>
      {/* Collection banner */}
      {bannerCopy.enabled && (
        <section className="relative h-[220px] w-full overflow-hidden bg-lilac sm:h-[300px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              activeCategory?.image_url ??
              (banner ? img(banner.image, 1900) : bannerCopy.image)
            }
            alt={heading}
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-aubergine/45" />
          <div
            className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            data-reveal="up"
            suppressHydrationWarning
          >
            <span className="eyebrow text-white/80">{bannerCopy.eyebrow}</span>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-[34px] leading-tight text-white sm:text-[46px]">
              {heading}
            </h1>
            <p className="mt-3 max-w-md text-[13px] leading-relaxed text-white/85">{description}</p>
          </div>
        </section>
      )}

      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex max-w-[1500px] items-center gap-2 px-6 py-4 text-[11px] text-muted xl:px-10"
      >
        <Link href="/" className="transition-colors hover:text-ink">
          Home
        </Link>
        <ChevronRight className="h-3 w-3 text-faint" />
        <Link href="/shop" className="transition-colors hover:text-ink">
          Shop
        </Link>
        {activeCategory && (
          <>
            <ChevronRight className="h-3 w-3 text-faint" />
            <span className="text-ink">{activeCategory.name}</span>
          </>
        )}
      </nav>

      <div className="mx-auto max-w-[1500px] px-6 pb-16 xl:px-10">
        <div className="min-w-0">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
            <p className="text-[12px] text-muted">
              <span className="text-ink">{products.length}</span>{" "}
              {products.length === 1 ? "item" : "items"}
            </p>

            <div className="flex items-center gap-4">
              <FilterSheet categories={categories} />
              <SortMenu />
            </div>
          </div>

          {products.length === 0 ? (
            <div className="py-24 text-center">
              <h3 className="font-[family-name:var(--font-display)] text-2xl text-ink">
                {empty.title}
              </h3>
              <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-ink-soft">
                {empty.copy}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link href="/shop" className="btn-primary">
                  View All Bedsheets
                </Link>
                <Link href="/custom" className="btn-outline">
                  Order a Custom Size
                </Link>
              </div>
            </div>
          ) : (
            <div
              className="grid grid-cols-2 gap-x-4 gap-y-10 pt-8 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
              data-reveal-stagger
              suppressHydrationWarning
            >
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── New in ──────────────────────────────────── tint ── */}
      {/* Both rails sit well below the fold on every viewport, so the browser
          is allowed to skip their layout work until they are scrolled near. */}
      {newInCopy.enabled && newIn.length > 0 && (
        <Section surface="tint" className="cv-auto">
          <SectionHeading
            align="between"
            eyebrow={newInCopy.eyebrow}
            title={newInCopy.title}
            copy={newInCopy.copy}
            action={{ label: newInCopy.action_label, href: "/shop?sort=newest" }}
          />

          <div
            className={`${HEADING_GAP} grid grid-cols-2 ${GRID_GAP} md:grid-cols-3 lg:grid-cols-4`}
            data-reveal-stagger
            suppressHydrationWarning
          >
            {newIn.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </Section>
      )}

      {/* ── Bestsellers ────────────────────────────── plain ── */}
      {bestsellersCopy.enabled && topSellers.length > 0 && (
        <Section className="cv-auto">
          <SectionHeading
            align="between"
            eyebrow={bestsellersCopy.eyebrow}
            title={bestsellersCopy.title}
            copy={bestsellersCopy.copy}
            action={{ label: bestsellersCopy.action_label, href: "/shop?sort=rating" }}
          />

          <div
            className={`${HEADING_GAP} grid grid-cols-2 ${GRID_GAP} md:grid-cols-3 lg:grid-cols-4`}
            data-reveal-stagger
            suppressHydrationWarning
          >
            {topSellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
