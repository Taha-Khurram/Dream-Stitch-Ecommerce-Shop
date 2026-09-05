import React, { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { ActionForm, Field } from "@/components/admin/ActionForm";
import { inputClass } from "@/components/admin/field-styles";
import { ContentEditor, type EditorOptions } from "@/components/admin/ContentEditor";
import { ResetTabButton } from "@/components/admin/ResetTabButton";
import { DateTimeField } from "@/components/admin/DateTimeField";
import { Switch } from "@/components/admin/Switch";
import { saveSettings, saveComingSoon, saveContent, resetContent } from "@/app/admin/actions";
import { getSettings } from "@/lib/api/settings";
import { isHoldingPageUp } from "@/lib/coming-soon";
import { getSiteContent } from "@/lib/api/content";
import { getCategories } from "@/lib/api/products";
import { CONTENT_TABS, findTab, tabOptionSources, type TabSpec } from "@/lib/content/fields";
import { CURRENCY } from "@/lib/format";
import { Skeleton } from "@/components/motion/Skeleton";

export const dynamic = "force-dynamic";

/**
 * The store-wide tabs. "General" is the landing tab, so it is the one with no
 * query string; anything else added here needs a branch in the switch below.
 */
const STORE_TABS = [
  { key: "general", label: "General" },
  { key: "coming-soon", label: "Coming soon" },
];

/** The store-wide tabs, plus one per surface the content editor covers. */
const TABS = [...STORE_TABS, ...CONTENT_TABS.map((tab) => ({
  key: tab.key,
  label: tab.label,
}))];

function tabHref(key: string) {
  return key === "general" ? "/admin/settings" : `/admin/settings?tab=${key}`;
}

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

      {/* The tabs read as one undifferentiated row, so they are grouped by
          what they actually change: the store's own details, versus the copy
          on one storefront page. */}
      <nav aria-label="Settings sections" className="mt-6 border-b border-line">
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2 pb-px">
          <span className="admin-th mr-2 py-2.5">Store</span>
          {STORE_TABS.map((tab) => (
            <TabLink key={tab.key} tab={tab} active={active} />
          ))}

          <span aria-hidden className="mx-3 hidden h-5 w-px bg-line sm:block" />

          <span className="admin-th mr-2 py-2.5">Page content</span>
          {TABS.slice(STORE_TABS.length).map((tab) => (
            <TabLink key={tab.key} tab={tab} active={active} />
          ))}
        </div>
      </nav>

      {/* The tab rail above is usable while the tab's own fields are still
          being read, so switching tabs never parks you on a blank screen. */}
      <div className="mt-8 max-w-3xl">
        <Suspense key={active} fallback={<FieldsSkeleton />}>
          {active === "general" ? (
            <GeneralSettings />
          ) : active === "coming-soon" ? (
            <ComingSoonSettings />
          ) : (
            <ContentSettings tabKey={active} />
          )}
        </Suspense>
      </div>
    </div>
  );
}

function FieldsSkeleton() {
  return (
    <div className="space-y-8" aria-hidden>
      {Array.from({ length: 3 }).map((_, section) => (
        <section key={section}>
          <Skeleton className="h-3 w-32" />
          <div className="mt-5 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, field) => (
              <div key={field}>
                <Skeleton className="h-2.5 w-20" />
                <Skeleton className="mt-2 h-10 w-full" />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TabLink({ tab, active }: { tab: { key: string; label: string }; active: string }) {
  const current = tab.key === active;

  return (
    <Link
      href={tabHref(tab.key)}
      aria-current={current ? "page" : undefined}
      className={`-mb-px border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${
        current
          ? "border-purple text-purple"
          : "border-transparent text-ink-soft hover:border-line hover:text-ink"
      }`}
    >
      {tab.label}
    </Link>
  );
}

/* ── General — the values that are not page copy ────────────────────────── */

async function GeneralSettings() {
  const settings = await getSettings();

  return (
    <ActionForm action={saveSettings} submitLabel="Save Settings">
      <section>
        <h2 className="admin-section-title border-b border-line pb-3">Contact</h2>
        <p className="admin-hint mt-2">
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
        <h2 className="admin-section-title border-b border-line pb-3">Delivery</h2>
        <p className="admin-hint mt-2">
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
        <h2 className="admin-section-title border-b border-line pb-3">Announcement bar</h2>
        <p className="admin-hint mt-2">
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

/* ── Coming soon — the pre-launch holding page ──────────────────────────── */

async function ComingSoonSettings() {
  const settings = await getSettings();
  const holding = isHoldingPageUp(settings);

  return (
    <div>
      {/* The switch alone does not answer "so is my shop up?" — a countdown
          that has already run out leaves it on and the shop open. This says
          which of the two is true right now. */}
      <p
        className={`flex items-start gap-2.5 border p-4 text-[13px] leading-relaxed ${
          holding ? "border-purple/30 bg-lilac text-ink" : "border-line bg-frost text-ink-soft"
        }`}
      >
        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${holding ? "bg-purple" : "bg-jade"}`} />
        {holding ? (
          <span>
            <strong className="font-medium">Visitors see the holding page.</strong> You do not —
            signed-in admins always get the real storefront, so you can check it before it opens.
          </span>
        ) : (
          <span>
            <strong className="font-medium">The storefront is open to everyone.</strong> Switch
            the holding page on below to close it.
          </span>
        )}
      </p>

      <div className="mt-8">
        <ActionForm action={saveComingSoon} submitLabel="Save Coming Soon">
          <section>
            <h2 className="admin-section-title border-b border-line pb-3">Holding page</h2>
            <p className="admin-hint mt-2">
              While this is on, every storefront page is replaced by the countdown. Sign-in and
              this panel stay reachable, so you can never lock yourself out.
            </p>

            <div className="mt-5">
              <Switch
                name="coming_soon_enabled"
                checked={settings.coming_soon_enabled}
                label="Show the coming soon page to visitors"
              />
            </div>

            <div className="mt-6">
              <Field
                label="Opens at"
                name="coming_soon_launch_at"
                hint="Your own local time. When this passes, the shop opens by itself — a visitor watching the timer just clicks the screen to come in. Leave it blank to hold the page until you switch it off."
              >
                <DateTimeField
                  name="coming_soon_launch_at"
                  defaultValue={settings.coming_soon_launch_at}
                />
              </Field>
            </div>
          </section>

          <section>
            <h2 className="admin-section-title border-b border-line pb-3">What it says</h2>
            <p className="admin-hint mt-2">
              The wordmark and the countdown are drawn for you. These are the words around them.
            </p>

            <div className="mt-5 space-y-6">
              <Field label="Heading" name="coming_soon_heading">
                <input
                  name="coming_soon_heading"
                  defaultValue={settings.coming_soon_heading}
                  className={inputClass}
                />
              </Field>

              <Field
                label="Message"
                name="coming_soon_message"
                hint="A line or two under the heading. Leave blank for heading and clock only."
              >
                <textarea
                  name="coming_soon_message"
                  rows={3}
                  defaultValue={settings.coming_soon_message}
                  className={`${inputClass} resize-y`}
                />
              </Field>

              <Field
                label="Small print"
                name="coming_soon_note"
                hint="Under the clock, while the shop is still shut — a phone number or an address, for anyone who needs you before opening day."
              >
                <input
                  name="coming_soon_note"
                  defaultValue={settings.coming_soon_note}
                  placeholder={`e.g. Orders and questions: ${settings.brand_whatsapp ?? ""}`}
                  className={inputClass}
                />
              </Field>

              <Field
                label="Button, once the timer ends"
                name="coming_soon_cta"
                hint="Replaces the small print the moment the countdown reaches zero. The whole screen is clickable too."
              >
                <input
                  name="coming_soon_cta"
                  defaultValue={settings.coming_soon_cta}
                  className={inputClass}
                />
              </Field>
            </div>
          </section>
        </ActionForm>
      </div>
    </div>
  );
}

/* ── One page's worth of copy, imagery and switches ─────────────────────── */

async function ContentSettings({ tabKey }: { tabKey: string }) {
  const tab = findTab(tabKey);
  if (!tab) notFound();

  const [content, options] = await Promise.all([getSiteContent(), editorOptions(tab)]);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <p className="max-w-xl text-sm leading-relaxed text-ink-soft">{tab.copy}</p>
        <ResetTabButton tabKey={tab.key} label={tab.label} onReset={resetContent} />
      </div>

      <div className="mt-8">
        <ActionForm action={saveContent} submitLabel="Save Changes">
          <ContentEditor tab={tab} content={content} options={options} />
        </ActionForm>
      </div>
    </div>
  );
}

/**
 * The live lists a tab's dropdowns need. Only the tabs that actually declare a
 * `select` column pay for the query — today that is the size guide, whose
 * charts are keyed to a category.
 */
async function editorOptions(tab: TabSpec): Promise<EditorOptions> {
  const sources = tabOptionSources(tab);
  if (!sources.includes("categories")) return {};

  const categories = await getCategories();
  return {
    categories: categories.map((category) => ({
      value: category.slug,
      label: category.name,
    })),
  };
}
