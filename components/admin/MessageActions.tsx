"use client";

import React, { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, Trash2 } from "lucide-react";
import { remove, setStatus } from "@/lib/inbox/api";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import {
  MESSAGE_STATUSES,
  MESSAGE_OPENED_STATUS,
  MESSAGE_STATUS_COPY,
  isUnopened,
  messageReference,
} from "@/lib/inbox/lifecycle";

/**
 * The three controls the panel has over one contact message.
 *
 * All of them go through /api/admin/contacts/[id], and all of them finish with
 * `router.refresh()` — the endpoints revalidate the paths they touch, so a
 * refresh is enough to redraw the row and the pill in their new state and
 * there is no local copy of the status to keep in step.
 */

const endpoint = (id: string) => `/api/admin/contacts/${id}`;

/* ── Opened means read ──────────────────────────────────────────────────── */

/**
 * Renders nothing. Marks the message read the first time it is opened.
 *
 * `new` is a statement about whether anybody has looked at the message, and by
 * the time this runs somebody is looking at it. Making them click a button to
 * confirm they have read what is on their screen is busywork, and an inbox
 * where every message stays bold until it is dismissed by hand stops meaning
 * anything within a week.
 *
 * It is a client effect rather than part of the server render on purpose: a
 * GET must not mutate. Prefetch, a bot, a link preview unfurling in a chat —
 * all of them would silently mark the inbox read without a person ever seeing
 * it. An effect only fires for a browser that actually rendered the page.
 *
 * The ref guards React's development double-invoke, so this is one request per
 * visit rather than two.
 */
export function MarkReadOnOpen({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const fired = useRef(false);

  useEffect(() => {
    if (!isUnopened(status) || fired.current) return;
    fired.current = true;

    let live = true;

    setStatus(endpoint(id), MESSAGE_OPENED_STATUS, "Could not mark the message read.").then(
      (result) => {
        /* Silent either way. Nobody asked for this, so a green toast would be
           noise and a red one would be an error about an action the admin did
           not take. The status pill simply stays `New` if it did not land, and
           the next visit tries again. */
        if (live && result.ok) router.refresh();
      }
    );

    return () => {
      live = false;
    };
  }, [id, status, router]);

  return null;
}

/* ── The status track ───────────────────────────────────────────────────── */

/**
 * Where the message sits, as four buttons.
 *
 * Every status is reachable, including back to `new` — unlike an order, where
 * un-receiving one would break the intake step, a message has nothing
 * downstream that depends on it never going backwards. "Actually, deal with
 * this later" is a real thing to want from an inbox.
 */
export function MessageStatusControl({ id, current }: { id: string; current: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const router = useRouter();

  const move = (status: string) => {
    setResult(null);
    startTransition(async () => {
      const outcome = await setStatus(endpoint(id), status, "Could not update the message.");
      setResult(outcome);
      if (outcome.ok) router.refresh();
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {MESSAGE_STATUSES.map((status) => {
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
              <span className="block text-[13px] font-medium">
                {MESSAGE_STATUS_COPY[status].label}
              </span>
              <span
                className={`mt-0.5 block text-[11.5px] leading-snug ${
                  active ? "text-white/75" : "text-muted"
                }`}
              >
                {MESSAGE_STATUS_COPY[status].note}
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

/* ── Deleting ───────────────────────────────────────────────────────────── */

/**
 * Erase the message.
 *
 * The confirm names `archived` as the alternative, because that is almost
 * always what is wanted: a message that needed no reply is filed, not
 * destroyed, and the person who wrote it may well write again about the same
 * thing. Deleting is for spam and for an erasure request.
 */
export function MessageDeleteButton({ id, onDeleted }: { id: string; onDeleted?: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();

  const confirmAndDelete = async () => {
    const confirmed = await confirm({
      title: `Delete message ${messageReference(id)} permanently?`,
      body: <p>This erases what the customer wrote, and cannot be undone.</p>,
      hint: "Archive it instead if you only want it out of the way.",
      confirmLabel: "Delete message",
    });
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const outcome = await remove(endpoint(id), "Could not delete the message.");
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      if (onDeleted) router.push(onDeleted);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={confirmAndDelete}
        className="flex w-full cursor-pointer items-center justify-center gap-1.5 border border-line px-3 py-2.5 text-[13px] font-medium text-muted transition-colors hover:border-sale hover:bg-sale/5 hover:text-sale disabled:cursor-wait disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        {pending ? "Deleting…" : "Delete message"}
      </button>

      {error ? (
        <p role="status" className="flex items-start gap-1.5 text-[12px] text-sale">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        <p className="text-[12px] leading-relaxed text-muted">
          Erases the message for good. Archive it instead to keep the record.
        </p>
      )}

      {confirmDialog}
    </div>
  );
}

/* ── The one-click tick in the list ─────────────────────────────────────── */

/**
 * "Replied", from the table, without opening the message.
 *
 * The common shape of a working morning is: read the inbox, answer three
 * people in the mail client, come back and tick them off. Making that a trip
 * into each message and back out again is three extra navigations for no
 * information gained.
 *
 * Only offered while a message is still open — there is nothing to tick on one
 * that is already replied or archived, and the row shows a link instead.
 */
export function MarkRepliedButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const outcome = await setStatus(endpoint(id), "replied", "Could not update.");
            if (!outcome.ok) {
              setError(outcome.message);
              return;
            }
            router.refresh();
          });
        }}
        className="flex shrink-0 cursor-pointer items-center gap-1.5 border border-line px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-jade hover:bg-jade/5 hover:text-jade disabled:cursor-wait disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
        Replied
      </button>

      {error && (
        <p role="status" className="max-w-[14rem] text-right text-[11.5px] text-sale">
          {error}
        </p>
      )}
    </div>
  );
}
