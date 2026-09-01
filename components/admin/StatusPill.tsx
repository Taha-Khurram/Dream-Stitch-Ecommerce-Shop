import React from "react";

/**
 * Order status as colour and shape, so the state reads at a glance.
 *
 * The dot carries the colour and the word carries the meaning: "pending" and
 * "processing" were previously two shades of the same purple at 9px, which is
 * not a distinction anyone can make while scanning a list.
 */
const STATUS_TONE: Record<string, { chip: string; dot: string }> = {
  pending: { chip: "border-line bg-white text-ink-soft", dot: "bg-faint" },
  processing: { chip: "border-purple/30 bg-lilac text-purple", dot: "bg-purple" },
  completed: { chip: "border-jade/30 bg-jade/10 text-jade", dot: "bg-jade" },
  cancelled: { chip: "border-sale/30 bg-sale/10 text-sale", dot: "bg-sale" },
};

export function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? {
    chip: "border-line bg-white text-ink-soft",
    dot: "bg-faint",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[12px] font-medium capitalize ${tone.chip}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      {status}
    </span>
  );
}
