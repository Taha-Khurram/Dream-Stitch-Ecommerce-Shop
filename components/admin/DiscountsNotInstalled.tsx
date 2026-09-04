import React from "react";

/**
 * What /admin/discounts shows when `discount_codes.sql` has not been run.
 *
 * Same reasoning as `InboxNotInstalled`, and the same failure mode worth a
 * component to avoid: "no codes yet" and "the table does not exist" look
 * identical on screen and mean opposite things, and it is the reassuring one
 * that gets believed. An admin would go off to create a code, watch the save
 * fail, and have no idea why — while the promo field in the cart drawer went
 * on telling shoppers their perfectly good code was not valid.
 *
 * Name the file, say what to do with it.
 */
export function DiscountsNotInstalled() {
  return (
    <div className="mt-10 border border-line bg-white p-10 text-center">
      <p className="text-sm text-ink">Discount codes are not installed yet.</p>
      <p className="admin-hint mx-auto mt-2 max-w-md">
        Run <code className="text-ink">discount_codes.sql</code> in the Supabase SQL editor, then
        reload this page. Until it has been applied, the promo field in the cart reports the same
        thing rather than quietly refusing every code a customer types.
      </p>
    </div>
  );
}
