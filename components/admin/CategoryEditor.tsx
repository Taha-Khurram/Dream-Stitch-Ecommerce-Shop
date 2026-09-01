"use client";

import React, { useState } from "react";
import { ActionForm, DeleteButton, Field } from "./ActionForm";
import { inputClass } from "./field-styles";
import { saveCategory, deleteCategory } from "@/app/(site)/admin/actions";
import type { Category } from "@/types/ecommerce";
import { Plus, X } from "lucide-react";

/**
 * With three fabrics there is no call for a list page plus two form routes —
 * editing happens inline, and the add form is the same component with no row.
 */
function CategoryFields({ category }: { category?: Category }) {
  return (
    <>
      {category && <input type="hidden" name="id" value={category.id} />}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Name" name={`name-${category?.id ?? "new"}`}>
          <input
            name="name"
            required
            defaultValue={category?.name}
            placeholder="Pure Cotton"
            className={inputClass}
          />
        </Field>

        <Field label="Slug" name={`slug-${category?.id ?? "new"}`} hint="Blank generates it from the name.">
          <input
            name="slug"
            defaultValue={category?.slug}
            placeholder="pure-cotton"
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Description" name={`description-${category?.id ?? "new"}`}>
        <textarea
          name="description"
          rows={2}
          defaultValue={category?.description ?? ""}
          placeholder="Densely woven pure cotton that stays cool through summer."
          className={`${inputClass} resize-y`}
        />
      </Field>

      <Field
        label="Image URL"
        name={`image-${category?.id ?? "new"}`}
        hint="Used for the homepage tile and the shop banner."
      >
        <input
          name="image_url"
          defaultValue={category?.image_url ?? ""}
          placeholder="https://…"
          className={`${inputClass} text-[12px]`}
        />
      </Field>
    </>
  );
}

export function CategoryEditor({
  categories,
  counts,
}: {
  categories: Category[];
  counts: Record<string, number>;
}) {
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {categories.map((category) => {
        const open = openId === category.id;
        const count = counts[category.id] ?? 0;

        return (
          <div key={category.id} className="border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div className="flex min-w-0 items-center gap-4">
                <div className="h-14 w-12 shrink-0 overflow-hidden bg-lilac">
                  {category.image_url && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={category.image_url}
                      alt=""
                      className="h-full w-full object-cover object-center"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <h2 className="font-[family-name:var(--font-display)] text-lg text-ink">
                    {category.name}
                  </h2>
                  <p className="text-[11px] text-muted">
                    /{category.slug} · {count} product{count === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : category.id)}
                  className="cursor-pointer text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft transition-colors hover:text-purple"
                >
                  {open ? "Close" : "Edit"}
                </button>
                <DeleteButton
                  confirmMessage={`Delete “${category.name}”?`}
                  onDelete={() => deleteCategory(category.id)}
                />
              </div>
            </div>

            {open && (
              <div className="border-t border-line bg-frost p-5">
                <ActionForm action={saveCategory} submitLabel="Save Category">
                  <CategoryFields category={category} />
                </ActionForm>
              </div>
            )}
          </div>
        );
      })}

      {adding ? (
        <div className="border border-purple bg-white p-5">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="eyebrow text-purple">New category</h2>
            <button
              type="button"
              onClick={() => setAdding(false)}
              aria-label="Cancel"
              className="cursor-pointer text-muted hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ActionForm action={saveCategory} submitLabel="Create Category">
            <CategoryFields />
          </ActionForm>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex w-full cursor-pointer items-center justify-center gap-2 border border-dashed border-line py-5 text-[12px] font-medium uppercase tracking-[0.12em] text-muted transition-colors hover:border-purple hover:text-purple"
        >
          <Plus className="h-4 w-4" /> Add category
        </button>
      )}
    </div>
  );
}
