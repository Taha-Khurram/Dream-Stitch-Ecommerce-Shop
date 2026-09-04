"use client";

import React, { useState } from "react";
import { ArrowRight, Check, Trash2 } from "lucide-react";
import { BulkBar, BulkButton, useBulkAction } from "@/components/admin/BulkSelection";
import { SelectField } from "@/components/admin/SelectField";
import { useConfirm } from "@/components/admin/ConfirmDialog";
import { bulkAcceptOrders, bulkDeleteOrders, bulkSetOrderStatus } from "@/app/admin/actions";
import type { ActionResult } from "@/app/admin/actions";
import { INTAKE_STATUS, STATUS_COPY, WORKFLOW_STATUSES } from "@/lib/orders/lifecycle";

/**
 * What a selection of orders can be told to do.
 *
 * The bar carries the row's own verbs, no more: accept, set a status, delete.
 * Which of them appear follows the tab you are reading under, because the
 * server refuses the rest anyway and a control whose only possible answer is
 * "0 orders changed" is worse than no control. Under **New** every order is
 * awaiting review, so the status track cannot be reached and only Accept and
 * Delete show; under a workflow tab there is nothing left to accept. **All**
 * mixes the two and so offers both.
 */

/* Lifecycle order, not alphabetical — the list reads as the path an order
   takes, with `cancelled` at the end as the way out. `new` is absent from
   `WORKFLOW_STATUSES` by construction, so it cannot be offered here. */
const STATUS_OPTIONS = WORKFLOW_STATUSES.map((status) => ({
  value: status,
  label: STATUS_COPY[status].label,
}));

type Job = "accept" | "status" | "delete";

export function OrderBulkActions({ filter }: { filter: string }) {
  const { ids, pending, message, dismiss, run } = useBulkAction();
  const { confirm, confirmDialog } = useConfirm();
  const [job, setJob] = useState<Job | null>(null);

  /* Which control is spinning. `pending` falling back to false ends it, so
     there is nothing to reset. */
  const busy = (which: Job) => pending && job === which;

  const start = (which: Job, action: (ids: string[]) => Promise<ActionResult>) => {
    setJob(which);
    run(action);
  };

  const showAccept = filter === "all" || filter === INTAKE_STATUS;
  const showStatus = filter !== INTAKE_STATUS;

  const remove = async () => {
    const count = ids.length;
    const confirmed = await confirm({
      title: `Delete ${count} order${count === 1 ? "" : "s"} permanently?`,
      body: (
        <p>
          This erases {count === 1 ? "the order" : "the orders"} and their lines. Any stock they
          reserved goes back to the catalogue, except on orders that have already shipped.
        </p>
      ),
      hint: "Cancel them instead if you want to keep the records.",
      confirmLabel: `Delete ${count} order${count === 1 ? "" : "s"}`,
    });
    if (!confirmed) return;
    start("delete", bulkDeleteOrders);
  };

  return (
    <BulkBar noun="order" message={message} onDismiss={dismiss}>
      {showAccept && (
        <BulkButton
          label="Accept"
          icon={Check}
          tone="primary"
          pending={busy("accept")}
          disabled={pending}
          onClick={() => start("accept", bulkAcceptOrders)}
        />
      )}

      {showStatus && (
        <form
          className="flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            /* `SelectField` commits into a hidden input, so the form is what
               holds the choice — there is no value to mirror in state here. */
            const status = String(new FormData(event.currentTarget).get("status") ?? "");
            if (!status) return;
            setJob("status");
            run((selection) => bulkSetOrderStatus(selection, status));
          }}
        >
          <div className="w-40">
            <SelectField name="status" options={STATUS_OPTIONS} placeholder="Set status…" />
          </div>
          <BulkButton
            type="submit"
            label="Apply"
            icon={ArrowRight}
            pending={busy("status")}
            disabled={pending}
          />
        </form>
      )}

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
