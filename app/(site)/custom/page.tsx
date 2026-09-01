import React from "react";
import Link from "next/link";
import { getSettings } from "@/lib/api/settings";
import { getSiteContent } from "@/lib/api/content";
import { MessageCircle, Ruler, Scissors, Truck } from "lucide-react";

/**
 * Custom Demand — the made-to-measure service. This is the one thing the
 * high-street cannot match, so it gets its own route rather than a line in an
 * FAQ.
 *
 * Every string and picture on this page is editable from
 * `/admin/settings?tab=custom`; only the icons are fixed, in the order below.
 */
const STEP_ICONS = [Ruler, MessageCircle, Scissors];
const REASSURANCE_ICONS = [Scissors, Truck, Ruler];

export const dynamic = "force-dynamic";

export default async function CustomOrderPage() {
  const [settings, content] = await Promise.all([getSettings(), getSiteContent()]);
  const { hero, steps, request, reassurance } = content.custom;

  return (
    <div className="pb-8">
      {/* Hero */}
      {hero.enabled && (
        <section className="relative h-[320px] w-full overflow-hidden bg-lilac sm:h-[420px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hero.image}
            alt=""
            className="h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-purple/80" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="eyebrow text-white/75">{hero.eyebrow}</span>
            <h1 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-[36px] leading-tight text-white sm:text-[50px]">
              {hero.title}
            </h1>
            <p className="mt-5 max-w-lg text-[13px] leading-relaxed text-white/85">{hero.copy}</p>
          </div>
        </section>
      )}

      {/* How it works */}
      {steps.enabled && steps.items.length > 0 && (
        <section
          id="how-it-works"
          className="mx-auto max-w-[1500px] px-6 py-16 sm:py-20 xl:px-10 scroll-mt-28"
        >
          <div className="text-center">
            <span className="eyebrow text-purple">{steps.eyebrow}</span>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink sm:text-[38px]">
              {steps.title}
            </h2>
          </div>

          <ol
            className="mt-14 grid grid-cols-1 gap-px bg-line md:grid-cols-3"
            data-reveal-stagger
            suppressHydrationWarning
          >
            {steps.items.map((step, i) => {
              const Icon = STEP_ICONS[i % STEP_ICONS.length];
              return (
                <li key={step.title} className="bg-white p-8">
                  <div className="flex items-center gap-4">
                    <span className="font-[family-name:var(--font-display)] text-[30px] leading-none text-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Icon className="h-5 w-5 text-purple" strokeWidth={1.3} />
                  </div>
                  <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{step.copy}</p>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* Request CTA */}
      {request.enabled && (
        <section id="request" className="bg-lilac scroll-mt-28">
          <div className="mx-auto max-w-2xl px-6 py-16 text-center sm:py-20">
            <span className="eyebrow text-purple">{request.eyebrow}</span>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink sm:text-[38px]">
              {request.title}
            </h2>
            <p className="mx-auto mt-5 max-w-md text-[13px] leading-relaxed text-ink-soft">
              {request.copy}
            </p>
            {request.show_whatsapp && settings.brand_whatsapp && (
              <p className="mx-auto mt-3 max-w-md text-[12px] leading-relaxed text-muted">
                Prefer to talk it through? Message us on WhatsApp at {settings.brand_whatsapp}.
              </p>
            )}

            {request.cta_label && (
              <Link href={request.cta_href || "/shop"} className="btn-primary mt-9 inline-flex">
                {request.cta_label}
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Reassurance strip */}
      {reassurance.enabled && reassurance.items.length > 0 && (
        <section className="border-t border-line bg-frost">
          <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-px bg-line sm:grid-cols-3">
            {reassurance.items.map((point, i) => {
              const Icon = REASSURANCE_ICONS[i % REASSURANCE_ICONS.length];
              return (
                <div
                  key={point.title}
                  className="flex flex-col items-center gap-2 bg-frost px-6 py-10 text-center"
                >
                  <Icon className="h-5 w-5 text-purple" strokeWidth={1.3} />
                  <h3 className="eyebrow mt-1 text-ink">{point.title}</h3>
                  <p className="text-[12px] text-muted">{point.copy}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
