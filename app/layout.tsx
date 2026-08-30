import type { Metadata } from "next";
import { Jost, Prata, Great_Vibes } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Header } from "@/components/layout/Header";
import { BRAND } from "@/lib/constants";
import { Instagram, Facebook, Youtube, MapPin, Phone, Mail } from "lucide-react";

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
  title: `${BRAND.name} ${BRAND.suffix} | ${BRAND.tagline}`,
  description:
    "Premium bedsheets in pure cotton, cotton zeen and cotton satin. King and single sets in stock, or made to your exact measurements. Delivered nationwide.",
};

const FOOTER_COLUMNS = [
  {
    title: "Shop",
    links: [
      { name: "Pure Cotton", href: "/shop?category=pure-cotton" },
      { name: "Cotton Zeen", href: "/shop?category=cotton-zeen" },
      { name: "Cotton Satin", href: "/shop?category=cotton-satin" },
      { name: "King Size", href: "/shop?size=King%20Size" },
      { name: "Single Bed", href: "/shop?size=Single" },
    ],
  },
  {
    title: "Help",
    links: [
      { name: "Size Guide", href: "/custom" },
      { name: "Fabric Care", href: "/contact" },
      { name: "Delivery & Returns", href: "/contact" },
      { name: "Track Your Order", href: "/contact" },
      { name: "FAQs", href: "/contact" },
    ],
  },
  {
    title: "Dream Stitch",
    links: [
      { name: "Our Story", href: "/about" },
      { name: "Custom Orders", href: "/custom" },
      { name: "Contact Us", href: "/contact" },
      { name: "WhatsApp Us", href: "/contact" },
    ],
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jost.variable} ${prata.variable} ${greatVibes.variable}`}>
      <body className="flex min-h-screen flex-col bg-white text-ink antialiased">
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <CartDrawer />

          <footer className="border-t border-line">
            {/* Link columns */}
            <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-x-8 gap-y-10 px-6 py-14 md:grid-cols-4 lg:grid-cols-5 xl:px-10">
              <div className="col-span-2 lg:col-span-2">
                <span className="block font-[family-name:var(--font-script)] text-[38px] leading-[1.15] text-ink">
                  {BRAND.name}
                </span>
                <span className="mt-0.5 block text-[10px] uppercase tracking-[0.28em] text-muted">
                  {BRAND.suffix}
                </span>
                <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-ink-soft">
                  Premium bedsheets in pure cotton, cotton zeen and cotton satin — cut, stitched
                  and checked by hand in Karachi.
                </p>

                <ul className="mt-6 space-y-2.5 text-[12px] text-muted">
                  <li className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple" strokeWidth={1.4} />
                    <span className="max-w-[16rem]">{BRAND.address}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-purple" strokeWidth={1.4} />
                    <span>{BRAND.phone}</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Mail className="h-3.5 w-3.5 shrink-0 text-purple" strokeWidth={1.4} />
                    <a href={`mailto:${BRAND.email}`} className="link-rule">
                      {BRAND.email}
                    </a>
                  </li>
                </ul>

                <div className="mt-6 flex items-center gap-3">
                  {[Instagram, Facebook, Youtube].map((Icon, i) => (
                    <a
                      key={i}
                      href="#"
                      aria-label="Social link"
                      className="flex h-9 w-9 items-center justify-center border border-line text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white"
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.4} />
                    </a>
                  ))}
                </div>
              </div>

              {FOOTER_COLUMNS.map((column) => (
                <div key={column.title}>
                  <h4 className="eyebrow text-ink">{column.title}</h4>
                  <ul className="mt-5 space-y-3">
                    {column.links.map((link) => (
                      <li key={link.name}>
                        <Link
                          href={link.href}
                          className="text-[13px] text-ink-soft transition-colors hover:text-purple"
                        >
                          {link.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Legal bar */}
            <div className="border-t border-line bg-frost">
              <div className="mx-auto flex max-w-[1500px] flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row xl:px-10">
                <p className="text-[11px] text-muted">
                  © {new Date().getFullYear()} {BRAND.name} {BRAND.suffix}. All rights reserved.
                </p>
                <div className="flex items-center gap-4">
                  <span className="eyebrow text-faint">Secure payments</span>
                  <div className="flex items-center gap-2">
                    {["VISA", "MASTER", "JAZZCASH", "EASYPAISA", "COD"].map((method) => (
                      <span
                        key={method}
                        className="border border-line bg-white px-2 py-1 text-[8px] font-medium tracking-[0.14em] text-ink-soft"
                      >
                        {method}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </footer>
        </CartProvider>
      </body>
    </html>
  );
}
