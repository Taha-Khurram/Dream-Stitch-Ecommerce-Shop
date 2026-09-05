/**
 * Reading an order from a database that may not have every column yet.
 *
 * Migrations here are pasted into the SQL editor by hand, one at a time, so
 * "which columns does `orders` have" is a question with more than one right
 * answer depending on how far a given deployment has got. PostgREST does not
 * help: ask for a column it has never heard of and it rejects the *whole*
 * select rather than returning that column as null, so one unapplied migration
 * takes the order screen down entirely.
 *
 * Every read of an order therefore asked for the optional columns, and fell
 * back to the shape from before them if that failed. That worked while there
 * was one optional group. With two it stops working: a deployment that has run
 * `discount_codes.sql` but not `order_payment_method.sql` would fail the wide
 * select and fall all the way back to the base columns, and discounts would
 * silently stop appearing on screens that had been showing them for months.
 *
 * So the fallback is a search rather than a single retry — widest set first,
 * then every smaller combination, then nothing. Each deployment lands on the
 * most complete select its own database can actually answer, and no group's
 * absence costs another group.
 */

/** Arrives with `discount_codes.sql`. */
export const DISCOUNT_COLUMNS = "discount_code, discount_amount";

/** Arrives with `order_payment_method.sql`. */
export const PAYMENT_COLUMNS = "payment_method";

/** Every optional group, in the order they read on a row. */
export const OPTIONAL_ORDER_COLUMNS = [DISCOUNT_COLUMNS, PAYMENT_COLUMNS] as const;

/**
 * Run an order query with the most complete column list it will accept.
 *
 * `run` is handed a fragment to splice straight into a select — either the
 * empty string or `", discount_code, discount_amount"` and friends, already
 * comma-prefixed, so a caller writes `${BASE}${extra}, ${ITEMS}` and nothing
 * has to reason about where the commas go.
 *
 * Any error retries, not just an unknown-column one. That is deliberate: the
 * narrowing ends at the base columns, which is the query the caller would have
 * written anyway, so a genuine fault — a bad id, no rows, RLS — arrives at the
 * caller in the shape it expects, from the narrowest attempt, and is handled
 * there. Trying to tell the two apart here would mean teaching this module
 * about every caller's error handling to save at most three cheap queries on a
 * path that is already failing.
 */
export async function selectOrderColumns<R extends { error: unknown }>(
  run: (extra: string) => PromiseLike<R>,
  optional: readonly string[] = OPTIONAL_ORDER_COLUMNS
): Promise<R> {
  let last: R | undefined;

  for (const groups of subsetsWidestFirst(optional)) {
    const result = await run(groups.map((group) => `, ${group}`).join(""));
    if (!result.error) return result;
    last = result;
  }

  /* Unreachable with a non-empty `optional` — the loop always runs at least
     the empty subset — but the compiler cannot know `optional.length > 0`. */
  return last ?? (await run(""));
}

/**
 * Every subset of `groups`, most columns first, ties in declaration order.
 *
 * Two groups is four selects in the worst case and one in the normal case,
 * because the first attempt is the full set and a database with every
 * migration applied answers it. The cost is only paid where a column really is
 * missing, which is exactly where it buys something.
 */
function subsetsWidestFirst(groups: readonly string[]): string[][] {
  const subsets: string[][] = [];

  for (let mask = 0; mask < 1 << groups.length; mask++) {
    subsets.push(groups.filter((_, index) => mask & (1 << index)));
  }

  /* Stable, so equal-sized subsets keep the order the masks generated them in
     — which is declaration order, so the oldest migration's columns are tried
     before a newer one's when only one of the two can be had. */
  return subsets.sort((a, b) => b.length - a.length);
}
