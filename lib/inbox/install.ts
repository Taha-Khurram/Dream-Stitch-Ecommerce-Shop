/**
 * "Has `inbox_schema.sql` been run?"
 *
 * The inbox is optional, the same way presence is: the app compiles, the
 * storefront renders and the panel loads whether or not the migration has been
 * applied. What must not happen is either half lying about it — a contact form
 * that shows its thank-you panel into a void, or an admin screen rendering an
 * empty table that reads as "nobody has written in".
 *
 * So every read and every write asks this question about whatever error came
 * back, and answers it the same way on both sides of the app: a 501 with a
 * sentence naming the file for the route handlers, and a panel naming the file
 * for the admin screens. Anything that is *not* a missing-install error is a
 * genuine fault and is reported as one.
 */

/** The shape both PostgREST and postgres-js errors share. */
export interface QueryError {
  code?: string;
  message?: string;
}

/**
 * True when the error means "that object does not exist", not "the query
 * failed".
 *
 * Five codes, because there are two objects and two layers that can notice
 * first. PostgREST answers PGRST202 for an unknown RPC and PGRST205 for an
 * unknown table — both from its cached schema, which is why the migration ends
 * with `NOTIFY pgrst`. Postgres itself raises 42883 (undefined_function) and
 * 42P01 (undefined_table) when the planner gets there first, which is what
 * happens in the window after a reload but before the cache catches up. The
 * message sniff is the last resort for a client version that reports neither.
 */
export function isMissingInstall(error: QueryError | null | undefined): boolean {
  if (!error) return false;

  const code = error.code ?? "";
  if (["PGRST202", "PGRST205", "42883", "42P01"].includes(code)) return true;

  const message = error.message ?? "";
  return (
    message.includes("Could not find the function") ||
    message.includes("Could not find the table") ||
    message.includes("does not exist")
  );
}

/**
 * True when the table is there but one column on it is not.
 *
 * Kept separate from `isMissingInstall` deliberately. That one answers "is
 * this table or function installed"; a missing column is a different question
 * with a different remedy — the table is there, one migration against it is
 * not — and the two are handled differently at every call site: a missing
 * install is a screen that says so, a missing column is usually a write that
 * retries without the field and logs which file to run.
 *
 * Two codes for one fact: PostgREST answers PGRST204 off its cached schema,
 * and Postgres raises 42703 (undefined_column) when the planner gets there
 * first — which is what happens in the window after a migration runs but
 * before the cache catches up.
 */
export function isMissingColumn(error: QueryError | null | undefined): boolean {
  return error?.code === "PGRST204" || error?.code === "42703";
}

/** The one sentence every surface uses to say the migration has not been run. */
export const INBOX_NOT_INSTALLED =
  "The inbox is not installed. Run inbox_schema.sql in the Supabase SQL editor.";
