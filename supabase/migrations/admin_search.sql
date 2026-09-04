-- ============================================================================
-- DREAM STITCH By Sk — admin search
--
-- The panel can now look an order or a customer up by what the person on the
-- phone actually says: a reference, a name, an email, a phone number. This file
-- is the index side of that — the queries work without it, they just work by
-- reading every row.
--
-- Run AFTER ecommerce_schema.sql, admin_performance.sql and dashboard_schema.sql.
-- Safe to re-run: every statement is idempotent.
--
-- Nothing here is required for the app to work.
-- ============================================================================

-- Same reasoning as idx_products_name_trgm in admin_performance.sql: the search
-- is `ILIKE '%q%'`, the leading wildcard makes a btree useless, and a trigram
-- index is the one thing that can serve an unanchored match.
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- ----------------------------------------------------------------------
-- 1. Orders — the person, out of the shipping address
--
--    The address rather than the linked customer, because that is what the
--    list renders and what a guest checkout leaves behind. `jsonb ->> text` is
--    immutable, so these are ordinary expression indexes; the expressions have
--    to match ORDER_COLUMNS in lib/admin/search.ts character for character or
--    the planner will not use them.
-- ----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_ship_name_trgm
    ON public.orders USING gin ((shipping_address ->> 'fullName') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_orders_ship_email_trgm
    ON public.orders USING gin ((shipping_address ->> 'email') gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_orders_ship_phone_trgm
    ON public.orders USING gin ((shipping_address ->> 'phone') gin_trgm_ops);

-- Searching by reference needs no index at all, which is the point of how it is
-- built: `#3F9A21C4` is a prefix of the uuid, uuids sort bytewise, so the panel
-- sends a plain range — `id >= 3f9a21c4-0000-… AND id < 3f9a21c5-0000-…` — and
-- the primary key serves it. See referenceClause() in lib/admin/search.ts.


-- ----------------------------------------------------------------------
-- 2. Customers
--
--    idx_customers_name_trgm already exists in dashboard_schema.sql, written
--    for this search before there was one. These are the other two columns the
--    box now looks at.
-- ----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_customers_email_trgm
    ON public.customers USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_customers_phone_trgm
    ON public.customers USING gin (phone gin_trgm_ops);
