import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { ActionForm, Field, inputClass } from "@/components/admin/ActionForm";
import { ContentEditor } from "@/components/admin/ContentEditor";
import { ResetTabButton } from "@/components/admin/ResetTabButton";
import { saveSettings, saveContent, resetContent } from "@/app/(site)/admin/actions";
import { getSettings } from "@/lib/api/settings";
import { getSiteContent } from "@/lib/api/content";
import { CONTENT_TABS, findTab } from "@/lib/content/fields";
import { CURRENCY } from "@/lib/format";

export const dynamic = "force-dynamic";

/** The store-wide tab, plus one per surface the content editor covers. */
const TABS = [{ key: "general", label: "General" }, ...CONTENT_TABS.map((tab) => ({
  key: tab.key,
  label: tab.label,
}))];

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: requested } = await searchParams;
  const active = requested ?? "general";

  if (!TABS.some((tab) => tab.key === active)) notFound();

  return (
    <div>
      <AdminHeading
        title="Settings"
        copy="Everything the storefront reads at render time — contact details, delivery rates, and the copy, imagery and switches behind each page. Saving takes effect on the next page load, no deploy."
      />

      <nav className="mt-6 flex flex-wrap gap-1 border-b border-line pb-px">
        {TABS.map((tab) => {
          const current = tab.key === active;
          return (
            <Link
              key={tab.key}
              href={tab.key === "general" ? "/admin/settings" : `/admin/settings?tab=${tab.key}`}
              aria-current={current ? "page" : undefined}
              className={`-mb-px border-b-2 px-3 py-2.5 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
                current
                  ? "border-purple text-purple"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 max-w-3xl">
        {active === "general" ? <GeneralSettings /> : <ContentSettings tabKey={active} />}
      </div>
    </div>
  );
}

/* ── General — the values that are not page copy ────────────────────────── */

async function GeneralSettings() {
  const settings = await getSettings();

  return (
    <ActionForm action={saveSettings} submitLabel="Save Settings">
      <section>
        <h2 className="eyebrow border-b border-line pb-3 text-ink">Contact</h2>
        <p className="mt-2 text-[12px] text-muted">
          Shown in the footer and on the contact page.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field label="Email" name="brand_email">
            <input
              name="brand_email"
              type="email"
              defaultValue={settings.brand_email ?? ""}
              className={inputClass}
            />
          </Field>

          <Field label="Phone" name="brand_phone">
            <input
              name="brand_phone"
              defaultValue={settings.brand_phone ?? ""}
              className={inputClass}
            />
          </Field>

          <Field label="WhatsApp" name="brand_whatsapp" hint="Shown on the custom order page.">
            <input
              name="brand_whatsapp"
              defaultValue={settings.brand_whatsapp ?? ""}
              className={inputClass}
            />
          </Field>

          <Field label="Address" name="brand_address">
            <input
              name="brand_address"
              defaultValue={settings.brand_address ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="eyebrow border-b border-line pb-3 text-ink">Delivery</h2>
        <p className="mt-2 text-[12px] text-muted">
          These drive the cart&apos;s free-delivery progress bar, the product page promise and
          the total recorded at checkout.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field
            label={`Free delivery above (${CURRENCY})`}
            name="free_shipping_threshold"
            hint="Set to 0 to make every order ship free."
          >
            <input
              name="free_shipping_threshold"
              inputMode="decimal"
              defaultValue={settings.free_shipping_threshold}
              className={`${inputClass} tabular-nums`}
            />
          </Field>

          <Field label={`Delivery fee (${CURRENCY})`} name="shipping_fee">
            <input
              name="shipping_fee"
              inputMode="decimal"
              defaultValue={settings.shipping_fee}
              className={`${inputClass} tabular-nums`}
            />
          </Field>
        </div>
      </section>

      <section>
        <h2 className="eyebrow border-b border-line pb-3 text-ink">Announcement bar</h2>
        <p className="mt-2 text-[12px] text-muted">
          The strip above the header. Lines cross-fade one at a time, and hold still for
          visitors who prefer reduced motion. Hide the strip itself from the Header tab.
        </p>

        <div className="mt-5">
          <Field label="Messages" name="announcements" hint="One per line. At least one.">
            <textarea
              name="announcements"
              rows={5}
              defaultValue={settings.announcements.join("\n")}
              className={`${inputClass} resize-y`}
            />
          </Field>
        </div>
      </section>
    </ActionForm>
  );
}

/* ── One page's worth of copy, imagery and switches ─────────────────────── */

async function ContentSettings({ tabKey }: { tabKey: string }) {
  const tab = findTab(tabKey);
  if (!tab) notFound();

  const content = await getSiteContent();

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-lg text-[13px] text-ink-soft">{tab.copy}</p>
        <ResetTabButton tabKey={tab.key} label={tab.label} onReset={resetContent} />
      </div>

      <div className="mt-8">
        <ActionForm action={saveContent} submitLabel="Save Changes">
          <ContentEditor tab={tab} content={content} />
        </ActionForm>
      </div>
    </div>
  );
}
