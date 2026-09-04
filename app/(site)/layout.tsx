import React from "react";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Header } from "@/components/layout/Header";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getSettings } from "@/lib/api/settings";
import { getSiteContent } from "@/lib/api/content";
import { getAccount } from "@/lib/auth/admin";
import { BackToTop } from "@/components/motion/BackToTop";
import { WhatsAppFab } from "@/components/layout/WhatsAppFab";
import { PresenceBeacon } from "@/components/presence/PresenceBeacon";

/** Storefront chrome. The (auth) and admin groups deliberately opt out of it. */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  /* One read answers both questions the header asks — who is signed in, and
     may they see the admin link. `getAccount` is request-cached and shares its
     GoTrue call with `getProfile`, so this costs nothing extra elsewhere in
     the tree. It reports the session, so an account whose `profiles` row is
     missing still renders as signed in rather than being offered a Sign In
     link it has no use for. */
  const [settings, account, content] = await Promise.all([
    getSettings(),
    getAccount(),
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
          isAdmin={account?.isAdmin ?? false}
          user={account ? { email: account.email } : null}
          content={content.header}
        />
        <main className="flex-1">{children}</main>
        <CartDrawer />
        {content.footer.enabled && <SiteFooter settings={settings} content={content.footer} />}
        <BackToTop />
        {/* Owner's number comes from /admin/settings, so it can change
            without a deploy; the compiled-in constant is the fallback. */}
        <WhatsAppFab phone={settings.brand_whatsapp} />
        {/* Renders nothing. Says "a tab is open here" so /admin can count it.
            Mounted on the layout rather than per page, so moving around the
            shop does not restart its clock. */}
        <PresenceBeacon />
      </WishlistProvider>
    </CartProvider>
  );
}
