import React from "react";
import Link from "next/link";
import type { Product } from "@/types/ecommerce";
import { formatPrice, discountPercent } from "@/lib/format";
import { swatchHex } from "@/lib/constants";
import { productColors, productSubtitle, hoverImage } from "@/lib/product-attributes";
import { QuickAdd } from "./QuickAdd";
import { WishlistButton } from "./WishlistButton";

interface ProductCardProps {
  product: Product;
  /** Tightens type sizes for dense carousels. */
  compact?: boolean;
}

export function ProductCard({ product, compact = false }: ProductCardProps) {
  const soldOut = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 3;
  const colors = productColors(product);
  const subtitle = productSubtitle(product);
  const secondary = hoverImage(product);
  const discount = discountPercent(Number(product.price), product.compare_at_price);

  return (
    <article className="group relative flex flex-col">
      <div className="img-swap relative aspect-[4/5] overflow-hidden bg-lilac">
        {product.image_url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={product.image_url}
              alt={product.name}
              loading="lazy"
              className="img-front absolute inset-0 h-full w-full object-cover object-center"
            />
            {secondary && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={secondary}
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="img-back absolute inset-0 h-full w-full object-cover object-center"
              />
            )}
          </>
        ) : (
          <div className="eyebrow flex h-full w-full items-center justify-center text-faint">
            Image coming soon
          </div>
        )}

        {/* Full-bleed link sits under the interactive controls */}
        <Link
          href={`/shop/${product.id}`}
          aria-label={product.name}
          className="absolute inset-0 z-10"
        />

        {/* Corner flags */}
        <div className="pointer-events-none absolute left-0 top-0 z-20 flex flex-col items-start gap-px">
          {discount !== null && (
            <span className="label-track bg-sale px-2.5 py-1 text-[9px] font-medium text-white">
              {discount}% Off
            </span>
          )}
          {product.is_featured && discount === null && (
            <span className="label-track bg-ink px-2.5 py-1 text-[9px] font-medium text-white">
              Bestseller
            </span>
          )}
          {soldOut && (
            <span className="label-track bg-white px-2.5 py-1 text-[9px] font-medium text-ink">
              Sold Out
            </span>
          )}
          {!soldOut && lowStock && (
            <span className="label-track bg-white/95 px-2.5 py-1 text-[9px] font-medium text-purple">
              Only {product.stock} Left
            </span>
          )}
        </div>

        <div className="absolute right-2 top-2 z-20 opacity-0 transition-opacity duration-300 group-hover:opacity-100 max-lg:opacity-100">
          <WishlistButton productId={product.id} />
        </div>

        {/* Quick-add bar — slides up on hover, pinned open on touch widths */}
        <div className="absolute inset-x-0 bottom-0 z-20 translate-y-full transition-transform duration-300 group-hover:translate-y-0 max-lg:translate-y-0">
          <QuickAdd product={product} />
        </div>
      </div>

      <div className={`flex flex-1 flex-col ${compact ? "pt-3" : "pt-4"}`}>
        {subtitle && <span className="eyebrow text-[8px] text-muted">{subtitle}</span>}

        <h3
          className={`mt-1.5 font-[family-name:var(--font-sans)] font-normal leading-snug ${
            compact ? "text-[13px]" : "text-sm"
          }`}
        >
          <Link
            href={`/shop/${product.id}`}
            className="text-ink transition-colors hover:text-purple"
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-ink">{formatPrice(product.price)}</span>
          {discount !== null && (
            <span className="text-[11px] text-faint line-through">
              {formatPrice(product.compare_at_price)}
            </span>
          )}
        </div>

        {colors.length > 1 && (
          <div className="mt-3 flex items-center gap-1.5">
            {colors.slice(0, 5).map((color) => (
              <span
                key={color}
                title={color}
                className="h-3 w-3 rounded-full border border-line"
                style={{ backgroundColor: swatchHex(color) }}
              />
            ))}
            {colors.length > 5 && (
              <span className="text-[10px] text-muted">+{colors.length - 5}</span>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
