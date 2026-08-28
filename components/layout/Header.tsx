"use client";

import React, { useState, useEffect, Suspense, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { BRAND, NAV_ITEMS, type NavItem } from "@/lib/constants";
import {
  Search,
  Heart,
  User as UserIcon,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  LogOut,
  MapPin,
} from "lucide-react";

/* ── Serif wordmark ────────────────────────────────────────────────────── */
function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group inline-flex flex-col items-center leading-none">
      <span
        className={`font-[family-name:var(--font-display)] tracking-[0.32em] text-ink transition-colors group-hover:text-clay ${
          compact ? "text-xl" : "text-2xl sm:text-[32px]"
        }`}
      >
        {BRAND.name}
      </span>
      {!compact && (
        <span className="eyebrow mt-1.5 text-[8px] tracking-[0.34em] text-muted">
          Est. 2014 · Karachi
        </span>
      )}
    </Link>
  );
}

/* ── Announcement marquee ──────────────────────────────────────────────── */
function AnnouncementBar() {
  const messages = [
    "Free delivery on orders above PKR 3,000",
    "New In — Sawan Lawn Vol. I is now live",
    "Easy 14-day exchange at all AASHNA stores",
    "Stitching services available nationwide",
  ];

  return (
    <div className="overflow-hidden bg-ink text-white">
      <div className="relative flex h-9 items-center">
        <div className="marquee-track whitespace-nowrap">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center" aria-hidden={copy === 1}>
              {messages.map((message) => (
                <span key={message} className="eyebrow flex items-center px-8 text-white/85">
                  {message}
                  <span className="ml-8 text-white/25">◆</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Slim utility strip above the masthead ─────────────────────────────── */
function UtilityBar({ user, onSignOut }: { user: User | null; onSignOut: () => void }) {
  return (
    <div className="hidden border-b border-line bg-cream lg:block">
      <div className="mx-auto flex h-9 max-w-[1500px] items-center justify-between px-6 xl:px-10">
        <Link
          href="/contact"
          className="eyebrow flex items-center gap-1.5 text-muted transition-colors hover:text-ink"
        >
          <MapPin className="h-3 w-3" />
          Store Locator
        </Link>

        <div className="flex items-center gap-6">
          <Link href="/about" className="eyebrow text-muted transition-colors hover:text-ink">
            Our Story
          </Link>
          <Link href="/contact" className="eyebrow text-muted transition-colors hover:text-ink">
            Track Order
          </Link>
          <Link href="/contact" className="eyebrow text-muted transition-colors hover:text-ink">
            Help
          </Link>
          {user ? (
            <button
              onClick={onSignOut}
              className="eyebrow cursor-pointer text-clay transition-colors hover:text-ink"
            >
              Sign Out
            </button>
          ) : (
            <Link href="/signin" className="eyebrow text-clay transition-colors hover:text-ink">
              Sign In / Register
            </Link>
          )}
        </div>
      </div>
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
    "Lawn 3 Piece",
    "Chikankari Kurta",
    "Organza Dupatta",
    "Eid Formals",
    "Khaddar",
  ];

  return (
    <div className="fixed inset-0 z-[60] bg-ink/25 backdrop-blur-[2px]" onClick={onClose}>
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
            <Search className="h-5 w-5 shrink-0 text-muted" />
            <input
              ref={inputRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="What are you looking for?"
              aria-label="Search products"
              className="w-full bg-transparent font-[family-name:var(--font-display)] text-2xl text-ink placeholder-faint focus:outline-none sm:text-3xl"
            />
            <button type="submit" className="eyebrow link-underline shrink-0 cursor-pointer text-clay">
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
    <div className="absolute inset-x-0 top-full z-50 border-t border-line bg-white shadow-[0_24px_40px_-32px_rgba(27,26,24,0.45)]">
      <div className="mx-auto grid max-w-[1500px] grid-cols-12 gap-10 px-6 py-10 xl:px-10">
        <div className="col-span-12 grid grid-cols-2 gap-x-10 gap-y-8 md:grid-cols-3 lg:col-span-8 lg:grid-cols-4">
          {item.columns.map((column) => (
            <div key={column.title}>
              <Link
                href={column.href}
                onClick={onNavigate}
                className="eyebrow text-ink transition-colors hover:text-clay"
              >
                {column.title}
              </Link>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      onClick={onNavigate}
                      className="text-[13px] text-ink-soft transition-colors hover:text-clay"
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
            <div className="relative aspect-[4/3] overflow-hidden bg-sand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.feature.image}
                alt={item.feature.title}
                className="h-full w-full object-cover transition-transform duration-[1200ms] group-hover:scale-105"
              />
            </div>
            <span className="eyebrow mt-4 block text-clay">{item.feature.label}</span>
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

export function Header() {
  const { totalItems, toggleCart } = useCart();
  const pathname = usePathname();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSection, setMobileSection] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
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
    "relative flex h-9 w-9 cursor-pointer items-center justify-center text-ink transition-colors hover:text-clay";

  const activeItem = NAV_ITEMS.find((i) => i.name === openMenu);

  return (
    <>
      <AnnouncementBar />

      <header className="sticky top-0 z-50 border-b border-line bg-white">
        <UtilityBar user={user} onSignOut={handleSignOut} />

        {/* Masthead: actions left, wordmark centred, actions right */}
        <div className="mx-auto flex max-w-[1500px] items-center gap-4 px-4 py-4 sm:px-6 xl:px-10">
          <div className="flex flex-1 items-center gap-1">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              className={`${iconButton} lg:hidden`}
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>
            <button onClick={() => setSearchOpen(true)} aria-label="Search" className={iconButton}>
              <Search className="h-[18px] w-[18px]" />
            </button>
          </div>

          <div className="flex shrink-0 justify-center">
            <Wordmark />
          </div>

          <div className="flex flex-1 items-center justify-end gap-1">
            <Link
              href="/shop?sort=rating"
              aria-label="Wishlist"
              className={`${iconButton} hidden sm:flex`}
            >
              <Heart className="h-[18px] w-[18px]" />
            </Link>

            <Link
              href={user ? "/dashboard" : "/signin"}
              aria-label={user ? "My account" : "Sign in"}
              className={iconButton}
            >
              <UserIcon className="h-[18px] w-[18px]" />
            </Link>

            <button
              onClick={toggleCart}
              aria-label={`Shopping bag, ${totalItems} items`}
              className={iconButton}
            >
              <ShoppingBagIcon />
              {totalItems > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-clay px-1 text-[9px] font-medium text-white">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Desktop nav rail */}
        <nav className="relative hidden border-t border-line-soft lg:block" onMouseLeave={scheduleClose}>
          <ul className="mx-auto flex max-w-[1500px] items-center justify-center px-6 xl:px-10">
            {NAV_ITEMS.map((item) => (
              <li
                key={item.name}
                onMouseEnter={() => {
                  cancelClose();
                  setOpenMenu(item.columns ? item.name : null);
                }}
              >
                <Link
                  href={item.href}
                  className={`label-track flex items-center gap-1 px-4 py-3.5 text-[11px] font-medium transition-colors xl:px-5 ${
                    item.accent
                      ? "text-sale hover:text-clay-deep"
                      : openMenu === item.name
                        ? "text-clay"
                        : "text-ink hover:text-clay"
                  }`}
                >
                  {item.name}
                  {item.columns && <ChevronDown className="h-3 w-3 opacity-40" />}
                </Link>
              </li>
            ))}
          </ul>

          {activeItem && (
            <div onMouseEnter={cancelClose}>
              <MegaPanel item={activeItem} onNavigate={() => setOpenMenu(null)} />
            </div>
          )}
        </nav>
      </header>

      <Suspense fallback={null}>
        <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
      </Suspense>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <Wordmark compact />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="cursor-pointer text-muted hover:text-ink"
              >
                <X className="h-5 w-5" />
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
                        className={`label-track flex-1 px-5 py-4 text-[12px] font-medium ${
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
                      <div className="space-y-5 bg-cream px-5 pb-5 pt-1">
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
                <button
                  onClick={handleSignOut}
                  className="btn-outline w-full cursor-pointer"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign Out
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/signin" className="btn-outline">
                    Sign In
                  </Link>
                  <Link href="/signup" className="btn-ink">
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
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden="true">
      <path
        d="M4.5 7.5h15l-1.1 12.2a1.5 1.5 0 0 1-1.5 1.3H7.1a1.5 1.5 0 0 1-1.5-1.3L4.5 7.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M8.75 9.5V6.75a3.25 3.25 0 0 1 6.5 0V9.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
