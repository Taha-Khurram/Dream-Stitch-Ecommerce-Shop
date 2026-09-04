import React from "react";

/**
 * Floating click-to-chat button.
 *
 * WhatsApp's own `wa.me` endpoint does the routing: it picks the app on a
 * phone and WhatsApp Web on a desktop, so there is nothing to detect here
 * and no widget script to load.
 */

/** What lands in the customer's compose box before they type a word. */
const DEFAULT_MESSAGE = "Hi dreamstitchbysk, I want to inquire about your bedsheets.";

/**
 * `wa.me` wants a bare international number — digits only, no `+`, no spaces,
 * no leading zero. The admin settings field accepts whatever an owner types
 * ("+92 333 1166929", "0333 1166929"), so normalise here rather than asking
 * them to remember the format.
 */
export function waLink(phone: string, message: string = DEFAULT_MESSAGE): string {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  // A Pakistani number given in local form ("3331166929") still needs its code.
  const intl = digits.startsWith("92") ? digits : `92${digits}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

export function WhatsAppFab({
  phone,
  message,
}: {
  phone: string | null;
  message?: string;
}) {
  // No number configured means no button — better than a dead chat link.
  if (!phone) return null;

  return (
    <a
      href={waLink(phone, message)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Order directly on WhatsApp"
      className="group fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-[0_18px_34px_-14px_rgba(18,140,126,0.75)] outline-none transition-[transform,box-shadow,background-color] duration-[320ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:bg-[#1ebe5b] hover:shadow-[0_22px_40px_-14px_rgba(18,140,126,0.85)] focus-visible:ring-2 focus-visible:ring-[#128c7e] focus-visible:ring-offset-2 focus-visible:ring-offset-white active:translate-y-0"
    >
      {/* A quiet halo, once per page under reduced motion — the global rule
          caps iteration counts, so this settles instead of pulsing forever. */}
      <span
        aria-hidden
        className="wa-fab-ring absolute inset-0 rounded-full bg-[#25d366] opacity-60"
      />

      {/* Name the destination on hover for anyone who does not read the
          glyph. Hidden on touch widths, where there is no hover to trigger it. */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-[calc(100%+0.75rem)] hidden whitespace-nowrap border border-line bg-white px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.16em] text-ink opacity-0 shadow-[0_16px_34px_-24px_rgba(42,27,51,0.7)] transition-opacity duration-[180ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-focus-visible:opacity-100 sm:block"
      >
        Order on WhatsApp
      </span>

      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        className="relative h-7 w-7 transition-transform duration-[320ms] ease-[cubic-bezier(0.34,1.4,0.64,1)] group-hover:scale-105"
      >
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.46 1.32 4.97L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.19-.31a8.19 8.19 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.26.86 5.81 2.42a8.16 8.16 0 0 1 2.41 5.82c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.4-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06a6.7 6.7 0 0 1-1.98-1.22 7.44 7.44 0 0 1-1.37-1.71c-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.44.12-.14.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.72 2.63 4.17 3.69.58.25 1.04.4 1.4.51.58.19 1.11.16 1.53.1.46-.07 1.42-.58 1.62-1.14.2-.56.2-1.04.14-1.14-.06-.11-.23-.17-.48-.29Z" />
      </svg>
    </a>
  );
}
