"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { useWishlist } from "@/context/WishlistContext";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { BRAND, NAV_ITEMS } from "@/lib/constants";
import { usePresence, useScrollLock } from "@/components/motion/usePresence";
import { startRouteProgress } from "@/components/motion/RouteProgress";
import {
  Search,
  Heart,
  User as UserIcon,
  Menu,
  X,
  LogIn,
  LogOut,
  LayoutDashboard,
  UserPlus,
} from "lucide-react";

/**
 * Sticky chrome is a single 56px row: wordmark left, page links centred,
 * actions right. The announcement strip sits outside the sticky wrapper so it
 * scrolls away and never eats into the viewport.
 *
 * `app/shop/page.tsx` pins its filter rail below this; keep the two in step.
 */
const ANNOUNCEMENT_MS = 5200;

/** Fallback only — the live list comes from `store_settings` via the layout. */
const ANNOUNCEMENTS = [
  "Free delivery on orders above PKR 5,000",
  "Custom sizes made to order — any bed, any drop",
  "Easy 7-day exchange, unused and in original packing",
  "Cash on delivery available nationwide",
];

/* ── Serif wordmark ────────────────────────────────────────────────────── */
function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex flex-col items-start leading-none">
      <span
        className={`font-[family-name:var(--font-script)] leading-[1.15] text-ink transition-colors duration-300 group-hover:text-purple ${
          compact ? "text-[22px]" : "text-[25px] sm:text-[28px]"
        }`}
      >
        {BRAND.name}
      </span>
      {!compact && (
        <span className="mt-[3px] text-[7px] font-medium uppercase tracking-[0.42em] text-muted">
          {BRAND.suffix}
        </span>
      )}
    </Link>
  );
}

/* ── Announcement strip ────────────────────────────────────────────────── */
function AnnouncementBar({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const timer = setInterval(
      () => setIndex((i) => (i + 1) % messages.length),
      ANNOUNCEMENT_MS
    );
    return () => clearInterval(timer);
  }, [messages.length]);

  return (
    <div className="relative h-8 overflow-hidden bg-aubergine text-white">
      {messages.map((message, i) => (
        <p
          key={message}
          aria-hidden={i !== index}
          className={`absolute inset-0 flex items-center justify-center px-6 text-center text-[9px] font-medium uppercase tracking-[0.3em] text-white/75 transition-opacity duration-700 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        >
          {message}
        </p>
      ))}
    </div>
  );
}

/* ── Full-width search overlay ─────────────────────────────────────────── */
function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [term, setTerm] = useState(searchParams.get("search") ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const { mounted, state } = usePresence(open, 200);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!mounted) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
    // A programmatic push bypasses the anchor-click listener, so start the
    // progress bar by hand or the search would navigate with no feedback.
    startRouteProgress();
    router.push(term.trim() ? `/shop?search=${encodeURIComponent(term.trim())}` : "/shop");
  };

  const suggestions = [
    "King Size Bedsheet",
    "Pure Cotton",
    "Cotton Satin",
    "Single Bed Set",
    "Custom Size",
  ];

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div
        className="veil absolute inset-0 bg-aubergine/25 backdrop-blur-[2px]"
        data-state={state}
      />
      <div
        className="sheet-top relative border-b border-line bg-white px-6 py-10 sm:py-14"
        data-state={state}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto max-w-3xl">
          <div className="flex items-start justify-between">
            <span className="eyebrow text-muted">Search {BRAND.name}</span>
            <button
              onClick={onClose}
              aria-label="Close search"
              className="cursor-pointer text-muted transition-colors hover:text-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={submit} className="mt-5 flex items-center gap-4 border-b border-ink pb-3">
            <Search className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.4} />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search bedsheets, fabrics, sizes…"
              aria-label="Search products"
              className="w-full bg-transparent font-[family-name:var(--font-display)] text-2xl text-ink placeholder-faint focus:outline-none sm:text-3xl"
            />
            <button type="submit" className="eyebrow link-underline shrink-0 cursor-pointer text-purple">
              Go
            </button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="eyebrow text-faint">Popular</span>
            {suggestions.map((s) => (
              <Link
                key={s}
                href={`/shop?search=${encodeURIComponent(s)}`}
                onClick={onClose}
                className="link-rule text-[13px] text-ink-soft"
              >
                {s}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Account icon and its dropdown ─────────────────────────────────────── */

/** Every row in the account dropdown shares this line style. */
const MENU_ROW =
  "eyebrow flex w-full items-center gap-2 text-ink transition-colors hover:text-purple";

function AccountMenu({
  user,
  isAdmin,
  onSignOut,
  className,
}: {
  user: User | null;
  isAdmin?: boolean;
  onSignOut: () => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const { mounted: menuMounted, state: menuState } = usePresence(open, 180);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { count: wishlistCount, isHydrated } = useWishlist();
  const savedCount = isHydrated ? wishlistCount : 0;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className={className}
      >
        <UserIcon className="h-[17px] w-[17px]" strokeWidth={1.25} />
        {user && (
          <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-purple" />
        )}
      </button>

      {menuMounted && (
        <div
          role="menu"
          data-state={menuState}
          className="sheet-top absolute right-0 top-full z-50 mt-2 w-52 border border-line bg-white p-4 shadow-[0_18px_34px_-26px_rgba(42,27,51,0.5)]"
        >
          <p className="truncate text-[12px] text-ink-soft">
            {user ? user.email : "Not signed in"}
          </p>

          {/* The wishlist is kept in the browser, so it is offered either way */}
          <Link
            role="menuitem"
            href="/wishlist"
            onClick={() => setOpen(false)}
            className={`${MENU_ROW} mt-4 border-t border-line pt-3`}
          >
            <Heart className="h-3.5 w-3.5" strokeWidth={1.4} /> Wishlist
            {savedCount > 0 && (
              <span className="ml-auto text-[10px] font-medium text-purple">{savedCount}</span>
            )}
          </Link>

          {isAdmin && user && (
            <Link
              role="menuitem"
              href="/admin"
              onClick={() => setOpen(false)}
              className={`${MENU_ROW} mt-3 text-purple hover:text-purple-deep`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" strokeWidth={1.4} /> Admin Panel
            </Link>
          )}

          {user ? (
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
              className={`${MENU_ROW} mt-3 cursor-pointer`}
            >
              <LogOut className="h-3.5 w-3.5" strokeWidth={1.4} /> Sign Out
            </button>
          ) : (
            <>
              <Link
                role="menuitem"
                href="/signin"
                onClick={() => setOpen(false)}
                className={`${MENU_ROW} mt-3`}
              >
                <LogIn className="h-3.5 w-3.5" strokeWidth={1.4} /> Sign In
              </Link>
              <Link
                role="menuitem"
                href="/signup"
                onClick={() => setOpen(false)}
                className={`${MENU_ROW} mt-3`}
              >
                <UserPlus className="h-3.5 w-3.5" strokeWidth={1.4} /> Register
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Header({
  announcements,
  isAdmin,
}: {
  announcements?: string[];
  isAdmin?: boolean;
}) {
  const { totalItems, toggleCart } = useCart();
  const { count: wishlistCount, isHydrated: wishlistHydrated } = useWishlist();
  const savedCount = wishlistHydrated ? wishlistCount : 0;
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { mounted: drawerMounted, state: drawerState } = usePresence(mobileOpen);
  const [lifted, setLifted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [supabase] = useState(() => createClient());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    );
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  // Close every transient surface on navigation
  useEffect(() => {
    setMobileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useScrollLock(mobileOpen);

  // A hairline shadow once the page moves, so the bar reads as a layer above
  // it. Scroll fires far more often than the screen paints, so the read is
  // coalesced to one per frame — this listener is on every page, all the time.
  useEffect(() => {
    let frame = 0;

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setLifted(window.scrollY > 4);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  };

  const iconButton =
    "relative flex h-8 w-8 cursor-pointer items-center justify-center text-ink transition-colors duration-300 hover:text-purple";

  /* Under /admin the shop nav, search, wishlist and cart all point away from
     the work surface — the bar keeps the wordmark and nothing else. */
  if (pathname?.startsWith("/admin")) {
    return (
      <header
        className={`sticky top-0 z-50 border-b bg-white transition-shadow duration-500 ${
          lifted
            ? "border-line shadow-[0_10px_30px_-26px_rgba(42,27,51,0.55)]"
            : "border-line-soft shadow-none"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-[1500px] items-center px-4 sm:px-6 xl:px-10">
          <Wordmark />
        </div>
      </header>
    );
  }

  return (
    <>
      <AnnouncementBar messages={announcements?.length ? announcements : ANNOUNCEMENTS} />

      <header
        className={`sticky top-0 z-50 border-b bg-white transition-shadow duration-500 ${
          lifted
            ? "border-line shadow-[0_10px_30px_-26px_rgba(42,27,51,0.55)]"
            : "border-line-soft shadow-none"
        }`}
      >
        {/* One row: wordmark left, page links centred, actions right */}
        <div className="mx-auto flex h-14 max-w-[1500px] items-center gap-4 px-4 sm:px-6 xl:px-10">
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className={`${iconButton} -ml-2 lg:hidden`}
            >
              <Menu className="h-[17px] w-[17px]" strokeWidth={1.25} />
            </button>
            <Wordmark />
          </div>

          <nav className="hidden h-full flex-1 items-stretch justify-center lg:flex">
            <ul className="flex items-stretch">
              {NAV_ITEMS.map((item) => (
                <li key={item.name} className="flex">
                  <Link
                    href={item.href}
                    className={`group relative flex items-center px-3.5 text-[10px] font-medium uppercase tracking-[0.18em] transition-colors duration-300 xl:px-4 ${
                      item.accent ? "text-sale hover:text-purple-deep" : "text-ink hover:text-purple"
                    }`}
                  >
                    {item.name}
                    {/* Hairline that wipes in from the centre on hover */}
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-3.5 bottom-0 h-px origin-center scale-x-0 bg-purple transition-transform duration-300 group-hover:scale-x-100 xl:inset-x-4"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-1 items-center justify-end gap-0.5 lg:flex-none">
            <button onClick={() => setSearchOpen(true)} aria-label="Search" className={iconButton}>
              <Search className="h-[17px] w-[17px]" strokeWidth={1.25} />
            </button>

            <Link
              href="/wishlist"
              aria-label={
                savedCount > 0 ? `Wishlist, ${savedCount} saved` : "Wishlist"
              }
              className={`${iconButton} hidden sm:flex`}
            >
              <Heart
                className={`h-[17px] w-[17px] ${savedCount > 0 ? "fill-purple text-purple" : ""}`}
                strokeWidth={1.25}
              />
              {savedCount > 0 && (
                <span className="absolute right-0 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-purple px-1 text-[8px] font-medium leading-none text-white">
                  {savedCount}
                </span>
              )}
            </Link>

            <AccountMenu
              user={user}
              isAdmin={isAdmin}
              onSignOut={handleSignOut}
              className={iconButton}
            />

            <button
              onClick={toggleCart}
              aria-label={`Shopping bag, ${totalItems} items`}
              className={`${iconButton} -mr-2`}
            >
              <ShoppingBagIcon />
              {totalItems > 0 && (
                <span className="absolute right-0 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-purple px-1 text-[8px] font-medium leading-none text-white">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <Suspense fallback={null}>
        <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      </Suspense>

      {/* Mobile drawer */}
      {drawerMounted && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div
            className="veil absolute inset-0 bg-aubergine/45"
            data-state={drawerState}
            onClick={() => setMobileOpen(false)}
          />
          <div
            className="sheet-left absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white shadow-[0_0_60px_-15px_rgba(42,27,51,0.45)]"
            data-state={drawerState}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <Wordmark compact />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="cursor-pointer text-muted hover:text-ink"
              >
                <X className="h-5 w-5" strokeWidth={1.4} />
              </button>
            </div>

            <div className="scroll-area flex-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block border-b border-line-soft px-5 py-4 text-[11px] font-medium uppercase tracking-[0.18em] ${
                    item.accent ? "text-sale" : "text-ink"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </div>

            <div className="border-t border-line px-5 py-5">
              <Link
                href="/wishlist"
                onClick={() => setMobileOpen(false)}
                className="mb-4 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-ink"
              >
                <Heart
                  className={`h-3.5 w-3.5 ${savedCount > 0 ? "fill-purple text-purple" : ""}`}
                  strokeWidth={1.4}
                />
                Wishlist
                {savedCount > 0 && (
                  <span className="ml-auto text-[10px] text-purple">{savedCount}</span>
                )}
              </Link>

              {user ? (
                <div className="space-y-3">
                  {isAdmin && (
                    <Link href="/admin" className="btn-primary w-full">
                      <LayoutDashboard className="h-3.5 w-3.5" /> Admin Panel
                    </Link>
                  )}
                  <button onClick={handleSignOut} className="btn-outline w-full cursor-pointer">
                    <LogOut className="h-3.5 w-3.5" /> Sign Out
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/signin" className="btn-outline">
                    Sign In
                  </Link>
                  <Link href="/signup" className="btn-primary">
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* Slim tote outline — reads more like retail packaging than lucide's default. */
function ShoppingBagIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" aria-hidden="true">
      <path
        d="M4.5 7.5h15l-1.1 12.2a1.5 1.5 0 0 1-1.5 1.3H7.1a1.5 1.5 0 0 1-1.5-1.3L4.5 7.5Z"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path
        d="M8.75 9.5V6.75a3.25 3.25 0 0 1 6.5 0V9.5"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}
