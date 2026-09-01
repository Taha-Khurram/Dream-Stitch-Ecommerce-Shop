import React from "react";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { CategoryEditor } from "@/components/admin/CategoryEditor";
import type { Category } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const supabase = await createClient();

  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").order("name"),
    supabase.from("products").select("category_id"),
  ]);

  const counts = new Map<string, number>();
  (products ?? []).forEach((row: { category_id: string | null }) => {
    if (row.category_id) counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
  });

  return (
    <div>
      <AdminHeading
        title="Categories"
        copy="These are the fabrics. They drive the shop filter rail, the homepage tiles and the Shop menu."
      />

      <div className="mt-8">
        <CategoryEditor
          categories={(categories ?? []) as Category[]}
          counts={Object.fromEntries(counts)}
        />
      </div>
    </div>
  );
}
