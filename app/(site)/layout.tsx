import React from "react";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Header } from "@/components/layout/Header";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getSettings } from "@/lib/api/settings";
import { isAdmin } from "@/lib/auth/admin";
import { BackToTop } from "@/components/motion/BackToTop";

/** Storefront chrome. The (auth) group deliberately opts out of all of it. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, admin] = await Promise.all([getSettings(), isAdmin()]);

  return (
    <CartProvider
      rates={{
        freeShippingThreshold: settings.free_shipping_threshold,
        shippingFee: settings.shipping_fee,
      }}
    >
      <WishlistProvider>
        <Header announcements={settings.announcements} isAdmin={admin} />
        <main className="flex-1">{children}</main>
        <CartDrawer />
        <SiteFooter settings={settings} />
        <BackToTop />
      </WishlistProvider>
    </CartProvider>
  );
}
