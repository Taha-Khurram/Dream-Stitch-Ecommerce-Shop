import React from "react";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { ActionForm, Field, inputClass } from "@/components/admin/ActionForm";
import { saveSettings } from "@/app/(site)/admin/actions";
import { getSettings } from "@/lib/api/settings";
import { CURRENCY } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div>
      <AdminHeading
        title="Settings"
        copy="Store-wide values the site reads at render time. Saving takes effect on the next page load — no deploy."
      />

      <div className="mt-8 max-w-3xl">
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
              visitors who prefer reduced motion.
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
      </div>
    </div>
  );
}
