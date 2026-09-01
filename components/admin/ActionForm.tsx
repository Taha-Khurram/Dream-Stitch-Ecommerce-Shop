"use client";

import React, { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertCircle, Loader2, Trash2 } from "lucide-react";
import type { ActionResult } from "@/app/(site)/admin/actions";

/**
 * Wraps a server action so every admin form reports success or failure the
 * same way. Actions never throw for expected problems — they return
 * `{ ok, message }` — so a rejected RLS write reads as a sentence rather than
 * a blank screen.
 */
export function ActionForm({
  action,
  children,
  submitLabel = "Save",
  onSuccessRedirect,
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  submitLabel?: string;
  onSuccessRedirect?: string;
}) {
  const router = useRouter();

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult | null, formData: FormData) => {
      const result = await action(formData);
      if (result.ok && onSuccessRedirect) {
        router.push(onSuccessRedirect);
        router.refresh();
      }
      return result;
    },
    null
  );

  return (
    <form action={formAction} className="space-y-7">
      {children}

      <div className="flex flex-wrap items-center gap-4 border-t border-line pt-6">
        <button
          type="submit"
          disabled={pending}
          className="btn-primary cursor-pointer disabled:cursor-wait disabled:opacity-60"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {pending ? "Saving…" : submitLabel}
        </button>

        {state && (
          <p
            role="status"
            className={`flex items-center gap-2 text-[13px] ${
              state.ok ? "text-jade" : "text-sale"
            }`}
          >
            {state.ok ? (
              <Check className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

/** Destructive action with a confirmation step and inline failure reporting. */
export function DeleteButton({
  onDelete,
  label = "Delete",
  confirmMessage = "Delete this permanently?",
}: {
  onDelete: () => Promise<ActionResult>;
  label?: string;
  confirmMessage?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(confirmMessage)) return;
          setError(null);
          startTransition(async () => {
            const result = await onDelete();
            if (result.ok) router.refresh();
            else setError(result.message);
          });
        }}
        className="flex cursor-pointer items-center gap-1.5 border border-line px-3 py-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted transition-colors hover:border-sale hover:text-sale disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {pending ? "Deleting…" : label}
      </button>
      {error && <p className="max-w-xs text-right text-[11px] text-sale">{error}</p>}
    </div>
  );
}

/* ── Field primitives ───────────────────────────────────────────────────── */

export function Field({
  label,
  name,
  hint,
  children,
}: {
  label: string;
  name: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="eyebrow text-muted">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1.5 text-[11px] leading-relaxed text-faint">{hint}</p>}
    </div>
  );
}
