import { DEFAULT_CONTENT, type SiteContent } from "./defaults";

/**
 * Two walks over `DEFAULT_CONTENT`, both driven by the shape of the defaults
 * rather than by a schema kept alongside them:
 *
 *   `mergeContent` — a stored jsonb payload → a complete, typed `SiteContent`.
 *     Unknown keys are dropped and wrong types ignored, so a hand-edited row in
 *     Postgres can never make the storefront throw.
 *
 *   `parseContentForm` — an admin form post → the payload to store. A key the
 *     submitted form never rendered keeps its current value, which is what lets
 *     `/admin/settings` split content across one tab per page.
 */

type Leaf = string | boolean;
type Template = Record<string, Leaf>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Coerce one repeater row against element zero of the default array. Rows with
 * nothing typed into them are dropped rather than rendered as an empty card.
 */
function coerceRow(template: Template, value: unknown): Template | null {
  if (!isRecord(value)) return null;

  const out: Template = {};
  let filled = false;

  for (const [key, sample] of Object.entries(template)) {
    if (typeof sample === "boolean") {
      out[key] = value[key] === true || value[key] === "on";
      continue;
    }
    const text = typeof value[key] === "string" ? value[key] : "";
    out[key] = text;
    if (text.trim()) filled = true;
  }

  return filled ? out : null;
}

function mergeNode(def: unknown, stored: unknown): unknown {
  if (typeof def === "boolean") return typeof stored === "boolean" ? stored : def;
  if (typeof def === "string") return typeof stored === "string" ? stored : def;

  if (Array.isArray(def)) {
    if (!Array.isArray(stored)) return def;
    // An emptied list is a deliberate edit, so it survives the merge.
    if (typeof def[0] === "string") {
      return stored.filter((item): item is string => typeof item === "string" && item.trim() !== "");
    }
    return stored
      .map((item) => coerceRow(def[0] as Template, item))
      .filter((item): item is Template => item !== null);
  }

  if (isRecord(def)) {
    const source = isRecord(stored) ? stored : {};
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(def)) {
      out[key] = mergeNode(value, source[key]);
    }
    return out;
  }

  return def;
}

/** A stored payload (partial, stale or malformed) → complete site content. */
export function mergeContent(stored: unknown): SiteContent {
  return mergeNode(DEFAULT_CONTENT, stored) as SiteContent;
}

/** One value per line, blanks dropped — the announcement-bar convention. */
function lines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseNode(def: unknown, current: unknown, formData: FormData, path: string): unknown {
  if (typeof def === "boolean") {
    // Every switch ships a hidden "off" ahead of the checkbox, so an absent
    // field means "this form did not render the switch" and never "unchecked".
    const submitted = formData.getAll(path);
    if (submitted.length === 0) return typeof current === "boolean" ? current : def;
    return submitted[submitted.length - 1] === "on";
  }

  if (typeof def === "string") {
    if (!formData.has(path)) return typeof current === "string" ? current : def;
    return String(formData.get(path)).replace(/\r\n/g, "\n").trim();
  }

  if (Array.isArray(def)) {
    const raw = formData.get(path);
    if (raw === null) return Array.isArray(current) ? current : def;

    if (typeof def[0] === "string") return lines(String(raw));

    try {
      const rows: unknown = JSON.parse(String(raw));
      if (!Array.isArray(rows)) return Array.isArray(current) ? current : def;
      return rows
        .map((row) => coerceRow(def[0] as Template, row))
        .filter((row): row is Template => row !== null);
    } catch {
      // A mangled payload must not wipe the list it came from.
      return Array.isArray(current) ? current : def;
    }
  }

  if (isRecord(def)) {
    const source = isRecord(current) ? current : {};
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(def)) {
      out[key] = parseNode(value, source[key], formData, path ? `${path}.${key}` : key);
    }
    return out;
  }

  return def;
}

/**
 * Read an admin content form. `current` is the site's live content, so fields
 * this particular form did not render are carried through untouched.
 */
export function parseContentForm(formData: FormData, current: SiteContent): SiteContent {
  return parseNode(DEFAULT_CONTENT, current, formData, "") as SiteContent;
}
