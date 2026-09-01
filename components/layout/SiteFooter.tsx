import Link from "next/link";
import { BRAND } from "@/lib/constants";
import type { StoreSettings } from "@/types/ecommerce";
import type { SiteContent } from "@/lib/content/defaults";
import { Instagram, Facebook, Youtube, MapPin, Phone, Mail } from "lucide-react";

/**
 * Storefront footer. Every block in it is switchable from
 * `/admin/settings?tab=footer`, and the whole thing is left out under `/admin`
 * by the layout rather than trimmed down here.
 */
export function SiteFooter({
  settings,
  content,
}: {
  settings: StoreSettings;
  content: SiteContent["footer"];
}) {
  const columns = groupLinks(content.links);
  const socials = [
    { Icon: Instagram, href: content.instagram_url, label: "Instagram" },
    { Icon: Facebook, href: content.facebook_url, label: "Facebook" },
    { Icon: Youtube, href: content.youtube_url, label: "YouTube" },
  ].filter((social) => social.href);

  return (
    <footer className="bg-purple text-white">
      {/* Link columns */}
      <div className="mx-auto grid max-w-[1500px] grid-cols-2 gap-x-8 gap-y-10 px-6 py-14 md:grid-cols-4 lg:grid-cols-5 xl:px-10">
        <div className="col-span-2 lg:col-span-2">
          <Wordmark />
          {content.blurb && (
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/75">
              {content.blurb}
            </p>
          )}

          {content.show_contact && (
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
          )}

          {content.show_social && socials.length > 0 && (
            <div className="mt-6 flex items-center gap-3">
              {socials.map(({ Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center border border-white/25 text-white transition-colors hover:border-white hover:bg-white hover:text-purple"
                >
                  <Icon className="h-4 w-4" strokeWidth={1.4} />
                </a>
              ))}
            </div>
          )}
        </div>

        {content.show_columns &&
          columns.map((column) => (
            <div key={column.title}>
              <h4 className="eyebrow text-white">{column.title}</h4>
              <ul className="mt-5 space-y-3">
                {column.links.map((link) => (
                  <li key={link.href + link.name}>
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
            © {new Date().getFullYear()} {BRAND.name} {BRAND.suffix}. {content.legal_note}
          </p>

          {content.show_payments && content.payments.length > 0 && (
            <div className="flex items-center gap-4">
              <span className="eyebrow text-white/45">{content.payments_label}</span>
              <div className="flex items-center gap-2">
                {content.payments.map((method) => (
                  <span
                    key={method}
                    className="border border-white/25 px-2 py-1 text-[8px] font-medium tracking-[0.14em] text-white/75"
                  >
                    {method}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}

/* ── Wordmark ───────────────────────────────────────────────────────────── */
function Wordmark() {
  return (
    <Link href="/" className="inline-flex flex-col items-start leading-none">
      <span className="font-[family-name:var(--font-script)] text-[38px] leading-[1.15] text-white">
        {BRAND.name}
      </span>
      <span className="mt-0.5 block text-[10px] uppercase tracking-[0.28em] text-white/60">
        {BRAND.suffix}
      </span>
    </Link>
  );
}

/**
 * Flat admin rows → the columns they render as. Both the column order and the
 * order within a column follow the list as it was entered.
 */
function groupLinks(links: SiteContent["footer"]["links"]) {
  const columns: { title: string; links: { name: string; href: string }[] }[] = [];

  for (const link of links) {
    if (!link.name || !link.href) continue;
    const title = link.column || BRAND.name;
    const column = columns.find((c) => c.title === title);
    if (column) column.links.push({ name: link.name, href: link.href });
    else columns.push({ title, links: [{ name: link.name, href: link.href }] });
  }

  return columns;
}
