-- ============================================================================
-- DREAM STITCH By Sk — order lifecycle
--
-- Puts a triage gate in front of the order book. An order now arrives as
-- `new` and stays there until an admin accepts it or deletes it; only an
-- accepted order starts moving through the fulfilment stages:
--
--     new ──accept──▶ opened ──▶ pending ──▶ processing ──▶ closed
--      │                 └──────────┴────────────┴──────▶ cancelled
--      └──delete──▶ (row gone)
--
-- What this file changes:
--
--   * public.orders.status — the CHECK constraint widens to the six statuses
--                            above, and the column default becomes 'new'.
--                            'completed' rows are renamed to 'closed'.
--   * public.orders        — gains an admin DELETE policy. There was none, so
--                            "delete this order" silently affected nothing.
--   * admin_dashboard_stats — the open-orders count picks up the two new
--                            working states, so a freshly placed order is
--                            counted the moment it lands.
--
-- Run AFTER ecommerce_schema.sql, admin_schema.sql and dashboard_schema.sql.
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------
-- 1. Widen the status vocabulary
--
--    Order matters. The constraint is dropped first, then the existing rows
--    are renamed, then the new constraint goes on — renaming under the old
--    constraint would fail on 'closed', and adding the new constraint before
--    the rename would fail on 'completed'.
--
--    'pending', 'processing' and 'cancelled' carry straight over: they are
--    already-triaged states, so every row that has one stays valid and keeps
--    its meaning. Only 'completed' is respelled.
-- ----------------------------------------------------------------------
ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_status_check;

UPDATE public.orders
   SET status = 'closed'
 WHERE status = 'completed';

ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN ('new', 'opened', 'pending', 'processing', 'closed', 'cancelled'));

-- Checkout sets the status explicitly, but the default is what protects a
-- direct INSERT (a SQL import, a seed file) from landing pre-accepted.
ALTER TABLE public.orders
    ALTER COLUMN status SET DEFAULT 'new';


-- ----------------------------------------------------------------------
-- 2. Let an admin delete an order
--
--    admin_schema.sql granted admins SELECT and UPDATE on orders but never
--    DELETE, so a delete matched no rows and PostgREST reported success on
--    having changed nothing. This is the missing half.
--
--    order_items is ON DELETE CASCADE, and a cascade runs as the system
--    rather than as the caller, so the lines go with the order without
--    needing a DELETE policy of their own.
--
--    Nobody but an admin gets this. A customer cannot delete their own order
--    — cancelling is theirs to ask for, erasing the record is not.
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins delete orders" ON public.orders;
CREATE POLICY "Admins delete orders"
ON public.orders FOR DELETE TO authenticated USING (public.is_admin());


-- ----------------------------------------------------------------------
-- 3. Count the new states as open work
--
--    Same function as dashboard_schema.sql section 6, with one line changed:
--    open_orders now spans every status that still owes someone something.
--    Revenue is untouched and still excludes only 'cancelled' — an order
--    awaiting acceptance is money on the table, and dropping it from the
--    total would move a number the dashboard has always reported.
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
    WITH billable AS (
        SELECT total_amount
          FROM public.orders
         WHERE status <> 'cancelled'
    )
    SELECT
        (SELECT count(*) FROM public.orders
          WHERE status IN ('new', 'opened', 'pending', 'processing')),
        (SELECT coalesce(sum(total_amount), 0) FROM billable),
        (SELECT count(*) FROM public.products),
        (SELECT count(*) FROM public.products WHERE stock <= 5),
        (SELECT count(*) FROM public.orders),
        (SELECT coalesce(round(avg(total_amount), 2), 0) FROM billable),
        (SELECT count(*) FROM public.customers)
    WHERE public.is_admin();
$admin_dashboard_stats$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;


-- ----------------------------------------------------------------------
-- 4. PostgREST caches the schema, including column defaults.
-- ----------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ----------------------------------------------------------------------
-- Verify — the new default, the delete policy, and the book by status.
-- ----------------------------------------------------------------------
SELECT 'orders.status default' AS check_name, column_default AS result
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'status'
UNION ALL
SELECT 'admin delete policy', count(*)::text
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'orders'
   AND policyname = 'Admins delete orders'
UNION ALL
SELECT 'legacy completed rows', count(*)::text
  FROM public.orders WHERE status = 'completed';
