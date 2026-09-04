import type { CustomSize, CustomSizeUnit } from "@/types/ecommerce";

/**
 * Made-to-measure dimensions, in one place.
 *
 * The product page collects them, the cart carries them, `/api/checkout`
 * re-validates them and the admin order page reads them back — four surfaces
 * that have to agree on what a valid measurement is, so the bounds and the
 * formatting live here rather than being retyped at each one.
 */

/** The `size` recorded on a cart line and an order item cut to measurement. */
export const CUSTOM_SIZE_LABEL = "Custom";

/**
 * Sane bounds per unit. The floor keeps out a mis-keyed "8" and the ceiling a
 * mis-keyed "800" — both of which are a cutting-table problem, not a form one,
 * by the time anyone notices.
 */
export const CUSTOM_SIZE_LIMITS: Record<CustomSizeUnit, { min: number; max: number }> = {
  in: { min: 12, max: 200 },
  cm: { min: 30, max: 500 },
};

export const CUSTOM_SIZE_UNITS: { value: CustomSizeUnit; label: string }[] = [
  { value: "in", label: "Inches" },
  { value: "cm", label: "cm" },
];

export function isCustomSizeUnit(value: unknown): value is CustomSizeUnit {
  return value === "in" || value === "cm";
}

export type CustomSizeResult =
  | { ok: true; value: CustomSize }
  | { ok: false; message: string };

/**
 * Parse what the buyer typed. Returns the reason it is unusable rather than a
 * bare null, because the product page shows that reason back to them.
 *
 * Dimensions are held to 1 decimal place: half-inch precision is real on a
 * cutting table, four decimal places is a typo.
 */
export function parseCustomSize(
  width: unknown,
  height: unknown,
  unit: unknown
): CustomSizeResult {
  if (!isCustomSizeUnit(unit)) {
    return { ok: false, message: "Choose inches or centimetres." };
  }

  const limits = CUSTOM_SIZE_LIMITS[unit];
  const parsed = { width: toNumber(width), height: toNumber(height) };

  if (parsed.width === null || parsed.height === null) {
    return { ok: false, message: "Enter both a width and a height." };
  }

  for (const [label, value] of [
    ["Width", parsed.width],
    ["Height", parsed.height],
  ] as const) {
    if (value < limits.min || value > limits.max) {
      return {
        ok: false,
        message: `${label} must be between ${limits.min} and ${limits.max} ${unit}.`,
      };
    }
  }

  return {
    ok: true,
    value: {
      width: round1(parsed.width),
      height: round1(parsed.height),
      unit,
    },
  };
}

/** e.g. `82 × 78 in` — one rendering, used by the cart and the admin alike. */
export function formatCustomSize(size: CustomSize): string {
  return `${trimZero(size.width)} × ${trimZero(size.height)} ${size.unit}`;
}

/** The one conversion this store needs, between the two units it offers. */
const CM_PER_INCH = 2.54;

/** The unit the buyer did not order in — `"cm"` for an inches order, and back. */
export function otherUnit(unit: CustomSizeUnit): CustomSizeUnit {
  return unit === "in" ? "cm" : "in";
}

/**
 * The same measurement expressed in the other unit.
 *
 * The buyer measures with whichever tape they own; the cutting table has one.
 * Converting 82 × 78 in by hand at the table is a sum done in a hurry next to
 * a bolt of cotton, so the packing slip prints both figures and nobody does
 * the sum. Rounded to the same 1 decimal place an ordered measurement is held
 * to — more precision than that is not something anyone can cut to.
 */
export function convertCustomSize(size: CustomSize, unit: CustomSizeUnit): CustomSize {
  if (size.unit === unit) return size;

  const factor = unit === "cm" ? CM_PER_INCH : 1 / CM_PER_INCH;

  return {
    width: round1(size.width * factor),
    height: round1(size.height * factor),
    unit,
  };
}

/**
 * One dimension on its own, e.g. `82 in`.
 *
 * `82 × 78` is only unambiguous to whoever typed it. On the slip the two
 * numbers are split apart under the words Width and Height, which is why they
 * are formatted one at a time.
 */
export function formatDimension(value: number, unit: CustomSizeUnit): string {
  return `${trimZero(value)} ${unit}`;
}

/**
 * Rebuild a `CustomSize` from the four nullable `order_items` columns, so the
 * admin screens never have to null-check each one on their own.
 */
export function customSizeFromRow(row: {
  custom_width?: number | string | null;
  custom_height?: number | string | null;
  custom_unit?: string | null;
}): CustomSize | null {
  const width = toNumber(row.custom_width);
  const height = toNumber(row.custom_height);

  if (width === null || height === null || !isCustomSizeUnit(row.custom_unit)) {
    return null;
  }

  return { width, height, unit: row.custom_unit };
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function trimZero(value: number): string {
  return String(Math.round(value * 10) / 10);
}
