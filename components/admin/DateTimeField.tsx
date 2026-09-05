"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { selectTriggerClass } from "./field-styles";

/**
 * A date and time, typed in the admin's own timezone and submitted as an
 * instant.
 *
 * ── Why the value is posted the way it is ─────────────────────────────
 *
 * A bare `<input type="datetime-local" name="…">` posts `2026-09-10T00:00`
 * with no offset at all, and the server action then has to guess what that
 * meant. `new Date(value)` on the server reads it in the *server's* timezone,
 * which on a deployment is UTC and in Karachi is not — so a code set to start
 * at midnight would quietly start at five in the morning. The bug is invisible
 * in development, where both clocks are the same machine.
 *
 * So the visible control carries no name, and a hidden field beside it carries
 * the ISO instant the browser computed from it. What reaches the action is
 * unambiguous, and what the admin sees is their own clock. That contract is
 * unchanged from when this was a native input — `actions.ts` reads the same
 * hidden field and needs no edit.
 *
 * ── Why the calendar is drawn here rather than by the browser ─────────
 *
 * Same reason `SelectField` exists. A native `datetime-local` can be styled
 * shut but not open: the picker belongs to the OS, so on Windows it came up as
 * a system-blue calendar with a spinning three-column clock beside it, sitting
 * over a form built from hairline borders, square corners and one purple. The
 * closed control was ours and the open one was not — and unlike a select, that
 * popup is *large*, so the mismatch was the loudest thing on the page.
 *
 * Drawing it also lets the two halves sit together. The native control puts
 * the clock in a scrolling column you cannot type into; here the time is two
 * fields you can type or arrow through, under the month it belongs to.
 *
 * The conversion back for an existing value runs in an effect rather than
 * during render, for the same reason it always did: the server has no business
 * rendering a local time, and doing it during render would be a hydration
 * mismatch anywhere the two clocks differ. The panel itself only ever exists
 * on the client, so nothing date-dependent is server-rendered at all.
 */

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Six rows, always. A month that fits in five leaves one row of greyed
 * neighbours rather than resizing the panel — a calendar that changes height
 * as you page through it drags the footer up and down under the cursor.
 */
const GRID_CELLS = 42;

/** Enough to decide, before opening, whether the panel fits below the field. */
const PANEL_WIDTH = 280;
const PANEL_HEIGHT = 396;

type Time = { h: number; m: number };
type Placement = "top" | "bottom";
type Align = "left" | "right";

export function DateTimeField({
  name,
  defaultValue,
  id,
  "aria-describedby": describedBy,
}: {
  name: string;
  /** An ISO instant, or null for an empty field. */
  defaultValue?: string | null;
  id?: string;
  "aria-describedby"?: string;
}) {
  /* Date and time are held apart rather than as one string because they are
     edited apart: the grid writes the day, the two fields below write the
     clock, and neither should have to parse the other's half back out. */
  const [date, setDate] = useState("");
  const [time, setTime] = useState<Time>({ h: 0, m: 0 });

  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [placement, setPlacement] = useState<Placement>("bottom");
  const [align, setAlign] = useState<Align>("left");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const panelId = useId();
  const gridId = `${panelId}-grid`;
  const cellId = (day: Date) => `${gridId}-${key(day)}`;

  const local = date ? `${date}T${pad(time.h)}:${pad(time.m)}` : "";
  const todayKey = key(new Date());

  useEffect(() => {
    const parsed = fromInstant(defaultValue);
    setDate(parsed?.date ?? "");
    setTime(parsed?.time ?? { h: 0, m: 0 });
  }, [defaultValue]);

  /**
   * Down by default — this is a field in the middle of a form, and a panel
   * that springs upward over its own label reads as a mistake. Upward only
   * when it genuinely would not fit below and there is more room above.
   */
  const place = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const below = window.innerHeight - rect.bottom;
    setPlacement(below >= PANEL_HEIGHT || rect.top <= below ? "bottom" : "top");

    /* The panel is wider than a half-width field, so the right-hand column of
       a two-up grid would otherwise push it off the edge of the window. */
    setAlign(rect.left + PANEL_WIDTH > window.innerWidth - 8 ? "right" : "left");
  }, []);

  const openPanel = useCallback(() => {
    setCursor(date ? parseDate(date) : startOfDay(new Date()));
    place();
    setOpen(true);
  }, [date, place]);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  /* Pointer-down, not click: a drag that starts in the panel and ends outside
     should not leave it open behind the cursor. */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  /* A panel this tall is anchored to a field that can scroll out from under
     it, so it re-measures rather than drifting off its own trigger. */
  useEffect(() => {
    if (!open) return;

    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  /* Focus lands on the grid, so the calendar takes arrow keys the moment it
     opens rather than after a Tab. */
  useEffect(() => {
    if (open) gridRef.current?.focus();
  }, [open]);

  function selectDay(day: Date) {
    setDate(key(day));
    setCursor(day);
  }

  /** The clock is meaningless without a day, so setting one implies today. */
  function setClock(next: Time) {
    setTime(next);
    if (!date) {
      const today = startOfDay(new Date());
      setDate(key(today));
      setCursor(today);
    }
  }

  function onGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const move = (days: number) => {
      event.preventDefault();
      setCursor((c) => addDays(c, days));
    };

    switch (event.key) {
      case "ArrowLeft":  return move(-1);
      case "ArrowRight": return move(1);
      case "ArrowUp":    return move(-7);
      case "ArrowDown":  return move(7);
      case "Home":       return move(-cursor.getDay());
      case "End":        return move(6 - cursor.getDay());
      case "PageUp":
        event.preventDefault();
        return setCursor((c) => shiftMonth(c, event.shiftKey ? -12 : -1));
      case "PageDown":
        event.preventDefault();
        return setCursor((c) => shiftMonth(c, event.shiftKey ? 12 : 1));
      case "Enter":
      case " ":
        event.preventDefault();
        return selectDay(cursor);
      case "Escape":
        event.preventDefault();
        return close();
    }
  }

  const days = monthGrid(cursor);
  const monthLabel = `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <div ref={rootRef} className="relative">
      {/* What the server action reads. The trigger is a button precisely so it
          never submits anything itself. */}
      <input type="hidden" name={name} value={toInstant(local)} />

      <button
        ref={triggerRef}
        id={id ?? name}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-describedby={describedBy}
        onClick={() => (open ? close(false) : openPanel())}
        onKeyDown={(event) => {
          if (!open && ["ArrowDown", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            openPanel();
          }
        }}
        className={`${selectTriggerClass} ${
          open ? "border-purple ring-2 ring-purple/15" : ""
        }`}
      >
        <span className={local ? "text-ink tabular-nums" : "text-faint"}>
          {local ? formatDisplay(date, time) : "Pick a date and time"}
        </span>
        <CalendarDays
          aria-hidden
          strokeWidth={1.75}
          className={`h-4 w-4 shrink-0 transition-colors duration-[var(--duration-fast)] ${
            open ? "text-purple" : "text-muted"
          }`}
        />
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Choose a date and time"
          data-placement={placement}
          style={{ width: PANEL_WIDTH }}
          className={`admin-pop absolute z-50 border border-purple/30 bg-white shadow-[0_18px_44px_-20px_rgba(42,27,51,0.5)] ${
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${align === "right" ? "right-0" : "left-0"}`}
        >
          {/* ── Month ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-b border-line-soft px-2 py-2">
            <MonthButton label="Previous month" onClick={() => setCursor((c) => shiftMonth(c, -1))}>
              <ChevronLeft aria-hidden strokeWidth={1.75} className="h-4 w-4" />
            </MonthButton>

            {/* Polite, not assertive: paging with the arrow keys should read the
                new month out without interrupting the key that got there. */}
            <div aria-live="polite" className="text-[13px] font-medium text-ink">
              {monthLabel}
            </div>

            <MonthButton label="Next month" onClick={() => setCursor((c) => shiftMonth(c, 1))}>
              <ChevronRight aria-hidden strokeWidth={1.75} className="h-4 w-4" />
            </MonthButton>
          </div>

          {/* ── Days ──────────────────────────────────────────────── */}
          <div className="px-3.5 pt-3 pb-1">
            <div className="grid grid-cols-7">
              {WEEKDAYS.map((weekday) => (
                <div
                  key={weekday}
                  aria-hidden
                  className="eyebrow flex h-6 items-center justify-center text-faint"
                >
                  {weekday}
                </div>
              ))}
            </div>

            <div
              ref={gridRef}
              role="grid"
              aria-label={monthLabel}
              tabIndex={0}
              aria-activedescendant={cellId(cursor)}
              onKeyDown={onGridKeyDown}
              className="grid grid-cols-7 outline-none"
            >
              {days.map((day) => {
                const dayKey = key(day);
                const outside = day.getMonth() !== cursor.getMonth();
                const selected = dayKey === date;
                const focused = dayKey === key(cursor);
                const isToday = dayKey === todayKey;

                return (
                  <div
                    key={dayKey}
                    id={cellId(day)}
                    role="gridcell"
                    aria-selected={selected}
                    aria-label={fullLabel(day)}
                    onClick={() => selectDay(day)}
                    className={[
                      "flex h-9 cursor-pointer items-center justify-center text-[13px] tabular-nums",
                      "transition-colors duration-[var(--duration-fast)]",
                      selected
                        ? "bg-purple font-medium text-white"
                        : focused
                          ? "bg-lilac text-purple"
                          : outside
                            ? "text-faint hover:bg-lilac-deep/60"
                            : "text-ink hover:bg-lilac hover:text-purple",
                      /* Today is marked by a rule under the number rather than a
                         fill, so it never competes with the day actually chosen. */
                      isToday && !selected
                        ? "font-medium text-purple underline decoration-purple/50 underline-offset-4"
                        : "",
                    ].join(" ")}
                  >
                    {day.getDate()}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Clock ─────────────────────────────────────────────── */}
          <div className="flex items-center gap-3 border-t border-line-soft px-3.5 py-3">
            <span className="eyebrow text-faint">Time</span>

            <div className="flex items-center gap-1">
              <TimePart
                label="Hour"
                value={to12(time.h)}
                min={1}
                max={12}
                onCommit={(hour) => setClock({ ...time, h: to24(hour, time.h >= 12) })}
              />
              <span aria-hidden className="text-sm text-faint">:</span>
              <TimePart
                label="Minute"
                value={time.m}
                min={0}
                max={59}
                onCommit={(minute) => setClock({ ...time, m: minute })}
              />
            </div>

            <div className="ml-auto flex border border-line">
              {(["AM", "PM"] as const).map((half) => {
                const active = (time.h >= 12) === (half === "PM");

                return (
                  <button
                    key={half}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setClock({ ...time, h: to24(to12(time.h), half === "PM") })}
                    className={`px-2 py-1 text-[11px] font-medium tracking-wide transition-colors duration-[var(--duration-fast)] ${
                      active ? "bg-purple text-white" : "text-muted hover:bg-lilac hover:text-purple"
                    }`}
                  >
                    {half}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Actions ───────────────────────────────────────────── */}
          <div className="flex items-center justify-between border-t border-line-soft px-3.5 py-2.5">
            <button
              type="button"
              onClick={() => {
                setDate("");
                setTime({ h: 0, m: 0 });
              }}
              className="text-xs text-muted underline-offset-4 transition-colors duration-[var(--duration-fast)] hover:text-sale hover:underline"
            >
              Clear
            </button>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setDate(key(now));
                  setTime({ h: now.getHours(), m: now.getMinutes() });
                  setCursor(startOfDay(now));
                }}
                className="text-xs text-muted underline-offset-4 transition-colors duration-[var(--duration-fast)] hover:text-purple hover:underline"
              >
                Now
              </button>

              <button
                type="button"
                onClick={() => close()}
                className="bg-purple px-3 py-1.5 text-[11px] font-medium tracking-wide text-white transition-colors duration-[var(--duration-fast)] hover:bg-purple-deep"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** The two month arrows — one component, so they cannot drift apart. */
function MonthButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center text-muted transition-colors duration-[var(--duration-fast)] hover:bg-lilac hover:text-purple focus:outline-none focus-visible:ring-2 focus-visible:ring-purple/30"
    >
      {children}
    </button>
  );
}

/**
 * One half of the clock.
 *
 * Typed rather than spun, because the common edit here is "make that nine" and
 * a scrolling column makes you drag for it. The draft is held as text while you
 * type — committing on every keystroke would turn a half-typed `5` on the way
 * to `50` into five minutes past, and then fight the second digit.
 */
function TimePart({
  label,
  value,
  min,
  max,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
}) {
  const [draft, setDraft] = useState(() => pad(value));
  const [focused, setFocused] = useState(false);

  /* Padding is applied to the settled value, never to what is being typed.
     Re-padding mid-edit is what breaks the second digit: `5` on the way to
     `50` commits as five, comes back as `05`, and the `0` that follows falls
     off the end of a two-character field — so the minute could never be set
     to anything above 12 by typing. */
  useEffect(() => {
    if (!focused) setDraft(pad(value));
  }, [value, focused]);

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      value={draft}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 2);
        setDraft(digits);
        /* Commit as soon as what is typed can only mean one thing, so the
           trigger above keeps up without waiting for a blur. */
        if (digits !== "" && Number(digits) >= min && Number(digits) <= max) {
          onCommit(Number(digits));
        }
      }}
      onFocus={(event) => {
        setFocused(true);
        event.target.select();
      }}
      onBlur={(event) => {
        setFocused(false);

        /* An empty box snaps back to what was there; anything typed that is out
           of range is pulled to the nearest end of it, so leaving a `0` in the
           hour box gives 1 rather than an invalid time. */
        const parsed = Number(event.target.value);
        if (event.target.value === "" || Number.isNaN(parsed)) return setDraft(pad(value));
        onCommit(Math.min(max, Math.max(min, parsed)));
      }}
      onKeyDown={(event) => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();

        /* Wrapping is the point of a clock: 59 and up is 00, not a dead end. */
        const span = max - min + 1;
        const next = event.key === "ArrowUp" ? value + 1 : value - 1;
        onCommit(((next - min + span) % span) + min);
      }}
      className="w-9 border border-line bg-white py-1 text-center text-sm tabular-nums text-ink transition-colors hover:border-faint focus:border-purple focus:ring-2 focus:ring-purple/15 focus:outline-none"
    />
  );
}

/* ── Dates ──────────────────────────────────────────────────────────── */

const pad = (value: number) => String(value).padStart(2, "0");

/** The local calendar day, as the `YYYY-MM-DD` half of the stored value. */
const key = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const parseDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/**
 * Paging from the 31st clamps rather than overflowing: `new Date(y, 1, 31)` is
 * the 3rd of March, so a month step off a long month would skip February.
 */
function shiftMonth(date: Date, months: number) {
  const year = date.getFullYear();
  const month = date.getMonth() + months;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(date.getDate(), lastDay));
}

/** Six weeks from the Sunday on or before the 1st. */
function monthGrid(cursor: Date) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: GRID_CELLS }, (_, index) => addDays(start, index));
}

const to12 = (h24: number) => (h24 % 12 === 0 ? 12 : h24 % 12);
const to24 = (h12: number, pm: boolean) => (h12 % 12) + (pm ? 12 : 0);

/** What the trigger reads once something is chosen. */
function formatDisplay(date: string, time: Time) {
  const day = parseDate(date);
  const meridiem = time.h >= 12 ? "PM" : "AM";

  return (
    `${day.getDate()} ${MONTHS_SHORT[day.getMonth()]} ${day.getFullYear()}` +
    ` · ${to12(time.h)}:${pad(time.m)} ${meridiem}`
  );
}

/** What a screen reader gets for a cell, where "14" alone means nothing. */
const fullLabel = (day: Date) =>
  `${day.getDate()} ${MONTHS[day.getMonth()]} ${day.getFullYear()}`;

/** `2026-09-10T00:00` in this browser's timezone → the ISO instant it means. */
function toInstant(local: string): string {
  if (!local) return "";
  const parsed = new Date(local);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

/** The reverse, for editing a code that already has a window. */
function fromInstant(iso?: string | null): { date: string; time: Time } | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;

  return {
    date: key(parsed),
    time: { h: parsed.getHours(), m: parsed.getMinutes() },
  };
}
