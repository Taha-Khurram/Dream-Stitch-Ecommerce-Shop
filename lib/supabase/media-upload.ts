/**
 * Upload transport for product masters. Browser only.
 *
 * Two paths, one signature:
 *
 *   • Small images (≤ 6 MB) go up in a single request via XMLHttpRequest.
 *     Not `supabase.storage.upload()` — that call is fetch-based and exposes
 *     neither progress events nor abort, and this UI needs both. The request
 *     it builds is otherwise identical to what storage-js sends in a browser:
 *     multipart with a `cacheControl` field, so no custom request header has
 *     to survive CORS preflight.
 *
 *   • Video and anything over 6 MB go up with TUS, in 6 MB chunks, with a
 *     fingerprint cached in localStorage. A dropped connection resumes from
 *     the last completed chunk instead of restarting a 90 MB clip, and the
 *     same file re-dropped after a reload picks up where it stopped.
 *
 * Neither path transforms the bytes. The file object handed in is the file
 * object written to the bucket.
 */

import * as tus from "tus-js-client";
import {
  MEDIA_CACHE_SECONDS,
  PRODUCT_MEDIA_BUCKET,
  RESUMABLE_CHUNK_SIZE,
  isResumable,
  storageObjectEndpoint,
  storageResumableEndpoint,
} from "./storage";

/** Thrown into `done` when the caller cancels, so callers can tell it apart. */
export class UploadCancelledError extends Error {
  constructor() {
    super("Upload cancelled");
    this.name = "UploadCancelledError";
  }
}

export interface UploadHandle {
  /** Resolves once the object is committed; rejects on failure or cancel. */
  done: Promise<void>;
  cancel: () => void;
}

export interface UploadRequest {
  file: File;
  /** Object key inside the bucket, from `buildMediaPath()`. */
  path: string;
  /** The caller's Supabase session token — RLS runs as that user. */
  accessToken: string;
  onProgress?: (loaded: number, total: number) => void;
}

function anonKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  return key;
}

/** Pull the human-readable half out of a storage-api error body. */
function messageFrom(body: string, status: number): string {
  try {
    const parsed = JSON.parse(body) as { message?: string; error?: string };
    return parsed.message || parsed.error || `Upload failed (${status})`;
  } catch {
    return body?.slice(0, 200) || `Upload failed (${status})`;
  }
}

function uploadSingleRequest({
  file,
  path,
  accessToken,
  onProgress,
}: UploadRequest): UploadHandle {
  const xhr = new XMLHttpRequest();
  let cancelled = false;

  const done = new Promise<void>((resolve, reject) => {
    xhr.open("POST", storageObjectEndpoint(path), true);
    xhr.setRequestHeader("authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("apikey", anonKey());
    // Never overwrite a master. Keys carry a timestamp, so a collision means
    // something is wrong and should surface rather than destroy a file.
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded, event.total);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(file.size, file.size);
        resolve();
      } else {
        reject(new Error(messageFrom(xhr.responseText, xhr.status)));
      }
    };

    xhr.onerror = () =>
      reject(new Error("Network error — check your connection and retry"));
    xhr.ontimeout = () => reject(new Error("Upload timed out"));
    xhr.onabort = () =>
      reject(cancelled ? new UploadCancelledError() : new Error("Upload aborted"));

    // Mirrors storage-js's browser body exactly: cache lifetime as a form
    // field, the file under an empty field name.
    const form = new FormData();
    form.append("cacheControl", MEDIA_CACHE_SECONDS);
    form.append("", file);

    xhr.send(form);
  });

  return {
    done,
    cancel: () => {
      cancelled = true;
      xhr.abort();
    },
  };
}

function uploadResumable({
  file,
  path,
  accessToken,
  onProgress,
}: UploadRequest): UploadHandle {
  let upload: tus.Upload | undefined;
  let cancelled = false;
  // tus's `abort()` stops the upload without emitting onError, so cancelling
  // has to settle the promise itself.
  let settleCancelled: () => void = () => {};

  const done = new Promise<void>((resolve, reject) => {
    settleCancelled = () => reject(new UploadCancelledError());

    upload = new tus.Upload(file, {
      endpoint: storageResumableEndpoint(),
      // Back off through a network blip rather than failing the file.
      retryDelays: [0, 1000, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: anonKey(),
        "x-upsert": "false",
      },
      // Supabase requires exactly this chunk size.
      chunkSize: RESUMABLE_CHUNK_SIZE,
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      // Key the resume record on the object key, not on tus's default of
      // name+size+mtime. Otherwise re-uploading the same file under a new key
      // would resume the *old* upload URL and write the bytes to the old key,
      // leaving the caller recording a path nothing was written to.
      fingerprint: async () => `tus-${PRODUCT_MEDIA_BUCKET}-${path}`,
      metadata: {
        bucketName: PRODUCT_MEDIA_BUCKET,
        objectName: path,
        contentType: file.type,
        cacheControl: MEDIA_CACHE_SECONDS,
      },
      onProgress: (loaded, total) => onProgress?.(loaded, total),
      onSuccess: () => resolve(),
      onError: (error) =>
        reject(cancelled ? new UploadCancelledError() : error),
    });

    // A file re-dropped after a reload resumes instead of restarting.
    const started = upload;
    started
      .findPreviousUploads()
      .then((previous) => {
        if (previous.length > 0) started.resumeFromPreviousUpload(previous[0]);
        if (!cancelled) started.start();
      })
      .catch(() => {
        // No fingerprint store (private mode, storage disabled) — just start.
        if (!cancelled) started.start();
      });
  });

  return {
    done,
    cancel: () => {
      cancelled = true;
      // abort(false) leaves the server-side partial in place so a retry can
      // resume it. Supabase expires abandoned resumable uploads on its own.
      void upload?.abort(false);
      settleCancelled();
    },
  };
}

export function uploadMaster(request: UploadRequest): UploadHandle {
  return isResumable(request.file)
    ? uploadResumable(request)
    : uploadSingleRequest(request);
}
