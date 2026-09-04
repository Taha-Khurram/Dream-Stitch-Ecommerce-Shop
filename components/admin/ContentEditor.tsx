import React from "react";
import { inputClass } from "@/components/admin/field-styles";
import { Repeater } from "@/components/admin/Repeater";
import { MediaField } from "@/components/admin/MediaField";
import type {
  FieldSpec,
  OptionSource,
  SectionSpec,
  SelectOption,
  TabSpec,
} from "@/lib/content/fields";
import { siteFolder } from "@/lib/supabase/storage";
import type { SiteContent } from "@/lib/content/defaults";

/** Choices for every `select` column on a tab, by the source it named. */
export type EditorOptions = Partial<Record<OptionSource, SelectOption[]>>;

/**
 * Renders one tab of the content editor from its spec. Everything except the
 * repeaters and the image fields is plain HTML — the switches are CSS-only —
 * so a tab of forty fields ships client JavaScript only for the controls that
 * genuinely need it: reorderable lists, and anything that uploads.
 */
export function ContentEditor({
  tab,
  content,
  options,
}: {
  tab: TabSpec;
  content: SiteContent;
  /** Choices for `select` columns — see `tabOptionSources`. */
  options?: EditorOptions;
}) {
  return (
    <div className="space-y-10">
      {tab.sections.map((section, index) => (
        <ContentSection
          key={`${section.path}-${index}`}
          section={section}
          content={content}
          options={options}
        />
      ))}
    </div>
  );
}

function ContentSection({
  section,
  content,
  options,
}: {
  section: SectionSpec;
  content: SiteContent;
  options?: EditorOptions;
}) {
  const values = resolve(content, section.path);

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-3">
        <div>
          <h2 className="admin-section-title">{section.title}</h2>
          {section.copy && <p className="admin-hint mt-2">{section.copy}</p>}
        </div>

        {section.toggle && (
          <Switch
            name={`${section.path}.enabled`}
            checked={Boolean(values.enabled)}
            label={values.enabled ? "Visible" : "Hidden"}
          />
        )}
      </div>

      {section.toggleHint && (
        <p className="admin-hint mt-2">{section.toggleHint}</p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2">
        {section.fields.map((field) => (
          <ContentField
            key={field.key}
            field={field}
            name={`${section.path}.${field.key}`}
            value={values[field.key]}
            options={options}
          />
        ))}
      </div>
    </section>
  );
}

function ContentField({
  field,
  name,
  value,
  options,
}: {
  field: FieldSpec;
  name: string;
  value: unknown;
  options?: EditorOptions;
}) {
  if (field.kind === "switch") {
    return (
      <div className={field.hint ? "sm:col-span-2" : ""}>
        <Switch name={name} checked={Boolean(value)} label={field.label} />
        {field.hint && <p className="admin-hint mt-1.5">{field.hint}</p>}
      </div>
    );
  }

  const wide = field.kind !== "text" && field.kind !== "url" ? true : !field.half;

  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <label htmlFor={name} className="admin-label font-medium text-ink">
        {field.label}
      </label>

      <div className="mt-1.5">
        {field.kind === "list" ? (
          <Repeater
            name={name}
            columns={field.columns ?? []}
            rows={asRows(value)}
            addLabel={field.addLabel}
            options={options}
          />
        ) : field.kind === "lines" ? (
          <textarea
            id={name}
            name={name}
            rows={Math.min(Math.max(asLines(value).length + 1, 3), 8)}
            defaultValue={asLines(value).join("\n")}
            className={`${inputClass} resize-y`}
          />
        ) : field.kind === "textarea" ? (
          <textarea
            id={name}
            name={name}
            rows={3}
            defaultValue={String(value ?? "")}
            className={`${inputClass} resize-y`}
          />
        ) : field.kind === "image" ? (
          <MediaField
            key={`${name}:${String(value ?? "")}`}
            name={name}
            value={String(value ?? "")}
            folder={siteFolder(name)}
            spec={field.image}
          />
        ) : (
          <input
            id={name}
            name={name}
            defaultValue={String(value ?? "")}
            className={inputClass}
          />
        )}
      </div>

      {field.hint && <p className="admin-hint mt-1.5">{field.hint}</p>}
    </div>
  );
}

/**
 * CSS-only switch. The hidden "off" ahead of the checkbox is what tells the
 * server the field was on the form at all — see `parseContentForm`.
 */
function Switch({
  name,
  checked,
  label,
}: {
  name: string;
  checked: boolean;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input type="hidden" name={name} value="off" />
      <input type="checkbox" name={name} value="on" defaultChecked={checked} className="peer sr-only" />
      <span className="relative block h-5 w-9 shrink-0 border border-line bg-white transition-colors after:absolute after:left-[3px] after:top-1/2 after:h-3 after:w-3 after:-translate-y-1/2 after:bg-line after:transition-transform peer-checked:border-purple peer-checked:bg-purple peer-checked:after:translate-x-4 peer-checked:after:bg-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-purple" />
      <span className="text-[13px] font-medium text-ink-soft">{label}</span>
    </label>
  );
}

/* ── Reading the content tree ───────────────────────────────────────────── */

function resolve(content: SiteContent, path: string): Record<string, unknown> {
  const value = path
    .split(".")
    .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], content);

  if (value === undefined || value === null || typeof value !== "object") {
    // A spec pointing at nothing would render fields that save nowhere.
    throw new Error(`Content spec references a missing section: ${path}`);
  }

  return value as Record<string, unknown>;
}

function asRows(value: unknown): Record<string, string>[] {
  if (!Array.isArray(value)) return [];
  return value.map((row) =>
    Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, String(v ?? "")]))
  );
}

function asLines(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
