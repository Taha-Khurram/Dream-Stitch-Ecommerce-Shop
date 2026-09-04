/**
 * Writing a CSV the panel hands to a person.
 *
 * Extracted when the customer book grew an export next to the subscriber one:
 * the quoting is easy to get subtly wrong, the formula guard is easy to forget
 * entirely, and two copies would have drifted on exactly the branch nobody
 * exercises while building the happy one.
 */

/**
 * A value Excel and Sheets would run instead of showing.
 *
 * A cell beginning `=`, `+`, `-`, `@`, tab or CR is evaluated as a formula, and
 * these files carry text typed by members of the public into a form on the
 * internet — `=HYPERLINK(...)` in a name field is a real phishing vector
 * against whoever opens the export, and `+cmd|'/c calc'!A0` is worse.
 *
 * `=`, `@`, tab and CR are never anything but trouble at the front of a cell.
 * `+` and `-` are, though: every international phone number in the book starts
 * with one, and guarding those put an apostrophe in front of a whole column of
 * real data. So they are read one step further — a formula needs something to
 * call, and a run of digits, spaces and phone punctuation cannot call anything.
 * `+92 300 1234567` goes out intact; `+SUM(A1)` and `-cmd|...` are still caught.
 */
function isFormula(raw: string): boolean {
  if (/^[=@\t\r]/.test(raw)) return true;
  if (!/^[+-]/.test(raw)) return false;
  return !/^[+-][\d\s().+-]*$/.test(raw);
}

/**
 * One cell, quoted and made safe to open. The quoting is ordinary CSV — double
 * the quotes, wrap the field; the apostrophe is the formula guard above.
 */
export function csvCell(value: string | number | null | undefined): string {
  const raw = String(value ?? "");
  const guarded = isFormula(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/**
 * Header, rows and an optional closing note as one file.
 *
 * The BOM is what makes Excel read it as UTF-8 rather than guessing at the
 * codepage and mangling every name with an accent in it. CRLF for the same
 * audience.
 */
export function csvDocument(
  header: string[],
  rows: (string | number | null | undefined)[][],
  note?: string
): string {
  const lines = [header.map(csvCell).join(",")];

  for (const row of rows) {
    lines.push(row.map(csvCell).join(","));
  }

  if (note) lines.push(csvCell(note));

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

/** The headers that make a browser save the response instead of showing it. */
export function csvHeaders(filename: string, rowCount: number): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Row-Count": String(rowCount),
  };
}

/** `dream-stitch-<what>-<yyyy-mm-dd>.csv` — the panel's one naming convention. */
export function csvFilename(what: string): string {
  return `dream-stitch-${what}-${new Date().toISOString().slice(0, 10)}.csv`;
}
