/**
 * What an admin types into a list's search box, turned into a PostgREST filter.
 *
 * Every admin list already reads its window out of the URL (see lib/pagination);
 * this is the other half — the term itself. Both live in the query string, so a
 * search is a real address that survives a reload and can be sent to someone.
 *
 * The filters built here are the `or=(…)` arm of a PostgREST request, which is
 * why this module exists at all: that grammar has punctuation of its own, and a
 * customer's name is not required to avoid it.
 */

/** The query-string key every admin list search reads. */
export const SEARCH_PARAM = "q";

/**
 * PostgREST separates the arms of `or=(…)` on commas, so a comma inside a value
 * ends its clause early and the whole tree fails to parse — a 400, not a bad
 * result. Rather than reject the search (an admin pasting `Khan, Ali` out of an
 * email has done nothing wrong) the offending characters become `*`, which
 * PostgREST reads as "anything here". The match widens by one character and
 * still lands on the row they were looking for.
 *
 * Only the comma is fatal against PostgREST 12; the brackets, quote and
 * backslash are the rest of the grammar's punctuation, folded in because a
 * parser that tightens later should not turn a name into an error page.
 *
 * Quoting the value instead — `ilike."*q*"` — looks like the tidier answer and
 * is a trap: PostgREST matches a quoted value *literally*, wildcards included,
 * so `"*ali*"` stops meaning "contains ali" and starts meaning "is exactly
 * star-a-l-i-star". Verified against the project's own REST endpoint.
 */
const GRAMMAR = /[,()"\\]/g;

/** `*term*` — contains-anywhere, with the grammar's punctuation defused. */
function likePattern(query: string): string {
  return `*${query.replace(GRAMMAR, "*")}*`;
}

/** One `col.ilike.*q*` per column: the OR arms of a contains-anywhere search. */
function containsAny(columns: readonly string[], query: string): string[] {
  const pattern = likePattern(query);
  return columns.map((column) => `${column}.ilike.${pattern}`);
}

/* ── Order references ─────────────────────────────────────────────────────── */

const HEX = "0123456789abcdef";

/**
 * How much of a reference has to be typed before it is read as one.
 *
 * The reference is eight hex characters, and hex characters spell English
 * words. Below four the overlap is constant — `ada`, `cab`, `bed` — and the
 * search would quietly return orders that have nothing to do with the name
 * being looked for. Four is short enough to be useful when someone reads half
 * a reference down the phone and long enough that the collisions are rare.
 */
const MIN_REFERENCE_HEX = 4;

/**
 * `#3F9A21C4`, `3f9a21c4`, or a whole pasted id → the hex prefix it names.
 *
 * Mirrors `orderReference()` in lib/orders/lifecycle.ts: what that function
 * prints is what this function has to accept back. Null when the term is not a
 * reference at all, which is the usual case — it is a name or an email.
 */
function referencePrefix(query: string): string | null {
  const hex = query.replace(/^#/, "").replace(/[\s-]/g, "").toLowerCase();
  return new RegExp(`^[0-9a-f]{${MIN_REFERENCE_HEX},32}$`).test(hex) ? hex : null;
}

/** The next prefix in hex order, or null when it is already all `f`. */
function nextPrefix(hex: string): string | null {
  const digits = [...hex];

  for (let i = digits.length - 1; i >= 0; i--) {
    if (digits[i] === "f") continue;
    digits[i] = HEX[HEX.indexOf(digits[i]) + 1];
    /* Everything to the right rolled over to zero. */
    return digits.slice(0, i + 1).join("").padEnd(hex.length, "0");
  }

  return null;
}

/** 32 hex characters → the canonical `8-4-4-4-12` a uuid literal has to be. */
function toUuid(hex: string): string {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * A reference prefix as a bounded range over `orders.id`.
 *
 * `id` is a uuid, and Postgres has no `ILIKE` for uuids — the obvious
 * `id::text LIKE '3f9a21c4%'` needs either a cast on every row or a second
 * indexed column to hang the text off. Neither is necessary: Postgres orders
 * uuids bytewise, so "starts with this prefix" *is* a half-open range, and the
 * primary key index already serves it. `#3F9A21C4` becomes
 * `3f9a21c4-0000-… <= id < 3f9a21c5-0000-…`: one index scan, nothing to build.
 */
function referenceClause(query: string): string | null {
  const prefix = referencePrefix(query);
  if (!prefix) return null;

  const low = `id.gte.${toUuid(prefix.padEnd(32, "0"))}`;
  const next = nextPrefix(prefix);

  /* All `f`: the prefix reaches the top of the space, so there is no upper
     bound to place and every id from `low` up is a match. */
  if (!next) return low;

  return `and(${low},id.lt.${toUuid(next.padEnd(32, "0"))})`;
}

/* ── The filters themselves ───────────────────────────────────────────────── */

/**
 * Where an order carries the person who placed it.
 *
 * The shipping address rather than the linked customer, and deliberately: it is
 * what the row renders, it is filled in for a guest checkout that never became
 * a customer record, and reaching `customers` from here would mean an inner
 * join that drops every order without one.
 */
const ORDER_COLUMNS = [
  "shipping_address->>fullName",
  "shipping_address->>email",
  "shipping_address->>phone",
] as const;

const CUSTOMER_COLUMNS = ["name", "email", "phone"] as const;

/**
 * The `.or()` argument for an order search, or null when there is nothing to
 * search for — which is the caller's signal to leave the query unfiltered.
 *
 * Reference, name, email and phone are one OR rather than four search modes:
 * whoever is on the phone reads out whichever of them they have to hand, and
 * being asked which kind of thing they just said is the panel's problem, not
 * theirs. The reference arm leads because it is the one that hits an index
 * outright.
 */
export function orderSearchFilter(query: string): string | null {
  const term = query.trim();
  if (!term) return null;

  const reference = referenceClause(term);
  const clauses = containsAny(ORDER_COLUMNS, term);

  return (reference ? [reference, ...clauses] : clauses).join(",");
}

/** The same, for the customer book. Name, email or phone. */
export function customerSearchFilter(query: string): string | null {
  const term = query.trim();
  return term ? containsAny(CUSTOMER_COLUMNS, term).join(",") : null;
}
