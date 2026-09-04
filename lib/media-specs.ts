/**
 * What an image should be *before* it is uploaded — dimensions, aspect and
 * format — for every place in the admin that takes one.
 *
 * These fields feed storefront `<img>` tags that render the master exactly as
 * uploaded (`publicMediaUrl`, no render endpoint in the way), so both halves of
 * the advice matter: the aspect decides how much of the picture survives
 * `object-cover`, and the weight is what a visitor actually downloads.
 *
 * Every number below is read off the container that renders it. If a
 * storefront section is re-laid-out, the spec here is what needs updating with
 * it — grep for the key.
 *
 * The format list is derived from `storage.ts` rather than restated, so the
 * bucket's allow-list and what the admin promises cannot drift apart.
 */

import { ALLOWED_IMAGE_MIME, ALLOWED_VIDEO_MIME } from "@/lib/supabase/storage";

export interface ImageSpec {
  /** Recommended master width, in pixels. */
  width: number;
  height: number;
  /** Where it lands, and what the crop does to it. */
  note: string;
}

/**
 * Ideal weight for anything in this family. Not a limit — the bucket accepts
 * far more (see `MAX_MEDIA_BYTES`) — but past roughly this the storefront
 * starts paying for it on every view, because nothing resizes these on the way
 * out.
 */
export const IDEAL_IMAGE_KB = 500;

export const IMAGE_SPECS = {
  /** Product gallery: `aspect-[4/5]` in the card, the hover swap and the PDP. */
  product: {
    width: 1600,
    height: 2000,
    note: "Portrait. The grid, the hover swap and the product gallery all crop 4:5 from the centre.",
  },

  /** Category tile — `aspect-[4/5]` on the homepage, cropped flat on the shop banner. */
  categoryTile: {
    width: 1600,
    height: 2000,
    note: "Portrait for the homepage tile. The shop banner crops the middle strip out of the same picture, so keep the subject centred.",
  },

  /** A portrait picture set beside copy, e.g. the About values block. */
  portrait: {
    width: 1200,
    height: 1500,
    note: "Portrait, sits beside the copy at 4:5.",
  },

  /** Home hero carousel: full-bleed, 520–760px tall. */
  heroSlide: {
    width: 2400,
    height: 1350,
    note: "Full-bleed behind the slide copy and tall on phones — keep the subject centred and detail away from the edges.",
  },

  /** The tall full-bleed CTA bands (home custom banner, About closing). */
  wideBanner: {
    width: 2400,
    height: 1000,
    note: "Full-bleed under a colour wash, so texture reads better than fine detail.",
  },

  /** Page hero bands: About, Custom orders, Contact. */
  pageHero: {
    width: 2400,
    height: 900,
    note: "A full-width band behind the page heading. Only the middle survives the crop.",
  },

  /** Shop collection banner — the shortest strip on the storefront. */
  shopBanner: {
    width: 2400,
    height: 600,
    note: "A short full-width strip. Used only when the category has no image of its own.",
  },
} as const satisfies Record<string, ImageSpec>;

export type ImageSpecKey = keyof typeof IMAGE_SPECS;

/** File extensions as a person writes them, keyed by the MIME the bucket takes. */
const FORMAT_LABELS: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/avif": "AVIF",
  "video/mp4": "MP4",
  "video/webm": "WebM",
  "video/quicktime": "MOV",
};

function labelFormats(mimes: readonly string[]): string {
  return mimes.map((mime) => FORMAT_LABELS[mime] ?? mime).join(", ");
}

/** "JPG, PNG, WebP, AVIF" — whatever `ALLOWED_IMAGE_MIME` currently holds. */
export const IMAGE_FORMATS = labelFormats(ALLOWED_IMAGE_MIME);

/** "MP4, WebM, MOV" */
export const VIDEO_FORMATS = labelFormats(ALLOWED_VIDEO_MIME);

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** `1600 × 2000` in the reduced form someone can compare a file against: `4:5`. */
export function aspectRatio(width: number, height: number): string {
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

/** "1600 × 2000 px (4:5)" */
export function describeSize(spec: ImageSpec): string {
  return `${spec.width} × ${spec.height} px (${aspectRatio(spec.width, spec.height)})`;
}

/** The whole thing on one line, for a `title` tooltip or a cramped cell. */
export function describeSpec(spec: ImageSpec): string {
  return `Best at ${describeSize(spec)} · ${IMAGE_FORMATS} · under ${IDEAL_IMAGE_KB} KB`;
}

/**
 * The same line from a key that may be missing. A field nobody has mapped to a
 * storefront slot yet gets no advice rather than invented advice — the controls
 * treat `undefined` as "say nothing".
 */
export function describeSpecKey(key: ImageSpecKey | undefined): string | undefined {
  return key ? describeSpec(IMAGE_SPECS[key]) : undefined;
}
