"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { selectTriggerClass } from "./field-styles";

/**
 * The admin forms' select.
 *
 * Same reason `PerPageSelect` exists: a native `<select>` can be styled shut
 * but not open — the popup belongs to the OS, so on Windows the Category list
 * came up with a system-blue highlight and system metrics next to a form built
 * from hairline borders, square corners and one purple. The closed control was
 * ours and the open one was not.
 *
 * Where this differs from `PerPageSelect`, and why it is a second component
 * rather than a generalisation of that one:
 *
 *   - it posts. The pager calls `onChange` and pushes a route; this sits in a
 *     `<form>` that submits to a server action, so the committed value rides
 *     along in a hidden input under `name` and the action is untouched.
 *   - it is a labelled field. `Field` clones its child to inject `id` and
 *     `aria-describedby`, so both land on the trigger — `<button>` is a
 *     labelable element, so the `<label for>` above it still works.
 *   - its list is open-ended. Four page sizes never scrolled; categories grow,
 *     so the list caps its height and keeps the active option in view.
 *   - typeahead takes words, not one digit. Options are names here, and a
 *     buffered prefix is what makes a long list usable from the keyboard.
 *
 * Keyboard behaviour follows the APG select-only combobox pattern, as there:
 * focus stays on the trigger with `aria-activedescendant` pointing into the
 * list, Up/Down/Home/End move, Enter/Space commit, Escape cancels, Tab leaves
 * without committing.
 */

export interface SelectOption {
  value: string;
  label: string;
}

/** Option row height (h-9) plus the list's vertical padding. */
const OPTION_HEIGHT = 36;
const LIST_PADDING = 10;
/** Beyond this the list scrolls rather than growing down the page. */
const MAX_VISIBLE = 7;

/** How long a typed prefix keeps collecting before it starts over. */
const TYPEAHEAD_RESET_MS = 600;

type Placement = "top" | "bottom";

export function SelectField({
  name,
  options,
  defaultValue = "",
  placeholder = "— none —",
  id,
  "aria-describedby": describedBy,
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string;
  /** Shown when nothing is picked, and as the value of the empty first row. */
  placeholder?: string;
  id?: string;
  "aria-describedby"?: string;
}) {
  /* The empty row is part of the list, so every index below indexes this
     array and not `options` — keeping one source of truth for "row 0". */
  const rows: SelectOption[] = [{ value: "", label: placeholder }, ...options];

  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [placement, setPlacement] = useState<Placement>("bottom");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const typeahead = useRef({ buffer: "", at: 0 });

  const listboxId = useId();
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const selectedIndex = rows.findIndex((row) => row.value === value);
  const selected = rows[selectedIndex] ?? rows[0];

  /**
   * Down by default — this is a field in the middle of a form, and a list that
   * springs upward over the label reads as a mistake. Upward only when the
   * list genuinely would not fit below and there is more room above.
   */
  const choosePlacement = useCallback((): Placement => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return "bottom";

    const height = Math.min(rows.length, MAX_VISIBLE) * OPTION_HEIGHT + LIST_PADDING;
    const below = window.innerHeight - rect.bottom;
    if (below >= height) return "bottom";

    return rect.top > below ? "top" : "bottom";
  }, [rows.length]);

  const openList = useCallback(() => {
    setActiveIndex(selectedIndex < 0 ? 0 : selectedIndex);
    setPlacement(choosePlacement());
    setOpen(true);
  }, [choosePlacement, selectedIndex]);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (index: number) => {
      const next = rows[index];
      close();
      if (next) setValue(next.value);
    },
    [close, rows]
  );

  /* Pointer-down, not click: a drag that starts in the list and ends outside
     should not leave the panel open behind the cursor. */
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  /* Keyboard movement has to drag the scroll port with it, or arrowing past
     the seventh category walks the highlight out of sight. */
  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`#${CSS.escape(optionId(activeIndex))}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Jump to the next option starting with the buffered prefix. */
  function jumpTo(key: string) {
    const now = Date.now();
    const state = typeahead.current;
    state.buffer = now - state.at > TYPEAHEAD_RESET_MS ? key : state.buffer + key;
    state.at = now;

    const prefix = state.buffer.toLowerCase();
    /* Search from the row after the active one and wrap, so repeating a
       letter walks through the options that share it. */
    const order = rows.map((_, i) => (activeIndex + 1 + i) % rows.length);
    const match = order.find((i) => rows[i].label.toLowerCase().startsWith(prefix));

    if (match !== undefined) setActiveIndex(match);
  }

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
        /* Focus is leaving the control; abandon the list without committing. */
        setOpen(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => Math.min(rows.length - 1, i + 1));
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
        setActiveIndex(rows.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commit(activeIndex);
        break;
      default:
        /* Single printable characters only — modifiers are shortcuts. */
        if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          jumpTo(event.key);
        }
    }
  }

  return (
    <div ref={rootRef} className="relative">
      {/* What the server action reads. The trigger is a button precisely so it
          never submits anything itself. */}
      <input type="hidden" name={name} value={value} />

      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-describedby={describedBy}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        onClick={() => (open ? close(false) : openList())}
        onKeyDown={onKeyDown}
        className={`${selectTriggerClass} ${
          open ? "border-purple ring-2 ring-purple/15" : ""
        }`}
      >
        {/* The empty row is a placeholder, so it is typed like one. */}
        <span className={value ? "text-ink" : "text-faint"}>{selected.label}</span>
        <ChevronDown
          aria-hidden
          strokeWidth={1.75}
          className={`h-4 w-4 shrink-0 text-muted transition-transform duration-[var(--duration-fast)] ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listboxId}
          role="listbox"
          aria-labelledby={id}
          data-placement={placement}
          style={{ maxHeight: MAX_VISIBLE * OPTION_HEIGHT + LIST_PADDING }}
          className={`admin-pop absolute left-0 z-50 w-full overflow-y-auto border border-purple/30 bg-white py-1 shadow-[0_10px_30px_-14px_rgba(42,27,51,0.45)] ${
            placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {rows.map((row, index) => {
            const isSelected = index === selectedIndex;
            const active = index === activeIndex;

            return (
              <li
                key={row.value || "__none__"}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                /* Hover moves the active row, so pointer and keyboard never
                   disagree about which one is lit. */
                onPointerEnter={() => setActiveIndex(index)}
                onClick={() => commit(index)}
                className={`flex h-9 cursor-pointer items-center justify-between gap-4 px-3 text-sm transition-colors duration-[var(--duration-fast)] ${
                  active ? "bg-lilac text-purple" : row.value ? "text-ink" : "text-faint"
                } ${isSelected ? "font-medium" : ""}`}
              >
                <span className="truncate">{row.label}</span>
                {/* The tick marks what is chosen; the tint only marks where you
                    are. Reserving the width stops names shifting as it moves. */}
                <Check
                  aria-hidden
                  strokeWidth={2}
                  className={`h-3.5 w-3.5 shrink-0 ${
                    isSelected ? "text-purple opacity-100" : "opacity-0"
                  }`}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
