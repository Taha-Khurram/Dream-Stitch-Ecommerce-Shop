import React from "react";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Header } from "@/components/layout/Header";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { StorefrontOnly } from "@/components/layout/StorefrontOnly";
import { getSettings } from "@/lib/api/settings";
import { getSiteContent } from "@/lib/api/content";
import { isAdmin } from "@/lib/auth/admin";
import { BackToTop } from "@/components/motion/BackToTop";

/** Storefront chrome. The (auth) group deliberately opts out of all of it. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [settings, admin, content] = await Promise.all([
    getSettings(),
    isAdmin(),
    getSiteContent(),
  ]);

  return (
    <CartProvider
      rates={{
        freeShippingThreshold: settings.free_shipping_threshold,
        shippingFee: settings.shipping_fee,
      }}
    >
      <WishlistProvider>
        <Header announcements={settings.announcements} isAdmin={admin} content={content.header} />
        <main className="flex-1">{children}</main>
        <CartDrawer />
        {content.footer.enabled && (
          <StorefrontOnly>
            <SiteFooter settings={settings} content={content.footer} />
          </StorefrontOnly>
        )}
        <BackToTop />
      </WishlistProvider>
    </CartProvider>
  );
}
