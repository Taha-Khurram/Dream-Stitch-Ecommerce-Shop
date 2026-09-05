import type { MetadataRoute } from "next";
import { getProducts, getCategories } from "@/lib/api/products";
import { getContentUpdatedAt } from "@/lib/api/content";
import { absoluteUrl } from "@/lib/site-url";

/**
 * `/sitemap.xml` — the crawl map handed to Google Search Console.
 *
 * Three rules decide what is in here, and every omission below traces back to
 * one of them:
 *
 *  1. **Only URLs that answer 200.** A sitemap is a list of pages worth
 *     indexing, so a redirect or a 404 in it is a reported error in Search
 *     Console rather than a harmless extra. That rules out `/products` and
 *     `/products/[id]`, which exist only to redirect to their `/shop` twins.
 *
 *  2. **Only pages a stranger can read.** `/dashboard`, `/wishlist` and
 *     `/track` render nothing without a session, an order reference, or the
 *     visitor's own browser storage — to a crawler they are empty shells, and
 *     listing empty shells asks Google to judge the site by them.
 *
 *  3. **One URL per piece of content.** See the note on product slugs below.
 *
 * Rendered per request. The data layer reads Supabase through the cookie-bound
 * server client, which opts any route that touches it into dynamic rendering —
 * so a `revalidate` here would be quietly ignored rather than honoured. That is
 * an acceptable trade at this size: two queries over eleven products and two
 * categories, against a file crawlers fetch a handful of times a day, and the
 * catalogue is never stale in it.
 */

/** Pages whose copy lives in `store_settings.content`, so they share its stamp. */
const MARKETING_PATHS = [
  { path: "/", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/custom", changeFrequency: "monthly" as const, priority: 0.8 },
  { path: "/about", changeFrequency: "monthly" as const, priority: 0.5 },
  { path: "/contact", changeFrequency: "monthly" as const, priority: 0.5 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  /* One failure here empties the shop's entire crawl map, so each source is
     allowed to fail on its own — a database blip during a crawl should cost
     the product URLs, not the four marketing pages that need no database. */
  const [products, categories, contentUpdatedAt] = await Promise.all([
    getProducts({ limit: 1000 }).catch(() => []),
    getCategories().catch(() => []),
    getContentUpdatedAt().catch(() => null),
  ]);

  /* `lastModified` is omitted rather than faked when the stamp is unknown.
     `changeFrequency` and `priority` are here for the crawlers that still read
     them; Google states plainly that it ignores both, so nothing in this file
     depends on them being obeyed. */
  const marketing: MetadataRoute.Sitemap = MARKETING_PATHS.map(
    ({ path, changeFrequency, priority }) => ({
      url: absoluteUrl(path),
      ...(contentUpdatedAt ? { lastModified: contentUpdatedAt } : {}),
      changeFrequency,
      priority,
    })
  );

  /* The shop index moves whenever any product does, so the freshest product
     stamp is its stamp — more honest than the settings row, which says nothing
     about the catalogue. */
  const newestProduct = products.reduce<Date | null>((newest, product) => {
    const stamp = new Date(product.updated_at);
    if (Number.isNaN(stamp.getTime())) return newest;
    return newest === null || stamp > newest ? stamp : newest;
  }, null);

  const shopIndex: MetadataRoute.Sitemap = [
    {
      url: absoluteUrl("/shop"),
      ...(newestProduct ? { lastModified: newestProduct } : {}),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  /* Collection pages. `?category=` is a query parameter rather than a path
     segment, which Google indexes perfectly well — but only the ones listed
     here, because robots.txt closes the rest of the filter rail (sort, size,
     price, sale, search) to crawling. Those combine into thousands of URLs
     over the same eleven products, and every one crawled is crawl budget not
     spent on a product page. */
  const collections: MetadataRoute.Sitemap = categories
    .filter((category) => Boolean(category.slug))
    .map((category) => ({
      url: absoluteUrl(`/shop?category=${encodeURIComponent(category.slug)}`),
      lastModified: new Date(category.updated_at),
      changeFrequency: "weekly",
      priority: 0.7,
    }));

  /* Product pages, addressed by slug.
   *
   * `/shop/[id]` resolves a uuid or a slug, and the product cards across the
   * site link by uuid — so every product genuinely answers on two URLs. Naming
   * the slug here, and only the slug, is half of settling that: the page's
   * canonical tag names the same slug URL, which is what tells Google the uuid
   * link it followed and this entry are one page rather than two.
   *
   * The slug is also the half worth keeping. `/shop/pure-cotton-king-set`
   * carries the product's keywords in the URL and survives being pasted into a
   * message; `/shop/9f8c2a1e-…` carries nothing and looks broken.
   */
  const productPages: MetadataRoute.Sitemap = products
    .filter((product) => Boolean(product.slug))
    .map((product) => ({
      url: absoluteUrl(`/shop/${product.slug}`),
      lastModified: new Date(product.updated_at),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  return [...marketing, ...shopIndex, ...collections, ...productPages];
}
