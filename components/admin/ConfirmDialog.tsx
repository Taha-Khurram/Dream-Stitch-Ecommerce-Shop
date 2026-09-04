"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { usePresence, useScrollLock } from "@/components/motion/usePresence";

/** Keep in step with the closed duration of `.dialog-panel` in globals.css. */
const EXIT_MS = 160;

export interface ConfirmOptions {
  /** The question, as a question. Short enough to be a heading. */
  title: string;
  /** What actually happens if they say yes. */
  body?: React.ReactNode;
  /** The calmer thing to do instead, set apart from the consequence. */
  hint?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` is irreversible and dressed as such; `neutral` is merely a check. */
  tone?: "danger" | "neutral";
}

/**
 * The admin's confirmation dialog.
 *
 * It replaces `window.confirm`, which the browser draws in its own chrome: a
 * grey slab with OS buttons, no room for structure, and — the part that
 * actually mattered here — an OK button that carries the same weight whether
 * it archives a row or erases an order and returns its stock. This one names
 * the act on the button, keeps the destructive answer visually separate from
 * the safe one, and can say what to do instead.
 *
 * Reach for it through `useConfirm`, which hands back a promise so a caller
 * reads the way the `window.confirm` it replaced did:
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   if (!(await confirm({ title: "Delete order #1FD50942?" }))) return;
 *   return <>{confirmDialog}...</>
 */
export function useConfirm() {
  const [request, setRequest] = useState<ConfirmOptions | null>(null);
  const [open, setOpen] = useState(false);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  /* A promise that never settles parks the caller's handler forever, so an
     unmount answers whatever is still open the way Cancel would. */
  useEffect(
    () => () => {
      resolveRef.current?.(false);
      resolveRef.current = null;
    },
    []
  );

  const confirm = useCallback((options: ConfirmOptions) => {
    /* Asking a second question while one is up answers the first with "no".
       The screen can only carry one, and the one you can see is the one you
       are answering. */
    resolveRef.current?.(false);
    setRequest(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const settle = useCallback((value: boolean) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  /* The request outlives `open` on purpose: the panel is still on screen,
     animating out, and an empty box on the way out looks like a bug. */
  const confirmDialog = request ? (
    <ConfirmDialog open={open} options={request} onSettle={settle} />
  ) : null;

  return { confirm, confirmDialog };
}

function ConfirmDialog({
  open,
  options,
  onSettle,
}: {
  open: boolean;
  options: ConfirmOptions;
  onSettle: (value: boolean) => void;
}) {
  const {
    title,
    body,
    hint,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    tone = "danger",
  } = options;

  const { mounted, state } = usePresence(open, EXIT_MS);
  useScrollLock(mounted);

  const panelRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<Element | null>(null);
  const ids = useId();

  const danger = tone === "danger";

  /* The safe answer takes focus on a destructive ask. Someone who opened this
     by reflex and hit Enter should land on Cancel, not on the keystroke that
     erases the record. Focus goes back where it came from on the way out — if
     that element still exists, which it will not when the delete navigated. */
  useEffect(() => {
    if (!open) return;

    returnFocusRef.current = document.activeElement;
    const frame = window.requestAnimationFrame(() => {
      (danger ? cancelRef : confirmRef).current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      const previous = returnFocusRef.current;
      if (previous instanceof HTMLElement && document.contains(previous)) {
        previous.focus();
      }
    };
  }, [open, danger]);

  /* Escape cancels, and Tab stays inside: a modal question you can tab out of
     and answer with the page behind it is not modal. */
  useEffect(() => {
    if (!mounted) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onSettle(false);
        return;
      }
      if (event.key !== "Tab") return;

      const stops = panelRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), a[href]"
      );
      if (!stops?.length) return;

      const first = stops[0];
      const last = stops[stops.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted, onSettle]);

  if (!mounted) return null;

  const Icon = danger ? AlertTriangle : HelpCircle;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto overscroll-contain px-4 py-6 sm:items-center sm:py-10">
      <div
        className="veil absolute inset-0 bg-ink/45"
        data-state={state}
        onClick={() => onSettle(false)}
      />

      <div
        ref={panelRef}
        /* `alertdialog` rather than `dialog`: a screen reader should announce
           the consequence, not wait to be explored. */
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${ids}-title`}
        aria-describedby={body ? `${ids}-body` : undefined}
        data-state={state}
        className="dialog-panel relative w-full max-w-md border border-line bg-white p-6 shadow-[0_28px_70px_-30px_rgba(42,27,51,0.55)] sm:p-7"
      >
        <div className="flex gap-4">
          <span
            aria-hidden
            className={`flex h-9 w-9 shrink-0 items-center justify-center ${
              danger ? "bg-sale/10 text-sale" : "bg-lilac text-purple"
            }`}
          >
            <Icon className="h-4 w-4" />
          </span>

          <div className="min-w-0 flex-1">
            <h2
              id={`${ids}-title`}
              className="font-[family-name:var(--font-display)] text-[19px] leading-snug text-ink"
            >
              {title}
            </h2>
            {body && (
              <div
                id={`${ids}-body`}
                className="mt-2 space-y-2 text-[13px] leading-relaxed text-ink-soft"
              >
                {body}
              </div>
            )}
          </div>
        </div>

        {/* The way out, kept apart from the consequence above it — it is the
            answer most of these questions actually want. */}
        {hint && (
          <p className="mt-5 border-l-2 border-line bg-frost px-4 py-3 text-[12px] leading-relaxed text-muted">
            {hint}
          </p>
        )}

        {/* Stacked on a phone with the destructive answer on top, so the thumb
            rests on Cancel rather than on the button that cannot be undone. */}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={() => onSettle(false)}
            className="cursor-pointer border border-line px-4 py-2.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={() => onSettle(true)}
            className={`flex cursor-pointer items-center justify-center gap-1.5 border px-4 py-2.5 text-[13px] font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
              danger
                ? "border-sale bg-sale hover:bg-sale-deep focus-visible:outline-sale"
                : "border-purple bg-purple hover:bg-purple-deep focus-visible:outline-purple"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
