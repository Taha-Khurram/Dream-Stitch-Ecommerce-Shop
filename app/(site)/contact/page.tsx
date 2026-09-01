import React from "react";
import type { Metadata } from "next";
import { BRAND } from "@/lib/constants";
import { getSiteContent } from "@/lib/api/content";
import { ContactView } from "@/components/contact/ContactView";

export const metadata: Metadata = {
  title: `Customer Care | ${BRAND.name} ${BRAND.suffix}`,
  description:
    "Delivery times, custom sizes, fabric care and exchanges — the answers, and a form that reaches a person.",
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const content = await getSiteContent();

  return <ContactView content={content.contact} />;
}
