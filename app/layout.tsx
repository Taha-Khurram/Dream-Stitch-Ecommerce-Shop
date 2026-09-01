import type { Metadata } from "next";
import { Jost, Prata, Great_Vibes } from "next/font/google";
import "./globals.css";
import { BRAND } from "@/lib/constants";

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-jost",
  display: "swap",
});

const prata = Prata({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-prata",
  display: "swap",
});

/* Wordmark only — never body or headings. */
const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-great-vibes",
  display: "swap",
});

export const metadata: Metadata = {
  title: `${BRAND.name} ${BRAND.suffix} | ${BRAND.tagline}`,
  description:
    "Premium bedsheets in pure cotton, cotton zeen and cotton satin. King and single sets in stock, or made to your exact measurements. Delivered nationwide.",
};

/**
 * Only the document shell lives here. Site chrome (header, cart, footer) is
 * owned by the (site) group so the (auth) group can render a bare page.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jost.variable} ${prata.variable} ${greatVibes.variable}`}>
      <body className="flex min-h-screen flex-col bg-white text-ink antialiased">
        {children}
      </body>
    </html>
  );
}
