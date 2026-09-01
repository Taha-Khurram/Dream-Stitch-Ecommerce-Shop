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
        className="border border-line px-3 py-2 text-[12px] font-medium text-ink-soft transition-colors hover:border-purple hover:bg-lilac hover:text-purple"
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
