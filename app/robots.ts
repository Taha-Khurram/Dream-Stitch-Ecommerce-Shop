import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/site-url";

/**
 * `/robots.txt` — what a crawler may fetch, and where the map is.
 *
 * The `Disallow` list is two different jobs wearing one hat:
 *
 *  - **Nothing to index.** `/admin` and `/api` are gated or machine-readable;
 *    `/dashboard`, `/wishlist`, `/signin`, `/signup` and `/login` render a
 *    session's contents or a form, which is a blank page to a crawler. None of
 *    it is secret — the admin routes are behind auth and RLS, and robots.txt
 *    is a public file that would only advertise them — it is simply not
 *    content, and pages with nothing on them drag on how a site is judged.
 *
 *  - **Crawl budget.** The filter rail on `/shop` takes sort, size, price
 *    bounds, sale and search, and those combine into thousands of URLs over
 *    the same eleven products. Left open, a crawler spends its visit walking
 *    permutations instead of reading the catalogue. Each parameter is closed
 *    by name so that `?category=`, the one facet that is a real collection
 *    page, stays open — it is in the sitemap and must remain crawlable.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api/",
          "/auth/",
          "/dashboard",
          "/wishlist",
          "/track",
          "/signin",
          "/signup",
          "/login",
          /* Faceted filters. The leading `/*` matches any path, the `?*`
             any position in the query string, so `?sort=` is closed whether
             it arrives first or after `?category=`. */
          "/*?*sort=",
          "/*?*size=",
          "/*?*min=",
          "/*?*max=",
          "/*?*sale=",
          "/*?*search=",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
