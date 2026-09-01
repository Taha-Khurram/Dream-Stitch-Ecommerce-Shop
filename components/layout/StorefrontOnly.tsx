"use client";

import React from "react";
import { usePathname } from "next/navigation";

/**
 * The admin surface sits inside the (site) group so it keeps the header and the
 * cart providers, but the storefront footer belongs to shoppers, not to the
 * dashboard. This drops any chrome the admin has no use for.
 */
export function StorefrontOnly({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;

  return <>{children}</>;
}
