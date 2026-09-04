"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, RotateCcw, Trash2, UserMinus } from "lucide-react";
import { remove, setStatus } from "@/lib/inbox/api";

/**
 * The two things the panel can do to one subscriber, in one component because
 * they are one row and it has to disable both while either is in flight.
 *
 * The pairing is also what makes the difference between them legible, and that
 * difference is the whole point of the screen:
 *
 * - **Unsubscribe** keeps the row. The address stays on file as a suppression
 *   entry, so a later import — or the same person subscribing again out of
 *   habit — cannot quietly put them back on a list they asked to leave.
 * - **Delete** forgets it. Which is exactly the wrong thing to do to somebody
 *   who opted out, and exactly the right thing for a typo or an erasure
 *   request. The confirm says so in as many words, because the two buttons sit
 *   next to each other and only one of them is reversible.
 */
export function SubscriberRowActions({
  id,
  email,
  status,
}: {
  id: string;
  email: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const endpoint = `/api/admin/subscribers/${id}`;
  const subscribed = status === "subscribed";

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

  const toggle = () =>
    run(() =>
      setStatus(
        endpoint,
        subscribed ? "unsubscribed" : "subscribed",
        "Could not update the subscriber."
      )
    );

  const erase = () => {
    const confirmed = window.confirm(
      `Delete ${email} from the list permanently?\n\n` +
        `Unsubscribing keeps the address on file so it is never mailed again. ` +
        `Deleting forgets it, so a future signup or import can put it back on the list.`
    );
    if (!confirmed) return;
    run(() => remove(endpoint, "Could not delete the subscriber."));
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={toggle}
          className={`flex shrink-0 cursor-pointer items-center gap-1.5 border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-wait disabled:opacity-50 ${
            subscribed
              ? "border-line text-ink-soft hover:border-purple hover:bg-lilac hover:text-purple"
              : "border-jade/40 text-jade hover:bg-jade/10"
          }`}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : subscribed ? (
            <UserMinus className="h-3.5 w-3.5" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5" />
          )}
          {subscribed ? "Unsubscribe" : "Resubscribe"}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={erase}
          aria-label={`Delete ${email}`}
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
    </div>
  );
}
