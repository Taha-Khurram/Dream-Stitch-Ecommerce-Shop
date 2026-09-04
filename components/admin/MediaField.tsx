"use client";

import React, { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { accessToken } from "@/lib/supabase/lazy-client";
import { uploadMaster } from "@/lib/supabase/media-upload";
import {
  ALLOWED_IMAGE_MIME,
  buildUploadPath,
  publicMediaUrl,
  validateMediaFile,
} from "@/lib/supabase/storage";
import { inputClass } from "@/components/admin/field-styles";
import { ImageGuidance } from "@/components/admin/MediaGuidance";
import { describeSpecKey, type ImageSpecKey } from "@/lib/media-specs";

/**
 * Upload controls for the places that store an image as a URL string —
 * category tiles, every `kind: "image"` field in the settings tabs, and the
 * product gallery list.
 *
 * These fields feed storefront `<img>` tags, so they take images only; video
 * belongs to `ProductMediaUploader`, which records it in `product_media` and
 * renders it as a `<video>`. Uploads land in the same `product-media` bucket
 * under `site/<field>/…`, which the storage policy admits alongside
 * `products/<id>/…`.
 *
 * The URL stays an editable text input throughout: an uploaded file just fills
 * it in. Pasting a URL from anywhere else keeps working exactly as before, and
 * the server actions never learn that any of this happened.
 */

const IMAGE_ACCEPT = ALLOWED_IMAGE_MIME.join(",");

/** Shared upload mechanics: one file at a time, into `folder`. */
function useImageUpload(folder: string) {
  const [percent, setPercent] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File): Promise<string | null> => {
      const check = validateMediaFile(file, ["image"]);
      if (!check.ok) {
        setError(check.reason);
        return null;
      }

      setError(null);
      setPercent(0);

      /* Fetches @supabase/supabase-js on first use. The user has just dropped
         a file, so this lands long before the upload it authorises. */
      const token = await accessToken();

      if (!token) {
        setError("Your session expired — sign in again");
        setPercent(null);
        return null;
      }

      const path = buildUploadPath(folder, file);

      try {
        await uploadMaster({
          file,
          path,
          accessToken: token,
          onProgress: (loaded, total) =>
            setPercent(total ? Math.round((loaded / total) * 100) : 0),
        }).done;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Upload failed");
        setPercent(null);
        return null;
      }

      setPercent(null);
      return publicMediaUrl(path);
    },
    [folder]
  );

  return { upload, percent, error, setError, busy: percent !== null };
}

function Thumb({ url, className = "" }: { url: string; className?: string }) {
  if (!url) {
    return (
      <span className={`flex items-center justify-center text-faint ${className}`}>
        <ImagePlus className="h-4 w-4" aria-hidden />
      </span>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img src={url} alt="" className={`h-full w-full object-cover object-center ${className}`} />
  );
}

/* ────────────────────────────────────────────────────────────────────────
   One image, one URL. Replaces the bare text box in the settings tabs and
   the category editor.
   ──────────────────────────────────────────────────────────────────────── */
export function MediaField({
  name,
  value,
  folder,
  spec,
  placeholder = "https://… or upload",
  compact = false,
}: {
  name: string;
  value: string;
  folder: string;
  /** Which storefront slot this fills — decides the size advice shown. */
  spec?: ImageSpecKey;
  placeholder?: string;
  /** Category editor: smaller preview, tighter type. */
  compact?: boolean;
}) {
  const [url, setUrl] = useState(value);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { upload, percent, error, setError, busy } = useImageUpload(folder);

  const take = async (file: File | undefined) => {
    if (!file) return;
    const uploaded = await upload(file);
    if (uploaded) setUrl(uploaded);
  };

  return (
    <div>
      <div className="flex items-start gap-3">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            void take(event.dataTransfer?.files?.[0]);
          }}
          onClick={() => !busy && input.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              input.current?.click();
            }
          }}
          aria-label="Upload an image"
          title={[ "Click or drop an image", describeSpecKey(spec) ]
            .filter(Boolean)
            .join(" — ")}
          className={`relative shrink-0 cursor-pointer overflow-hidden border bg-lilac transition-colors ${
            compact ? "h-12 w-16" : "h-16 w-24"
          } ${dragging ? "border-purple" : "border-line hover:border-faint"}`}
        >
          <Thumb url={url} />

          {busy && (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/85">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-purple" />
              <span className="text-[10px] tabular-nums text-muted">{percent}%</span>
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              id={name}
              name={name}
              value={url}
              onChange={(event) => {
                setUrl(event.target.value);
                setError(null);
              }}
              placeholder={placeholder}
              className={`${inputClass} ${compact ? "text-[12px]" : ""}`}
            />
            {url && (
              <button
                type="button"
                onClick={() => setUrl("")}
                aria-label="Clear this image"
                className="shrink-0 cursor-pointer p-1.5 text-faint transition-colors hover:text-sale"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="admin-hint mt-1.5 cursor-pointer underline underline-offset-2 transition-colors hover:text-purple disabled:cursor-wait"
          >
            {busy ? "Uploading…" : "Upload a file instead"}
          </button>

          <ImageGuidance spec={spec} className="mt-1.5" />

          {error && <p className="mt-1 text-[12px] text-sale">{error}</p>}
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        onChange={(event) => {
          void take(event.target.files?.[0]);
          event.target.value = "";
        }}
        className="hidden"
      />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   A compact button for rows that already have their own text input — the
   repeater's image columns.
   ──────────────────────────────────────────────────────────────────────── */
export function MediaUploadButton({
  folder,
  spec,
  onUploaded,
}: {
  folder: string;
  spec?: ImageSpecKey;
  onUploaded: (url: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const { upload, percent, error, busy } = useImageUpload(folder);

  return (
    <>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        title={error ?? describeSpecKey(spec) ?? "Upload an image"}
        aria-label="Upload an image"
        className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center border transition-colors disabled:cursor-wait ${
          error
            ? "border-sale text-sale"
            : "border-line text-muted hover:border-purple hover:text-purple"
        }`}
      >
        {busy ? (
          <span className="text-[10px] tabular-nums">{percent}</span>
        ) : (
          <ImagePlus className="h-4 w-4" />
        )}
      </button>

      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const url = await upload(file);
          if (url) onUploaded(url);
        }}
        className="hidden"
      />
    </>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   The product gallery: many images, order matters. Submits the same
   newline-separated string the textarea used to, so `saveProduct` is
   untouched.
   ──────────────────────────────────────────────────────────────────────── */
export function MediaListField({
  name,
  value,
  folder,
  spec,
}: {
  name: string;
  value: string[];
  folder: string;
  spec?: ImageSpecKey;
}) {
  const [urls, setUrls] = useState<string[]>(value);
  const [manual, setManual] = useState("");
  const [dragging, setDragging] = useState(false);
  const [queue, setQueue] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const { upload, percent, error, setError, busy } = useImageUpload(folder);

  /**
   * Sequential rather than parallel: these are usually two or three files, and
   * uploading them in order is what keeps the gallery in the order they were
   * dropped — which is the order the storefront renders.
   */
  const take = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;

    setQueue(list.length);
    for (const file of list) {
      const uploaded = await upload(file);
      if (uploaded) setUrls((current) => [...current, uploaded]);
      setQueue((left) => left - 1);
    }
    setQueue(0);
  };

  const move = (index: number, delta: number) =>
    setUrls((current) => {
      const next = [...current];
      const target = index + delta;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const addManual = () => {
    const trimmed = manual.trim();
    if (!trimmed) return;
    setUrls((current) => [...current, trimmed]);
    setManual("");
    setError(null);
  };

  return (
    <div>
      {/* What actually rides to the server — one URL per line, as before. */}
      <input type="hidden" name={name} value={urls.join("\n")} />

      {urls.length > 0 && (
        <ul className="mb-3 space-y-2">
          {urls.map((url, index) => (
            <li
              key={`${url}-${index}`}
              className="flex items-center gap-3 border border-line bg-white p-2"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden bg-lilac">
                <Thumb url={url} />
              </div>

              <span className="min-w-0 flex-1 truncate text-[12px] text-ink-soft">
                {url}
              </span>

              {index === 0 && (
                <span className="shrink-0 bg-lilac-deep px-2 py-0.5 text-[10px] tracking-wide text-ink uppercase">
                  Main
                </span>
              )}

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label="Move up"
                  className="cursor-pointer px-1.5 text-muted transition-colors hover:text-purple disabled:cursor-default disabled:opacity-35"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === urls.length - 1}
                  aria-label="Move down"
                  className="cursor-pointer px-1.5 text-muted transition-colors hover:text-purple disabled:cursor-default disabled:opacity-35"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setUrls((current) => current.filter((_, i) => i !== index))
                  }
                  aria-label="Remove this image"
                  className="cursor-pointer p-1 text-faint transition-colors hover:text-sale"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void take(event.dataTransfer?.files ?? null);
        }}
        onClick={() => !busy && input.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            input.current?.click();
          }
        }}
        aria-label="Add product images"
        className={`flex cursor-pointer flex-col items-center gap-1 border border-dashed px-4 py-6 text-center transition-colors ${
          dragging ? "border-purple bg-lilac" : "border-line bg-frost hover:border-faint"
        }`}
      >
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-purple" aria-hidden />
            <span className="text-[13px] tabular-nums text-ink">
              Uploading {percent}%
              {queue > 1 && <span className="text-muted"> · {queue} left</span>}
            </span>
          </>
        ) : (
          <>
            <ImagePlus className="h-4 w-4 text-faint" aria-hidden />
            <span className="text-[13px] text-ink">
              Drop images here or <span className="text-purple underline">browse</span>
            </span>
          </>
        )}
        <ImageGuidance spec={spec} className="mt-1 max-w-md" />

        <span className="admin-hint">
          Stored uncompressed. The first image is the main shot; the second drives
          the hover cross-fade.
        </span>

        <input
          ref={input}
          type="file"
          multiple
          accept={IMAGE_ACCEPT}
          onChange={(event) => {
            void take(event.target.files);
            event.target.value = "";
          }}
          onClick={(event) => event.stopPropagation()}
          className="hidden"
        />
      </div>

      {error && <p className="mt-1.5 text-[12px] text-sale">{error}</p>}

      <div className="mt-2 flex items-center gap-2">
        <input
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addManual();
            }
          }}
          placeholder="…or paste a URL"
          className={`${inputClass} text-[12px]`}
        />
        <button
          type="button"
          onClick={addManual}
          disabled={!manual.trim()}
          className="shrink-0 cursor-pointer border border-line px-3 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-purple hover:text-purple disabled:cursor-default disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}
