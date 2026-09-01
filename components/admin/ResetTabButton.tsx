"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import type { ActionResult } from "@/app/admin/actions";

/**
 * Puts one tab's copy, imagery and switches back to the values the site ships
 * with. Editing live copy with no way back is the one thing this screen could
 * do that a deploy cannot undo.
 */
export function ResetTabButton({
  tabKey,
  label,
  onReset,
}: {
  tabKey: string;
  label: string;
  onReset: (tabKey: string) => Promise<ActionResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Restore the ${label} tab to its original content?`)) return;
          setError(null);
          startTransition(async () => {
            const result = await onReset(tabKey);
            if (result.ok) router.refresh();
            else setError(result.message);
          });
        }}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 border border-line px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:border-sale hover:bg-sale/5 hover:text-sale disabled:opacity-50"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {pending ? "Restoring…" : "Restore defaults"}
      </button>
      {error && <p className="max-w-xs text-right text-[12px] text-sale">{error}</p>}
    </div>
  );
}
