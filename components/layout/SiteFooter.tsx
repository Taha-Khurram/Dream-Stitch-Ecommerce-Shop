"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/constants";
import type { StoreSettings } from "@/types/ecommerce";
import { Instagram, Facebook, Youtube, MapPin, Phone, Mail } from "lucide-react";

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

/* ── Wordmark, the one thing the admin footer keeps ────────────────────── */
function Wordmark({ tone = "ink" }: { tone?: "ink" | "light" }) {
  const light = tone === "light";

  return (
    <Link href="/" className="inline-flex flex-col items-start leading-none">
      <span
        className={`font-[family-name:var(--font-script)] text-[38px] leading-[1.15] ${
          light ? "text-white" : "text-ink"
        }`}
      >
        {BRAND.name}
      </span>
      <span
        className={`mt-0.5 block text-[10px] uppercase tracking-[0.28em] ${
          light ? "text-white/60" : "text-muted"
        }`}
      >
        {BRAND.suffix}
      </span>
    </Link>
  );
}

/**
 * Storefront footer. Under `/admin` the shop links, contact block and legal bar
 * are all noise around a work surface, so the footer shrinks to the wordmark —
 * the same trim `Header` applies to the top of the page.
 */
export function SiteFooter({ settings }: { settings: StoreSettings }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/admin")) {
    return (
      <footer className="border-t border-line">
        <div className="mx-auto max-w-[1500px] px-6 py-10 xl:px-10">
          <Wordmark />
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-purple text-white">
      {/* Link columns */}
      <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-x-8 gap-y-10 px-6 py-14 md:grid-cols-4 lg:grid-cols-5 xl:px-10">
        <div className="col-span-2 lg:col-span-2">
          <Wordmark tone="light" />
          <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/75">
            Premium bedsheets in pure cotton, cotton zeen and cotton satin — cut, stitched
            and checked by hand in Karachi.
          </p>

          <ul className="mt-6 space-y-2.5 text-[12px] text-white/75">
            <li className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/55" strokeWidth={1.4} />
              <span className="max-w-[16rem]">{settings.brand_address}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="h-3.5 w-3.5 shrink-0 text-white/55" strokeWidth={1.4} />
              <span>{settings.brand_phone}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-white/55" strokeWidth={1.4} />
              <a href={`mailto:${settings.brand_email}`} className="link-rule">
                {settings.brand_email}
              </a>
            </li>
          </ul>

          <div className="mt-6 flex items-center gap-3">
            {[Instagram, Facebook, Youtube].map((Icon, i) => (
              <a
                key={i}
                href="#"
                aria-label="Social link"
                className="flex h-9 w-9 items-center justify-center border border-white/25 text-white transition-colors hover:border-white hover:bg-white hover:text-purple"
              >
                <Icon className="h-4 w-4" strokeWidth={1.4} />
              </a>
            ))}
          </div>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <div key={column.title}>
            <h4 className="eyebrow text-white">{column.title}</h4>
            <ul className="mt-5 space-y-3">
              {column.links.map((link) => (
                <li key={link.name}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-white/70 transition-colors hover:text-white"
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
      <div className="bg-aubergine">
        <div className="mx-auto flex max-w-[1500px] flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row xl:px-10">
          <p className="text-[11px] text-white/60">
            © {new Date().getFullYear()} {BRAND.name} {BRAND.suffix}. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="eyebrow text-white/45">Secure payments</span>
            <div className="flex items-center gap-2">
              {["VISA", "MASTER", "JAZZCASH", "EASYPAISA", "COD"].map((method) => (
                <span
                  key={method}
                  className="border border-white/25 px-2 py-1 text-[8px] font-medium tracking-[0.14em] text-white/75"
                >
                  {method}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
