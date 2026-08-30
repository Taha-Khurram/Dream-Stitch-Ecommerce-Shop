import React from "react";
import Link from "next/link";
import { getProducts, getCategories } from "@/lib/api/products";
import { ProductCard } from "@/components/products/ProductCard";
import { CategoryFilter } from "@/components/products/CategoryFilter";
import { MobileFilterSheet } from "@/components/products/MobileFilterSheet";
import { SortMenu } from "@/components/products/SortMenu";
import { productSizes } from "@/lib/product-attributes";
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
    min?: string;
    max?: string;
    sale?: string;
  }>;
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

  // Size, colour and markdowns live in optional columns, so they are narrowed
  // here rather than in the query — this keeps working before the migration runs.
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
        : "All Bedsheets";

  const description = onSale
    ? "Sets currently reduced from their original price. Same cloth, same finish."
    : (banner?.copy ??
      activeCategory?.description ??
      "Every set we make, in pure cotton, cotton zeen and cotton satin — king, single or cut to your own measurements.");

  return (
    <div className="pb-16">
      {/* Collection banner */}
      <section className="relative h-[220px] w-full overflow-hidden bg-lilac sm:h-[300px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeCategory?.image_url ?? img(banner?.image ?? IMG.editorialCraft, 1900)}
          alt={heading}
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-aubergine/45" />
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
          <div className="sticky top-[76px] max-h-[calc(100vh-92px)] overflow-y-auto pb-8 pr-2">
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
                No sets match these filters. Try widening your search, browse the full collection,
                or have this made in your own size.
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
