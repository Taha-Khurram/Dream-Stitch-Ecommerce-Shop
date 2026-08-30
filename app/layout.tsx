import type { Metadata } from "next";
import { Jost, Prata } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Header } from "@/components/layout/Header";
import { BRAND } from "@/lib/constants";
import {
  Truck,
  RotateCcw,
  Scissors,
  Headphones,
  ArrowRight,
  Instagram,
  Facebook,
  Youtube,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";

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

export const metadata: Metadata = {
  title: `${BRAND.name} ${BRAND.suffix} | ${BRAND.tagline}`,
  description:
    "Premium bedsheets in pure cotton, cotton zeen and cotton satin. King and single sets in stock, or made to your exact measurements. Delivered nationwide.",
};

const SERVICES = [
  { icon: Truck, title: "Nationwide Delivery", copy: "Free above PKR 5,000" },
  { icon: RotateCcw, title: "7-Day Exchange", copy: "Unused, in original packing" },
  { icon: Scissors, title: "Any Size, Made to Order", copy: "Stitched to your measurements" },
  { icon: Headphones, title: "Customer Care", copy: "Mon–Sat, 9am – 9pm PKT" },
];

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
    <html lang="en" className={`${jost.variable} ${prata.variable}`}>
      <body className="flex min-h-screen flex-col bg-white text-ink antialiased">
        <CartProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <CartDrawer />

          <footer className="mt-20 border-t border-line">
            {/* Service promises */}
            <div className="border-b border-line bg-frost">
              <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-px bg-line px-0 lg:grid-cols-4">
                {SERVICES.map(({ icon: Icon, title, copy }) => (
                  <div
                    key={title}
                    className="flex flex-col items-center gap-2 bg-frost px-4 py-8 text-center"
                  >
                    <Icon className="h-5 w-5 text-purple" strokeWidth={1.3} />
                    <h4 className="eyebrow mt-1 text-ink">{title}</h4>
                    <p className="text-[11px] text-muted">{copy}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Newsletter */}
            <div className="border-b border-line bg-lilac">
              <div className="mx-auto flex max-w-[1500px] flex-col items-center gap-6 px-6 py-14 text-center lg:flex-row lg:justify-between lg:gap-16 lg:text-left xl:px-10">
                <div className="max-w-md">
                  <h3 className="font-[family-name:var(--font-display)] text-[26px] leading-tight text-ink">
                    First look, before anyone else
                  </h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                    New prints, restocks and the occasional quiet sale. One email, now and then —
                    never a flood.
                  </p>
                </div>

                <form className="flex w-full max-w-md items-center border-b border-ink" action="#">
                  <input
                    type="email"
                    placeholder="Your email address"
                    aria-label="Email address"
                    className="w-full bg-transparent py-3 text-[13px] text-ink placeholder-muted focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="eyebrow flex shrink-0 cursor-pointer items-center gap-1.5 py-3 pl-4 text-ink transition-colors hover:text-purple"
                  >
                    Subscribe <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </div>

            {/* Link columns */}
            <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-x-8 gap-y-10 px-6 py-14 md:grid-cols-4 lg:grid-cols-5 xl:px-10">
              <div className="col-span-2 lg:col-span-2">
                <span className="font-[family-name:var(--font-display)] text-2xl tracking-[0.3em] text-ink">
                  {BRAND.name}
                </span>
                <span className="mt-1 block text-[11px] tracking-[0.28em] text-muted uppercase">
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
