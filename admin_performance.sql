-- ============================================================================
-- DREAM STITCH By Sk — admin panel performance
--
-- Indexes for the queries the admin panel actually runs, plus one function so
-- the dashboard's four headline numbers cost one round trip instead of pulling
-- rows into JavaScript to be counted there.
--
-- Run AFTER ecommerce_schema.sql and admin_schema.sql.
-- Safe to re-run: every statement is idempotent.
--
-- Nothing here is required for the app to work. Every caller falls back to the
-- old path if this has not been applied — same contract as lib/api/settings.ts.
-- ============================================================================

-- ----------------------------------------------------------------------
-- 1. Indexes
-- ----------------------------------------------------------------------

-- The admin product search is `name ILIKE '%q%'`. A leading wildcard makes the
-- existing btree on `name` useless, so every keystroke was a sequential scan.
-- A trigram index is the one thing that can serve an unanchored match.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
    ON public.products USING gin (name gin_trgm_ops);

-- /admin/orders?status=… filters on status and orders by created_at within it.
-- The two single-column indexes force a bitmap-and plus a sort; this serves
-- both halves in one ordered scan.
CREATE INDEX IF NOT EXISTS idx_orders_status_created
    ON public.orders(status, created_at DESC);

-- The dashboard's "Running low" panel: `stock <= 5 ORDER BY stock`. Partial, so
-- it stays tiny however large the catalogue grows.
-- Keep the bound in step with LOW_STOCK_AT in app/admin/page.tsx.
CREATE INDEX IF NOT EXISTS idx_products_low_stock
    ON public.products(stock) WHERE stock <= 5;

-- ----------------------------------------------------------------------
-- 2. Dashboard headline numbers
--
--    PostgREST aggregate functions are disabled by default on Supabase, so
--    `sum(total_amount)` is not reachable over REST. The dashboard used to
--    work around that by fetching fifty order rows and summing them in the
--    browser's server render — which is both a large transfer and a number
--    that silently means "the last fifty orders" rather than "revenue".
--
--    SECURITY DEFINER, so it must gate itself: the WHERE clause below yields
--    zero rows to anyone who is not an admin, and the caller falls back.
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS TABLE (
    open_orders     BIGINT,
    revenue         NUMERIC,
    product_count   BIGINT,
    low_stock_count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT
        (SELECT count(*) FROM public.orders
          WHERE status IN ('pending', 'processing')),
        (SELECT coalesce(sum(total_amount), 0) FROM public.orders
          WHERE status <> 'cancelled'),
        (SELECT count(*) FROM public.products),
        (SELECT count(*) FROM public.products WHERE stock <= 5)
    WHERE public.is_admin();
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
