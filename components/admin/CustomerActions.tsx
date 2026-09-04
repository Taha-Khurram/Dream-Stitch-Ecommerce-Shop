"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { remove } from "@/lib/inbox/api";
import { useConfirm } from "@/components/admin/ConfirmDialog";

interface CustomerTarget {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  /** Where to go once the record is gone. Omit to stay put and refresh. */
  onDeleted?: string;
}

/**
 * Removing one customer from the book — the act, without the button.
 *
 * Two places offer it now (the row in the list and the panel on the detail
 * page) and they must ask the same question: the wording below is the only
 * place an admin is told what survives a delete, so a second copy of it is a
 * second thing to keep true.
 *
 * The confirm spells that out because "delete customer" reads like it might
 * take the orders with it. It does not: `orders.customer_id` is `ON DELETE SET
 * NULL`, so the orders stay on the books complete with their totals and
 * shipping details, and an account holder keeps their account. What goes is the
 * entry in this list and the link from those orders to it.
 */
function useCustomerDelete({ id, name, email, orderCount, onDeleted }: CustomerTarget) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();

  const erase = async () => {
    const confirmed = await confirm({
      title: `Remove ${name || email} from the customer book?`,
      body:
        orderCount > 0 ? (
          <p>
            Their {orderCount} order{orderCount === 1 ? "" : "s"} will stay on the books with
            the name and address already recorded on them, but will no longer be linked to a
            customer.
          </p>
        ) : undefined,
      hint: "This does not delete their account — someone with a sign-in keeps it.",
      confirmLabel: "Remove customer",
    });
    if (!confirmed) return;

    setError(null);
    startTransition(async () => {
      const outcome = await remove(`/api/admin/customers/${id}`, "Could not delete the customer.");
      if (!outcome.ok) {
        setError(outcome.message);
        return;
      }
      if (onDeleted) router.push(onDeleted);
      router.refresh();
    });
  };

  return { erase, pending, error, confirmDialog };
}

/** The icon button at the end of a row in the customer book. */
export function CustomerRowActions(props: Omit<CustomerTarget, "onDeleted">) {
  const { erase, pending, error, confirmDialog } = useCustomerDelete(props);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={erase}
        aria-label={`Remove ${props.name || props.email}`}
        className="flex shrink-0 cursor-pointer items-center border border-line p-1.5 text-muted transition-colors hover:border-sale hover:bg-sale/5 hover:text-sale disabled:cursor-wait disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>

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

/**
 * The same delete, in the detail page's danger zone.
 *
 * A labelled full-width button rather than an icon, because here it is not one
 * control among several in a dense row — it is the last thing on the page, and
 * the one act on this screen that cannot be undone. It says what it does and
 * what it leaves behind before it is pressed, not only in the dialog after.
 */
export function CustomerDeleteButton(props: CustomerTarget) {
  const { erase, pending, error, confirmDialog } = useCustomerDelete(props);

  return (
    <div className="space-y-2">
      <button
        type="button"
        disabled={pending}
        onClick={erase}
        className="flex w-full cursor-pointer items-center justify-center gap-1.5 border border-line px-3 py-2.5 text-[13px] font-medium text-muted transition-colors hover:border-sale hover:bg-sale/5 hover:text-sale disabled:cursor-wait disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        {pending ? "Removing…" : "Remove customer"}
      </button>

      {error ? (
        <p role="status" className="flex items-start gap-1.5 text-[12px] text-sale">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        <p className="text-[12px] leading-relaxed text-muted">
          {props.orderCount > 0
            ? `Their ${props.orderCount} order${props.orderCount === 1 ? "" : "s"} stay on the books, unlinked.`
            : "Removes the book entry."}{" "}
          Their sign-in, if they have one, is untouched.
        </p>
      )}

      {confirmDialog}
    </div>
  );
}
