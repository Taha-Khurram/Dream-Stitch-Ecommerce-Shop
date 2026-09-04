import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/api";
import { csvDocument, csvFilename, csvHeaders } from "@/lib/admin/csv";
import { SEARCH_PARAM, customerSearchFilter } from "@/lib/admin/search";

export const dynamic = "force-dynamic";

/**
 * The customer book as a CSV.
 *
 * Same reasoning as the subscriber export next door: the panel is not the
 * place to grow a mail merge or a reporting suite, and a file the owner can
 * see the whole of beats an integration they have to trust.
 *
 * A static segment, so it takes precedence over `[id]` next door and no
 * customer id can shadow it.
 *
 * `?q=` is honoured, and has to be: the button sits beside the search box, so
 * an export that ignored the term would hand back the whole book while the
 * screen showed four rows — a file that silently disagrees with what was asked
 * for is worse than no file.
 */

/**
 * The whole book in one response, up to a point.
 *
 * PostgREST caps a range anyway, and an export that quietly truncates is worse
 * than one that says it did — so the cut is recorded in the file itself and
 * the count rides on a header for anything reading this programmatically.
 */
const MAX_ROWS = 20_000;

/** `orders(count)` is a PostgREST aggregate embed — an array of one row. */
type ExportRow = {
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  orders?: { count: number }[];
};

export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) return auth.response;

  const query = new URL(request.url).searchParams.get(SEARCH_PARAM) ?? "";

  let select = auth.supabase
    .from("customers")
    .select("name, email, phone, created_at, orders(count)")
    .order("created_at", { ascending: false })
    .range(0, MAX_ROWS - 1);

  /* The same filter the list screen builds, from the same module — so the file
     and the table can never disagree about what the term means. */
  const search = customerSearchFilter(query);
  if (search) select = select.or(search);

  const { data, error } = await select;

  if (error) {
    /* The table only exists once dashboard_schema.sql has been applied \u2014 the
       same thing the list itself says, in the idiom a fetch can read. */
    if (error.code === "42P01") {
      return NextResponse.json(
        { success: false, error: "The customers table is not there yet. Run dashboard_schema.sql." },
        { status: 501 }
      );
    }

    console.error("Customer export failed:", error.message);
    return NextResponse.json(
      { success: false, error: "Could not build the export." },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as ExportRow[];

  const file = csvDocument(
    ["name", "email", "phone", "orders", "joined"],
    rows.map((row) => [
      row.name,
      row.email,
      row.phone ?? "",
      row.orders?.[0]?.count ?? 0,
      row.created_at,
    ]),
    rows.length === MAX_ROWS
      ? `Truncated at ${MAX_ROWS} rows \u2014 export the rest from the database.`
      : undefined
  );

  return new NextResponse(file, { headers: csvHeaders(csvFilename("customers"), rows.length) });
}
