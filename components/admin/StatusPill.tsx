import React from "react";
import { statusLabel } from "@/lib/orders/lifecycle";

/**
 * Order status as colour and shape, so the state reads at a glance.
 *
 * The dot carries the colour and the word carries the meaning: "pending" and
 * "processing" were previously two shades of the same purple at 9px, which is
 * not a distinction anyone can make while scanning a list. The six statuses
 * are separated by fill weight rather than by hue — solid, outlined, tinted,
 * plain — so the pill itself shows roughly how far along an order is before
 * you read the label.
 *
 * `new` is the loud one on purpose: it is the only status that is a request
 * for the admin to do something, so it should be findable down a long table
 * without reading a single word.
 */
const STATUS_TONE: Record<string, { chip: string; dot: string }> = {
  new: { chip: "border-purple bg-purple text-white", dot: "bg-white" },
  opened: { chip: "border-purple bg-white text-purple", dot: "bg-purple" },
  pending: { chip: "border-line bg-white text-ink-soft", dot: "bg-faint" },
  processing: { chip: "border-purple/30 bg-lilac text-purple", dot: "bg-purple" },
  closed: { chip: "border-jade/30 bg-jade/10 text-jade", dot: "bg-jade" },
  cancelled: { chip: "border-sale/30 bg-sale/10 text-sale", dot: "bg-sale" },
  /* Pre-lifecycle spelling of `closed`. Kept so a row written before
     order_lifecycle.sql ran still renders in its own colour. */
  completed: { chip: "border-jade/30 bg-jade/10 text-jade", dot: "bg-jade" },
};

export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? {
    chip: "border-line bg-white text-ink-soft",
    dot: "bg-faint",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[12px] font-medium ${tone.chip}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      {statusLabel(status)}
    </span>
  );
}
