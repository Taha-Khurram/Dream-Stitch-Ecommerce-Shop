import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getProductByIdOrSlug, getProducts } from "@/lib/api/products";
import { ProductGallery } from "@/components/products/ProductGallery";
import { ProductOptions } from "@/components/products/ProductOptions";
import { ProductAccordions, type AccordionPanel } from "@/components/products/ProductAccordions";
import { ProductCard } from "@/components/products/ProductCard";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { formatPrice, discountPercent } from "@/lib/format";
import { getSettings } from "@/lib/api/settings";
import { getSiteContent } from "@/lib/api/content";
import { resolveSizeGuide } from "@/lib/size-guide";
import { BRAND } from "@/lib/constants";
import { productImages, productSubtitle } from "@/lib/product-attributes";
import { ChevronRight, Star, Truck } from "lucide-react";

export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await getProductByIdOrSlug(id);

  if (!product) {
    return { title: `Product Not Found | ${BRAND.name}` };
  }

  return {
    title: `${product.name} | ${BRAND.name}`,
    /* Every product answers on two URLs: the uuid the product cards link by,
       and the slug. This names the slug as the real one, which is what stops
       Google treating a card click and a sitemap entry as two thin pages
       competing with each other — and it is the slug that carries the
       product's words in the address bar. */
    alternates: { canonical: `/shop/${product.slug}` },
    // The fallback used to quote a PKR 5,000 delivery threshold that no longer
    // came from anywhere — Settings owns that number, and a search snippet is
    // no place to hardcode a second copy of it.
    description:
      product.description || `${product.name} — ${BRAND.name} ${BRAND.suffix}.`,
    openGraph: {
      title: product.name,
      description: product.description || undefined,
      images: product.image_url ? [product.image_url] : [],
    },
  };
}

export default async function ProductDetailPage({ params }: ProductPageProps) {
  const { id } = await params;
  // The same call `generateMetadata` made, answered from the request cache.
  const product = await getProductByIdOrSlug(id);

  if (!product) {
    notFound();
  }

  const [settings, content] = await Promise.all([getSettings(), getSiteContent()]);

  // The size chart is per category, and the buy box is a client component —
  // so it is resolved here and handed over already picked.
  const sizeGuide = resolveSizeGuide(content, product.category?.slug);

  const related = await getProducts({
    categorySlug: product.category?.slug,
    limit: 5,
  }).then((items) => items.filter((p) => p.id !== product.id).slice(0, 4));

  const images = productImages(product);
  const subtitle = productSubtitle(product);
  const discount = discountPercent(Number(product.price), product.compare_at_price);
  const soldOut = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 3;

  const articleCode = product.id.replace(/-/g, "").slice(0, 10).toUpperCase();

  // Both numbers come from Settings → General, so a threshold of 0 really does
  // mean every order ships free and there is no fee to name.
  const deliveryPromise =
    settings.free_shipping_threshold > 0
      ? `Free delivery on orders above ${formatPrice(settings.free_shipping_threshold)} · ${formatPrice(
          settings.shipping_fee
        )} below that`
      : "Free delivery on every order";

  /* Only the attributes this product actually carries. A row with nothing
     behind it is dropped, and a panel with no rows left never renders — the
     page says what the catalogue knows and stops there. */
  const specs = [
    { label: "Fabric", value: product.fabric },
    { label: "Set includes", value: product.pieces },
    { label: "Sizing", value: product.sizes?.length ? product.sizes.join(", ") : null },
  ].filter((spec): spec is { label: string; value: string } => Boolean(spec.value));

  const panels: AccordionPanel[] = [];

  if (product.description) {
    panels.push({ title: "Description", body: <p>{product.description}</p> });
  }

  if (specs.length > 0) {
    panels.push({
      title: "Fabric & Size",
      body: (
        <dl className="space-y-2.5">
          {specs.map((spec) => (
            <div key={spec.label} className="flex justify-between gap-6">
              <dt className="text-muted">{spec.label}</dt>
              <dd className="text-right text-ink">{spec.value}</dd>
            </div>
          ))}
        </dl>
      ),
    });
  }

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
                ? "Sold out."
                : `Only ${product.stock} left in stock.`}
            </p>
          )}

          <div className="mt-7">
            <ProductOptions product={product} sizeGuide={sizeGuide} />
          </div>

          {/* The one promise the store actually configures: the delivery rates
              from Settings → General. Transit times, the exchange window and
              the made-to-measure offer used to sit here too, invented in this
              file with nothing behind them — a claim the shop could not change
              and could not honour. */}
          <ul className="mt-8 space-y-3 border-y border-line py-6 text-[12px] text-ink-soft">
            <li className="flex items-start gap-3">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-purple" strokeWidth={1.3} />
              <span>{deliveryPromise}</span>
            </li>
          </ul>

          {panels.length > 0 && (
            <div className="mt-8">
              <ProductAccordions panels={panels} />
            </div>
          )}
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
