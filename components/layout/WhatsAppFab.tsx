"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { ArrowRight, MessageCircle, Package, Ruler, Scissors, Sparkles, X } from "lucide-react";
import { BRAND } from "@/lib/constants";
import { WHATSAPP_TOPICS, waLink, type WhatsAppTopic } from "@/lib/whatsapp";

/**
 * Floating WhatsApp concierge.
 *
 * The button opens a small panel of pre-typed inquiries rather than jumping
 * straight to a blank chat: a customer who has to compose the first message
 * often does not send one. Every row is still just a `wa.me` link, so the
 * whole thing works with one tap and no chat backend behind it.
 */

type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>;

const ICONS: Record<WhatsAppTopic["icon"], IconComponent> = {
  sizing: Ruler,
  order: Package,
  custom: Scissors,
  chat: Sparkles,
};

export function WhatsAppFab({ phone }: { phone: string | null }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstRowRef = useRef<HTMLAnchorElement>(null);

  const close = useCallback((returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }, []);

  /* Escape and outside clicks dismiss it, the way the header's panels do.
     Bound only while open, so the page carries no idle listeners. */
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open, close]);

  // Opening by keyboard should land inside the panel, not leave focus behind it.
  useEffect(() => {
    if (open) firstRowRef.current?.focus();
  }, [open]);

  // No number configured means no button — better than a dead chat link.
  if (!phone) return null;

  return (
    <div ref={rootRef} className="fixed right-6 bottom-6 z-40 flex flex-col items-end gap-3">
      <div
        id={panelId}
        role="dialog"
        aria-label="WhatsApp concierge"
        aria-hidden={!open}
        className={`w-[min(21rem,calc(100vw-3rem))] origin-bottom-right overflow-hidden rounded-[14px] border border-line bg-white shadow-[0_30px_60px_-28px_rgba(42,27,51,0.55)] transition-[opacity,transform] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none translate-y-3 scale-[0.97] opacity-0"
        }`}
      >
        {/* Header — who is on the other end, and how soon they answer. */}
        <div className="flex items-start gap-3 bg-gradient-to-br from-[#0f5f52] to-[#075e54] px-4 py-3.5 text-white">
          <span className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15">
            <MessageCircle className="h-4 w-4" strokeWidth={1.6} />
            <span className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-[#0f5f52] bg-[#25d366]" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[0.78rem] font-medium uppercase tracking-[0.14em]">
              {BRAND.name} Concierge
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[0.68rem] text-white/75">
              <span className="h-1.5 w-1.5 rounded-full bg-[#25d366]" />
              Online · Replies in ~5 mins
            </span>
          </span>

          <button
            type="button"
            onClick={() => close()}
            tabIndex={open ? 0 : -1}
            aria-label="Close WhatsApp concierge"
            className="-mr-1 cursor-pointer rounded-full p-1 text-white/70 transition-colors duration-[180ms] hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" strokeWidth={1.6} />
          </button>
        </div>

        <p className="border-b border-line-soft bg-frost px-4 py-3 text-[0.8rem] leading-relaxed text-ink-soft">
          Hello! How can our stitching &amp; customer care team assist you today?
        </p>

        {/* Each row is a finished question — one tap sends it. */}
        <div className="flex flex-col gap-1.5 p-3">
          {WHATSAPP_TOPICS.map((topic, index) => {
            const Icon = ICONS[topic.icon];
            return (
              <a
                key={topic.label}
                ref={index === 0 ? firstRowRef : undefined}
                href={waLink(phone, topic.message)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => close(false)}
                tabIndex={open ? 0 : -1}
                className="group/row flex items-center gap-3 rounded-[10px] border border-line-soft bg-white px-3 py-2.5 text-[0.82rem] text-ink transition-[background-color,border-color] duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-line hover:bg-lilac focus-visible:border-line focus-visible:bg-lilac focus-visible:outline-none"
              >
                <Icon className="h-4 w-4 shrink-0 text-purple" strokeWidth={1.5} />
                <span className="min-w-0 flex-1 truncate">{topic.label}</span>
                <ArrowRight
                  className="h-3.5 w-3.5 shrink-0 text-faint transition-transform duration-[180ms] group-hover/row:translate-x-0.5 group-hover/row:text-purple"
                  strokeWidth={1.5}
                />
              </a>
            );
          })}
        </div>

        {/* The escape hatch for anyone whose question is not on the list. */}
        <div className="px-3 pb-3">
          <a
            href={waLink(phone)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => close(false)}
            tabIndex={open ? 0 : -1}
            className="flex items-center justify-center gap-2 rounded-[10px] bg-[#25d366] px-4 py-3 text-[0.72rem] font-medium tracking-[0.16em] text-white uppercase transition-colors duration-[180ms] hover:bg-[#1ebe5b] focus-visible:ring-2 focus-visible:ring-[#128c7e] focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <MessageCircle className="h-4 w-4" strokeWidth={1.8} />
            Start Direct Chat
          </a>
        </div>
      </div>

      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close WhatsApp concierge" : "Order directly on WhatsApp"}
        className="group relative flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-[#25d366] text-white shadow-[0_18px_34px_-14px_rgba(18,140,126,0.75)] transition-[transform,box-shadow,background-color] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-[#1ebe5b] hover:shadow-[0_22px_40px_-14px_rgba(18,140,126,0.85)] focus-visible:ring-2 focus-visible:ring-[#128c7e] focus-visible:ring-offset-2 focus-visible:ring-offset-white focus-visible:outline-none active:translate-y-0"
      >
        {/* A quiet halo that draws the eye once. It stops while the panel is
            open, where it would only be noise. */}
        {!open && (
          <span
            aria-hidden
            className="wa-fab-ring absolute inset-0 rounded-full bg-[#25d366] opacity-60"
          />
        )}

        {open ? (
          <X className="relative h-6 w-6" strokeWidth={1.8} />
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden
            className="relative h-7 w-7 transition-transform duration-[320ms] ease-[cubic-bezier(0.34,1.4,0.64,1)] group-hover:scale-105"
          >
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.97L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.19-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.26.86 5.81 2.42a8.16 8.16 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.4-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06a6.7 6.7 0 0 1-1.98-1.22 7.44 7.44 0 0 1-1.37-1.71c-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.72 2.63 4.17 3.69.58.25 1.04.4 1.4.51.58.19 1.11.16 1.53.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.11-.23-.17-.48-.29Z" />
          </svg>
        )}
      </button>
    </div>
  );
}
