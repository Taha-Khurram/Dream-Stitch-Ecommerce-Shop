import React from "react";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Header } from "@/components/layout/Header";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getSettings } from "@/lib/api/settings";
import { getSiteContent } from "@/lib/api/content";
import { getProfile } from "@/lib/auth/admin";
import { BackToTop } from "@/components/motion/BackToTop";
import { PresenceBeacon } from "@/components/presence/PresenceBeacon";

/** Storefront chrome. The (auth) and admin groups deliberately opt out of it. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  /* One profile read answers both questions the header asks — who is signed in,
     and may they see the admin link. `getProfile` is request-cached, so this
     costs nothing extra anywhere else in the tree. */
  const [settings, profile, content] = await Promise.all([
    getSettings(),
    getProfile(),
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
        <Header
          announcements={settings.announcements}
          isAdmin={profile?.role === "admin"}
          user={profile ? { email: profile.email } : null}
          content={content.header}
        />
        <main className="flex-1">{children}</main>
        <CartDrawer />
        {content.footer.enabled && <SiteFooter settings={settings} content={content.footer} />}
        <BackToTop />
        {/* Renders nothing. Says "a tab is open here" so /admin can count it.
            Mounted on the layout rather than per page, so moving around the
            shop does not restart its clock. */}
        <PresenceBeacon />
      </WishlistProvider>
    </CartProvider>
  );
}
