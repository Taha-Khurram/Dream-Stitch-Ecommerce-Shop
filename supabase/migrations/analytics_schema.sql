-- ============================================================================
-- DREAM STITCH By Sk — analytics beyond revenue
--
-- Three functions behind /admin/analytics. Nothing is collected that was not
-- already being collected: every number here is read out of `order_items`,
-- `orders`, `products`, `categories` and `customers` exactly as they stand.
--
--   * admin_top_products     — what actually sells, by money and by units.
--   * admin_category_revenue — the same split by category, uncategorised
--                              products included as their own bucket.
--   * admin_shopper_stats    — signup→purchase conversion and the repeat-
--                              customer rate, each with the equal-length
--                              window before it so the tiles can carry a
--                              delta the same way the dashboard's do.
--
-- Two rules every one of them keeps, so these screens can never disagree with
-- the dashboard:
--
--   1. Money is recognised on fulfilment. The status filter is
--      `('closed', 'completed')` — the same set as REVENUE_STATUSES in
--      lib/orders/lifecycle.ts and revenue_recognition.sql. `completed` is
--      the pre-order_lifecycle.sql spelling that survives in older rows.
--   2. A window of `p_days` ends today and starts `p_days - 1` days ago, in
--      UTC, dated by `orders.created_at` — the identical arithmetic
--      admin_revenue_series uses, so "the last 30 days" means one thing.
--
-- One deliberate difference, and it is worth knowing about: the two breakdowns
-- sum `quantity * unit_price` off the order LINES, whereas the dashboard's
-- revenue tile sums `orders.total_amount`. Line revenue is goods only, so it
-- excludes delivery (see lib/pricing.ts). A category cannot be charged for
-- postage, so attributing it would be inventing a number — which does mean the
-- category totals add up to slightly less than the headline figure on a window
-- where anything shipped below the free-delivery threshold.
--
-- Run AFTER ecommerce_schema.sql, admin_schema.sql, dashboard_schema.sql and
-- order_lifecycle.sql. It depends on `is_admin()`, on `orders.customer_id` and
-- on the widened status vocabulary.
-- Safe to re-run: every statement is idempotent.
--
-- Nothing here is required for the app to work. /admin/analytics says plainly
-- that the file has not been run rather than rendering empty panels that read
-- as "nothing sold" — the same choice the Customers screen makes about
-- dashboard_schema.sql.
-- ============================================================================


-- ----------------------------------------------------------------------
-- 1. An index for the join these three all make
--
--    Every query below walks `order_items` back to `orders` to find out
--    whether the line was fulfilled and when. idx_order_items_order_id
--    (ecommerce_schema.sql) serves the join itself; this one serves the other
--    side — pick the fulfilled orders in a date range, then look up their
--    lines. Partial, so it indexes only the orders whose money counts and
--    stays a fraction of the size of idx_orders_status_created.
--
--    Keep the status set in step with REVENUE_STATUSES.
-- ----------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_fulfilled_created
    ON public.orders (created_at DESC)
    WHERE status IN ('closed', 'completed');


-- ----------------------------------------------------------------------
-- 2. Top products
--
--    Ordered by revenue rather than by units, because that is the question
--    being asked: a cheap set that shifts forty units is a good line, but it
--    is not the thing paying the rent, and ordering by volume would bury the
--    thing that is. Units come back alongside so both readings are on screen.
--
--    `orders` counts DISTINCT order ids, not lines. One order that takes a
--    King and a Single of the same design is one order and two lines; calling
--    that two orders would double-count a customer.
--
--    A product deleted from the catalogue drops out of this list entirely —
--    `order_items.product_id` is ON DELETE RESTRICT, so that cannot happen
--    while any order references it, and an inner join is therefore safe.
--
--    p_limit is clamped: this feeds a fixed-height panel, and an unbounded
--    limit arriving from a caller is an invitation to serialise the whole
--    catalogue into a server render.
--
--    `window_revenue` is the same number on every row, and it is what makes
--    the share column mean something. This is a top eight, so the rows it
--    returns do not add up to the window — dividing by their own subtotal
--    would report the best seller of a quiet week as 40% of the business.
--    Dividing by every fulfilled line instead makes a product's share and its
--    category's share (section 3) figures on one scale, which is the whole
--    point of putting the two panels on one screen. Uncorrelated, so the
--    planner evaluates it once as an InitPlan rather than per row.
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_top_products(INTEGER, INTEGER);

CREATE FUNCTION public.admin_top_products(
    p_days  INTEGER DEFAULT 7,
    p_limit INTEGER DEFAULT 8
)
RETURNS TABLE (
    product_id     UUID,
    name           TEXT,
    slug           TEXT,
    image_url      TEXT,
    units          BIGINT,
    orders         BIGINT,
    revenue        NUMERIC,
    window_revenue NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $admin_top_products$
    SELECT p.id,
           p.name,
           p.slug,
           p.image_url,
           sum(oi.quantity)::bigint,
           count(DISTINCT oi.order_id),
           sum(oi.quantity * oi.unit_price)::numeric,
           (SELECT coalesce(sum(oi2.quantity * oi2.unit_price), 0)::numeric
              FROM public.order_items oi2
              JOIN public.orders o2 ON o2.id = oi2.order_id
             WHERE o2.status IN ('closed', 'completed')
               AND o2.created_at >= timezone('utc'::text, now())::date
                                    - (greatest(coalesce(p_days, 7), 1) - 1) * interval '1 day')
      FROM public.order_items oi
      JOIN public.orders   o ON o.id = oi.order_id
      JOIN public.products p ON p.id = oi.product_id
     WHERE public.is_admin()
       AND o.status IN ('closed', 'completed')
       AND o.created_at >= timezone('utc'::text, now())::date
                           - (greatest(coalesce(p_days, 7), 1) - 1) * interval '1 day'
     GROUP BY p.id, p.name, p.slug, p.image_url
     ORDER BY sum(oi.quantity * oi.unit_price) DESC,
              sum(oi.quantity) DESC,
              p.name
     LIMIT greatest(1, least(50, coalesce(p_limit, 8)));
$admin_top_products$;

REVOKE ALL ON FUNCTION public.admin_top_products(INTEGER, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_top_products(INTEGER, INTEGER) TO authenticated;


-- ----------------------------------------------------------------------
-- 3. Revenue by category
--
--    Same rows as section 2, grouped one level up. The join to `categories`
--    is a LEFT JOIN and the grouping key is `c.id`, so every line whose
--    product has no category — `products.category_id` is ON DELETE SET NULL,
--    so deleting a category creates exactly this — collapses into a single
--    bucket with a null id rather than vanishing from the breakdown. A
--    category split that does not add up to the total is worse than one with
--    an "Uncategorised" row in it.
--
--    The category is read from the product as it stands *today*, not as it
--    stood when the order was placed. Nothing in the schema records the
--    latter, and it is the right answer for the question this panel is asked
--    ("which part of the range is earning") — but it does mean re-filing a
--    product moves its whole history with it.
--
--    Unlimited: a store has a handful of categories, and dropping the tail
--    would be dropping part of the total. That is also what lets this one
--    skip the `window_revenue` column section 2 needs — every fulfilled line
--    is in here somewhere, so the rows already sum to the window.
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_category_revenue(INTEGER);

CREATE FUNCTION public.admin_category_revenue(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    category_id UUID,
    name        TEXT,
    slug        TEXT,
    units       BIGINT,
    orders      BIGINT,
    revenue     NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $admin_category_revenue$
    SELECT c.id,
           coalesce(c.name, 'Uncategorised'),
           c.slug,
           sum(oi.quantity)::bigint,
           count(DISTINCT oi.order_id),
           sum(oi.quantity * oi.unit_price)::numeric
      FROM public.order_items oi
      JOIN public.orders     o ON o.id = oi.order_id
      JOIN public.products   p ON p.id = oi.product_id
      LEFT JOIN public.categories c ON c.id = p.category_id
     WHERE public.is_admin()
       AND o.status IN ('closed', 'completed')
       AND o.created_at >= timezone('utc'::text, now())::date
                           - (greatest(coalesce(p_days, 7), 1) - 1) * interval '1 day'
     GROUP BY c.id, c.name, c.slug
     ORDER BY sum(oi.quantity * oi.unit_price) DESC,
              coalesce(c.name, 'Uncategorised');
$admin_category_revenue$;

REVOKE ALL ON FUNCTION public.admin_category_revenue(INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_category_revenue(INTEGER) TO authenticated;


-- ----------------------------------------------------------------------
-- 4. Conversion, and how many come back
--
--    Two rates out of one round trip, because both need the same answer to
--    the same awkward question: which person does this order belong to?
--
--    An order can identify its buyer three ways. `customer_id` is the direct
--    link dashboard_schema.sql added and backfilled. Checkout does not set it
--    — it writes `user_id` from the session — so an order placed since that
--    migration is matched through `customers.user_id` instead. An order with
--    neither (an import, seed data) falls back to the raw `user_id`, and one
--    with none of the three is left out: it cannot be attributed to anybody,
--    and counting it as its own anonymous customer would inflate the
--    denominator of both rates with rows that can never repeat.
--
--    coalesce() rather than a union is what keeps one person one buyer: an
--    order carrying both a customer_id and a user_id resolves to the
--    customer, so the two identifiers can never split one shopper in half.
--
--    ── conversion ──
--    Of the customers who joined in the window, the share that has since
--    placed an order that was fulfilled. "Has since" is lifetime, not
--    in-window: a signup on the last day of the window has not had a week to
--    come back, and requiring the purchase to land inside the same window
--    would report that as a failure to convert.
--
--    The cost of that choice is that the older cohort has had longer to
--    convert, so the delta flatters the previous period slightly. It is the
--    honest direction to be wrong in — it under-claims rather than over-claims
--    — and the alternative is worse.
--
--    This is a *signup* conversion, not a visit conversion. The store has no
--    persisted session history to measure the latter against: live_sessions
--    holds only who is on the site right now and prunes itself hourly (see
--    presence_schema.sql), by design.
--
--    ── repeat ──
--    Of the customers who bought in the window, the share that has ever
--    bought more than once. Lifetime again, and for the same reason: two
--    orders inside one seven-day window is not what "a repeat customer"
--    means to anybody.
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_shopper_stats(INTEGER);

CREATE FUNCTION public.admin_shopper_stats(p_days INTEGER DEFAULT 7)
RETURNS TABLE (
    signups            BIGINT,
    converted          BIGINT,
    prior_signups      BIGINT,
    prior_converted    BIGINT,
    buyers             BIGINT,
    repeat_buyers      BIGINT,
    prior_buyers       BIGINT,
    prior_repeat_buyers BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $admin_shopper_stats$
    WITH win AS (
        SELECT timezone('utc'::text, now())::date
                   - (greatest(coalesce(p_days, 7), 1) - 1) * interval '1 day'     AS opened,
               timezone('utc'::text, now())::date
                   - (greatest(coalesce(p_days, 7), 1) * 2 - 1) * interval '1 day' AS prior
    ),
    /* Every fulfilled order, resolved to one buyer. */
    attributed AS (
        SELECT o.created_at,
               coalesce(o.customer_id, c.id, o.user_id) AS buyer
          FROM public.orders o
          LEFT JOIN public.customers c ON c.user_id = o.user_id
         WHERE o.status IN ('closed', 'completed')
           AND coalesce(o.customer_id, c.id, o.user_id) IS NOT NULL
    ),
    lifetime AS (
        SELECT buyer, count(*) AS placed FROM attributed GROUP BY buyer
    ),
    /* The signup cohorts, each flagged with whether they ever bought. */
    cohort AS (
        SELECT c.created_at >= (SELECT opened FROM win) AS in_window,
               c.created_at >= (SELECT prior  FROM win)
                   AND c.created_at < (SELECT opened FROM win) AS in_prior,
               EXISTS (SELECT 1 FROM lifetime l WHERE l.buyer = c.id) AS bought
          FROM public.customers c
    ),
    window_buyers AS (
        SELECT DISTINCT buyer FROM attributed
         WHERE created_at >= (SELECT opened FROM win)
    ),
    prior_window_buyers AS (
        SELECT DISTINCT buyer FROM attributed
         WHERE created_at >= (SELECT prior  FROM win)
           AND created_at <  (SELECT opened FROM win)
    )
    SELECT
        (SELECT count(*) FROM cohort WHERE in_window),
        (SELECT count(*) FROM cohort WHERE in_window AND bought),
        (SELECT count(*) FROM cohort WHERE in_prior),
        (SELECT count(*) FROM cohort WHERE in_prior AND bought),
        (SELECT count(*) FROM window_buyers),
        (SELECT count(*) FROM window_buyers w
           JOIN lifetime l ON l.buyer = w.buyer
          WHERE l.placed > 1),
        (SELECT count(*) FROM prior_window_buyers p),
        (SELECT count(*) FROM prior_window_buyers p
           JOIN lifetime l ON l.buyer = p.buyer
          WHERE l.placed > 1)
    WHERE public.is_admin();
$admin_shopper_stats$;

REVOKE ALL ON FUNCTION public.admin_shopper_stats(INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_shopper_stats(INTEGER) TO authenticated;


-- ----------------------------------------------------------------------
-- 5. PostgREST caches the catalogue of callable functions. Without this it
--    keeps answering PGRST202 for all three until the pooler restarts.
-- ----------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ----------------------------------------------------------------------
-- Verify — the three functions are installed, then a look at what each one
-- says over the last 90 days. Run as an admin, or they correctly return
-- nothing at all.
-- ----------------------------------------------------------------------
SELECT 'analytics functions' AS check_name, count(*)::text AS result
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname IN ('admin_top_products', 'admin_category_revenue', 'admin_shopper_stats');

SELECT name, units, orders, revenue, window_revenue
  FROM public.admin_top_products(90, 8);

SELECT name, units, orders, revenue FROM public.admin_category_revenue(90);

SELECT * FROM public.admin_shopper_stats(90);
