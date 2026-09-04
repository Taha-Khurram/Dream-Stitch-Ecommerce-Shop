# Migrations

Every `.sql` file the project applies to Supabase lives here — nothing SQL goes
in the repo root. New migrations get added to this directory and to the run
order below.

There is no Supabase CLI in this project: each file is pasted into the
**Supabase SQL editor** and run by hand, so the filenames carry no timestamp
prefix. This table is the ordering.

## Run order

| # | File | Depends on |
| :-- | :-- | :-- |
| 1 | `ecommerce_schema.sql` | — the store's base tables |
| 2 | `bedding_seed.sql` | 1 — catalogue + bedding columns (generated, see below) |
| 3 | `admin_schema.sql` | 1, 2 — `is_admin()`, RLS write policies, `store_settings` |
| 4 | `product_media_schema.sql` | 1, 3 — public product-image bucket |
| 5 | `admin_performance.sql` | 1, 3 — indexes for the admin lists |
| 6 | `dashboard_schema.sql` | 1, 3, 5 — `customers`, dashboard RPCs |
| 7 | `presence_schema.sql` | 3 — live visitor table |
| 8 | `order_lifecycle.sql` | 1, 3, 6 — widened `orders.status` CHECK, admin policies |
| 9 | `inbox_schema.sql` | 3 — newsletter + contact tables |

Optional, run at any point after their dependency:

| File | Notes |
| :-- | :-- |
| `products_bedding_columns.sql` | Step 1 of `bedding_seed.sql` alone — the bedding columns without the delete-and-reinsert. Use instead of 2 to keep an existing catalogue. |
| `dashboard_seed.sql` | Demo customers/orders for the dashboard. Needs 6. |
| `supabase_schema.sql` | The original `todos` table demo. Unrelated to the store; nothing in `app/` reads it. |

Each file is idempotent — re-running one is safe.

## Generated files

`bedding_seed.sql` is **generated output**. Edit
[`scripts/gen_bedding_seed.py`](../../scripts/gen_bedding_seed.py) and re-run
`python scripts/gen_bedding_seed.py` rather than editing the SQL by hand.
