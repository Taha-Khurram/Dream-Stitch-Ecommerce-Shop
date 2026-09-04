-- ============================================================================
-- DREAM STITCH By Sk — revenue recognition
--
-- Revenue now counts only orders that have actually been fulfilled.
--
-- Both dashboard money functions used to sum every order that was not
-- cancelled, which put an order in the total the moment it landed. That reads
-- as takings before anything has shipped, and it makes the headline figure
-- fall whenever an order is later cancelled. Recognising revenue on
-- fulfilment instead means the number only moves one way, and the orders
-- still in the workflow stay visible as the open-orders count they already
-- are.
--
-- What this file changes:
--
--   * admin_dashboard_stats  — `revenue` and `avg_order_value` sum only
--                              fulfilled orders. `open_orders` and
--                              `order_count` are untouched.
--   * admin_revenue_series   — the daily bars, and the daily order count
--                              beside them, cover only fulfilled orders.
--
-- The fulfilled set is `('closed', 'completed')`: `closed` is the lifecycle
-- spelling, `completed` the pre-`order_lifecycle.sql` one that survives in any
-- row written before that migration ran. Mirrors `REVENUE_STATUSES` in
-- `lib/orders/lifecycle.ts` — changing one means changing the other.
--
-- Run AFTER dashboard_schema.sql and order_lifecycle.sql: it redefines the
-- functions both of those create, so running it earlier would have the later
-- file put the old definitions back.
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------
-- 1. Headline numbers
--
--    Same shape and column names as order_lifecycle.sql section 3 — this is
--    a redefinition, not a widening, so every caller reading by key keeps
--    working. Only what `earned` selects has changed.
--
--    Definitions, so the tiles can be trusted:
--      revenue         — sum of every fulfilled order.
--      open_orders     — orders that still owe someone something. Unchanged:
--                        the money they represent is now counted here and
--                        nowhere else.
--      order_count     — every order, cancelled included. It is a volume
--                        number, not a money number.
--      avg_order_value — revenue divided by the orders that make it up, i.e.
--                        the fulfilled ones. Dividing by order_count would
--                        mix a fulfilled numerator with a whole-book
--                        denominator and read far below any real basket.
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_dashboard_stats();

CREATE FUNCTION public.admin_dashboard_stats()
RETURNS TABLE (
    open_orders     BIGINT,
    revenue         NUMERIC,
    product_count   BIGINT,
    low_stock_count BIGINT,
    order_count     BIGINT,
    avg_order_value NUMERIC,
    customer_count  BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $admin_dashboard_stats$
    WITH earned AS (
        SELECT total_amount
          FROM public.orders
         WHERE status IN ('closed', 'completed')
    )
    SELECT
        (SELECT count(*) FROM public.orders
          WHERE status IN ('new', 'opened', 'pending', 'processing')),
        (SELECT coalesce(sum(total_amount), 0) FROM earned),
        (SELECT count(*) FROM public.products),
        (SELECT count(*) FROM public.products WHERE stock <= 5),
        (SELECT count(*) FROM public.orders),
        (SELECT coalesce(round(avg(total_amount), 2), 0) FROM earned),
        (SELECT count(*) FROM public.customers)
    WHERE public.is_admin();
$admin_dashboard_stats$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;


-- ----------------------------------------------------------------------
-- 2. Revenue over the last N days
--
--    Days still come from generate_series, so a day with nothing fulfilled is
--    a zero rather than a gap.
--
--    Bars stay dated by `created_at` — when the order was placed, not when it
--    shipped — so the shape of a week does not shift under a bar every time
--    an old order is closed. The consequence is that a recent day fills in as
--    its orders are fulfilled; that is the same trading week the tiles
--    describe, and the caption below the chart says so.
--
--    `orders` counts the fulfilled ones only. Counting the whole book beside
--    a fulfilled-only revenue figure would put a bar of zero next to a count
--    of six.
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_revenue_series(INTEGER);

CREATE FUNCTION public.admin_revenue_series(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    day     DATE,
    revenue NUMERIC,
    orders  BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $admin_revenue_series$
    SELECT d.day::date,
           coalesce(sum(o.total_amount), 0)::numeric,
           count(o.id)
      FROM generate_series(
               timezone('utc'::text, now())::date
                   - (greatest(p_days, 1) - 1) * interval '1 day',
               timezone('utc'::text, now())::date,
               interval '1 day'
           ) AS d(day)
      LEFT JOIN public.orders o
             ON o.created_at >= d.day
            AND o.created_at <  d.day + interval '1 day'
            AND o.status IN ('closed', 'completed')
     WHERE public.is_admin()
     GROUP BY d.day
     ORDER BY d.day;
$admin_revenue_series$;

REVOKE ALL ON FUNCTION public.admin_revenue_series(INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_revenue_series(INTEGER) TO authenticated;


-- ----------------------------------------------------------------------
-- 3. PostgREST caches the catalogue of callable functions.
-- ----------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ----------------------------------------------------------------------
-- Verify — the book split into what is earned and what is not yet, and the
-- two figures the tiles will show. Run as an admin, or the functions
-- correctly return nothing.
-- ----------------------------------------------------------------------
SELECT CASE
           WHEN status IN ('closed', 'completed') THEN 'earned'
           WHEN status = 'cancelled'              THEN 'cancelled'
           ELSE 'not yet earned'
       END AS bucket,
       count(*)                          AS orders,
       coalesce(sum(total_amount), 0)    AS amount
  FROM public.orders
 GROUP BY 1
 ORDER BY 1;

SELECT revenue, avg_order_value, open_orders, order_count
  FROM public.admin_dashboard_stats();
