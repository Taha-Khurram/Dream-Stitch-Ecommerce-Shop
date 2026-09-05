-- ============================================================================
-- DREAM STITCH By Sk — what a product costs to make, and the profit that
-- follows from it.
--
-- Why this file exists
-- --------------------
-- The catalogue recorded what a set sells for and never what it cost to put
-- together, so every money figure in the admin was a revenue figure. Revenue
-- is not the number anyone runs a workroom on: two sets that both take
-- PKR 6,490 are not the same business if one costs PKR 2,000 in cloth and
-- stitching and the other costs PKR 5,600.
--
-- What this file adds:
--
--   * product_costs         — what one unit of a product costs us to make.
--                             Entered on the product form, beside the price.
--   * order_item_costs      — that cost as it stood the day a line sold.
--   * a trigger             — which copies the first into the second at the
--                             moment an order line is written.
--   * admin_profit_series() — daily goods revenue, cost of goods, and how much
--                             of that revenue has a cost behind it.
--
-- Why two tables instead of two columns
-- -------------------------------------
-- This is the whole design decision, and it is about who can read what.
--
-- `products` is world-readable by policy — "Allow public read access on
-- products", anon included — and the anon key ships in the browser. A
-- `products.cost_price` column would therefore publish the cost of the entire
-- range to anybody who asked the REST API for it, competitors included. RLS is
-- row-level: there is no policy that hides one column of a table whose rows
-- are public, and column privileges cannot help either, because the admin is
-- an ordinary `authenticated` user distinguished by `is_admin()` rather than
-- by a Postgres role.
--
-- The same argument applies to `order_items`, where a customer can read the
-- lines of their own orders: a cost column there would let anybody who buys
-- one of each set read the cost of one of each set.
--
-- So cost lives in two tables of its own, each with nothing but an admin
-- policy on it. Nothing that a shopper is allowed to read has a cost in it,
-- and the checkout does not so much as fetch one — the trigger in section 4
-- stamps it in Postgres, under the definer's rights, where a request running
-- as the shopper cannot reach it. That also makes the snapshot unconditional:
-- it happens for any order line however it was written, not only for lines
-- that went through /api/checkout.
--
-- Why the cost is snapshotted at all
-- ----------------------------------
-- `unit_price` is already frozen onto the line for this reason: an order is a
-- record of what happened, and re-pricing last quarter's orders every time the
-- catalogue changes would make history move. Cost has the same property and a
-- sharper edge — cloth prices move, and a raise entered this morning must not
-- quietly re-write what March earned.
--
-- A line with no cost row means "not known", never "free", and every figure
-- below keeps the two apart: `costed_revenue` says how much of a window has a
-- cost behind it, so the dashboard can report a margin *and* how much of the
-- trading that margin actually speaks for.
--
-- One convention, shared with analytics_schema.sql: profit is taken over
-- **goods** — `quantity × unit_price` off the fulfilled lines — not over
-- `orders.total_amount`. Delivery is charged to cover a courier whose cost
-- this schema does not record, and counting it as margin would book the
-- postage as profit; discount codes come off the basket rather than the line,
-- so a window with codes redeemed in it reads slightly high. Both are said on
-- the panel rather than left for the reader to discover.
--
-- Run AFTER ecommerce_schema.sql, admin_schema.sql and order_lifecycle.sql —
-- it needs `is_admin()` and the widened status vocabulary.
-- Safe to re-run: every statement is idempotent.
-- ============================================================================


-- ----------------------------------------------------------------------
-- 1. What a unit costs to make, today
--
--    One row per product, or none. Absence is the "not costed yet" state, so
--    there is no null to confuse with a cost of zero and no default that would
--    report an un-costed catalogue as 100% margin the day this file is run.
--
--    ON DELETE CASCADE: a cost with no product is not information, and the
--    line-level snapshots in section 3 are what history is read from.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_costs (
    product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
    cost_price NUMERIC(10, 2) NOT NULL CHECK (cost_price >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.product_costs IS
    'Admin-only: what one unit of a product costs to make. Never exposed to shoppers.';

ALTER TABLE public.product_costs ENABLE ROW LEVEL SECURITY;

-- Admins only, for reading and for writing. No policy exists for anyone else,
-- and RLS denies by default — a shopper's request returns zero rows rather
-- than an error, which is exactly right: there is nothing here for them.
DROP POLICY IF EXISTS "Admins read product costs" ON public.product_costs;
CREATE POLICY "Admins read product costs"
ON public.product_costs
FOR SELECT
TO authenticated
USING (public.is_admin());

DROP POLICY IF EXISTS "Admins write product costs" ON public.product_costs;
CREATE POLICY "Admins write product costs"
ON public.product_costs
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Belt and braces. The policies above already give `anon` nothing; this makes
-- it impossible to reach the table at all, so a future policy written without
-- this file in view cannot accidentally open it to the storefront.
REVOKE ALL ON public.product_costs FROM anon;


-- ----------------------------------------------------------------------
-- 2. That cost, frozen onto the line it sold on
--
--    Keyed by order line rather than carrying its own id: exactly one cost
--    per line, enforced by the primary key rather than by whoever writes it.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_item_costs (
    order_item_id UUID PRIMARY KEY REFERENCES public.order_items(id) ON DELETE CASCADE,
    unit_cost     NUMERIC(10, 2) NOT NULL CHECK (unit_cost >= 0),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.order_item_costs IS
    'Admin-only: what one unit cost to make when the line was ordered. Stamped by trigger.';

ALTER TABLE public.order_item_costs ENABLE ROW LEVEL SECURITY;

-- Read-only even for an admin. Nothing in the app edits a snapshot — that is
-- the point of it being one — and the only writer is the definer trigger
-- below, which bypasses RLS as the table owner.
DROP POLICY IF EXISTS "Admins read order item costs" ON public.order_item_costs;
CREATE POLICY "Admins read order item costs"
ON public.order_item_costs
FOR SELECT
TO authenticated
USING (public.is_admin());

REVOKE ALL ON public.order_item_costs FROM anon;


-- ----------------------------------------------------------------------
-- 3. Backfill — the catalogue's cost today, onto lines that have none
--
--    An estimate, and worth being plain about it: this stamps today's cost
--    onto orders placed before anyone was recording one. It is the only
--    figure those lines will ever have, and the alternative is a dashboard
--    that reports nothing until a full window of new orders has accumulated.
--
--    ON CONFLICT DO NOTHING, so a line that already carries its own snapshot
--    is never touched and re-running the file cannot re-cost history.
--
--    Delete this statement before running the file if you would rather older
--    orders stayed uncosted — the panel handles that honestly and says how
--    much of the window it could see a cost for.
-- ----------------------------------------------------------------------
INSERT INTO public.order_item_costs (order_item_id, unit_cost)
SELECT oi.id, pc.cost_price
  FROM public.order_items oi
  JOIN public.product_costs pc ON pc.product_id = oi.product_id
ON CONFLICT (order_item_id) DO NOTHING;


-- ----------------------------------------------------------------------
-- 4. The stamp
--
--    AFTER INSERT rather than BEFORE, because the row has to exist before
--    anything can key off its id. SECURITY DEFINER, because the session doing
--    the inserting is a shopper's: it can write its own order lines and must
--    not be able to read a cost, and this is what lets both be true at once.
--
--    A product with no cost recorded writes no row. That is the "unknown"
--    state travelling correctly rather than a zero being invented for it.
--
--    Never overwrites: `ON CONFLICT DO NOTHING` covers the re-insert of a line
--    id that somehow already has a snapshot, which should not happen and must
--    not silently re-cost the line if it does.
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.stamp_order_item_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $stamp_order_item_cost$
BEGIN
    INSERT INTO public.order_item_costs (order_item_id, unit_cost)
    SELECT NEW.id, pc.cost_price
      FROM public.product_costs pc
     WHERE pc.product_id = NEW.product_id
    ON CONFLICT (order_item_id) DO NOTHING;

    RETURN NULL;  -- AFTER trigger: the return value is ignored.
END;
$stamp_order_item_cost$;

DROP TRIGGER IF EXISTS order_items_stamp_cost ON public.order_items;
CREATE TRIGGER order_items_stamp_cost
    AFTER INSERT ON public.order_items
    FOR EACH ROW
    EXECUTE FUNCTION public.stamp_order_item_cost();


-- ----------------------------------------------------------------------
-- 5. Profit over the last N days
--
--    Deliberately the same shape, the same window arithmetic and the same
--    fulfilled-only status filter as admin_revenue_series in
--    revenue_recognition.sql, so a day in this series and a bar on the
--    dashboard chart are describing the same orders. Days come from
--    generate_series, so a quiet day is a zero rather than a gap.
--
--    Three numbers rather than a single "profit", because a margin with
--    nothing beside it cannot be told apart from a margin over one costed
--    sale:
--
--      revenue        — goods, at what they sold for.
--      cost           — goods, at what they cost. A line with no snapshot
--                       contributes nothing here *and* nothing to
--                       costed_revenue, so it drops out of the margin
--                       entirely rather than dragging it upward.
--      costed_revenue — the part of `revenue` that has a cost behind it. Equal
--                       to `revenue` when everything sold is costed; the panel
--                       says which of those it is looking at.
--
--    Profit is `costed_revenue - cost`, computed by the caller: it is a
--    subtraction, not worth a round trip, and keeping the parts separate is
--    what lets the panel show cost of goods as a figure in its own right.
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_profit_series(INTEGER);

CREATE FUNCTION public.admin_profit_series(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    day            DATE,
    revenue        NUMERIC,
    cost           NUMERIC,
    costed_revenue NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $admin_profit_series$
    SELECT d.day::date,
           coalesce(sum(oi.quantity * oi.unit_price), 0)::numeric,
           coalesce(sum(oi.quantity * oic.unit_cost), 0)::numeric,
           coalesce(
               sum(oi.quantity * oi.unit_price) FILTER (WHERE oic.unit_cost IS NOT NULL),
               0
           )::numeric
      FROM generate_series(
               timezone('utc'::text, now())::date
                   - (greatest(coalesce(p_days, 7), 1) - 1) * interval '1 day',
               timezone('utc'::text, now())::date,
               interval '1 day'
           ) AS d(day)
      LEFT JOIN public.orders o
             ON o.created_at >= d.day
            AND o.created_at <  d.day + interval '1 day'
            AND o.status IN ('closed', 'completed')
      LEFT JOIN public.order_items oi
             ON oi.order_id = o.id
      LEFT JOIN public.order_item_costs oic
             ON oic.order_item_id = oi.id
     WHERE public.is_admin()
     GROUP BY d.day
     ORDER BY d.day;
$admin_profit_series$;

REVOKE ALL ON FUNCTION public.admin_profit_series(INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_profit_series(INTEGER) TO authenticated;


-- ----------------------------------------------------------------------
-- 6. PostgREST caches the table and function catalogue. Without this, the
--    product form keeps failing to find `product_costs` and the profit panel
--    keeps reporting itself uninstalled until the pooler happens to restart.
-- ----------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ----------------------------------------------------------------------
-- Verify
-- ----------------------------------------------------------------------

-- Both tables exist, and both have RLS on.
SELECT relname, relrowsecurity
  FROM pg_class
 WHERE oid IN ('public.product_costs'::regclass, 'public.order_item_costs'::regclass);

-- How much of the catalogue has been costed.
SELECT count(*)                                        AS products,
       (SELECT count(*) FROM public.product_costs)     AS costed
  FROM public.products;

-- The last week's trading, split. Run as an admin, or the function correctly
-- returns nothing.
SELECT day, revenue, cost, costed_revenue - cost AS profit, costed_revenue
  FROM public.admin_profit_series(7)
 ORDER BY day;
