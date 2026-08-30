import React from "react";
import { ActionForm, Field, inputClass } from "./ActionForm";
import { saveProduct } from "@/app/admin/actions";
import { CURRENCY } from "@/lib/format";
import { FILTER_SIZES } from "@/lib/constants";
import type { Category, Product } from "@/types/ecommerce";

/**
 * One form for create and edit — the only difference is the hidden id and
 * whether the fields arrive pre-filled.
 */
export function ProductForm({
  product,
  categories,
}: {
  product?: Product;
  categories: Category[];
}) {
  const editing = Boolean(product);

  return (
    <ActionForm
      action={saveProduct}
      submitLabel={editing ? "Save Changes" : "Create Product"}
      onSuccessRedirect="/admin/products"
    >
      {editing && <input type="hidden" name="id" value={product!.id} />}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Name" name="name">
          <input
            id="name"
            name="name"
            required
            defaultValue={product?.name}
            placeholder="Sahar Printed Pure Cotton King Bedsheet"
            className={inputClass}
          />
        </Field>

        <Field label="Slug" name="slug" hint="Leave blank to generate it from the name.">
          <input
            id="slug"
            name="slug"
            defaultValue={product?.slug}
            placeholder="sahar-printed-pure-cotton-king"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Description" name="description">
        <textarea
          id="description"
          name="description"
          rows={5}
          defaultValue={product?.description ?? ""}
          placeholder="What the set is, how it is cut, and how it behaves after a few washes."
          className={`${inputClass} resize-y`}
        />
      </Field>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        <Field label={`Price (${CURRENCY})`} name="price">
          <input
            id="price"
            name="price"
            required
            inputMode="decimal"
            defaultValue={product?.price}
            placeholder="6490"
            className={`${inputClass} tabular-nums`}
          />
        </Field>

        <Field
          label={`Compare at (${CURRENCY})`}
          name="compare_at_price"
          hint="Higher than price to show a markdown."
        >
          <input
            id="compare_at_price"
            name="compare_at_price"
            inputMode="decimal"
            defaultValue={product?.compare_at_price ?? ""}
            placeholder="7990"
            className={`${inputClass} tabular-nums`}
          />
        </Field>

        <Field label="Stock" name="stock" hint="0 shows the set as sold out.">
          <input
            id="stock"
            name="stock"
            inputMode="numeric"
            defaultValue={product?.stock ?? 0}
            className={`${inputClass} tabular-nums`}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Category" name="category_id">
          <select
            id="category_id"
            name="category_id"
            defaultValue={product?.category_id ?? ""}
            className={inputClass}
          >
            <option value="">— none —</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Fabric" name="fabric" hint="Shown above the product name.">
          <input
            id="fabric"
            name="fabric"
            defaultValue={product?.fabric ?? ""}
            placeholder="Pure Cotton"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Set includes" name="pieces">
          <input
            id="pieces"
            name="pieces"
            defaultValue={product?.pieces ?? ""}
            placeholder="1 bedsheet + 2 pillow covers"
            className={inputClass}
          />
        </Field>

        <Field
          label="Bed sizes"
          name="sizes"
          hint={`Comma separated. Recognised: ${FILTER_SIZES.join(", ")}.`}
        >
          <input
            id="sizes"
            name="sizes"
            defaultValue={product?.sizes?.join(", ") ?? ""}
            placeholder="King Size"
            className={inputClass}
          />
        </Field>
      </div>

      <Field
        label="Colourways"
        name="colors"
        hint="Comma separated. Names map to swatches; unknown names fall back to a neutral chip."
      >
        <input
          id="colors"
          name="colors"
          defaultValue={product?.colors?.join(", ") ?? ""}
          placeholder="Ivory, Lilac, Sage"
          className={inputClass}
        />
      </Field>

      <Field
        label="Images"
        name="images"
        hint="One URL per line. The first becomes the main shot; the second drives the hover cross-fade on product cards."
      >
        <textarea
          id="images"
          name="images"
          rows={4}
          defaultValue={(product?.images ?? []).join("\n")}
          placeholder={"https://…/front.jpg\nhttps://…/detail.jpg"}
          className={`${inputClass} resize-y font-[family-name:var(--font-sans)] text-[12px]`}
        />
      </Field>

      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          name="is_featured"
          defaultChecked={product?.is_featured ?? false}
          className="h-4 w-4 accent-[color:var(--color-purple)]"
        />
        <span className="text-[13px] text-ink">Featured</span>
        <span className="text-[11px] text-muted">Eligible for the homepage rails</span>
      </label>
    </ActionForm>
  );
}
