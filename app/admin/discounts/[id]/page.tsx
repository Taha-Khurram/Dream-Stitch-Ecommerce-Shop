import React, { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { DiscountForm } from "@/components/admin/DiscountForm";
import { DiscountsNotInstalled } from "@/components/admin/DiscountsNotInstalled";
import { Skeleton } from "@/components/motion/Skeleton";
import { isMissingInstall } from "@/lib/inbox/install";
import { formatPrice } from "@/lib/format";
import { orderReference } from "@/lib/orders/lifecycle";
import type { DiscountCode } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

/** The ledger is long; the screen only needs to show that it is real. */
const RECENT_REDEMPTIONS = 10;

export default async function EditDiscountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("discount_codes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  /* The table itself is missing, which is a different thing from this code
     being missing — and answering 404 for it would send an admin looking for a
     row they deleted rather than for a migration they have not run. */
  if (error && isMissingInstall(error)) {
    return (
      <div>
        <AdminHeading title="Discount code" />
        <DiscountsNotInstalled />
      </div>
    );
  }

  if (!data) notFound();

  const discount = data as DiscountCode;

  return (
    <div>
      <AdminHeading
        title={discount.code}
        copy="Editing a live code changes what the next order gets. Redemptions already recorded keep the terms they were spent on."
        action={
          <Link href="/admin/discounts" className="btn-outline">
            Back
          </Link>
        }
      />

      <div className="mt-8 max-w-3xl space-y-12">
        <DiscountForm discount={discount} />

        <div className="border-t border-line pt-10">
          <Suspense fallback={<RedemptionsSkeleton />}>
            <Redemptions discountId={discount.id} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/**
 * The last few times this code was actually spent.
 *
 * Its own boundary below the form: the form is what somebody came here to
 * change, and a ledger read has no business holding it up. The count is the
 * whole set, not the ten rows — "3 of 500" would be a lie the screen tells
 * quietly.
 */
async function Redemptions({ discountId }: { discountId: string }) {
  const supabase = await createClient();

  const { data, count } = await supabase
    .from("discount_redemptions")
    .select("id, order_id, amount, subtotal, created_at", { count: "exact" })
    .eq("discount_id", discountId)
    .order("created_at", { ascending: false })
    .limit(RECENT_REDEMPTIONS);

  const rows = (data ?? []) as {
    id: string;
    order_id: string;
    amount: number;
    subtotal: number;
    created_at: string;
  }[];

  const total = count ?? 0;

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <h2 className="admin-section-title">Redemptions</h2>
        <p className="admin-hint">
          {total === 0
            ? "None yet"
            : total <= rows.length
              ? `${total.toLocaleString()} in total`
              : `Latest ${rows.length} of ${total.toLocaleString()}`}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 border border-line bg-white p-8 text-center text-sm text-muted">
          Nobody has used this code yet.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line border-y border-line">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-4 py-3">
              <Link
                href={`/admin/orders/${row.order_id}`}
                className="text-sm text-ink transition-colors hover:text-purple"
              >
                {orderReference(row.order_id)}
              </Link>
              <span className="flex items-baseline gap-3 text-[13px] tabular-nums">
                <span className="text-muted">
                  {new Date(row.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
                <span className="text-purple">−{formatPrice(row.amount)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RedemptionsSkeleton() {
  return (
    <section aria-hidden>
      <Skeleton className="h-3 w-32" />
      <div className="mt-4 border-y border-line">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-3.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>
    </section>
  );
}
