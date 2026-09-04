import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { BRAND } from "@/lib/constants";
import {
  HEARTBEAT_INTERVAL_MS,
  HEARTBEAT_PATH,
  IDLE_TIMEOUT_MS,
} from "@/lib/auth/session";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: `Admin | ${BRAND.name} ${BRAND.suffix}`,
  robots: { index: false, follow: false },
};

/* Order data must never be served from a cache shared between admins. */
export const dynamic = "force-dynamic";

/**
 * The admin panel is deliberately NOT inside the (site) route group.
 *
 * It used to be, which meant every dashboard screen paid for the storefront:
 * `getSettings()` and `getSiteContent()` on the server for a header and footer
 * the panel does not render, and on the client the cart and wishlist providers,
 * the cart drawer, the scroll-reveal observer and — through the site header —
 * 67 kB gzipped of `@supabase/supabase-js`. None of it was reachable from here.
 *
 * Sitting at the top level, the panel's only ancestor is the document shell in
 * app/layout.tsx, so this file owns all of its own chrome. The bar below is the
 * one thing that was worth keeping from the storefront header.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();

  return (
    <>
      {/* Renders nothing. Signs an idle admin out, and keeps an active one in.
          The middleware enforces the same window server-side regardless. */}
      <SessionGuard
        idleMs={IDLE_TIMEOUT_MS}
        heartbeatMs={HEARTBEAT_INTERVAL_MS}
        heartbeatPath={HEARTBEAT_PATH}
      />

      <header className="sticky top-0 z-50 border-b border-line-soft bg-white">
        <div className="mx-auto flex h-14 max-w-[1500px] items-center px-4 sm:px-6 xl:px-10">
          <Link href="/" className="group inline-flex flex-col items-start leading-none">
            <span className="font-[family-name:var(--font-script)] text-[22px] leading-[1.15] text-ink transition-colors duration-300 group-hover:text-purple">
              {BRAND.name}
            </span>
          </Link>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] flex-col px-6 py-10 lg:flex-row xl:px-10">
        {/* The rail is separated from the work area by a single hairline: a
            bottom rule when the nav stacks above the page, a right rule once
            they sit side by side.

            Side by side, the rail is fixed to the viewport (see .admin-rail in
            globals.css) — so the <aside> is left behind purely to reserve the
            column, and the right-hand rule moves onto the fixed rail with it. */}
        <aside className="shrink-0 border-b border-line pb-8 lg:w-52 lg:border-b-0 lg:pb-0">
          <div className="admin-rail">
            {/* The wordmark lives in the bar a row above; the rail only needs to
                say which surface you are on. */}
            <Link
              href="/admin"
              className="admin-th block text-purple transition-colors hover:text-purple-deep"
            >
              Admin
            </Link>

            <div className="mt-6">
              <AdminNav />
            </div>

            <div className="mt-8 border-t border-line pt-5 lg:mt-10">
              <p className="truncate text-[12px] text-muted" title={profile.email ?? undefined}>
                {profile.email}
              </p>
              <Link
                href="/"
                className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-soft transition-colors hover:text-purple"
              >
                View store <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pt-8 lg:pt-0 lg:pl-10">{children}</main>
      </div>
    </>
  );
}
