"use client";

import React from "react";
import Link from "next/link";
import { DeleteButton } from "./ActionForm";
import { deleteProduct } from "@/app/(site)/admin/actions";

export function ProductRowActions({ id, name }: { id: string; name: string }) {
  return (
    <div className="flex items-center justify-end gap-3">
      <Link
        href={`/admin/products/${id}`}
        className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft transition-colors hover:text-purple"
      >
        Edit
      </Link>
      <DeleteButton
        label="Delete"
        confirmMessage={`Delete “${name}”? This cannot be undone.`}
        onDelete={() => deleteProduct(id)}
      />
    </div>
  );
}
