"use client";

import React, { useState } from "react";
import { ArrowRight, Star, StarOff, Trash2 } from "lucide-react";
import { BulkBar, BulkButton, useBulkAction } from "@/components/admin/BulkSelection";
import { SelectField } from "@/components/admin/SelectField";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import {
  bulkDeleteProducts,
  bulkSetFeatured,
  bulkSetProductType,
  type ActionResult,
} from "@/app/admin/actions";
import { PRODUCT_TYPES } from "@/lib/product-attributes";

/**
 * What a selection of products can be told to do: be marked as a bedsheet or
 * a cushion cover, be featured or unfeatured, or be deleted.
 *
 * The delete confirmation says what the row's own delete says, plus the part
 * that only matters in bulk: anything on a placed order is kept rather than
 * taking the whole batch down with it. The other writes are one click to undo,
 * so they ask nothing.
 */

type Job = "type" | "feature" | "unfeature" | "delete";

export function ProductBulkActions() {
  const { ids, pending, message, dismiss, run } = useBulkAction();
  const { confirm, confirmDialog } = useConfirm();
  const [job, setJob] = useState<Job | null>(null);

  const busy = (which: Job) => pending && job === which;

  const start = (which: Job, action: (ids: string[]) => Promise<ActionResult>) => {
    setJob(which);
    run(action);
  };

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
    start("delete", bulkDeleteProducts);
  };

  return (
    <BulkBar noun="product" message={message} onDismiss={dismiss}>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          /* `SelectField` commits into a hidden input, so the form holds the
             choice — the same arrangement as the orders bar's status. */
          const type = String(new FormData(event.currentTarget).get("product_type") ?? "");
          if (!type) return;
          start("type", (selection) => bulkSetProductType(selection, type));
        }}
      >
        <div className="w-44">
          <SelectField name="product_type" options={PRODUCT_TYPES} placeholder="Mark as…" />
        </div>
        <BulkButton
          type="submit"
          label="Apply"
          icon={ArrowRight}
          pending={busy("type")}
          disabled={pending}
        />
      </form>

      <BulkButton
        label="Feature"
        icon={Star}
        pending={busy("feature")}
        disabled={pending}
        onClick={() => start("feature", (selection) => bulkSetFeatured(selection, true))}
      />

      <BulkButton
        label="Unfeature"
        icon={StarOff}
        pending={busy("unfeature")}
        disabled={pending}
        onClick={() => start("unfeature", (selection) => bulkSetFeatured(selection, false))}
      />

      <BulkButton
        label="Delete"
        icon={Trash2}
        tone="danger"
        pending={busy("delete")}
        disabled={pending}
        onClick={remove}
      />

      {confirmDialog}
    </BulkBar>
  );
}
