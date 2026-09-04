import React from "react";
import { DISCOUNT_STATUS_COPY, type DiscountStatus } from "@/lib/discounts/lifecycle";

/**
 * Where a code stands, as colour and shape — on the same terms as `StatusPill`
 * for orders: the dot carries the colour, the word carries the meaning, and
 * the states are told apart by fill weight rather than by hue.
 *
 * `active` is the solid one here, and it is the opposite choice to the order
 * pills, where `new` is loud because it is a request for the admin to do
 * something. Nothing on this screen is asking for work. What the eye needs to
 * find down a list of coupons is the one that is *live right now* — the row
 * that is currently costing money — and everything else is history or
 * housekeeping.
 */
const STATUS_TONE: Record<DiscountStatus, { chip: string; dot: string }> = {
  active: { chip: "border-jade/40 bg-jade text-white", dot: "bg-white" },
  scheduled: { chip: "border-purple bg-white text-purple", dot: "bg-purple" },
  paused: { chip: "border-line bg-white text-ink-soft", dot: "bg-faint" },
  exhausted: { chip: "border-purple/30 bg-lilac text-purple", dot: "bg-purple" },
  expired: { chip: "border-line bg-white text-muted", dot: "bg-faint" },
};

export function DiscountStatusPill({ status }: { status: DiscountStatus }) {
  const tone = STATUS_TONE[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[12px] font-medium ${tone.chip}`}
      title={DISCOUNT_STATUS_COPY[status].note}
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      {DISCOUNT_STATUS_COPY[status].label}
    </span>
  );
}
