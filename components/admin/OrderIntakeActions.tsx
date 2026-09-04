"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, Trash2 } from "lucide-react";
import { acceptOrder, deleteOrder } from "@/app/admin/actions";
import type { ActionResult } from "@/app/admin/actions";
import { hasShipped, orderReference } from "@/lib/orders/lifecycle";
import { useConfirm } from "@/components/admin/ConfirmDialog";

/**
 * The accept-or-delete decision on a newly received order.
 *
 * Both controls live in one component because they are one choice, and
 * because the row has to disable both while either is in flight — accepting an
 * order you are halfway through deleting is not a state worth supporting.
 *
 * `row` renders for the orders table, where the buttons sit in a cell and the
 * message has to stay on one line; `panel` renders on the detail page, where
 * there is room to say what each one does.
 */
export function OrderIntakeActions({
  id,
  variant = "row",
  onDeleted,
}: {
  id: string;
  variant?: "row" | "panel";
  /** Where to go once the order is gone — the detail page cannot stay put. */
  onDeleted?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();

  /* Both actions revalidate the paths they touch, so a refresh is enough to
     redraw the row in its new state — no local copy of the status to keep. */
  const run = (action: () => Promise<ActionResult>, thenGoTo?: string) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (thenGoTo) router.push(thenGoTo);
      router.refresh();
    });
  };

  const accept = () => run(() => acceptOrder(id));

  const remove = async () => {
    const confirmed = await confirm({
      title: `Delete order ${orderReference(id)} permanently?`,
      body: (
        <p>
          This erases the order and its lines, and returns the stock it reserved to the
          catalogue.
        </p>
      ),
      hint: "Cancel the order instead if you want to keep the record.",
      confirmLabel: "Delete order",
    });
    if (!confirmed) return;
    run(() => deleteOrder(id), onDeleted);
  };

  const panel = variant === "panel";

  return (
    <div className={panel ? "space-y-3" : "flex flex-col items-start gap-1.5"}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={accept}
          className={`flex cursor-pointer items-center gap-1.5 border border-purple bg-purple font-medium text-white transition-colors hover:bg-purple-deep disabled:cursor-wait disabled:opacity-60 ${
            panel ? "px-4 py-2.5 text-[13px]" : "px-3 py-1.5 text-[12px]"
          }`}
        >
          {pending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          Accept
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={remove}
          className={`flex cursor-pointer items-center gap-1.5 border border-line font-medium text-muted transition-colors hover:border-sale hover:bg-sale/5 hover:text-sale disabled:cursor-wait disabled:opacity-50 ${
            panel ? "px-4 py-2.5 text-[13px]" : "px-3 py-1.5 text-[12px]"
          }`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete
        </button>
      </div>

      {panel && !error && (
        <p className="text-[12px] leading-relaxed text-muted">
          Accepting starts the order&rsquo;s status track. Deleting erases it and returns its stock.
        </p>
      )}

      {error && (
        <p
          role="status"
          className={`flex items-start gap-1.5 text-[12px] text-sale ${panel ? "" : "max-w-[16rem]"}`}
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      )}

      {confirmDialog}
    </div>
  );
}

/**
 * Deleting an order that has already been triaged.
 *
 * Kept apart from the intake pair because it is a different act: at intake,
 * delete is one half of a routine decision, while here it is the destructive
 * option on an order that is genuinely on the books. It only appears on the
 * detail page, where you can see what you are erasing.
 */
export function OrderDeleteButton({
  id,
  status,
  onDeleted,
}: {
  id: string;
  status: string;
  onDeleted?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();

  const shipped = hasShipped(status);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          const confirmed = await confirm({
            title: `Delete order ${orderReference(id)} permanently?`,
            body: (
              <>
                <p>This erases the order and its lines. It cannot be undone.</p>
                <p>
                  {shipped
                    ? "This order has shipped, so its stock is not returned."
                    : "The stock it reserved goes back to the catalogue."}
                </p>
              </>
            ),
            hint: "Cancel the order instead if you want to keep the record.",
            confirmLabel: "Delete order",
          });
          if (!confirmed) return;

          setError(null);
          startTransition(async () => {
            const result = await deleteOrder(id);
            if (!result.ok) {
              setError(result.message);
              return;
            }
            if (onDeleted) router.push(onDeleted);
            router.refresh();
          });
        }}
        className="flex w-full cursor-pointer items-center justify-center gap-1.5 border border-line px-3 py-2.5 text-[13px] font-medium text-muted transition-colors hover:border-sale hover:bg-sale/5 hover:text-sale disabled:cursor-wait disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        {pending ? "Deleting…" : "Delete order"}
      </button>

      {error ? (
        <p role="status" className="flex items-start gap-1.5 text-[12px] text-sale">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        <p className="text-[12px] leading-relaxed text-muted">
          Erases the order and its lines.{" "}
          {shipped ? "Shipped stock is not returned." : "Its stock returns to the catalogue."}
        </p>
      )}

      {confirmDialog}
    </div>
  );
}
