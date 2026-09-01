"use client";

import React from "react";
import { ScrollReveal } from "@/components/motion/ScrollReveal";

/**
 * A template (rather than a layout) remounts on every navigation, which is
 * exactly what an entrance animation needs. Site chrome stays in the layout
 * above, so the header, cart and footer hold their place while only the page
 * body fades up.
 *
 * Kept to 300ms on purpose: these pages are `force-dynamic`, so the shopper
 * has already waited on the server. Adding a long, showy transition on top of
 * that spends their patience twice.
 *
 * ScrollReveal is mounted here rather than in the root layout because this is
 * inside the route segment's Suspense boundary — see the note in that file.
 * Remounting per navigation is a bonus: each new page re-registers its own
 * reveals without needing anything carried across.
 */
export default function SiteTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-in">
      <ScrollReveal />
      {children}
    </div>
  );
}
