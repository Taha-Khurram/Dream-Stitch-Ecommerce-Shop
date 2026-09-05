"use client";

import React, { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BRAND } from "@/lib/constants";
import { launchInstant } from "@/lib/coming-soon";

/**
 * The holding page, shown in place of the entire storefront while
 * `coming_soon_enabled` is on. See `lib/coming-soon.ts` for who decides.
 *
 * The click-to-enter is not a bypass. When the countdown reaches zero the
 * *server* already considers the shop open — the gate compares the same launch
 * instant this component counts down to — so the click only asks Next.js to
 * fetch the page again. That is why there is no cookie and no token here: a
 * visitor who clicks early gets the holding page back, because the shop really
 * is still shut.
 */
export function ComingSoon({
  heading,
  message,
  note,
  cta,
  launchAt,
}: {
  heading: string;
  message: string;
  note: string;
  cta: string;
  /** ISO instant, or null for a hold with no countdown. */
  launchAt: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [remaining, setRemaining] = useState(() => timeLeft(launchAt));
  const [attempted, setAttempted] = useState(false);

  const open = remaining !== null && remaining <= 0;

  useEffect(() => {
    if (launchAt === null) return;

    /* One tick immediately, because the value rendered on the server is as old
       as the request that produced it — on a cached or slow response that can
       be several seconds stale. */
    setRemaining(timeLeft(launchAt));

    const id = setInterval(() => setRemaining(timeLeft(launchAt)), 1000);
    return () => clearInterval(id);
  }, [launchAt]);

  function enter() {
    if (!open) return;
    setAttempted(true);
    startTransition(() => router.refresh());
  }

  return (
    <div
      onClick={enter}
      className={`flex min-h-screen flex-col items-center justify-center bg-aubergine px-6 py-16 text-center text-white ${
        open ? "cursor-pointer" : ""
      }`}
    >
      {/* Soft lilac wash so the panel is not a flat rectangle of aubergine. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(244,239,250,0.16),transparent_60%)]"
      />

      <div className="relative w-full max-w-2xl">
        <span className="font-[family-name:var(--font-script)] text-[44px] leading-[1.1] sm:text-[56px]">
          {BRAND.name}
        </span>
        <span className="mt-1 block text-[10px] font-medium uppercase tracking-[0.42em] text-white/50">
          {BRAND.suffix}
        </span>

        <h1 className="mt-10 font-[family-name:var(--font-display)] text-[26px] leading-tight sm:text-[34px]">
          {heading}
        </h1>

        {message && (
          <p className="mx-auto mt-5 max-w-lg text-[15px] leading-relaxed text-white/70">
            {message}
          </p>
        )}

        {remaining !== null && (
          <Countdown remaining={remaining} launchAt={launchAt} />
        )}

        <div className="mt-12 min-h-[3.5rem]">
          {open ? (
            <>
              <button
                type="button"
                /* The whole screen is clickable for a mouse, but that is not
                   reachable by keyboard or announced by a screen reader, so
                   the real control is this button and the screen merely
                   forwards to it. */
                onClick={(event) => {
                  event.stopPropagation();
                  enter();
                }}
                disabled={pending}
                className="cursor-pointer border border-white/40 px-8 py-3.5 text-[13px] font-medium uppercase tracking-[0.18em] transition-colors hover:border-white hover:bg-white hover:text-aubergine disabled:cursor-wait disabled:opacity-60"
              >
                {pending ? "Opening…" : cta}
              </button>

              {/* A visitor whose own clock runs fast reaches zero before the
                  server does. Saying so beats a click that appears to do
                  nothing. */}
              {attempted && !pending && (
                <p role="status" className="mt-4 text-[13px] text-white/60">
                  Almost — the shop opens in a moment. Try again shortly.
                </p>
              )}
            </>
          ) : (
            note && <p className="text-[13px] leading-relaxed text-white/50">{note}</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── The clock ──────────────────────────────────────────────────────────── */

function Countdown({
  remaining,
  launchAt,
}: {
  remaining: number;
  launchAt: string | null;
}) {
  const { days, hours, minutes, seconds } = split(remaining);

  return (
    <div className="mt-11">
      <div
        className="flex items-start justify-center gap-2.5 sm:gap-4"
        /* The server renders the figure as of the request and the browser
           re-renders it as of hydration; a second between the two is normal
           and is not a bug worth a console warning. */
        suppressHydrationWarning
      >
        <Unit value={days} label="Days" />
        <Unit value={hours} label="Hours" />
        <Unit value={minutes} label="Minutes" />
        <Unit value={seconds} label="Seconds" />
      </div>

      {/* The countdown reads as a duration, which tells nobody *when*. The
          machine-readable instant is here for anyone who wants the date. */}
      {launchAt && (
        <p className="mt-6 text-[12px] uppercase tracking-[0.2em] text-white/40">
          Opening <LocalLaunchDate iso={launchAt} />
        </p>
      )}
    </div>
  );
}

function Unit({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-[68px] border border-white/15 bg-white/5 px-3 py-4 sm:min-w-[88px] sm:px-5">
      <span className="block text-[30px] font-light leading-none tabular-nums sm:text-[42px]">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-2.5 block text-[9px] font-medium uppercase tracking-[0.24em] text-white/45 sm:text-[10px]">
        {label}
      </span>
    </div>
  );
}

/**
 * The launch date in the *visitor's* timezone.
 *
 * Formatted after mount rather than during render, for the reason
 * `DateTimeField` gives: the server has no idea what clock the visitor keeps,
 * so rendering a local time there is a hydration mismatch anywhere the two
 * differ. The `<time>` element carries the instant either way, so the date is
 * never actually absent — only its prose form waits a frame.
 */
function LocalLaunchDate({ iso }: { iso: string }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    setLabel(
      new Date(iso).toLocaleString(undefined, {
        dateStyle: "long",
        timeStyle: "short",
      })
    );
  }, [iso]);

  return (
    <time dateTime={iso} suppressHydrationWarning>
      {label}
    </time>
  );
}

/* ── Arithmetic ─────────────────────────────────────────────────────────── */

/** Milliseconds until launch, floored at zero. Null when there is no date. */
function timeLeft(launchAt: string | null): number | null {
  const launch = launchInstant(launchAt);
  if (launch === null) return null;
  return Math.max(0, launch - Date.now());
}

function split(ms: number) {
  const total = Math.floor(ms / 1000);
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}
