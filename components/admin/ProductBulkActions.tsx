"use client";

import React from "react";
import { Trash2 } from "lucide-react";
import { BulkBar, BulkButton, useBulkAction } from "@/components/admin/BulkSelection";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { bulkDeleteProducts } from "@/app/admin/actions";

/**
 * What a selection of products can be told to do.
 *
 * Only delete, because a product has no status to change — the catalogue's
 * equivalent is stock, and setting several products' stock in one go is a
 * different control from this one and not one anybody has asked for.
 *
 * The confirmation says what the row's own delete says, plus the part that
 * only matters in bulk: anything on a placed order is kept rather than taking
 * the whole batch down with it.
 */
export function ProductBulkActions() {
  const { ids, pending, message, dismiss, run } = useBulkAction();
  const { confirm, confirmDialog } = useConfirm();

  const count = ids.length;
  const noun = `${count} product${count === 1 ? "" : "s"}`;

  const remove = async () => {
    const confirmed = await confirm({
      title: `Delete ${noun}?`,
      body: (
        <>
          <p>
            {count === 1 ? "The product" : "The products"} and their imagery leave the store. This
            cannot be undone.
          </p>
          <p>Anything that appears on a placed order is kept, and named in the result.</p>
        </>
      ),
      confirmLabel: `Delete ${noun}`,
    });
    if (!confirmed) return;
    run(bulkDeleteProducts);
  };

  return (
    <BulkBar noun="product" message={message} onDismiss={dismiss}>
      <BulkButton label="Delete" icon={Trash2} tone="danger" pending={pending} onClick={remove} />
      {confirmDialog}
    </BulkBar>
  );
}
