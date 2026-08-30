"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/app/admin/actions";
import { Check, AlertCircle, Loader2 } from "lucide-react";

const STATUSES = ["pending", "processing", "completed", "cancelled"] as const;

export function OrderStatusControl({ id, current }: { id: string; current: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const router = useRouter();

  const move = (status: string) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await updateOrderStatus(id, status);
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            disabled={pending || status === current}
            onClick={() => move(status)}
            className={`cursor-pointer border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors disabled:cursor-default ${
              status === current
                ? "border-purple bg-purple text-white"
                : "border-line text-ink-soft hover:border-purple hover:text-purple disabled:opacity-50"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {pending && (
        <p className="flex items-center gap-2 text-[12px] text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
        </p>
      )}

      {result && !pending && (
        <p
          role="status"
          className={`flex items-center gap-2 text-[12px] ${result.ok ? "text-jade" : "text-sale"}`}
        >
          {result.ok ? (
            <Check className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          {result.message}
        </p>
      )}
    </div>
  );
}
