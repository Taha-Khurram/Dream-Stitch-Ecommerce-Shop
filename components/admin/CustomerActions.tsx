"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, Trash2 } from "lucide-react";
import { remove } from "@/lib/inbox/api";
import { useConfirm } from "@/components/admin/ConfirmDialog";

/**
 * Removing one customer from the book.
 *
 * The confirm spells out what survives, because the button sits in a table of
 * people who have spent money and "delete customer" reads like it might take
 * the orders with it. It does not: `orders.customer_id` is `ON DELETE SET
 * NULL`, so the orders stay on the books complete with their totals and
 * shipping details, and an account holder keeps their account. What goes is
 * the entry in this list and the link from those orders to it.
 */
export function CustomerRowActions({
  id,
  name,
  email,
  orderCount,
}: {
  id: string;
  name: string;
  email: string;
  orderCount: number;
}) {
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
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={pending}
        onClick={erase}
        aria-label={`Remove ${name || email}`}
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
