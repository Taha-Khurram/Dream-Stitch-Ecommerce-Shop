import React from "react";
import {
  IDEAL_IMAGE_KB,
  IMAGE_FORMATS,
  IMAGE_SPECS,
  describeSize,
  type ImageSpecKey,
} from "@/lib/media-specs";

/**
 * The "what should I upload here" line that sits under every image control.
 *
 * Deliberately a server component with no state: it is rendered inside client
 * uploaders, but it is only text, so it costs nothing on the wire beyond the
 * string itself.
 *
 * Two registers, because the fields sit in very different amounts of space:
 * `full` gets its own two lines under a drop zone, `inline` is one clause for a
 * repeater cell.
 */
export function ImageGuidance({
  spec: key,
  variant = "full",
  className = "",
}: {
  spec: ImageSpecKey | undefined;
  variant?: "full" | "inline";
  className?: string;
}) {
  if (!key) return null;

  const spec = IMAGE_SPECS[key];

  if (variant === "inline") {
    return (
      <span className={`admin-hint block ${className}`}>
        {describeSize(spec)} · {IMAGE_FORMATS}
      </span>
    );
  }

  return (
    <div className={`admin-hint ${className}`}>
      <p>
        <span className="font-medium text-ink-soft">Best size</span>{" "}
        <span className="tabular-nums">{describeSize(spec)}</span>
        {" · "}
        <span className="font-medium text-ink-soft">Formats</span> {IMAGE_FORMATS}
        {" · "}
        <span className="font-medium text-ink-soft">Ideally under</span>{" "}
        <span className="tabular-nums">{IDEAL_IMAGE_KB} KB</span>
      </p>
      <p className="mt-0.5">{spec.note}</p>
    </div>
  );
}
