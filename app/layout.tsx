import type { Metadata } from "next";
import { Jost, Prata, Great_Vibes } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Header } from "@/components/layout/Header";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { BRAND } from "@/lib/constants";
import { getSettings } from "@/lib/api/settings";
import { isAdmin } from "@/lib/auth/admin";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [settings, admin] = await Promise.all([getSettings(), isAdmin()]);

  return (
    <html lang="en" className={`${jost.variable} ${prata.variable} ${greatVibes.variable}`}>
      <body className="flex min-h-screen flex-col bg-white text-ink antialiased">
        <CartProvider
          rates={{
            freeShippingThreshold: settings.free_shipping_threshold,
            shippingFee: settings.shipping_fee,
          }}
        >
          <Header announcements={settings.announcements} isAdmin={admin} />
          <main className="flex-1">{children}</main>
          <CartDrawer />
          <SiteFooter settings={settings} />
        </CartProvider>
      </body>
    </html>
  );
}
