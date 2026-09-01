import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminNav } from "@/components/admin/AdminNav";
import { BRAND } from "@/lib/constants";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: `Admin | ${BRAND.name} ${BRAND.suffix}`,
  robots: { index: false, follow: false },
};

/* Order data must never be served from a cache shared between admins. */
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col px-6 py-10 lg:flex-row xl:px-10">
      {/* The rail is separated from the work area by a single hairline: a bottom
          rule when the nav stacks above the page, a right rule once they sit
          side by side. */}
      <aside className="shrink-0 border-b border-line pb-8 lg:w-52 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-10">
        <div className="lg:sticky lg:top-24">
          {/* The wordmark lives in the site header a row above; the rail only
              needs to say which surface you are on. */}
          <Link
            href="/admin"
            className="block text-[9px] font-medium uppercase tracking-[0.32em] text-purple transition-colors hover:text-purple-deep"
          >
            Admin
          </Link>

          <div className="mt-6">
            <AdminNav />
          </div>

          <div className="mt-8 border-t border-line pt-5 lg:mt-10">
            <p className="truncate text-[11px] text-muted" title={profile.email ?? undefined}>
              {profile.email}
            </p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft transition-colors hover:text-purple"
            >
              View store <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 pt-8 lg:pt-0 lg:pl-10">{children}</main>
    </div>
  );
}
