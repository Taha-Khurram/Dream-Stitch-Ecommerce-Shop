import React from "react";

/** Order status as colour and shape, so the state reads at a glance. */
const STATUS_TONE: Record<string, string> = {
  pending: "bg-lilac text-purple",
  processing: "bg-purple/15 text-purple",
  completed: "bg-jade/15 text-jade",
  cancelled: "bg-sale/10 text-sale",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-block px-2 py-1 text-[9px] font-medium uppercase tracking-[0.14em] ${
        STATUS_TONE[status] ?? "bg-lilac text-ink-soft"
      }`}
    >
      {status}
    </span>
  );
}
