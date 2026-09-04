"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Pause, Play, Trash2 } from "lucide-react";
import { deleteDiscount, setDiscountActive } from "@/app/admin/actions";
import { useConfirm } from "@/components/admin/ConfirmDialog";

/**
 * The two things the panel can do to one code from the list, in one component
 * because they are one row and it has to disable both while either is in
 * flight.
 *
 * Pausing sits next to deleting for the same reason unsubscribing sits next to
 * deleting a subscriber: only one of them is reversible, and the pair is what
 * makes the difference legible.
 *
 * - **Pause** stops the code being accepted and leaves everything else alone —
 *   its dates, and every redemption it has ever had. Switch it back on and it
 *   returns to the schedule it was written with.
 * - **Delete** removes the rule, and the ledger goes with it: the redemptions
 *   cascade, so the usage history for that code is gone. The orders are
 *   untouched and keep what they were charged. The confirm says so, because
 *   "delete the code that ran all summer" and "delete this typo" look
 *   identical from a row.
 */
export function DiscountRowActions({
  id,
  code,
  isActive,
  uses,
}: {
  id: string;
  code: string;
  isActive: boolean;
  /** All-time redemptions, so the confirm can say what deleting would lose. */
  uses: number;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();

  const run = (action: () => Promise<{ ok: boolean; message: string }>) => {
    setError(null);
    startTransition(async () => {
      const outcome = await action();
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      router.refresh();
    });
  };

  const erase = async () => {
    const confirmed = await confirm({
      title: `Delete ${code} permanently?`,
      body:
        uses > 0 ? (
          <p>
            This code has been used {uses === 1 ? "once" : `${uses} times`}. Deleting it removes
            those redemptions, so it disappears from every usage figure on the dashboard.
          </p>
        ) : (
          <p>This code has never been used, so nothing is lost by removing it.</p>
        ),
      hint:
        uses > 0
          ? "Pausing keeps the history and stops the code being accepted."
          : undefined,
      confirmLabel: "Delete code",
    });
    if (!confirmed) return;
    run(() => deleteDiscount(id));
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setDiscountActive(id, !isActive))}
          className={`flex shrink-0 cursor-pointer items-center gap-1.5 border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-wait disabled:opacity-50 ${
            isActive
              ? "border-line text-ink-soft hover:border-purple hover:bg-lilac hover:text-purple"
              : "border-jade/40 text-jade hover:bg-jade/10"
          }`}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : isActive ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          {isActive ? "Pause" : "Resume"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={erase}
          aria-label={`Delete ${code}`}
          className="flex shrink-0 cursor-pointer items-center border border-line p-1.5 text-muted transition-colors hover:border-sale hover:bg-sale/5 hover:text-sale disabled:cursor-wait disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {error && (
        <p role="status" className="flex items-start gap-1.5 text-right text-[11.5px] text-sale">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          {error}
        </p>
      )}

      {confirmDialog}
    </div>
  );
}
