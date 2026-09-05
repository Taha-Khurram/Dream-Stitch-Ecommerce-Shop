"use client";

import React from "react";
import Link from "next/link";
import { DeleteButton } from "./ActionForm";
import { deleteProduct } from "@/app/admin/actions";

/**
 * `id` and `href` are deliberately separate: the delete is keyed by the row's
 * id, while the link is the readable address the list decided on — the slug.
 */
export function ProductRowActions({
  id,
  href,
  name,
}: {
  id: string;
  href: string;
  name: string;
}) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Link
        href={href}
        className="border border-line px-3 py-2 text-[12px] font-medium text-ink-soft transition-colors hover:border-purple hover:bg-lilac hover:text-purple"
      >
        Edit
      </Link>
      <DeleteButton
        label="Delete"
        confirmMessage={`Delete “${name}”?`}
        confirmBody={<p>The product and its imagery leave the store. This cannot be undone.</p>}
        confirmLabel="Delete product"
        onDelete={() => deleteProduct(id)}
      />
    </div>
  );
}
