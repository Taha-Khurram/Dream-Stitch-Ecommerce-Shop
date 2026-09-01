import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductById, getProductBySlug, getProducts } from "@/lib/api/products";
import { ProductGallery } from "@/components/products/ProductGallery";
import { ProductOptions } from "@/components/products/ProductOptions";
import { ProductAccordions } from "@/components/products/ProductAccordions";
import { ProductCard } from "@/components/products/ProductCard";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { formatPrice, discountPercent } from "@/lib/format";
import { getSettings } from "@/lib/api/settings";
import { BRAND } from "@/lib/constants";
import { productImages, productSubtitle, isMadeToOrder } from "@/lib/product-attributes";
import { ChevronRight, Star, Truck, RotateCcw, Scissors } from "lucide-react";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = (await getProductById(id)) || (await getProductBySlug(id));

  if (!product) {
    return { title: `Product Not Found | ${BRAND.name}` };
  }

  return {
    title: `${product.name} | ${BRAND.name}`,
    description:
      product.description ||
      `Shop ${product.name} at ${BRAND.name} ${BRAND.suffix}. Free delivery over PKR 5,000. Custom sizes made to order.`,
    openGraph: {
      title: product.name,
      description: product.description || undefined,
      images: product.image_url ? [product.image_url] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params;
  const product = (await getProductById(id)) || (await getProductBySlug(id));

  if (!product) {
    notFound();
  }

  const settings = await getSettings();

  const related = await getProducts({
    categorySlug: product.category?.slug,
    limit: 5,
  }).then((items) => items.filter((p) => p.id !== product.id).slice(0, 4));

  const images = productImages(product);
  const subtitle = productSubtitle(product);
  const madeToOrder = isMadeToOrder(product);
  const discount = discountPercent(Number(product.price), product.compare_at_price);
  const soldOut = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 3;

  const articleCode = product.id.replace(/-/g, "").slice(0, 10).toUpperCase();

  return (
    <div className="pb-20">
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-2 px-6 py-5 text-[11px] text-muted xl:px-10"
      >
        <Link href="/" className="transition-colors hover:text-ink">
          Home
        </Link>
        <ChevronRight className="h-3 w-3 text-faint" />
        <Link href="/shop" className="transition-colors hover:text-ink">
          Shop
        </Link>
        {product.category && (
          <>
            <ChevronRight className="h-3 w-3 text-faint" />
            <Link
              href={`/shop?category=${product.category.slug}`}
              className="transition-colors hover:text-ink"
            >
              {product.category.name}
            </Link>
          </>
        )}
        <ChevronRight className="h-3 w-3 text-faint" />
        <span className="truncate text-ink">{product.name}</span>
      </nav>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-10 px-6 lg:grid-cols-2 lg:gap-16 xl:px-10">
        {/* Gallery */}
        <div data-reveal="left" suppressHydrationWarning>
          <ProductGallery images={images} alt={product.name} />
        </div>

        {/* Buy box */}
        <div className="lg:max-w-md" data-reveal="right" suppressHydrationWarning>
          {subtitle && <span className="eyebrow text-purple">{subtitle}</span>}

          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink sm:text-[38px]">
            {product.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-4">
            <span className="eyebrow text-faint">Art. {articleCode}</span>
            {product.rating !== undefined && product.rating !== null && (
              <span className="flex items-center gap-1.5 text-[12px] text-ink-soft">
                <Star className="h-3.5 w-3.5 fill-purple text-purple" />
                {product.rating}
                {product.reviews_count !== undefined && (
                  <span className="text-muted">({product.reviews_count} reviews)</span>
                )}
              </span>
            )}
          </div>

          <div className="mt-6 flex items-baseline gap-3 border-b border-line pb-6">
            <span className="font-[family-name:var(--font-display)] text-[26px] text-ink">
              {formatPrice(product.price)}
            </span>
            {discount !== null && (
              <>
                <span className="text-[14px] text-faint line-through">
                  {formatPrice(product.compare_at_price)}
                </span>
                <span className="label-track bg-sale px-2 py-1 text-[9px] font-medium text-white">
                  {discount}% Off
                </span>
              </>
            )}
          </div>

          {(soldOut || lowStock) && (
            <p className={`mt-5 text-[12px] ${soldOut ? "text-muted" : "text-purple"}`}>
              {soldOut
                ? "Sold out for now — or have this cut to your size on order."
                : `Only ${product.stock} left in stock.`}
            </p>
          )}

          <div className="mt-7">
            <ProductOptions product={product} />
          </div>

          {/* Service promises */}
          <ul className="mt-8 space-y-3 border-y border-line py-6 text-[12px] text-ink-soft">
            <li className="flex items-start gap-3">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-purple" strokeWidth={1.3} />
              <span>
                Free nationwide delivery on orders above {formatPrice(settings.free_shipping_threshold)} ·
                3–5 working days
              </span>
            </li>
            <li className="flex items-start gap-3">
              <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-purple" strokeWidth={1.3} />
              <span>7-day exchange — unused and in its original packing</span>
            </li>
            <li className="flex items-start gap-3">
              <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-purple" strokeWidth={1.3} />
              <span>
                {madeToOrder
                  ? "Cut to your measurements — dispatched in 7–10 working days"
                  : "Need a different size? We stitch this fabric to any bed"}
              </span>
            </li>
          </ul>

          <div className="mt-8">
            <ProductAccordions
              panels={[
                {
                  title: "Description",
                  body: (
                    <p>
                      {product.description ||
                        "A considered everyday set from the Dream Stitch table — cut generously, hemmed twice and checked by hand before it is folded."}
                    </p>
                  ),
                },
                {
                  title: "Fabric & Size",
                  body: (
                    <dl className="space-y-2.5">
                      <div className="flex justify-between gap-6">
                        <dt className="text-muted">Fabric</dt>
                        <dd className="text-right text-ink">{product.fabric ?? "Pure Cotton"}</dd>
                      </div>
                      <div className="flex justify-between gap-6">
                        <dt className="text-muted">Set includes</dt>
                        <dd className="text-right text-ink">
                          {product.pieces ?? "1 bedsheet + 2 pillow covers"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-6">
                        <dt className="text-muted">Sizing</dt>
                        <dd className="text-right text-ink">
                          {madeToOrder ? "Cut to your measurements" : "King and single in stock"}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-6">
                        <dt className="text-muted">Custom sizing</dt>
                        <dd className="text-right text-ink">Available on request</dd>
                      </div>
                    </dl>
                  ),
                },
                {
                  title: "Care",
                  body: (
                    <ul className="list-inside list-disc space-y-1.5">
                      <li>Machine wash cold with like colours, mild detergent, no bleach</li>
                      <li>Tumble dry low, or line dry in shade — direct sun fades colour</li>
                      <li>Warm iron if needed; satin weaves press best on the reverse</li>
                      <li>Wash before first use to bring the cotton to its softest</li>
                    </ul>
                  ),
                },
                {
                  title: "Delivery & Exchange",
                  body: (
                    <p>
                      Dispatched within 24 hours from Karachi. Delivery in 3–5 working days
                      nationwide, free above {formatPrice(settings.free_shipping_threshold)}. Exchange
                      within 7 days, unused and in its original packing. Made-to-order sets are cut
                      for one bed only, so they are not exchangeable.
                    </p>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </div>

      {/* You may also like */}
      {related.length > 0 && (
        <section className="cv-auto mx-auto mt-24 max-w-[1500px] px-6 xl:px-10">
          <SectionHeading
            align="between"
            eyebrow="Pairs Well"
            title="You May Also Like"
            action={{
              label: "View Collection",
              href: `/shop?category=${product.category?.slug ?? ""}`,
            }}
          />
          <div
            className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4"
            data-reveal-stagger
            suppressHydrationWarning
          >
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
