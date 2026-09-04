"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/app/admin/actions";
import { STATUS_COPY, WORKFLOW_STATUSES } from "@/lib/orders/lifecycle";
import { Check, AlertCircle, Loader2 } from "lucide-react";

/**
 * The status track an accepted order moves along.
 *
 * Only reachable once an order has been accepted — `new` is not in
 * `WORKFLOW_STATUSES`, so there is no button that puts an order back to
 * awaiting review, and the server refuses it anyway. The stages are listed in
 * lifecycle order rather than alphabetically, so the column reads as a path:
 * opened, pending, processing, closed, with cancelled at the end as the way
 * out.
 */
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
      <div className="space-y-2">
        {WORKFLOW_STATUSES.map((status) => {
          const active = status === current;
          return (
            <button
              key={status}
              type="button"
              disabled={pending || active}
              onClick={() => move(status)}
              aria-current={active ? "true" : undefined}
              className={`w-full cursor-pointer border px-3 py-2.5 text-left transition-colors disabled:cursor-default ${
                active
                  ? "border-purple bg-purple text-white"
                  : "border-line text-ink-soft hover:border-purple hover:bg-lilac hover:text-purple disabled:opacity-50"
              }`}
            >
              <span className="block text-[13px] font-medium">{STATUS_COPY[status].label}</span>
              <span
                className={`mt-0.5 block text-[11.5px] leading-snug ${
                  active ? "text-white/75" : "text-muted"
                }`}
              >
                {STATUS_COPY[status].note}
              </span>
            </button>
          );
        })}
      </div>

      {pending && (
        <p className="flex items-center gap-2 text-[13px] text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating…
        </p>
      )}

      {result && !pending && (
        <p
          role="status"
          className={`flex items-center gap-2 text-[13px] ${result.ok ? "text-jade" : "text-sale"}`}
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
