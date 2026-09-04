import React from "react";
import { ActionForm, Field } from "./ActionForm";
import { SelectField } from "./SelectField";
import { DateTimeField } from "./DateTimeField";
import { inputClass } from "./field-styles";
import { saveDiscount } from "@/app/admin/actions";
import { CURRENCY } from "@/lib/format";
import { DISCOUNT_KINDS, KIND_COPY } from "@/lib/discounts/lifecycle";
import type { DiscountCode } from "@/types/ecommerce";

/**
 * One form for create and edit — the only difference is the hidden id and
 * whether the fields arrive pre-filled, the same arrangement as `ProductForm`.
 *
 * Three of these fields are limits, and all three are blank by default. Blank
 * means unlimited, which is what a house code usually is; spelling "no cap" as
 * a very large number would put a real edge into the data that nobody meant to
 * put there. The hints say so, because an empty numeric field is otherwise
 * easy to read as "not filled in yet".
 */
export function DiscountForm({ discount }: { discount?: DiscountCode }) {
  const editing = Boolean(discount);

  return (
    <ActionForm
      action={saveDiscount}
      submitLabel={editing ? "Save Changes" : "Create Code"}
      onSuccessRedirect="/admin/discounts"
    >
      {editing && <input type="hidden" name="id" value={discount!.id} />}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field
          label="Code"
          name="code"
          hint="Letters, digits, dashes and underscores. Upper-cased when it is saved."
        >
          <input
            id="code"
            name="code"
            required
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
            defaultValue={discount?.code}
            placeholder="SUMMER20"
            className={`${inputClass} tracking-[0.08em] uppercase`}
          />
        </Field>

        <Field label="Note" name="description" hint="For you, not for the customer.">
          <input
            id="description"
            name="description"
            maxLength={200}
            defaultValue={discount?.description ?? ""}
            placeholder="Eid campaign, printed on the insert card"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Field label="Takes off" name="kind">
          <SelectField
            id="kind"
            name="kind"
            defaultValue={discount?.kind ?? "percent"}
            placeholder="— pick one —"
            options={DISCOUNT_KINDS.map((kind) => ({ value: kind, label: KIND_COPY[kind].label }))}
          />
        </Field>

        <Field
          label="Amount"
          name="value"
          hint={`A percentage (1–100), or a flat sum in ${CURRENCY}.`}
        >
          <input
            id="value"
            name="value"
            required
            inputMode="decimal"
            defaultValue={discount?.value ?? ""}
            placeholder="20"
            className={`${inputClass} tabular-nums`}
          />
        </Field>

        <Field
          label={`Minimum bag (${CURRENCY})`}
          name="min_subtotal"
          hint="0 applies the code to any order."
        >
          <input
            id="min_subtotal"
            name="min_subtotal"
            inputMode="decimal"
            defaultValue={discount?.min_subtotal ?? 0}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Total uses" name="max_uses" hint="Blank for unlimited.">
          <input
            id="max_uses"
            name="max_uses"
            inputMode="numeric"
            defaultValue={discount?.max_uses ?? ""}
            placeholder="Unlimited"
            className={`${inputClass} tabular-nums`}
          />
        </Field>

        <Field
          label="Uses per customer"
          name="per_customer_limit"
          hint="Blank for unlimited. 1 makes it a one-per-person code."
        >
          <input
            id="per_customer_limit"
            name="per_customer_limit"
            inputMode="numeric"
            defaultValue={discount?.per_customer_limit ?? ""}
            placeholder="Unlimited"
            className={`${inputClass} tabular-nums`}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Starts" name="starts_at" hint="Your local time. Blank starts it now.">
          <DateTimeField name="starts_at" defaultValue={discount?.starts_at} />
        </Field>

        <Field label="Ends" name="expires_at" hint="Your local time. Blank never expires.">
          <DateTimeField name="expires_at" defaultValue={discount?.expires_at} />
        </Field>
      </div>

      <label className="flex cursor-pointer items-start gap-3 border border-line bg-frost p-4">
        <input
          type="checkbox"
          name="is_active"
          /* On for a new code: somebody filling in this form is making a
             coupon to use, and a fresh code that silently does nothing is the
             harder mistake to spot. */
          defaultChecked={discount?.is_active ?? true}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-purple)]"
        />
        <span>
          <span className="block text-sm font-medium text-ink">Active</span>
          <span className="admin-hint">
            Off pauses the code without touching its dates or its history
          </span>
        </span>
      </label>
    </ActionForm>
  );
}
