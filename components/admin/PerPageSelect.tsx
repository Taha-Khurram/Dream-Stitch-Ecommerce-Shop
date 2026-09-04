"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { PER_PAGE_OPTIONS, type PerPage } from "@/lib/pagination";

/**
 * Rows per page.
 *
 * This was a native `<select>`, and the popup it opened was drawn by Windows:
 * a system-blue highlight, system corner radius, system font. Next to a panel
 * built out of hairline borders, square corners and one purple, it read as a
 * piece of another application. The closed control can be styled; the open
 * list cannot — the OS owns it — so the list is rebuilt here.
 *
 * That is a real cost: a native select is accessible, and everything it did
 * for free now has to be done by hand. What is implemented, per the APG
 * select-only combobox pattern:
 *
 *   - focus never leaves the trigger; the active option is pointed at with
 *     `aria-activedescendant`, so screen readers announce the option without
 *     the focus ring hopping into a list that vanishes on Escape
 *   - Up/Down/Home/End move, Enter/Space commit, Escape cancels and restores
 *     focus, Tab commits nothing and lets focus pass
 *   - typing a digit jumps to the option starting with it
 *   - pointer-down outside closes
 *
 * One thing it does better than the native control it replaces: arrowing
 * through the list no longer commits on every keypress. A native select on
 * Windows fires `change` on each arrow, so a keyboard user paging with the
 * old control kicked off a navigation per step — 20, then 30, then 40 — and
 * the pager reloaded under them. Here nothing is committed until Enter.
 *
 * Deliberately never disabled while the navigation it started is in flight: a
 * disabled control drops keyboard focus to <body>, throwing the user out of
 * the control the instant they use it. A superseded router.push is harmless,
 * and the dimmed pager plus the progress bar already carry the pending state.
 */

/** Matches the option height below (h-9 = 2.25rem) plus the list's 1px padding. */
const OPTION_HEIGHT = 36;
const LIST_PADDING = 10;
const ESTIMATED_LIST_HEIGHT = PER_PAGE_OPTIONS.length * OPTION_HEIGHT + LIST_PADDING;

type Placement = "top" | "bottom";

export function PerPageSelect({
  value,
  onChange,
}: {
  value: PerPage;
  onChange: (next: PerPage) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement>("top");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  /**
   * The pager lives at the foot of a long table, so upward is nearly always
   * right — and is what keeps the list from being clipped by the viewport
   * bottom. Downward is the fallback for the short-list case, where the whole
   * table fits above the fold and there is more room below than above.
   */
  const choosePlacement = useCallback((): Placement => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return "top";

    const above = rect.top;
    const below = window.innerHeight - rect.bottom;

    if (above >= ESTIMATED_LIST_HEIGHT) return "top";
    return below > above ? "bottom" : "top";
  }, []);

  const openList = useCallback(() => {
    const selected = PER_PAGE_OPTIONS.indexOf(value);
    setActiveIndex(selected < 0 ? 0 : selected);
    setPlacement(choosePlacement());
    setOpen(true);
  }, [choosePlacement, value]);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const next = PER_PAGE_OPTIONS[index];
      close();
      /* The pager treats a no-op resize as a no-op; saying so here as well
         keeps a stray router.push out of the history stack. */
      if (next !== undefined && next !== value) onChange(next);
    },
    [close, onChange, value]
  );

  /* Pointer-down, not click: a click that starts inside and ends outside
     should not leave the list open behind the cursor. */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        openList();
      }
      return;
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        close();
        break;
      case "Tab":
        /* Focus is leaving; abandon the list without committing. */
        setOpen(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => Math.min(PER_PAGE_OPTIONS.length - 1, i + 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(PER_PAGE_OPTIONS.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      default: {
        if (!/^\d$/.test(event.key)) break;
        const match = PER_PAGE_OPTIONS.findIndex((option) =>
          String(option).startsWith(event.key)
        );
        if (match >= 0) {
          event.preventDefault();
          setActiveIndex(match);
        }
      }
    }
  }

  return (
    <div ref={rootRef} className="flex shrink-0 items-center gap-2">
      <span id={`${listboxId}-label`} className="admin-hint">
        Rows
      </span>

      {/* The positioning context is the button alone, not the label beside it —
          otherwise `right-0` anchors the list to the group and it hangs out
          under the word "Rows". */}
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          role="combobox"
          aria-controls={listboxId}
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-labelledby={`${listboxId}-label`}
          aria-activedescendant={open ? optionId(activeIndex) : undefined}
          onClick={() => (open ? close(false) : openList())}
          onKeyDown={onKeyDown}
          className={`inline-flex h-9 min-w-[4.25rem] items-center justify-between gap-2 border px-2.5 text-[13px] tabular-nums transition-colors duration-[var(--duration-fast)] focus-visible:ring-2 focus-visible:ring-purple/15 focus-visible:outline-none ${
            open
              ? "border-purple bg-lilac text-purple"
              : "border-line bg-white text-ink hover:border-purple hover:bg-lilac hover:text-purple"
          }`}
        >
          {value}
          <ChevronDown
            aria-hidden
            strokeWidth={1.75}
            className={`h-3.5 w-3.5 shrink-0 transition-transform duration-[var(--duration-fast)] ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>

        {open && (
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={`${listboxId}-label`}
            data-placement={placement}
            className={`admin-pop absolute right-0 z-50 min-w-full border border-purple/30 bg-white py-1 shadow-[0_10px_30px_-14px_rgba(42,27,51,0.45)] ${
              placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
            }`}
          >
            {PER_PAGE_OPTIONS.map((option, index) => {
              const selected = option === value;
              const active = index === activeIndex;

              return (
                <li
                  key={option}
                  id={optionId(index)}
                  role="option"
                  aria-selected={selected}
                  /* Hover moves the active option, so pointer and keyboard
                     never disagree about which row is highlighted. */
                  onPointerEnter={() => setActiveIndex(index)}
                  onClick={() => commit(index)}
                  className={`flex h-9 cursor-pointer items-center justify-between gap-4 px-2.5 text-[13px] tabular-nums transition-colors duration-[var(--duration-fast)] ${
                    active ? "bg-lilac text-purple" : "text-ink"
                  } ${selected ? "font-medium" : ""}`}
                >
                  {option}
                  {/* The tick is the selected marker; the tint is only where you
                      are. Reserving the width stops the numbers shifting as the
                      highlight moves down the list. */}
                  <Check
                    aria-hidden
                    strokeWidth={2}
                    className={`h-3.5 w-3.5 shrink-0 ${
                      selected ? "text-purple opacity-100" : "opacity-0"
                    }`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
