"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { BRAND, NAV_ITEMS, type NavItem } from "@/lib/constants";
import { Search, Heart, User as UserIcon, Menu, X, ChevronRight, LogOut } from "lucide-react";

/**
 * Sticky chrome is a single 56px row: wordmark left, page links centred,
 * actions right. The announcement strip sits outside the sticky wrapper so it
 * scrolls away and never eats into the viewport.
 *
 * `app/shop/page.tsx` pins its filter rail below this; keep the two in step.
 */
const ANNOUNCEMENT_MS = 5200;

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
        className={`font-[family-name:var(--font-display)] tracking-[0.34em] text-ink transition-colors duration-300 group-hover:text-purple ${
          compact ? "text-[15px]" : "text-[16px] sm:text-[19px]"
        }`}
      >
        {BRAND.name}
      </span>
      {!compact && (
        <span className="mt-[6px] text-[7px] font-medium uppercase tracking-[0.42em] text-muted">
          {BRAND.suffix}
        </span>
      )}
    </Link>
  );
}

/* ── Announcement strip ────────────────────────────────────────────────── */
function AnnouncementBar() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;

    const timer = setInterval(
      () => setIndex((i) => (i + 1) % ANNOUNCEMENTS.length),
      ANNOUNCEMENT_MS
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative h-8 overflow-hidden bg-aubergine text-white">
      {ANNOUNCEMENTS.map((message, i) => (
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

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onClose();
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
    <div className="fixed inset-0 z-[60] bg-aubergine/25 backdrop-blur-[2px]" onClick={onClose}>
      <div
        className="animate-fade-up border-b border-line bg-white px-6 py-10 sm:py-14"
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

/* ── Mega panel for one nav item ───────────────────────────────────────── */
function MegaPanel({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  if (!item.columns?.length) return null;

  return (
    <div className="absolute inset-x-0 top-full z-50 border-t border-line bg-white shadow-[0_24px_40px_-32px_rgba(42,27,51,0.45)]">
      <div className="mx-auto grid max-w-[1500px] grid-cols-12 gap-10 px-6 py-10 xl:px-10">
        <div className="col-span-12 grid grid-cols-2 gap-x-10 gap-y-8 md:grid-cols-3 lg:col-span-8 lg:grid-cols-4">
          {item.columns.map((column) => (
            <div key={column.title}>
              <Link
                href={column.href}
                onClick={onNavigate}
                className="eyebrow text-ink transition-colors hover:text-purple"
              >
                {column.title}
              </Link>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      onClick={onNavigate}
                      className="text-[13px] text-ink-soft transition-colors hover:text-purple"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {item.feature && (
          <Link href={item.feature.href} onClick={onNavigate} className="group col-span-12 lg:col-span-4">
            <div className="relative aspect-[4/3] overflow-hidden bg-lilac">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.feature.image}
                alt={item.feature.title}
                className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
              />
            </div>
            <span className="eyebrow mt-4 block text-purple">{item.feature.label}</span>
            <p className="mt-1.5 font-[family-name:var(--font-display)] text-xl text-ink">
              {item.feature.title}
            </p>
            <span className="eyebrow link-underline mt-2 inline-block text-ink">Shop Now</span>
          </Link>
        )}
      </div>
    </div>
  );
}

/* ── Account icon, with a sign-out menu once signed in ─────────────────── */
function AccountMenu({
  user,
  onSignOut,
  className,
}: {
  user: User | null;
  onSignOut: () => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  if (!user) {
    return (
      <Link href="/signin" aria-label="Sign in" className={className}>
        <UserIcon className="h-[17px] w-[17px]" strokeWidth={1.25} />
      </Link>
    );
  }

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
        <span className="absolute -bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-purple" />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-fade-up absolute right-0 top-full z-50 mt-2 w-52 border border-line bg-white p-4 shadow-[0_18px_34px_-26px_rgba(42,27,51,0.5)]"
        >
          <p className="truncate text-[12px] text-ink-soft">{user.email}</p>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="eyebrow mt-4 flex w-full cursor-pointer items-center gap-2 border-t border-line pt-3 text-ink transition-colors hover:text-purple"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.4} /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { totalItems, toggleCart } = useCart();
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [lifted, setLifted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [supabase] = useState(() => createClient());
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null)
    );
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  // Close every transient surface on navigation
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // A hairline shadow once the page moves, so the bar reads as a layer above it
  useEffect(() => {
    const onScroll = () => setLifted(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    window.location.href = "/";
  };

  // Grace period so the pointer can travel from the trigger into the panel
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpenMenu(null), 120);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  const iconButton =
    "relative flex h-8 w-8 cursor-pointer items-center justify-center text-ink transition-colors duration-300 hover:text-purple";

  const activeItem = NAV_ITEMS.find((i) => i.name === openMenu);

  return (
    <>
      <AnnouncementBar />

      <header
        onMouseLeave={scheduleClose}
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
                <li
                  key={item.name}
                  className="flex"
                  onMouseEnter={() => {
                    cancelClose();
                    setOpenMenu(item.columns ? item.name : null);
                  }}
                >
                  <Link
                    href={item.href}
                    className={`group relative flex items-center px-3.5 text-[10px] font-medium uppercase tracking-[0.18em] transition-colors duration-300 xl:px-4 ${
                      item.accent
                        ? "text-sale hover:text-purple-deep"
                        : openMenu === item.name
                          ? "text-purple"
                          : "text-ink hover:text-purple"
                    }`}
                  >
                    {item.name}
                    {/* Hairline that wipes in from the centre on hover or open */}
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none absolute inset-x-3.5 bottom-0 h-px origin-center bg-purple transition-transform duration-300 group-hover:scale-x-100 xl:inset-x-4 ${
                        openMenu === item.name ? "scale-x-100" : "scale-x-0"
                      }`}
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
              href="/shop?sort=rating"
              aria-label="Wishlist"
              className={`${iconButton} hidden sm:flex`}
            >
              <Heart className="h-[17px] w-[17px]" strokeWidth={1.25} />
            </Link>

            <AccountMenu user={user} onSignOut={handleSignOut} className={iconButton} />

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

        {/* Mega panel hangs off the header, so it spans the full width */}
        {activeItem && (
          <div onMouseEnter={cancelClose}>
            <MegaPanel item={activeItem} onNavigate={() => setOpenMenu(null)} />
          </div>
        )}
      </header>

      <Suspense fallback={null}>
        <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      </Suspense>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-aubergine/45" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white">
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

            <div className="flex-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const expanded = mobileSection === item.name;
                return (
                  <div key={item.name} className="border-b border-line-soft">
                    <div className="flex items-center">
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex-1 px-5 py-4 text-[11px] font-medium uppercase tracking-[0.18em] ${
                          item.accent ? "text-sale" : "text-ink"
                        }`}
                      >
                        {item.name}
                      </Link>
                      {item.columns && (
                        <button
                          onClick={() => setMobileSection(expanded ? null : item.name)}
                          aria-label={`Toggle ${item.name}`}
                          aria-expanded={expanded}
                          className="cursor-pointer px-5 py-4 text-muted"
                        >
                          <ChevronRight
                            className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`}
                          />
                        </button>
                      )}
                    </div>

                    {expanded && item.columns && (
                      <div className="space-y-5 bg-frost px-5 pb-5 pt-1">
                        {item.columns.map((column) => (
                          <div key={column.title}>
                            <span className="eyebrow text-muted">{column.title}</span>
                            <ul className="mt-3 space-y-2.5">
                              {column.links.map((link) => (
                                <li key={link.name}>
                                  <Link
                                    href={link.href}
                                    onClick={() => setMobileOpen(false)}
                                    className="text-[13px] text-ink-soft"
                                  >
                                    {link.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-line px-5 py-5">
              {user ? (
                <button onClick={handleSignOut} className="btn-outline w-full cursor-pointer">
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </button>
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
