import React from "react";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/* Order data must never be served from a cache shared between admins. */
export const dynamic = "force-dynamic";

/**
 * The print group: admin pages that are documents rather than screens.
 *
 * These routes sit under /admin by URL but outside app/admin/layout.tsx by
 * design. That layout owns a sticky bar, a rail fixed to the viewport and the
 * idle-session guard — chrome that is right for a screen someone works in for
 * an hour, and wrong for a sheet of paper. A fixed element in particular is
 * not merely surplus in print: browsers are free to repeat it on every page,
 * which is how you get a navigation rail stamped across a packing slip.
 *
 * The gate comes with them, though. `requireAdmin()` runs here exactly as it
 * does in the panel, so nothing in this group is reachable by a customer
 * holding a URL — a packing slip carries a buyer's address and phone number.
 */
export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return <div className="min-h-screen bg-frost px-4 py-6 print:bg-white print:p-0">{children}</div>;
}
