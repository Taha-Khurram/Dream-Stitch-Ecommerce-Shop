import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { ProductForm } from "@/components/admin/ProductForm";
import type { Category, Product } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: product }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).single(),
    supabase.from("categories").select("*").order("name"),
  ]);

  if (!product) notFound();

  return (
    <div>
      <AdminHeading
        title={product.name}
        copy="Changes reach the storefront as soon as you save."
        action={
          <div className="flex gap-3">
            <Link href={`/shop/${product.id}`} className="btn-outline">
              View
            </Link>
            <Link href="/admin/products" className="btn-outline">
              Back
            </Link>
          </div>
        }
      />
      <div className="mt-8 max-w-3xl">
        <ProductForm
          product={product as Product}
          categories={(categories ?? []) as Category[]}
        />
      </div>
    </div>
  );
}
