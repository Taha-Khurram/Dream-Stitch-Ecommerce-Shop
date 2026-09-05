/**
 * The one origin every absolute URL the site emits is built from — canonical
 * tags, Open Graph images, `sitemap.xml`, `robots.txt`.
 *
 * Deliberately *not* `VERCEL_URL`. That variable holds the per-deployment
 * hostname (`demo-a1b2c3.vercel.app`), so building canonicals from it would
 * have every preview deploy declare itself the canonical home of the shop and
 * invite Google to index a throwaway build. The production origin is a
 * constant, so it is written as one.
 */
const PRODUCTION_ORIGIN = "https://dreamstitchbysk.vercel.app";

/**
 * A local origin is correct in development and catastrophic in production: a
 * sitemap full of `http://localhost:3000/…` is a sitemap of URLs Google cannot
 * fetch, and canonical tags pointing at localhost tell it the real pages are
 * duplicates of somewhere it can never reach.
 *
 * `NEXT_PUBLIC_SITE_URL` is set to localhost in `.env.local` for exactly the
 * right reason, and the same variable is one careless copy away from being set
 * that way in Vercel. So the override is honoured everywhere except where it
 * would do damage — in a production build a local origin is ignored rather
 * than obeyed, and the shop's real address is used instead.
 */
function resolveOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!configured) return PRODUCTION_ORIGIN;

  let origin: URL;
  try {
    origin = new URL(configured);
  } catch {
    // Not a URL at all — a bare hostname, or an empty override left behind.
    return PRODUCTION_ORIGIN;
  }

  const isLocal =
    origin.hostname === "localhost" ||
    origin.hostname === "127.0.0.1" ||
    origin.hostname === "0.0.0.0" ||
    origin.hostname.endsWith(".local");

  if (isLocal && process.env.NODE_ENV === "production") return PRODUCTION_ORIGIN;

  return origin.origin;
}

/** Origin with no trailing slash, so `${SITE_URL}${path}` is always well formed. */
export const SITE_URL = resolveOrigin().replace(/\/+$/, "");

/** `/shop/linen-set` → `https://…/shop/linen-set`. */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
