import React from "react";
import Link from "next/link";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { DiscountForm } from "@/components/admin/DiscountForm";

export const dynamic = "force-dynamic";

export default function NewDiscountPage() {
  return (
    <div>
      <AdminHeading
        title="New code"
        copy="It can be typed into the bag the moment you save it, unless you give it a start date."
        action={
          <Link href="/admin/discounts" className="btn-outline">
            Cancel
          </Link>
        }
      />
      <div className="mt-8 max-w-3xl">
        <DiscountForm />
      </div>
    </div>
  );
}
