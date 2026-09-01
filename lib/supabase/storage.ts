/**
 * Product media storage — the single source of truth for the `product-media`
 * bucket, shared by the uploader and by everything that renders a product.
 *
 * The contract this module exists to protect: **the uploaded file is the
 * master.** Nothing here compresses, re-encodes or resizes on the way in. What
 * lands in the bucket is the photographer's original, byte for byte, cached by
 * the Smart CDN for a year. Display-sized derivatives are asked for at read
 * time through `mediaImageSrc()`, which hits Supabase's render endpoint and
 * leaves the original untouched.
 *
 * Mirrors `product_media_schema.sql` — the MIME list and size ceiling below are
 * the same ones the bucket enforces server-side. Change them in both places.
 */

export const PRODUCT_MEDIA_BUCKET = "product-media";

export const ALLOWED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export const ALLOWED_VIDEO_MIME = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;

export const ALLOWED_MEDIA_MIME = [
  ...ALLOWED_IMAGE_MIME,
  ...ALLOWED_VIDEO_MIME,
] as const;

/** 100 MB — matches the bucket's `file_size_limit`. */
export const MAX_MEDIA_BYTES = 100 * 1024 * 1024;

/**
 * Above this, the uploader switches from a single request to TUS. 6 MB is
 * Supabase's resumable chunk size, so anything larger benefits from being
 * resumable and anything smaller would be one chunk anyway.
 */
export const RESUMABLE_THRESHOLD_BYTES = 6 * 1024 * 1024;

/** TUS requires exactly 6 MB chunks against Supabase. Not tunable. */
export const RESUMABLE_CHUNK_SIZE = 6 * 1024 * 1024;

/**
 * A year, in seconds. Object keys carry a timestamp so they are immutable —
 * a replaced shot is a new key — which makes an immutable cache header safe
 * and keeps repeat views entirely on the CDN edge.
 */
export const MEDIA_CACHE_SECONDS = "31536000";

export type MediaType = "image" | "video";

export function supabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return url.replace(/\/$/, "");
}

/** REST target for a one-shot upload: POST a body straight at the object key. */
export function storageObjectEndpoint(path: string): string {
  return `${supabaseUrl()}/storage/v1/object/${PRODUCT_MEDIA_BUCKET}/${encodeMediaPath(path)}`;
}

/** TUS creation endpoint. The bucket and key travel in upload metadata. */
export function storageResumableEndpoint(): string {
  return `${supabaseUrl()}/storage/v1/upload/resumable`;
}

export function mediaTypeFor(mime: string): MediaType | null {
  if ((ALLOWED_IMAGE_MIME as readonly string[]).includes(mime)) return "image";
  if ((ALLOWED_VIDEO_MIME as readonly string[]).includes(mime)) return "video";
  return null;
}

export function isResumable(file: File): boolean {
  return file.size > RESUMABLE_THRESHOLD_BYTES || mediaTypeFor(file.type) === "video";
}

export type MediaValidation =
  | { ok: true; mediaType: MediaType }
  | { ok: false; reason: string };

/**
 * Front-line validation. Deliberately duplicated by the bucket's own
 * allow-list: this one produces a sentence for a human, that one is the
 * security boundary.
 */
export function validateMediaFile(file: File): MediaValidation {
  const mediaType = mediaTypeFor(file.type);

  if (!mediaType) {
    return {
      ok: false,
      reason: file.type
        ? `${file.type} is not an accepted format`
        : "Unrecognised file type",
    };
  }

  if (file.size === 0) {
    return { ok: false, reason: "File is empty" };
  }

  if (file.size > MAX_MEDIA_BYTES) {
    return {
      ok: false,
      reason: `${formatBytes(file.size)} exceeds the ${formatBytes(MAX_MEDIA_BYTES)} limit`,
    };
  }

  return { ok: true, mediaType };
}

/**
 * Keep the original name legible in the key — it is what someone reads when
 * auditing the bucket — while stripping anything that would break a URL or
 * let a name climb out of its folder.
 */
export function sanitizeFileName(name: string): string {
  const lastDot = name.lastIndexOf(".");
  const stem = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot + 1) : "";

  const cleanStem =
    stem
      .normalize("NFKD")
      .replace(/[^\w\s.-]/g, "")
      .trim()
      .replace(/[\s_]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .toLowerCase()
      .slice(0, 80) || "file";

  const cleanExt = ext.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

  return cleanExt ? `${cleanStem}.${cleanExt}` : cleanStem;
}

/**
 * `products/{product_id}/{timestamp}-{sanitized}` — the product id partitions
 * the bucket, and the timestamp makes a collision require two uploads of the
 * same filename inside the same millisecond. Uploads are non-upsert, so even
 * that fails loudly rather than overwriting a master.
 */
export function buildMediaPath(productId: string, file: File): string {
  return `products/${productId}/${Date.now()}-${sanitizeFileName(file.name)}`;
}

/** Percent-encode each segment; the separators have to survive. */
function encodeMediaPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

/** The master asset, uncompressed, straight off the CDN. */
export function publicMediaUrl(path: string): string {
  return `${supabaseUrl()}/storage/v1/object/public/${PRODUCT_MEDIA_BUCKET}/${encodeMediaPath(path)}`;
}

export interface MediaTransform {
  width?: number;
  height?: number;
  /** 20-100. Defaults to 100 — visually lossless, still a smaller payload. */
  quality?: number;
  resize?: "cover" | "contain" | "fill";
}

/**
 * A display-sized rendering of an image master.
 *
 * The original is never modified: this is a CDN-side transformation, cached
 * per parameter set. Videos have no render endpoint, so callers should keep
 * using `publicMediaUrl()` for them — `productMediaSrc()` below picks for you.
 *
 * Note: image transformations are a paid-plan feature. On the free tier the
 * render URL 400s, so `productMediaSrc()` takes a `transform` flag you can
 * turn off project-wide from one place.
 */
export function mediaImageSrc(path: string, opts: MediaTransform = {}): string {
  const params = new URLSearchParams();
  if (opts.width) params.set("width", String(opts.width));
  if (opts.height) params.set("height", String(opts.height));
  params.set("quality", String(opts.quality ?? 100));
  if (opts.resize) params.set("resize", opts.resize);

  return `${supabaseUrl()}/storage/v1/render/image/public/${PRODUCT_MEDIA_BUCKET}/${encodeMediaPath(
    path
  )}?${params.toString()}`;
}

/**
 * What a component should call. Images get a sized rendering, video gets the
 * master, and `transform: false` falls back to masters everywhere.
 */
export function productMediaSrc(
  path: string,
  mediaType: MediaType,
  opts: MediaTransform & { transform?: boolean } = {}
): string {
  const { transform = true, ...rest } = opts;
  if (mediaType === "video" || !transform) return publicMediaUrl(path);
  return mediaImageSrc(path, rest);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  const mb = bytes / (1024 * 1024);
  return mb < 10 ? `${mb.toFixed(1)} MB` : `${mb.toFixed(0)} MB`;
}
