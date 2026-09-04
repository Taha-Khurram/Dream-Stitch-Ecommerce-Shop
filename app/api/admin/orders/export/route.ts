import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/api";
import { csvDocument, csvFilename, csvHeaders } from "@/lib/admin/csv";
import { SEARCH_PARAM, orderSearchFilter } from "@/lib/admin/search";
import { isOrderStatus, orderReference, statusLabel } from "@/lib/orders/lifecycle";
import { customSizeFromRow, formatCustomSize } from "@/lib/custom-size";
import type { ShippingAddress } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

/**
 * The order book as a CSV.
 *
 * The third of these, and for the same reason as the other two: the panel is
 * not the place to grow a reporting suite, and a file the owner can see the
 * whole of beats an integration they have to trust. This one has a use the
 * others do not — it is what a day's orders get packed and posted from, away
 * from the screen.
 *
 * A static segment, so it takes precedence over `[id]` next door and no order
 * id can shadow it.
 *
 * Both of the list screen's filters are honoured, and have to be: the button
 * sits above the tab rail and beside the search box, so an export that ignored
 * either would hand back the whole book while the screen showed four rows. A
 * file that silently disagrees with what was asked for is worse than no file.
 */

/**
 * The whole book in one response, up to a point.
 *
 * PostgREST caps a range anyway, and an export that quietly truncates is worse
 * than one that says it did — so the cut is recorded in the file itself and
 * the count rides on a header for anything reading this programmatically.
 */
const MAX_ROWS = 20_000;

/**
 * One row per order, not per line item.
 *
 * The alternative — a row per item, the shape a production run wants — was
 * left alone on purpose: this screen counts orders, searches orders and pages
 * through orders, and a file whose row count disagrees with the pager it was
 * downloaded from is a file nobody can reconcile. The lines ride in a single
 * cell instead, which is enough to pack from.
 */
const COLUMNS =
  "id, status, total_amount, created_at, shipping_address, " +
  "order_items(quantity, size, custom_width, custom_height, custom_unit, product:products(name))";

/**
 * The discount, asked for separately because it may not be there.
 *
 * These two columns arrive with `discount_codes.sql`, and PostgREST refuses
 * the whole select if either is unknown — so the export is attempted with them
 * and falls back to the shape it has always had. The two cells then come out
 * empty, which is the truth on a store that has never issued a code.
 *
 * Worth the fallback rather than left out: `total` is already net of the
 * reduction, so a file without these columns balances but cannot be explained.
 * Anyone reconciling a day's takings needs to see why an order came to less
 * than its lines.
 */
const DISCOUNT_COLUMNS = "discount_code, discount_amount";

type ExportItem = {
  quantity: number;
  size: string | null;
  custom_width: number | null;
  custom_height: number | null;
  custom_unit: string | null;
  product: { name: string } | null;
};

type ExportRow = {
  id: string;
  status: string;
  total_amount: number;
  created_at: string;
  shipping_address: ShippingAddress | null;
  order_items?: ExportItem[];
  /** Absent on the fallback select, and on every store without codes. */
  discount_code?: string | null;
  discount_amount?: number | null;
};

/** `2 × Velvet Throw (Cut to measure 82 × 78 in)` — one line of an order. */
function itemLine(item: ExportItem): string {
  const custom = customSizeFromRow(item);
  const variant = custom
    ? `Cut to measure ${formatCustomSize(custom)}`
    : /* Null size means a row written before order_item_variants.sql ran —
         unknown, rather than "no size", so it is left off rather than guessed
         at. The detail page says "Size not recorded" for the same rows. */
      item.size;

  const name = item.product?.name ?? "Product removed";

  return `${item.quantity} × ${name}${variant ? ` (${variant})` : ""}`;
}

export async function GET(request: Request) {
  const auth = await requireAdminUser();
  if (!auth.ok) return auth.response;

  const params = new URL(request.url).searchParams;

  /* Anything unrecognised exports the whole book rather than erroring: the
     term for this is already in the lifecycle module, and a hand-edited URL
     should not be the one thing that cannot produce a file. */
  const requested = params.get("status");
  const status = requested && isOrderStatus(requested) ? requested : null;
  const query = params.get(SEARCH_PARAM) ?? "";

  const search = orderSearchFilter(query);

  const build = (columns: string) => {
    let select = auth.supabase
      .from("orders")
      .select(columns)
      .order("created_at", { ascending: false })
      .range(0, MAX_ROWS - 1);

    if (status) select = select.eq("status", status);

    /* Status and search compose exactly as they do on the screen — `.or()` is
       one clause against the whole set, so it stays an AND with the `.eq()`
       above rather than widening it back out. Same module the table builds its
       filter from, so the file and the list can never disagree about what the
       term means. */
    if (search) select = select.or(search);

    return select;
  };

  const withDiscount = await build(`${COLUMNS}, ${DISCOUNT_COLUMNS}`);
  const { data, error } = withDiscount.error ? await build(COLUMNS) : withDiscount;

  if (error) {
    console.error("Order export failed:", error.message);
    return NextResponse.json(
      { success: false, error: "Could not build the export." },
      { status: 500 }
    );
  }

  const rows = (data ?? []) as unknown as ExportRow[];

  const file = csvDocument(
    [
      "reference",
      "status",
      "placed",
      "customer",
      "email",
      "phone",
      "address",
      "city",
      "province",
      "postal_code",
      "country",
      "items",
      "discount_code",
      "discount",
      "total",
    ],
    rows.map((row) => {
      /* Null on an order placed before the address was required. The table
         renders an em dash for it; a cell stays empty, because an em dash in a
         spreadsheet column is a value someone has to filter back out. */
      const to = row.shipping_address;

      return [
        orderReference(row.id),
        /* The label, not the column value: `closed` and the legacy `completed`
           are the same thing to whoever reads this, and `statusLabel` is what
           the panel already prints for both. */
        statusLabel(row.status),
        row.created_at,
        to?.fullName ?? "",
        to?.email ?? "",
        to?.phone ?? "",
        /* A column each, rather than one run-together postal block — the same
           call the detail page makes, and more clearly right here: a
           spreadsheet has columns for free, "Test, Punjab 38000" does not say
           which line was typed as the city, and whoever prints the labels
           should not have to guess. */
        to?.streetAddress ?? "",
        to?.city ?? "",
        to?.state ?? "",
        to?.postalCode ?? "",
        to?.country ?? "",
        (row.order_items ?? []).map(itemLine).join("; "),
        row.discount_code ?? "",
        Number(row.discount_amount ?? 0),
        /* The bare number, not `formatPrice`: this column exists to be summed,
           and "PKR 7,000" is text to every spreadsheet that opens it. Already
           net of the discount column beside it. */
        Number(row.total_amount),
      ];
    }),
    rows.length === MAX_ROWS
      ? `Truncated at ${MAX_ROWS} rows \u2014 narrow by status or export from the database.`
      : undefined
  );

  /* The status rides in the filename because these get kept: a folder with
     three exports in it should say which is which without opening them. */
  const name = csvFilename(status ? `orders-${status}` : "orders");

  return new NextResponse(file, { headers: csvHeaders(name, rows.length) });
}
