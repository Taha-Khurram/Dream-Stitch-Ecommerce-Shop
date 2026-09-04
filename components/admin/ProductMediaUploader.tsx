"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Film,
  Loader2,
  RotateCcw,
  Star,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { accessToken, browserClient } from "@/lib/supabase/lazy-client";
import { UploadCancelledError, uploadMaster } from "@/lib/supabase/media-upload";
import {
  ALLOWED_MEDIA_MIME,
  MAX_MEDIA_BYTES,
  PRODUCT_MEDIA_BUCKET,
  buildMediaPath,
  formatBytes,
  isResumable,
  productMediaSrc,
  publicMediaUrl,
  validateMediaFile,
  type MediaType,
} from "@/lib/supabase/storage";
import {
  IMAGE_FORMATS,
  IMAGE_SPECS,
  VIDEO_FORMATS,
  describeSize,
} from "@/lib/media-specs";
import type { ProductMedia } from "@/types/ecommerce";

/**
 * Product media manager for the admin panel.
 *
 * What it is careful about, in order of importance:
 *
 *  1. **The master is never touched.** No canvas, no re-encode, no resize. The
 *     File object the browser hands over is the body of the upload. Previews
 *     come from `URL.createObjectURL`, which reads the same bytes locally and
 *     costs nothing, so a 40 MB shot appears as a thumbnail the instant it is
 *     dropped while the upload is still starting.
 *  2. **Throughput.** Up to `maxParallel` files in flight at once through a
 *     worker pool, small images in one request, video and anything over 6 MB
 *     through TUS so a blip resumes instead of restarting.
 *  3. **Nothing is half-done.** A file becomes a `product_media` row only
 *     after its object is committed, and if that insert fails the object is
 *     deleted again rather than left orphaned in the bucket.
 *
 * Writes are the caller's own session, so the RLS policies in
 * `product_media_schema.sql` are the enforcement point — the validation here
 * exists to give a person a sentence instead of a 400.
 */

type QueueStatus = "queued" | "uploading" | "saving" | "done" | "error" | "cancelled";

interface QueueItem {
  key: string;
  file: File;
  /**
   * Object key, decided once at intake rather than per attempt: a retry has to
   * target the same key so a resumable upload can pick up its own partial.
   */
  path: string;
  /** Local blob URL — full quality, no network. Revoked on unmount. */
  previewUrl: string;
  mediaType: MediaType;
  resumable: boolean;
  status: QueueStatus;
  loaded: number;
  error?: string;
}

interface RejectedFile {
  key: string;
  name: string;
  reason: string;
}

const ACCEPT = ALLOWED_MEDIA_MIME.join(",");

let keySeed = 0;
const nextKey = () => `m${Date.now().toString(36)}-${keySeed++}`;

function byDisplayOrder(a: ProductMedia, b: ProductMedia): number {
  if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
  if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
  return a.created_at.localeCompare(b.created_at);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Upload failed";
}

export function ProductMediaUploader({
  productId,
  initialMedia,
  maxParallel = 4,
  /**
   * Render thumbnails through the CDN's transform endpoint. Leaves masters
   * untouched either way; turn it off on plans without Image Transformations
   * (a failed render also falls back to the master on its own).
   */
  useTransformations = true,
  onChange,
}: {
  productId: string;
  initialMedia?: ProductMedia[];
  maxParallel?: number;
  useTransformations?: boolean;
  onChange?: (media: ProductMedia[]) => void;
}) {

  const [attached, setAttached] = useState<ProductMedia[]>(
    () => [...(initialMedia ?? [])].sort(byDisplayOrder)
  );
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const handles = useRef(new Map<string, { cancel: () => void }>());
  const previews = useRef(new Set<string>());
  const fileInput = useRef<HTMLInputElement>(null);
  /** Cancelled before a worker reached them — there is no handle to abort. */
  const abandoned = useRef(new Set<string>());

  /** Next `sort_order` to hand out, and whether a primary already exists. */
  const sortCursor = useRef(0);
  const hasPrimary = useRef(false);

  /**
   * Uploads finish inside a pool, long after the render that started them, so
   * the list they append to has to come from a ref rather than a closure.
   */
  const attachedRef = useRef<ProductMedia[]>(attached);

  const syncCursors = useCallback((media: ProductMedia[]) => {
    sortCursor.current = media.reduce((max, m) => Math.max(max, m.sort_order + 1), 0);
    hasPrimary.current = media.some((m) => m.is_primary);
  }, []);

  const commit = useCallback(
    (next: ProductMedia[]) => {
      const sorted = [...next].sort(byDisplayOrder);
      syncCursors(sorted);
      attachedRef.current = sorted;
      setAttached(sorted);
      onChange?.(sorted);
    },
    [onChange, syncCursors]
  );

  // Load what is already attached unless the server handed it over.
  useEffect(() => {
    if (initialMedia) {
      syncCursors(attached);
      return;
    }

    let live = true;
    void (async () => {
      const supabase = await browserClient();
      const { data, error } = await supabase
        .from("product_media")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order");

      if (!live) return;
      if (error) {
        setNotice(`Could not load existing media: ${error.message}`);
        return;
      }
      const media = ((data ?? []) as ProductMedia[]).sort(byDisplayOrder);
      syncCursors(media);
      attachedRef.current = media;
      setAttached(media);
    })();

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Blob URLs outlive the component unless revoked explicitly.
  useEffect(
    () => () => {
      previews.current.forEach((url) => URL.revokeObjectURL(url));
      previews.current.clear();
      handles.current.forEach((handle) => handle.cancel());
      handles.current.clear();
    },
    []
  );

  const patch = useCallback((key: string, changes: Partial<QueueItem>) => {
    setQueue((items) =>
      items.map((item) => (item.key === key ? { ...item, ...changes } : item))
    );
  }, []);

  // ── Upload one file, then record it ────────────────────────────────────
  const uploadOne = useCallback(
    async (item: QueueItem, accessToken: string) => {
      if (abandoned.current.delete(item.key)) return;

      patch(item.key, { status: "uploading", loaded: 0, error: undefined });

      const path = item.path;

      const handle = uploadMaster({
        file: item.file,
        path,
        accessToken,
        onProgress: (loaded) => patch(item.key, { loaded }),
      });
      handles.current.set(item.key, handle);

      try {
        await handle.done;
      } catch (error) {
        handles.current.delete(item.key);
        if (error instanceof UploadCancelledError) {
          patch(item.key, { status: "cancelled", loaded: 0 });
        } else {
          patch(item.key, { status: "error", error: errorMessage(error) });
        }
        return;
      }
      handles.current.delete(item.key);

      patch(item.key, { status: "saving", loaded: item.file.size });

      // First image in becomes the primary shot; video never claims it.
      const isPrimary = !hasPrimary.current && item.mediaType === "image";

      const { data, error } = await (await browserClient())
        .from("product_media")
        .insert({
          product_id: productId,
          file_path: path,
          media_type: item.mediaType,
          sort_order: sortCursor.current,
          is_primary: isPrimary,
        })
        .select()
        .single();

      if (error || !data) {
        // The object is up but unreferenced — take it back out so the bucket
        // never accumulates masters nothing points at.
        await (await browserClient()).storage.from(PRODUCT_MEDIA_BUCKET).remove([path]);
        patch(item.key, {
          status: "error",
          error: error?.message ?? "Could not attach the file to this product",
        });
        return;
      }

      commit([...attachedRef.current, data as ProductMedia]);
      patch(item.key, { status: "done" });
    },
    [commit, patch, productId]
  );

  /**
   * Concurrency pool: `maxParallel` workers draining one shared queue via
   * `Promise.all`. Bounded on purpose — firing thirty uploads at once starves
   * each of them and trips storage-api's rate limiting.
   */
  const runPool = useCallback(
    async (items: QueueItem[]) => {
      if (items.length === 0) return;

      /* Loads @supabase/supabase-js on first use — see lib/supabase/lazy-client. */
      const token = await accessToken();

      if (!token) {
        items.forEach((item) =>
          patch(item.key, { status: "error", error: "Your session expired — sign in again" })
        );
        return;
      }

      const pending = [...items];
      const workers = Array.from(
        { length: Math.min(maxParallel, pending.length) },
        async () => {
          while (pending.length > 0) {
            const next = pending.shift();
            if (next) await uploadOne(next, token);
          }
        }
      );

      await Promise.all(workers);
    },
    [maxParallel, patch, uploadOne]
  );

  // ── Intake ─────────────────────────────────────────────────────────────
  const accept = useCallback(
    (files: FileList | File[] | null) => {
      const incoming = Array.from(files ?? []);
      if (incoming.length === 0) return;

      const accepted: QueueItem[] = [];
      const refused: RejectedFile[] = [];

      for (const file of incoming) {
        const check = validateMediaFile(file);
        if (!check.ok) {
          refused.push({ key: nextKey(), name: file.name, reason: check.reason });
          continue;
        }

        // Instant, full-quality preview — no decode, no upload wait.
        const previewUrl = URL.createObjectURL(file);
        previews.current.add(previewUrl);

        accepted.push({
          key: nextKey(),
          file,
          path: buildMediaPath(productId, file),
          previewUrl,
          mediaType: check.mediaType,
          resumable: isResumable(file),
          status: "queued",
          loaded: 0,
        });
      }

      if (refused.length > 0) setRejected((prev) => [...prev, ...refused]);
      if (accepted.length === 0) return;

      // Optimistic: the tiles are on screen before the first byte moves.
      setQueue((prev) => [...prev, ...accepted]);
      void runPool(accepted);
    },
    [productId, runPool]
  );

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragging(false);
    accept(event.dataTransfer?.files ?? null);
  };

  /**
   * Paste is bound to the document, not to the drop zone: a screenshot is
   * usually pasted without clicking anything first. Only events that actually
   * carry files are claimed, so pasting text into a form field is untouched.
   */
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (files && files.length > 0) {
        event.preventDefault();
        accept(files);
      }
    };

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [accept]);

  // ── Per-item controls ──────────────────────────────────────────────────
  const cancel = (key: string) => {
    const handle = handles.current.get(key);
    if (handle) {
      handle.cancel();
      handles.current.delete(key);
      return;
    }
    // Still waiting for a free worker: mark it so the pool skips it.
    abandoned.current.add(key);
    patch(key, { status: "cancelled", loaded: 0 });
  };

  const retry = (key: string) => {
    const item = queue.find((entry) => entry.key === key);
    if (!item) return;
    abandoned.current.delete(key);
    patch(key, { status: "queued", loaded: 0, error: undefined });
    void runPool([{ ...item, status: "queued", loaded: 0 }]);
  };

  const discard = (key: string) => {
    setQueue((items) => {
      const item = items.find((entry) => entry.key === key);
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
        previews.current.delete(item.previewUrl);
      }
      return items.filter((entry) => entry.key !== key);
    });
  };

  const clearFinished = () => {
    setQueue((items) => {
      items
        .filter((item) => item.status === "done" || item.status === "cancelled")
        .forEach((item) => {
          URL.revokeObjectURL(item.previewUrl);
          previews.current.delete(item.previewUrl);
        });
      return items.filter(
        (item) => item.status !== "done" && item.status !== "cancelled"
      );
    });
    setRejected([]);
  };

  /** Row first, then the object: a stray object is sweepable, a stray row renders as a hole. */
  const detach = async (media: ProductMedia) => {
    setBusyId(media.id);
    setNotice(null);

    const supabase = await browserClient();
    const { error } = await supabase.from("product_media").delete().eq("id", media.id);
    if (error) {
      setNotice(`Could not remove that file: ${error.message}`);
      setBusyId(null);
      return;
    }

    const { error: storageError } = await supabase.storage
      .from(PRODUCT_MEDIA_BUCKET)
      .remove([media.file_path]);

    if (storageError) {
      setNotice(
        "Removed from the product, but the file is still in storage — it will be swept later."
      );
    }

    commit(attachedRef.current.filter((entry) => entry.id !== media.id));
    setBusyId(null);
  };

  /** One UPDATE — the database trigger demotes the incumbent. */
  const makePrimary = async (media: ProductMedia) => {
    setBusyId(media.id);
    setNotice(null);

    const { error } = await (await browserClient())
      .from("product_media")
      .update({ is_primary: true })
      .eq("id", media.id);

    if (error) {
      setNotice(`Could not set the main image: ${error.message}`);
      setBusyId(null);
      return;
    }

    commit(
      attachedRef.current.map((entry) => ({
        ...entry,
        is_primary: entry.id === media.id,
      }))
    );
    setBusyId(null);
  };

  // ── Aggregate progress ─────────────────────────────────────────────────
  const live = queue.filter(
    (item) => item.status !== "cancelled" && item.status !== "error"
  );
  const totalBytes = live.reduce((sum, item) => sum + item.file.size, 0);
  const sentBytes = live.reduce((sum, item) => sum + item.loaded, 0);
  const totalPercent = totalBytes === 0 ? 0 : Math.round((sentBytes / totalBytes) * 100);
  const inFlight = queue.some(
    (item) => item.status === "uploading" || item.status === "saving" || item.status === "queued"
  );

  const thumbFor = (media: ProductMedia) =>
    productMediaSrc(media.file_path, media.media_type, {
      width: 320,
      height: 400,
      resize: "cover",
      transform: useTransformations,
    });

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium tracking-wide text-ink uppercase">
            Media library
          </h2>
          <p className="mt-1 text-sm text-muted">
            Video and full-resolution masters, tracked in <code>product_media</code>.
            The storefront gallery renders the <strong>Images</strong> list above; this
            is where footage and originals live. Up to {formatBytes(MAX_MEDIA_BYTES)} per
            file — {IMAGE_FORMATS} for stills, {VIDEO_FORMATS} for video.
          </p>
        </div>
        {attached.length > 0 && (
          <span className="text-sm tabular-nums text-faint">
            {attached.length} attached
          </span>
        )}
      </header>

      {notice && (
        <p
          role="status"
          className="flex items-start gap-2 border border-line bg-lilac px-3 py-2 text-sm text-ink-soft"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-sale" />
          {notice}
        </p>
      )}

      {/* ── Already attached ─────────────────────────────────────────── */}
      {attached.length > 0 && (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {attached.map((media) => (
            <li key={media.id} className="group relative border border-line bg-lilac">
              <div className="relative aspect-[4/5] overflow-hidden">
                {media.media_type === "video" ? (
                  <video
                    src={`${publicMediaUrl(media.file_path)}#t=0.1`}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={thumbFor(media)}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      // Transformations unavailable on this plan — show the master.
                      const img = event.currentTarget;
                      const master = publicMediaUrl(media.file_path);
                      if (img.src !== master) img.src = master;
                    }}
                    className="h-full w-full object-cover"
                  />
                )}

                {media.is_primary && (
                  <span className="absolute top-2 left-2 flex items-center gap-1 bg-purple px-2 py-1 text-[11px] tracking-wide text-white uppercase">
                    <Star className="h-3 w-3" /> Main
                  </span>
                )}
                {media.media_type === "video" && (
                  <span className="absolute top-2 right-2 bg-ink/80 p-1 text-white">
                    <Film className="h-3 w-3" />
                  </span>
                )}
                {busyId === media.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-white/70">
                    <Loader2 className="h-4 w-4 animate-spin text-purple" />
                  </span>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-line bg-white px-2 py-1.5">
                <button
                  type="button"
                  onClick={() => void makePrimary(media)}
                  disabled={media.is_primary || media.media_type === "video" || busyId !== null}
                  className="cursor-pointer text-[11px] tracking-wide text-muted uppercase transition-colors hover:text-purple disabled:cursor-default disabled:text-faint"
                >
                  {media.is_primary ? "Main image" : "Make main"}
                </button>
                <button
                  type="button"
                  onClick={() => void detach(media)}
                  disabled={busyId !== null}
                  aria-label="Remove this file"
                  className="cursor-pointer p-1 text-faint transition-colors hover:text-sale disabled:cursor-default"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ── Drop zone ────────────────────────────────────────────────── */}
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            fileInput.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label="Add product media"
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 border border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? "border-purple bg-lilac"
            : "border-line bg-frost hover:border-faint"
        }`}
      >
        <UploadCloud
          className={`h-6 w-6 ${dragging ? "text-purple" : "text-faint"}`}
          aria-hidden
        />
        <p className="text-sm text-ink">
          Drop files here, paste from the clipboard, or{" "}
          <span className="text-purple underline">browse</span>
        </p>
        <p className="text-xs text-muted">
          Several at a time — {maxParallel} upload in parallel, video resumes after a
          dropped connection
        </p>
        <p className="text-xs text-muted">
          <span className="font-medium text-ink-soft">Stills</span>{" "}
          <span className="tabular-nums">{describeSize(IMAGE_SPECS.product)}</span> or larger,
          cropped from the centre · {IMAGE_FORMATS}
          {" · "}
          <span className="font-medium text-ink-soft">Video</span> 1920 × 1080 or better,{" "}
          {VIDEO_FORMATS}
        </p>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={(event) => {
            accept(event.target.files);
            event.target.value = "";
          }}
          onClick={(event) => event.stopPropagation()}
          className="hidden"
        />
      </div>

      {/* ── Refused before any bytes moved ───────────────────────────── */}
      {rejected.length > 0 && (
        <ul className="space-y-1">
          {rejected.map((file) => (
            <li
              key={file.key}
              className="flex items-center gap-2 border border-line bg-white px-3 py-2 text-sm"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-sale" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
              <span className="text-muted">{file.reason}</span>
              <button
                type="button"
                onClick={() =>
                  setRejected((prev) => prev.filter((entry) => entry.key !== file.key))
                }
                aria-label="Dismiss"
                className="cursor-pointer p-1 text-faint hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Queue ────────────────────────────────────────────────────── */}
      {queue.length > 0 && (
        <div className="space-y-3 border border-line bg-white p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink">
                  {inFlight ? "Uploading" : "Upload complete"}
                </span>
                <span className="tabular-nums text-muted">
                  {formatBytes(sentBytes)} of {formatBytes(totalBytes)} · {totalPercent}%
                </span>
              </div>
              <div className="mt-2 h-1 w-full bg-lilac-deep">
                <div
                  role="progressbar"
                  aria-valuenow={totalPercent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Total upload progress"
                  style={{ width: `${totalPercent}%` }}
                  className="h-full bg-purple transition-[width] duration-200"
                />
              </div>
            </div>
            {!inFlight && (
              <button
                type="button"
                onClick={clearFinished}
                className="cursor-pointer text-[11px] tracking-wide text-muted uppercase hover:text-purple"
              >
                Clear
              </button>
            )}
          </div>

          <ul className="divide-y divide-line-soft">
            {queue.map((item) => {
              const percent =
                item.status === "done" || item.status === "saving"
                  ? 100
                  : item.file.size === 0
                    ? 0
                    : Math.round((item.loaded / item.file.size) * 100);

              return (
                <li key={item.key} className="flex items-center gap-3 py-3">
                  <div className="relative h-14 w-11 shrink-0 overflow-hidden bg-lilac">
                    {item.mediaType === "video" ? (
                      <video
                        src={`${item.previewUrl}#t=0.1`}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={item.previewUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm text-ink">{item.file.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        {formatBytes(item.file.size)}
                        {item.resumable && (
                          <span className="ml-1 text-faint" title="Resumable upload">
                            · TUS
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="mt-1.5 h-1 w-full bg-lilac">
                      <div
                        role="progressbar"
                        aria-valuenow={percent}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={`${item.file.name} upload progress`}
                        style={{ width: `${percent}%` }}
                        className={`h-full transition-[width] duration-200 ${
                          item.status === "error"
                            ? "bg-sale"
                            : item.status === "done"
                              ? "bg-jade"
                              : "bg-purple"
                        }`}
                      />
                    </div>

                    <p className="mt-1 flex items-center gap-1.5 text-xs">
                      {item.status === "queued" && <span className="text-muted">Queued</span>}
                      {item.status === "uploading" && (
                        <span className="tabular-nums text-muted">{percent}%</span>
                      )}
                      {item.status === "saving" && (
                        <span className="flex items-center gap-1 text-muted">
                          <Loader2 className="h-3 w-3 animate-spin" /> Attaching
                        </span>
                      )}
                      {item.status === "done" && (
                        <span className="flex items-center gap-1 text-jade">
                          <Check className="h-3 w-3" /> Stored at full quality
                        </span>
                      )}
                      {item.status === "cancelled" && (
                        <span className="text-muted">Cancelled</span>
                      )}
                      {item.status === "error" && (
                        <span className="text-sale">{item.error}</span>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    {(item.status === "uploading" || item.status === "queued") && (
                      <button
                        type="button"
                        onClick={() => cancel(item.key)}
                        aria-label={`Cancel ${item.file.name}`}
                        className="cursor-pointer p-1.5 text-faint transition-colors hover:text-sale"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {(item.status === "error" || item.status === "cancelled") && (
                      <>
                        <button
                          type="button"
                          onClick={() => retry(item.key)}
                          aria-label={`Retry ${item.file.name}`}
                          className="cursor-pointer p-1.5 text-faint transition-colors hover:text-purple"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => discard(item.key)}
                          aria-label={`Discard ${item.file.name}`}
                          className="cursor-pointer p-1.5 text-faint transition-colors hover:text-ink"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
