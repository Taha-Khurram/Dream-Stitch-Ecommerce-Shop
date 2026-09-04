"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Loader2, Minus, X } from "lucide-react";
import type { ActionResult } from "@/app/admin/actions";

/**
 * Multi-select for the admin tables, and the bar that acts on a selection.
 *
 * The tables are server components — they query, they render, they hold no
 * state — and none of that changes here. A provider wraps the rows the server
 * drew, the tick boxes inside them talk to it through context, and the bar at
 * the foot reads the same context. The table stays a server component with two
 * client leaves in it rather than becoming a client component that fetches.
 *
 * A selection means "these rows, on this page". Paging or searching remounts
 * the Suspense boundary and the selection goes with it, which is the honest
 * behaviour: the ticks you can see are the rows a bulk action will touch, and
 * there is no invisible set carried across pages waiting to surprise someone.
 */

interface Selection {
  /** Every id on the page, in the order the rows are drawn. */
  ids: readonly string[];
  selected: ReadonlySet<string>;
  /** `extend` fills the run from the last row touched to this one. */
  toggle: (id: string, extend: boolean) => void;
  setAll: (on: boolean) => void;
  clear: () => void;
}

const SelectionContext = createContext<Selection | null>(null);

function useSelection(): Selection {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error("Bulk selection controls have to sit inside <SelectionProvider>.");
  }
  return context;
}

/** The rows between two ids, inclusive — a shift-click's span. */
function spanBetween(ids: readonly string[], from: string, to: string): string[] {
  const start = ids.indexOf(from);
  const end = ids.indexOf(to);
  if (start < 0 || end < 0) return [to];
  return ids.slice(Math.min(start, end), Math.max(start, end) + 1);
}

export function SelectionProvider({
  ids,
  children,
}: {
  ids: string[];
  children: React.ReactNode;
}) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set());
  /* Where the next shift-click measures from. */
  const anchor = useRef<string | null>(null);

  const present = useMemo(() => new Set(ids), [ids]);

  /**
   * The selection, narrowed to rows that are still on the page.
   *
   * A bulk write ends in `router.refresh()`, which redraws these rows in place
   * rather than remounting the boundary — so without this the ids just deleted
   * would stay ticked and the bar would cheerfully offer to delete them again.
   * Derived rather than pruned in an effect: the wrong set is then never
   * rendered, not even for a frame.
   */
  const selected = useMemo(
    () => new Set([...ticked].filter((id) => present.has(id))),
    [ticked, present]
  );

  const toggle = useCallback(
    (id: string, extend: boolean) => {
      setTicked((previous) => {
        const next = new Set([...previous].filter((each) => present.has(each)));
        const turningOn = !next.has(id);
        const span = extend && anchor.current ? spanBetween(ids, anchor.current, id) : [id];

        for (const target of span) {
          if (turningOn) next.add(target);
          else next.delete(target);
        }

        anchor.current = id;
        return next;
      });
    },
    [ids, present]
  );

  const setAll = useCallback(
    (on: boolean) => {
      anchor.current = null;
      setTicked(on ? new Set(ids) : new Set());
    },
    [ids]
  );

  const clear = useCallback(() => setAll(false), [setAll]);

  const value = useMemo(
    () => ({ ids, selected, toggle, setAll, clear }),
    [ids, selected, toggle, setAll, clear]
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

/* ── The tick box ─────────────────────────────────────────────────────────── */

/**
 * A real `<input type="checkbox">` wearing our paint.
 *
 * Unlike the selects in this panel, a checkbox has no OS-drawn popup to escape
 * — `appearance-none` takes the box and nothing else — so the label wiring, the
 * space key and the accessibility tree all stay native and free.
 */
function TickBox({
  checked,
  mixed = false,
  label,
  onToggle,
}: {
  checked: boolean;
  /** Some but not all: drawn as a dash rather than a tick. */
  mixed?: boolean;
  label: string;
  onToggle: (extend: boolean) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const dash = mixed && !checked;

  /* `indeterminate` is a property, not an attribute — there is no way to set
     it from JSX. */
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = dash;
  }, [dash]);

  return (
    <span className="relative inline-flex h-4 w-4 shrink-0 align-middle">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        aria-label={label}
        /* React synthesises a checkbox's `change` from the `click` event, so
           the modifier keys are on the native event — which is the only place
           shift-click's range select can read them from. Keyboard space also
           dispatches a click, with no modifiers, so it just toggles the row. */
        onChange={(event) => {
          const native = event.nativeEvent;
          onToggle("shiftKey" in native && native.shiftKey === true);
        }}
        className="peer h-4 w-4 cursor-pointer appearance-none border border-line bg-white transition-colors duration-[var(--duration-fast)] checked:border-purple checked:bg-purple indeterminate:border-purple indeterminate:bg-purple hover:border-purple focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple"
      />
      {dash ? (
        <Minus
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white"
        />
      ) : (
        <Check
          aria-hidden
          strokeWidth={3}
          className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 peer-checked:opacity-100"
        />
      )}
    </span>
  );
}

/** The box in a row. `label` is what a screen reader hears, so it names the row. */
export function RowCheckbox({ id, label }: { id: string; label: string }) {
  const { selected, toggle } = useSelection();
  return (
    <TickBox checked={selected.has(id)} label={label} onToggle={(extend) => toggle(id, extend)} />
  );
}

/** The box in the header: every row on the page, or none of them. */
export function SelectAllCheckbox({ label }: { label: string }) {
  const { ids, selected, setAll } = useSelection();
  const all = ids.length > 0 && selected.size === ids.length;

  return (
    <TickBox checked={all} mixed={selected.size > 0} label={label} onToggle={() => setAll(!all)} />
  );
}

/* ── Running an action over the selection ─────────────────────────────────── */

/**
 * The plumbing every bulk bar repeats: what is selected, whether a write is in
 * flight, and what the last one said.
 *
 * Success clears the selection — those rows are dealt with, and leaving them
 * ticked invites the same action twice. The message outlives the clearing on
 * purpose, which is why `BulkBar` stays up while one is showing.
 */
export function useBulkAction() {
  const { selected, clear } = useSelection();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<ActionResult | null>(null);
  const router = useRouter();

  const ids = useMemo(() => [...selected], [selected]);

  const dismiss = useCallback(() => setMessage(null), []);

  const run = useCallback(
    (action: (ids: string[]) => Promise<ActionResult>) => {
      setMessage(null);
      startTransition(async () => {
        const result = await action(ids);
        setMessage(result);
        if (result.ok) {
          clear();
          router.refresh();
        }
      });
    },
    [ids, clear, router]
  );

  return { ids, pending, message, dismiss, run };
}

/* ── The bar ──────────────────────────────────────────────────────────────── */

/**
 * The bar that appears once something is ticked.
 *
 * Sticky rather than fixed: it rides the foot of the viewport while there is
 * still table below it and then settles into the page, so it never covers the
 * last row of a short list. It stays up after the selection is cleared if there
 * is a result to read — the alternative is a bar that vanishes at the same
 * instant it is told how many orders were deleted.
 */
export function BulkBar({
  noun,
  message,
  onDismiss,
  children,
}: {
  /** Singular; pluralised here. */
  noun: string;
  message: ActionResult | null;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const { selected, clear } = useSelection();
  const count = selected.size;

  if (count === 0 && !message) return null;

  return (
    <div className="sticky bottom-5 z-30 mt-5 flex justify-center">
      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-3 border border-purple/25 bg-white px-4 py-3 shadow-[0_18px_44px_-20px_rgba(42,27,51,0.55)] sm:w-auto">
        {count > 0 && (
          <>
            <p className="text-[13px] font-medium text-ink">
              <span className="tabular-nums">{count}</span> {noun}
              {count === 1 ? "" : "s"} selected
            </p>

            <div className="flex flex-wrap items-center gap-2">{children}</div>

            <button
              type="button"
              onClick={() => {
                clear();
                onDismiss();
              }}
              className="cursor-pointer text-[13px] text-muted transition-colors hover:text-purple"
            >
              Clear
            </button>
          </>
        )}

        {message && (
          <p
            role="status"
            className={`flex max-w-md items-start gap-1.5 text-[12px] leading-relaxed ${
              message.ok ? "text-jade" : "text-sale"
            }`}
          >
            {message.ok ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            ) : (
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            )}
            {message.message}
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss"
              className="-my-1 cursor-pointer p-1 text-muted transition-colors hover:text-ink"
            >
              <X aria-hidden className="h-3 w-3" />
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * A control in the bar. `tone` is the only choice: `danger` is the one that
 * cannot be undone, and it is dressed apart from the rest so it is never the
 * button someone hits by reflex.
 */
export function BulkButton({
  label,
  icon: Icon,
  pending = false,
  disabled = false,
  tone = "neutral",
  onClick,
  type = "button",
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  pending?: boolean;
  disabled?: boolean;
  tone?: "primary" | "neutral" | "danger";
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  const tones = {
    primary: "border-purple bg-purple text-white hover:bg-purple-deep focus-visible:outline-purple",
    neutral:
      "border-line bg-white text-ink-soft hover:border-purple hover:bg-lilac hover:text-purple focus-visible:outline-purple",
    danger:
      "border-line bg-white text-muted hover:border-sale hover:bg-sale/5 hover:text-sale focus-visible:outline-sale",
  } as const;

  return (
    <button
      type={type}
      disabled={disabled || pending}
      onClick={onClick}
      /* `py-2.5` rather than a fixed height so the buttons stand exactly as
         tall as the `SelectField` beside them — see `fieldBox`. */
      className={`inline-flex cursor-pointer items-center gap-1.5 border px-3 py-2.5 text-[13px] font-medium transition-colors duration-[var(--duration-fast)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${tones[tone]}`}
    >
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}
