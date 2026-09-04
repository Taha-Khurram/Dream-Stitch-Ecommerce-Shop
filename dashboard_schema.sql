-- ============================================================================
-- DREAM STITCH By Sk — customers + dashboard analytics
--
-- Phase 1 of the admin dashboard brief, reconciled with the schema that is
-- already live. The brief asked for three tables (customers, products,
-- orders); two of them already exist and carry the storefront, so this file
-- is ADDITIVE ONLY:
--
--   * public.customers  — new. The one table the brief asked for that was
--                         genuinely missing.
--   * public.orders     — gains a nullable `customer_id`; `user_id` is
--                         relaxed to nullable so an order can exist without
--                         an auth account (imports, phone orders, seed data).
--   * public.products   — untouched. It already has name/price/stock plus
--                         the catalogue columns the shop renders.
--
-- Nothing is dropped and nothing is re-created. Checkout, order_items,
-- product_media and every RLS policy keep working exactly as before.
--
-- Run AFTER ecommerce_schema.sql, admin_schema.sql and admin_performance.sql.
-- Safe to re-run: every statement is idempotent.
-- ============================================================================


-- ----------------------------------------------------------------------
-- 1. Customers
--
--    The brief's shape is (id, name, email, created_at). `user_id` is the
--    one addition: it is what lets a customer row line up with the auth
--    account that placed the order, so the dashboard can join a name onto
--    an order instead of digging it out of the shipping address JSON.
--    Nullable, because a customer record can exist before (or without) a
--    login — which is the whole point of having the table.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customers (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    name       TEXT NOT NULL CHECK (length(btrim(name)) > 0),
    email      TEXT NOT NULL UNIQUE CHECK (position('@' IN email) > 1),
    phone      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- The customers list sorts newest first; the dashboard counts over the table.
CREATE INDEX IF NOT EXISTS idx_customers_created_at
    ON public.customers(created_at DESC);

-- Admin search is `name ILIKE '%q%'` — a leading wildcard needs a trigram
-- index, same reasoning as idx_products_name_trgm in admin_performance.sql.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_customers_name_trgm
    ON public.customers USING gin (name gin_trgm_ops);


-- ----------------------------------------------------------------------
-- 2. Wire orders to customers
--
--    Both changes are additive. `customer_id` is nullable so the rows that
--    already exist stay valid, and DROP NOT NULL on user_id only ever widens
--    what the column accepts — no existing row or policy is invalidated.
--    ("Users can view their own orders" is `auth.uid() = user_id`, which
--    simply yields NULL -> not visible for an order with no account. Admins
--    still see the whole book through `is_admin()`.)
-- ----------------------------------------------------------------------
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS customer_id UUID
        REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.orders
    ALTER COLUMN user_id DROP NOT NULL;

-- An un-indexed foreign key makes both the join and the ON DELETE SET NULL
-- scan the whole orders table.
CREATE INDEX IF NOT EXISTS idx_orders_customer_id
    ON public.orders(customer_id);

-- The revenue series filters purely on created_at. idx_orders_status_created
-- leads with `status`, so it cannot serve a bare date range.
CREATE INDEX IF NOT EXISTS idx_orders_created_at
    ON public.orders(created_at DESC);


-- ----------------------------------------------------------------------
-- 3. Backfill — every existing account becomes a customer, and every
--    existing order is linked to it.
-- ----------------------------------------------------------------------
INSERT INTO public.customers (user_id, name, email)
SELECT p.id,
       coalesce(nullif(btrim(p.full_name), ''), split_part(p.email, '@', 1)),
       p.email
  FROM public.profiles p
 WHERE p.email IS NOT NULL
   AND position('@' IN p.email) > 1
ON CONFLICT (email) DO NOTHING;

UPDATE public.orders o
   SET customer_id = c.id
  FROM public.customers c
 WHERE c.user_id = o.user_id
   AND o.customer_id IS NULL;


-- ----------------------------------------------------------------------
-- 4. Keep it in step — a new signup gets a customer row automatically.
--
--    admin_schema.sql already puts an AFTER INSERT trigger on auth.users for
--    `profiles`. This is a second, independent trigger rather than an edit to
--    that function, so neither file has to know about the other.
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_customer()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $handle_new_customer$
BEGIN
    IF NEW.email IS NULL OR position('@' IN NEW.email) < 2 THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.customers (user_id, name, email)
    VALUES (
        NEW.id,
        coalesce(
            nullif(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
            split_part(NEW.email, '@', 1)
        ),
        NEW.email
    )
    ON CONFLICT (email) DO UPDATE
        SET user_id = excluded.user_id
      WHERE public.customers.user_id IS NULL;

    RETURN NEW;
END;
$handle_new_customer$;

DROP TRIGGER IF EXISTS on_auth_user_created_customer ON auth.users;
CREATE TRIGGER on_auth_user_created_customer
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_customer();


-- ----------------------------------------------------------------------
-- 5. Row Level Security
--
--    Same shape as the rest of the schema: admins get the whole table, a
--    signed-in customer gets exactly their own row, anonymous gets nothing.
-- ----------------------------------------------------------------------
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers view their own record" ON public.customers;
CREATE POLICY "Customers view their own record"
ON public.customers FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Admins view all customers" ON public.customers;
CREATE POLICY "Admins view all customers"
ON public.customers FOR SELECT TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins insert customers" ON public.customers;
CREATE POLICY "Admins insert customers"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins update customers" ON public.customers;
CREATE POLICY "Admins update customers"
ON public.customers FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete customers" ON public.customers;
CREATE POLICY "Admins delete customers"
ON public.customers FOR DELETE TO authenticated
USING (public.is_admin());


-- ----------------------------------------------------------------------
-- 6. Dashboard headline numbers
--
--    Extends admin_dashboard_stats() with the three KPIs the brief asks for
--    (total revenue, average order value, total orders) plus a customer
--    count. The four original columns keep their names and meaning, so this
--    is a widening change for any caller reading by key.
--
--    DROP first: changing the OUT columns of a set-returning function is not
--    something CREATE OR REPLACE can do.
--
--    Definitions, so the tiles can be trusted:
--      revenue         — sum of every order not cancelled.
--      order_count     — every order, cancelled included. It is a volume
--                        number, not a money number.
--      avg_order_value — revenue divided by the orders that make it up, i.e.
--                        the non-cancelled ones. Dividing by order_count
--                        would quietly deflate AOV every time one is voided.
--
--    SECURITY DEFINER, so it gates itself: the WHERE yields zero rows to a
--    non-admin and the caller falls back.
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
          WHERE status IN ('pending', 'processing')),
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
-- 7. Revenue over the last N days
--
--    generate_series supplies the spine, so a day with no orders comes back
--    as a zero rather than being missing — a line chart that skips empty
--    days lies about the shape of the week.
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
            AND o.status <> 'cancelled'
     WHERE public.is_admin()
     GROUP BY d.day
     ORDER BY d.day;
$admin_revenue_series$;

REVOKE ALL ON FUNCTION public.admin_revenue_series(INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_revenue_series(INTEGER) TO authenticated;


-- ----------------------------------------------------------------------
-- 8. PostgREST caches the schema. Without this the API keeps returning
--    PGRST205 for `customers` until the pooler happens to restart.
-- ----------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ----------------------------------------------------------------------
-- Verify — three rows: a customer count, the new column, and its nullability.
-- ----------------------------------------------------------------------
SELECT 'customers rows' AS check_name, count(*)::text AS result
  FROM public.customers
UNION ALL
SELECT 'orders.customer_id exists', count(*)::text
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'orders'
   AND column_name = 'customer_id'
UNION ALL
SELECT 'orders.user_id nullable', max(is_nullable)
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'orders'
   AND column_name = 'user_id';
