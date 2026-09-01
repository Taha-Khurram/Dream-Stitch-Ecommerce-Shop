import React from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { ProductForm } from "@/components/admin/ProductForm";
import type { Category } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("categories").select("*").order("name");

  return (
    <div>
      <AdminHeading
        title="New product"
        copy="It goes live the moment you save."
        action={
          <Link href="/admin/products" className="btn-outline">
            Cancel
          </Link>
        }
      />
      <div className="mt-8 max-w-3xl">
        <ProductForm categories={(data ?? []) as Category[]} />
      </div>
    </div>
  );
}
