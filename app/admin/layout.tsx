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
    <div className="mx-auto flex max-w-[1500px] flex-col gap-8 px-6 py-10 lg:flex-row lg:gap-12 xl:px-10">
      <aside className="shrink-0 lg:w-52">
        <div className="lg:sticky lg:top-24">
          <Link href="/admin" className="block">
            <span className="block font-[family-name:var(--font-script)] text-[28px] leading-none text-ink">
              {BRAND.name}
            </span>
            <span className="mt-1.5 block text-[8px] font-medium uppercase tracking-[0.32em] text-purple">
              Admin
            </span>
          </Link>

          <div className="mt-8 lg:mt-10">
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

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
