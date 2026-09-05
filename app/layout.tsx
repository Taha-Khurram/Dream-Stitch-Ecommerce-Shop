import type { Metadata } from "next";
import { Jost, Prata, Great_Vibes } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/constants";
import { SITE_URL } from "@/lib/site-url";
import { RouteProgress } from "@/components/motion/RouteProgress";
import { SpeedInsights } from "@vercel/speed-insights/next";

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

const prata = Prata({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-prata",
  display: "swap",
});

/* Wordmark only — never body or headings. */
const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-great-vibes",
  display: "swap",
});

export const metadata: Metadata = {
  /* The origin every relative URL in a page's metadata is resolved against.
     Without it Next emits canonical tags and Open Graph image URLs as bare
     paths, which a crawler cannot follow — so a product's `alternates.canonical`
     would silently do nothing. */
  metadataBase: new URL(SITE_URL),
  title: `${BRAND.name} ${BRAND.suffix} | ${BRAND.tagline}`,
  description:
    "Premium bedsheets in pure cotton, cotton zeen and cotton satin. King and single sets in stock, or made to your exact measurements. Delivered nationwide.",
};

/**
 * Arms the scroll-reveal system before the first paint.
 *
 * This has to be a blocking inline script rather than an effect: the attribute
 * is what *hides* revealable content, so setting it from React would let the
 * page paint fully and then blink out. Running here means content is only ever
 * hidden if JS is actually available to bring it back.
 *
 * The failsafe matters more than it looks. If the observer never arms — a
 * chunk fails to load, a script error — the attribute is dropped and every
 * reveal falls back to plain visible content. The alternative is a blank
 * storefront, so the three seconds of insurance is worth the four lines.
 */
const ARM_REVEALS = `
(function () {
  try {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var d = document.documentElement;
    d.setAttribute("data-reveal-ready", "");
    setTimeout(function () {
      if (!d.hasAttribute("data-reveal-armed")) d.removeAttribute("data-reveal-ready");
    }, 3000);
  } catch (e) {}
})();
`;

/**
 * Only the document shell lives here. Site chrome (header, cart, footer) is
 * owned by the (site) group so the (auth) group can render a bare page.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jost.variable} ${prata.variable} ${greatVibes.variable}`}
      /* ARM_REVEALS stamps data-reveal-ready on this element before React
         reaches it; without this React reports it as a mismatch. */
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: ARM_REVEALS }} />
      </head>
      <body className="flex min-h-screen flex-col bg-white text-ink antialiased">
        {/* Navigation feedback sits above the route groups so the auth
            pages get it too. Renders nothing until a link is clicked. */}
        <RouteProgress />
        {children}
        {/* Real-user performance metrics. No-ops off Vercel. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
