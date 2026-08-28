import React from "react";
import Link from "next/link";
import { getProducts, getCategories } from "@/lib/api/products";
import { ProductCard } from "@/components/products/ProductCard";
import { CategoryFilter } from "@/components/products/CategoryFilter";
import { MobileFilterSheet } from "@/components/products/MobileFilterSheet";
import { SortMenu } from "@/components/products/SortMenu";
import { productSizes, productColors } from "@/lib/product-attributes";
import { IMG, img } from "@/lib/imagery";
import { ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";

type SortKey = "newest" | "price-asc" | "price-desc" | "rating";

interface ShopPageProps {
  searchParams: Promise<{
    category?: string;
    search?: string;
    sort?: SortKey;
    size?: string;
    color?: string;
    min?: string;
    max?: string;
  }>;
}

const COLLECTION_BANNER: Record<string, { image: string; copy: string }> = {
  "ready-to-wear": {
    image: IMG.catReadyToWear,
    copy: "Stitched kurtas, co-ords and separates in the relaxed AASHNA fit.",
  },
  fabrics: {
    image: IMG.catFabrics,
    copy: "Unstitched lawn, cambric and khaddar — yours to cut as you like.",
  },
  festive: {
    image: IMG.catFestive,
    copy: "Hand-worked formals for weddings, Eid and the long evenings between.",
  },
  men: { image: IMG.catMen, copy: "Kameez shalwar, waistcoats and kurtas for men." },
  kids: { image: IMG.catKids, copy: "Small-scale versions of the pieces you already love." },
  home: { image: IMG.catHome, copy: "Block-printed bedlinen, throws and table textiles." },
  fragrances: { image: IMG.catFragrance, copy: "Body mists and eau de parfum, layered like fabric." },
  accessories: { image: IMG.catAccessories, copy: "Dupattas, stoles, bags and everyday jewellery." },
};

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const categorySlug = params.category;
  const searchQuery = params.search;
  const sortBy: SortKey = params.sort ?? "newest";

  const minPrice = params.min ? Number(params.min) : undefined;
  const maxPrice = params.max ? Number(params.max) : undefined;

  const [fetched, categories] = await Promise.all([
    getProducts({
      categorySlug,
      query: searchQuery,
      sortBy,
      minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
      limit: 60,
    }),
    getCategories(),
  ]);

  // Size and colour live in optional array columns, so they are narrowed here
  // rather than in the query — this keeps working before the migration runs.
  const products = fetched.filter((product) => {
    if (params.size && !productSizes(product).includes(params.size)) return false;
    if (params.color && !productColors(product).includes(params.color)) return false;
    return true;
  });

  const activeCategory = categories.find((c) => c.slug === categorySlug);
  const banner = categorySlug ? COLLECTION_BANNER[categorySlug] : undefined;

  const heading = activeCategory
    ? activeCategory.name
    : searchQuery
      ? `Search: ${searchQuery}`
      : "All Products";

  const description =
    banner?.copy ??
    activeCategory?.description ??
    "Every piece in the studio, from featherweight lawn to hand-embroidered formals.";

  return (
    <div className="pb-16">
      {/* Collection banner */}
      <section className="relative h-[220px] w-full overflow-hidden bg-sand sm:h-[300px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeCategory?.image_url ?? img(banner?.image ?? IMG.editorialCraft, 1900)}
          alt={heading}
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-ink/35" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="eyebrow text-white/80">Collection</span>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[34px] leading-tight text-white sm:text-[46px]">
            {heading}
          </h1>
          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-white/85">{description}</p>
        </div>
      </section>

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

      <div className="mx-auto flex max-w-[1500px] gap-10 px-6 xl:px-10">
        {/* Desktop filter rail */}
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-[184px] max-h-[calc(100vh-200px)] overflow-y-auto pb-8 pr-2">
            <h2 className="eyebrow border-b border-ink pb-4 text-ink">Filter</h2>
            <CategoryFilter categories={categories} />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
            <p className="text-[12px] text-muted">
              <span className="text-ink">{products.length}</span>{" "}
              {products.length === 1 ? "item" : "items"}
            </p>

            <div className="flex items-center gap-4">
              <MobileFilterSheet categories={categories} />
              <SortMenu />
            </div>
          </div>

          {products.length === 0 ? (
            <div className="py-24 text-center">
              <h3 className="font-[family-name:var(--font-display)] text-2xl text-ink">
                Nothing here yet
              </h3>
              <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-ink-soft">
                We couldn&apos;t find pieces matching these filters. Try widening your search or
                browse the full collection.
              </p>
              <Link href="/shop" className="btn-ink mt-8">
                View All Products
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 pt-8 md:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
