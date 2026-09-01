"use client";

import React, { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, AlertCircle, Loader2, Trash2 } from "lucide-react";
import type { ActionResult } from "@/app/admin/actions";

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

      {/* The content tabs run to several screens, so the save control follows
          you down rather than sitting at a bottom you have to hunt for. */}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-4 border-t border-line bg-white/95 px-1 py-4 backdrop-blur-sm">
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
            className={`flex items-center gap-2 text-sm ${
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
        className="flex cursor-pointer items-center gap-1.5 border border-line px-3 py-2 text-[12px] font-medium text-muted transition-colors hover:border-sale hover:bg-sale/5 hover:text-sale disabled:opacity-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {pending ? "Deleting…" : label}
      </button>
      {error && <p className="max-w-xs text-right text-[12px] text-sale">{error}</p>}
    </div>
  );
}

/* ── Field primitives ───────────────────────────────────────────────────── */

/**
 * A labelled control. `htmlFor` only works if the control carries the matching
 * `id`, so the id is cloned onto the child rather than left to each caller to
 * remember — several of them did not, which left the labels unclickable.
 */
export function Field({
  label,
  name,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  name: string;
  /** Override when the control's id differs from `name` (repeated forms). */
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const id = htmlFor ?? name;
  const hintId = hint ? `${id}-hint` : undefined;

  const control = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        id: (children.props as Record<string, unknown>).id ?? id,
        "aria-describedby": hintId,
      })
    : children;

  return (
    <div>
      <label htmlFor={id} className="admin-label font-medium text-ink">
        {label}
      </label>
      <div className="mt-1.5">{control}</div>
      {hint && (
        <p id={hintId} className="admin-hint mt-1.5">
          {hint}
        </p>
      )}
    </div>
  );
}
