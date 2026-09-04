import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/api";
import { INBOX_NOT_INSTALLED, isMissingInstall } from "@/lib/inbox/install";
import { isSubscriberStatus } from "@/lib/inbox/lifecycle";

export const dynamic = "force-dynamic";

/**
 * The subscriber list as a CSV, for whatever actually sends the mail.
 *
 * This app has no outbound mail and should not grow one — the newsletter goes
 * out of a mail platform, and this is the bridge to it. A download beats an
 * integration here: it works with every provider, it needs no API key in the
 * environment, and the admin can see exactly what they are handing over.
 *
 * A static segment, so it takes precedence over `[id]` next door and there is
 * no subscriber whose id could shadow it.
 */

/**
 * The whole list in one response, up to a point.
 *
 * PostgREST caps a range anyway, and an export that quietly truncates is worse
 * than one that says it did. Past this the answer is a real export job, not a
 * bigger number here — so the row is added to the file and the header carries
 * the count for anything reading it programmatically.
 */
const MAX_ROWS = 20_000;

export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) return auth.response;

  /* `?status=subscribed` is the useful one and what the button links to —
     mailing the people who asked to be left alone is the whole thing the
     suppression list exists to prevent. Anything unrecognised exports all. */
  const requested = new URL(request.url).searchParams.get("status");
  const status = requested && isSubscriberStatus(requested) ? requested : null;

  let query = auth.supabase
    .from("newsletter_subscribers")
    .select("email, status, source, created_at, unsubscribed_at")
    .order("created_at", { ascending: false })
    .range(0, MAX_ROWS - 1);

  if (status) query = query.eq("status", status);

  const { data, error } = await query;

  if (error) {
    if (isMissingInstall(error)) {
      return NextResponse.json({ success: false, error: INBOX_NOT_INSTALLED }, { status: 501 });
    }

    console.error("Subscriber export failed:", error.message);
    return NextResponse.json(
      { success: false, error: "Could not build the export." },
      { status: 500 }
    );
  }

  const rows = data ?? [];
  const truncated = rows.length === MAX_ROWS;

  const header = ["email", "status", "source", "subscribed_at", "unsubscribed_at"];
  const lines = [header.join(",")];

  for (const row of rows) {
    lines.push(
      [row.email, row.status, row.source, row.created_at, row.unsubscribed_at ?? ""]
        .map(csvCell)
        .join(",")
    );
  }

  if (truncated) {
    lines.push(
      csvCell(`Truncated at ${MAX_ROWS} rows — narrow by status or export from the database.`)
    );
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const name = `dream-stitch-subscribers-${status ?? "all"}-${stamp}.csv`;

  /* A BOM, so Excel opens it as UTF-8 rather than guessing at the codepage and
     mangling any address with an accent in it. */
  return new NextResponse(`\uFEFF${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
      "X-Row-Count": String(rows.length),
    },
  });
}

/**
 * One cell, quoted and made safe to open.
 *
 * Two separate problems. The quoting is ordinary CSV: double the quotes, wrap
 * the field. The leading apostrophe is formula injection — a cell beginning
 * `=`, `+`, `-`, `@`, tab or CR is evaluated as a formula by Excel and Sheets,
 * and every value in this file was typed by a member of the public into a form
 * on the internet. `=HYPERLINK(...)` in an address field is a real phishing
 * vector against whoever opens the export.
 */
function csvCell(value: string | null | undefined): string {
  const raw = String(value ?? "");
  const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${guarded.replace(/"/g, '""')}"`;
}
