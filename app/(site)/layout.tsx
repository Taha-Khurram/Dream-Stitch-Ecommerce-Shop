import React from "react";
import Link from "next/link";
import { CartProvider } from "@/context/CartContext";
import { WishlistProvider } from "@/context/WishlistContext";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { Header } from "@/components/layout/Header";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { ComingSoon } from "@/components/layout/ComingSoon";
import { getSettings } from "@/lib/api/settings";
import { getSiteContent } from "@/lib/api/content";
import { getAccount } from "@/lib/auth/admin";
import { isHoldingPageUp } from "@/lib/coming-soon";
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

  /* The pre-launch gate, and the only place it is enforced.

     It lives on this layout rather than in `middleware.ts` on purpose. The
     middleware runs on every asset-adjacent request and has no request cache,
     so gating there would have meant a fresh database round trip per request
     just to ask a question the layout already has the answer to. Everything a
     visitor can reach is inside this group, and the two groups that are not —
     (auth) and admin — are exactly the two an admin needs in order to sign in
     and turn the gate back off. */
  const holding = isHoldingPageUp(settings);

  /* Admins walk through it. Locking the owner out of their own storefront
     while they are getting it ready is the opposite of useful, and the bar
     below means they can never mistake the open shop for the public view. */
  if (holding && !account?.isAdmin) {
    return (
      <ComingSoon
        heading={settings.coming_soon_heading}
        message={settings.coming_soon_message}
        note={settings.coming_soon_note}
        cta={settings.coming_soon_cta}
        launchAt={settings.coming_soon_launch_at}
      />
    );
  }

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
        {holding && <HoldingNotice />}
      </WishlistProvider>
    </CartProvider>
  );
}

/**
 * What an admin sees instead of the holding page.
 *
 * Without this the shop looks perfectly normal to the one person who can tell
 * that it is not — which is how a store stays shut for a week after launch
 * day. Bottom left, clear of the WhatsApp button and the back-to-top control.
 */
function HoldingNotice() {
  return (
    <div className="fixed bottom-4 left-4 z-40 flex max-w-[min(22rem,calc(100vw-2rem))] flex-wrap items-center gap-x-2 gap-y-1 border border-purple/30 bg-white px-3.5 py-2.5 text-[12px] shadow-[0_4px_16px_rgba(42,27,51,0.12)]">
      <span className="font-medium text-ink">Coming soon is on.</span>
      <span className="text-muted">Visitors see the countdown, not the shop.</span>
      <Link
        href="/admin/settings?tab=coming-soon"
        className="font-medium text-purple underline underline-offset-2 hover:text-purple-deep"
      >
        Change
      </Link>
    </div>
  );
}
