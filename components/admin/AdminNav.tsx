"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Tags, Receipt, Users, Inbox, Mail, Settings } from "lucide-react";

const LINKS = [
  { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { name: "Products", href: "/admin/products", icon: Package },
  { name: "Categories", href: "/admin/categories", icon: Tags },
  { name: "Orders", href: "/admin/orders", icon: Receipt },
  { name: "Customers", href: "/admin/customers", icon: Users },
  /* The two storefront forms land here. Below the trading screens because
     neither is where a morning starts, and above Settings because both are
     day-to-day work rather than configuration. */
  { name: "Contacts", href: "/admin/contacts", icon: Inbox },
  { name: "Newsletter", href: "/admin/newsletter", icon: Mail },
  { name: "Settings", href: "/admin/settings", icon: Settings },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5 lg:overflow-visible">
      {LINKS.map(({ name, href, icon: Icon }) => {
        // Dashboard is the index, so it must match exactly or it lights up
        // for every child route.
        const active = href === "/admin" ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-3 px-3 py-2.5 text-[13px] font-medium transition-colors ${
              active
                ? "bg-purple text-white"
                : "text-ink-soft hover:bg-lilac hover:text-purple"
            }`}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.5} />
            {name}
          </Link>
        );
      })}
    </nav>
  );
}
