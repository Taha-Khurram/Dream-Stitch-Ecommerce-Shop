import React from "react";
import { previousSpan } from "@/lib/admin/range";

/**
 * How a tile has moved against the window before it.
 *
 * Server-rendered, like the tile it sits in. Every measure this is used on —
 * revenue, order count, basket size, new customers — is one where up is good,
 * so a single tone rule covers all four: jade for a rise, sale red for a fall,
 * muted for no real movement.
 *
 * Colour is never the only carrier. The arrow is decorative (a screen reader
 * announcing "black up-pointing triangle" helps nobody), so the direction is
 * also spelled out in a visually hidden word, and the window being compared
 * against is written out in full beside the figure rather than left to a
 * legend somewhere else on the page.
 */

interface Change {
  tone: "up" | "down" | "level";
  /** The chip's text, or null when there is nothing to put in a chip. */
  chip: string | null;
  /**
   * The direction, for a screen reader, when the chip alone does not say it.
   * "18%" needs it — the arrow carrying that meaning is decorative. "new" and
   * "level" already read as what they are, and prefixing them with a direction
   * would announce "up new".
   */
  spoken: string | null;
  /** The quiet line beside it. */
  note: string;
}

/**
 * Divide-by-zero is not an error case here, it is the interesting one: a store
 * that took nothing last week and something this week has not risen by an
 * infinite percentage, it has started. Both empty windows get no chip at all,
 * because "0%" would read as a measurement where there was nothing to measure.
 *
 * A move that rounds to zero percent is reported as level rather than as
 * "0%" — the arrow and the number would claim a direction the rounding just
 * threw away.
 */
function changeFrom(current: number, previous: number, days: number): Change {
  const span = previousSpan(days);

  if (previous <= 0) {
    if (current <= 0) {
      return { tone: "level", chip: null, spoken: null, note: `Nothing in either ${days}-day window` };
    }
    return { tone: "up", chip: "new", spoken: null, note: `Nothing in ${span}` };
  }

  const percent = Math.round(((current - previous) / previous) * 100);

  if (percent === 0) return { tone: "level", chip: "level", spoken: null, note: `vs ${span}` };

  return {
    tone: percent > 0 ? "up" : "down",
    chip: `${Math.abs(percent)}%`,
    spoken: percent > 0 ? "up" : "down",
    note: `vs ${span}`,
  };
}

const TONES: Record<Change["tone"], { chip: string; arrow: string | null }> = {
  up: { chip: "border-jade/30 bg-jade/10 text-jade", arrow: "▲" },
  down: { chip: "border-sale/30 bg-sale/10 text-sale", arrow: "▼" },
  level: { chip: "border-line bg-frost text-muted", arrow: null },
};

export function Delta({
  current,
  previous,
  days,
}: {
  current: number;
  previous: number;
  days: number;
}) {
  const change = changeFrom(current, previous, days);
  const tone = TONES[change.tone];

  return (
    <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
      {change.chip && (
        <span
          className={`inline-flex items-center gap-1 border px-1.5 py-0.5 text-[11px] font-medium tabular-nums ${tone.chip}`}
        >
          {tone.arrow && (
            <span aria-hidden className="text-[9px] leading-none">
              {tone.arrow}
            </span>
          )}
          {change.spoken && <span className="sr-only">{change.spoken} </span>}
          {change.chip}
        </span>
      )}
      <span className="admin-hint">{change.note}</span>
    </p>
  );
}
