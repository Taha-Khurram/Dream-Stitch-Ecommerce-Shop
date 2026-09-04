-- ============================================================================
-- DREAM STITCH By Sk — discount codes
--
-- A coupon is two things that look like one: a *rule* an admin writes down,
-- and a *ledger* of the times it was actually spent. This file is both, kept
-- deliberately apart:
--
--   * public.discount_codes       — the rule. What it takes off, what the bag
--                                   has to be worth first, and the window it
--                                   is alive in.
--   * public.discount_redemptions — the ledger. One row per order that used a
--                                   code, with the money it moved.
--
-- There is no `times_used` counter on the code, and that is the whole design.
-- A counter and a ledger disagree the first time anything goes wrong — a
-- rolled-back checkout, a deleted order, a hand-edited row — and when they do,
-- the counter is the one that gets believed and the one that is wrong. The
-- ledger is the only source of truth here: the cap is enforced by counting it
-- under a row lock, and every usage figure on the panel is an aggregate of it.
--
-- Three functions carry the public side, and none of them lets the caller near
-- the tables. Following inbox_schema.sql, there is no anon or customer policy
-- anywhere in this file: an INSERT policy on `discount_redemptions` would hand
-- the client the shape of the row, which is to say the amount. A SELECT policy
-- on `discount_codes` would be worse — it would let anyone holding any session
-- list every live coupon in the store. So instead:
--
--   * preview_discount()      — "is this code any good to me, and for how much"
--   * redeem_discount()       — spends it against an order, once, under a lock
--   * admin_discount_usage()  — the aggregates the panel and dashboard read
--
-- `orders` also gains `discount_code` and `discount_amount`, so an order stays
-- self-describing: what it was reduced by is on the row, not reachable only by
-- joining a ledger that a later delete may have taken with it.
--
-- Run AFTER ecommerce_schema.sql and admin_schema.sql (it depends on
-- `is_admin()`). Safe to re-run: every statement is idempotent.
--
-- Nothing here is required for the app to work. Checkout places orders exactly
-- as before when this has not been applied, the promo field reports that codes
-- are not installed rather than silently swallowing one, and /admin/discounts
-- names the file to run — the same fallback contract as inbox_schema.sql.
--
-- On time: the columns default to `timezone('utc', now())` in the house style
-- from ecommerce_schema.sql, but every comparison inside the functions uses a
-- bare `now()`. Same reason inbox_schema.sql gives — `timezone('utc', now())`
-- is a timestamp, and comparing one to a TIMESTAMPTZ column pulls the session
-- TimeZone into the answer. A coupon's expiry is not a place to want that.
-- ============================================================================


-- ----------------------------------------------------------------------
-- 1. The rule
--
--    `code` is stored exactly as it will be compared: upper-cased and
--    trimmed. The CHECK enforces that rather than trusting every writer to
--    remember, so `summer24`, ` SUMMER24 ` and `SUMMER24` cannot become three
--    rows that a shopper experiences as one broken coupon.
--
--    The shape is deliberately narrow — letters, digits, dash, underscore.
--    A code is read down a phone and typed off a printed card, and every
--    character outside that set is a support email.
--
--    Both limits are nullable, and null means unlimited on purpose rather
--    than by accident: a house code with no cap is the common case, and
--    spelling it as a very large number would put a real edge into the data
--    that nobody meant to put there.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_codes (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code               TEXT NOT NULL UNIQUE
                         CHECK (code = upper(btrim(code))
                                AND code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
    -- Mirrors DISCOUNT_KINDS in lib/discounts/lifecycle.ts. Changing this list
    -- means changing that module too.
    kind               TEXT NOT NULL CHECK (kind IN ('percent', 'fixed')),
    value              NUMERIC(10, 2) NOT NULL CHECK (value > 0),
    -- What the bag must be worth before the code applies at all. Zero — the
    -- default — means "any order".
    min_subtotal       NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (min_subtotal >= 0),
    -- Null: unlimited.
    max_uses           INTEGER CHECK (max_uses IS NULL OR max_uses > 0),
    per_customer_limit INTEGER CHECK (per_customer_limit IS NULL OR per_customer_limit > 0),
    starts_at          TIMESTAMPTZ,
    expires_at         TIMESTAMPTZ,
    -- The off switch. Separate from the dates because "stop this now" and
    -- "this was always meant to end on Sunday" are different decisions, and
    -- flattening them loses the schedule the moment somebody pauses a code.
    is_active          BOOLEAN NOT NULL DEFAULT TRUE,
    -- What the code was for, in the admin's own words. Never shown to a
    -- shopper — it is the note that explains the row a year later.
    description        TEXT CHECK (description IS NULL OR length(description) <= 200),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    -- 120% off is not a discount, it is a refund with extra steps.
    CONSTRAINT discount_codes_percent_range
        CHECK (kind <> 'percent' OR value <= 100),
    -- A window that closes before it opens is a code nobody can ever use.
    CONSTRAINT discount_codes_window
        CHECK (starts_at IS NULL OR expires_at IS NULL OR expires_at > starts_at)
);

-- The panel lists newest first, unfiltered.
CREATE INDEX IF NOT EXISTS idx_discount_codes_created_at
    ON public.discount_codes (created_at DESC);


-- ----------------------------------------------------------------------
-- 2. The ledger
--
--    UNIQUE on `order_id`, which is what makes "one code per order" a fact
--    about the database rather than a promise made by the checkout route. It
--    is also the concurrency backstop: two requests racing to spend a code on
--    the same order cannot both win, whatever else goes wrong upstream.
--
--    `code`, `subtotal` and `amount` are snapshots, not lookups. The rule can
--    be edited or deleted afterwards, and a redemption has to keep saying what
--    it actually was — an accounts question gets asked about last March, not
--    about how the coupon reads today.
--
--    ON DELETE CASCADE from `orders` is the deliberate half of that: deleting
--    an order — which order_lifecycle.sql lets an admin do to a rejected one —
--    gives the use back. It never happened, so it should not be counted, and a
--    cap that quietly ate a use every time an admin cleaned up a duplicate
--    would be a coupon that runs out early for no reason anybody can see.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_redemptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    discount_id UUID NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
    order_id    UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
    -- Null for an order placed by an account that has since been removed. The
    -- redemption still happened, and still counts against the cap.
    user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    code        TEXT NOT NULL,
    subtotal    NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    amount      NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- "How many times has this code been spent" — the cap check on every checkout,
-- and every number on the usage screens. Leading with discount_id lets one
-- index serve the count, the window and `last used` alike.
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_discount_created
    ON public.discount_redemptions (discount_id, created_at DESC);

-- ...and how many times by this person, which is the per-customer limit.
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_discount_user
    ON public.discount_redemptions (discount_id, user_id);

-- The dashboard's window, which spans every code at once.
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_created_at
    ON public.discount_redemptions (created_at DESC);


-- ----------------------------------------------------------------------
-- 3. What the order itself remembers
--
--    Denormalised on purpose. /admin/orders/[id] derives delivery as
--    `total_amount - sum(line totals)`, and without the reduction on the row
--    that arithmetic silently starts reporting a negative delivery charge on
--    every discounted order. These two columns are what keep an order legible
--    on its own.
--
--    NOT NULL DEFAULT 0 on the amount rather than nullable: every order has a
--    discount, and on almost all of them it is nothing. Nothing is 0, not
--    unknown.
-- ----------------------------------------------------------------------
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS discount_code TEXT;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0;

-- `ADD CONSTRAINT` has no IF NOT EXISTS, so re-running the file would fail on
-- the second pass without this.
DO $orders_discount_check$
BEGIN
    ALTER TABLE public.orders
        ADD CONSTRAINT orders_discount_amount_check CHECK (discount_amount >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END;
$orders_discount_check$;


-- ----------------------------------------------------------------------
-- 4. Row Level Security
--
--    Admins only, on both tables, and no policy for `anon` or for a signed-in
--    customer anywhere in this file.
--
--    The SELECT policy on `discount_codes` that is *not* here is the one worth
--    spelling out. It reads like a harmless convenience — let the client check
--    the code itself — and what it actually means is that anyone who can reach
--    PostgREST with any session can list every live coupon in the store, cap
--    and all. The public side gets `preview_discount()` instead, which answers
--    about one code the caller already knew and never enumerates.
--
--    `discount_redemptions` has no INSERT policy at all, for admins either. A
--    redemption is not something anybody types; it is what spending a code
--    leaves behind, and the only thing entitled to write one is section 5.3.
-- ----------------------------------------------------------------------
ALTER TABLE public.discount_codes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_redemptions ENABLE ROW LEVEL SECURITY;

-- 4.1 Codes: the panel writes these ---------------------------------------
DROP POLICY IF EXISTS "Admins read discount codes" ON public.discount_codes;
CREATE POLICY "Admins read discount codes"
ON public.discount_codes FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins insert discount codes" ON public.discount_codes;
CREATE POLICY "Admins insert discount codes"
ON public.discount_codes FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins update discount codes" ON public.discount_codes;
CREATE POLICY "Admins update discount codes"
ON public.discount_codes FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete discount codes" ON public.discount_codes;
CREATE POLICY "Admins delete discount codes"
ON public.discount_codes FOR DELETE TO authenticated USING (public.is_admin());

-- 4.2 Redemptions: read, and at most undo ---------------------------------
DROP POLICY IF EXISTS "Admins read redemptions" ON public.discount_redemptions;
CREATE POLICY "Admins read redemptions"
ON public.discount_redemptions FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins delete redemptions" ON public.discount_redemptions;
CREATE POLICY "Admins delete redemptions"
ON public.discount_redemptions FOR DELETE TO authenticated USING (public.is_admin());


-- ----------------------------------------------------------------------
-- 5. The public side
-- ----------------------------------------------------------------------

-- 5.1 What a code is worth ------------------------------------------------
--
--     One rounding rule, in one place, called by both the preview and the
--     redemption, so a shopper is never quoted a figure that checkout then
--     disagrees with by a rupee.
--
--     Mirrors `calcDiscountAmount()` in lib/discounts/lifecycle.ts, which is
--     what the cart drawer recomputes with as the bag changes. Both round to
--     whole units because `formatPrice()` displays whole units — a discount
--     carrying invisible paisa is a total that does not add up on screen.
--
--     Clamped to the subtotal: a PKR 1,000 code against a PKR 400 bag takes
--     off 400, not 1,000. Delivery is never discounted, which is why the clamp
--     is against the subtotal and not the total.
CREATE OR REPLACE FUNCTION public.discount_amount_for(
    p_kind     TEXT,
    p_value    NUMERIC,
    p_subtotal NUMERIC
)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $discount_amount_for$
    SELECT least(
        greatest(coalesce(p_subtotal, 0), 0),
        CASE
            WHEN p_kind = 'percent'
                THEN round(greatest(coalesce(p_subtotal, 0), 0) * p_value / 100)
            ELSE round(p_value)
        END
    );
$discount_amount_for$;

REVOKE ALL ON FUNCTION public.discount_amount_for(TEXT, NUMERIC, NUMERIC) FROM public;
GRANT EXECUTE ON FUNCTION public.discount_amount_for(TEXT, NUMERIC, NUMERIC) TO anon, authenticated;


-- 5.2 "Is this code any good to me?" --------------------------------------
--
--     Answers about *one* code the caller already knew, which is the whole
--     reason it exists instead of a SELECT policy.
--
--     Every outcome is a value, not an exception. A mistyped code, a code that
--     ran out, a bag that is PKR 200 short of the minimum — none of those is a
--     fault. They are the ordinary things that happen at a checkout, each one
--     has something specific and useful to say back, and returning them as
--     values keeps the route handler mapping a string instead of pattern
--     matching on SQLSTATE. Mirrors DISCOUNT_OUTCOMES in
--     lib/discounts/lifecycle.ts.
--
--     Granted to `anon` as well as `authenticated` so a code can be tried
--     before signing in — placing the order still needs an account. The
--     per-customer limit is simply not checked when there is no session to
--     check it against; redeem_discount() applies it for real, which is the
--     only place it can be enforced anyway.
--
--     `min_subtotal` comes back on the below_minimum answer so the drawer can
--     say how much more is needed rather than just refusing.
/* DROP first, here and below: CREATE OR REPLACE cannot change a return type,
   so without it an edit to either signature turns a re-run into an error. */
DROP FUNCTION IF EXISTS public.preview_discount(TEXT, NUMERIC);

CREATE FUNCTION public.preview_discount(
    p_code     TEXT,
    p_subtotal NUMERIC
)
RETURNS TABLE (
    outcome      TEXT,
    code         TEXT,
    kind         TEXT,
    value        NUMERIC,
    min_subtotal NUMERIC,
    amount       NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $preview_discount$
DECLARE
    v_code     TEXT := upper(btrim(coalesce(p_code, '')));
    v_subtotal NUMERIC := greatest(coalesce(p_subtotal, 0), 0);
    v_uid      UUID := auth.uid();
    v_rule     public.discount_codes%ROWTYPE;
    v_uses     BIGINT;
BEGIN
    SELECT * INTO v_rule FROM public.discount_codes d WHERE d.code = v_code;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'not_found'::TEXT, NULL::TEXT, NULL::TEXT,
                            NULL::NUMERIC, NULL::NUMERIC, 0::NUMERIC;
        RETURN;
    END IF;

    /* Everything below returns the rule alongside the verdict. The caller has
       already proved it knows the code, and the details are what let the
       storefront say something more useful than "no". */
    IF NOT v_rule.is_active THEN
        RETURN QUERY SELECT 'inactive'::TEXT, v_rule.code, v_rule.kind,
                            v_rule.value, v_rule.min_subtotal, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_rule.starts_at IS NOT NULL AND v_rule.starts_at > now() THEN
        RETURN QUERY SELECT 'not_started'::TEXT, v_rule.code, v_rule.kind,
                            v_rule.value, v_rule.min_subtotal, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_rule.expires_at IS NOT NULL AND v_rule.expires_at <= now() THEN
        RETURN QUERY SELECT 'expired'::TEXT, v_rule.code, v_rule.kind,
                            v_rule.value, v_rule.min_subtotal, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_rule.max_uses IS NOT NULL THEN
        SELECT count(*) INTO v_uses
          FROM public.discount_redemptions r
         WHERE r.discount_id = v_rule.id;

        IF v_uses >= v_rule.max_uses THEN
            RETURN QUERY SELECT 'exhausted'::TEXT, v_rule.code, v_rule.kind,
                                v_rule.value, v_rule.min_subtotal, 0::NUMERIC;
            RETURN;
        END IF;
    END IF;

    /* Skipped for a signed-out browser: there is no identity to count against
       yet. Enforced for real in redeem_discount(). */
    IF v_uid IS NOT NULL AND v_rule.per_customer_limit IS NOT NULL THEN
        SELECT count(*) INTO v_uses
          FROM public.discount_redemptions r
         WHERE r.discount_id = v_rule.id AND r.user_id = v_uid;

        IF v_uses >= v_rule.per_customer_limit THEN
            RETURN QUERY SELECT 'already_used'::TEXT, v_rule.code, v_rule.kind,
                                v_rule.value, v_rule.min_subtotal, 0::NUMERIC;
            RETURN;
        END IF;
    END IF;

    IF v_subtotal < v_rule.min_subtotal THEN
        RETURN QUERY SELECT 'below_minimum'::TEXT, v_rule.code, v_rule.kind,
                            v_rule.value, v_rule.min_subtotal, 0::NUMERIC;
        RETURN;
    END IF;

    RETURN QUERY SELECT 'ok'::TEXT, v_rule.code, v_rule.kind, v_rule.value,
                        v_rule.min_subtotal,
                        public.discount_amount_for(v_rule.kind, v_rule.value, v_subtotal);
END;
$preview_discount$;

REVOKE ALL ON FUNCTION public.preview_discount(TEXT, NUMERIC) FROM public;
GRANT EXECUTE ON FUNCTION public.preview_discount(TEXT, NUMERIC) TO anon, authenticated;


-- 5.3 Spending it ---------------------------------------------------------
--
--     The same checks as the preview, run again against a *locked* rule row,
--     because everything the preview said was true a few seconds ago and a cap
--     is exactly the kind of fact that stops being true while somebody is
--     filling in their address.
--
--     `FOR UPDATE` on the code row is what serialises the last use of a
--     limited coupon. Two checkouts arriving together both read "9 of 10
--     spent" without it, and both write the tenth. With it the second waits,
--     counts 10, and is told the code is exhausted — which is the truth, and
--     which it can still act on because nothing has been confirmed to the
--     shopper yet.
--
--     The order must already exist and must belong to the caller. That is not
--     ceremony: this runs as the definer, so without the ownership check it
--     would be an endpoint for attaching your coupon to somebody else's order.
DROP FUNCTION IF EXISTS public.redeem_discount(TEXT, UUID, NUMERIC);

CREATE FUNCTION public.redeem_discount(
    p_code     TEXT,
    p_order_id UUID,
    p_subtotal NUMERIC
)
RETURNS TABLE (outcome TEXT, amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $redeem_discount$
DECLARE
    v_code     TEXT := upper(btrim(coalesce(p_code, '')));
    v_subtotal NUMERIC := greatest(coalesce(p_subtotal, 0), 0);
    v_uid      UUID := auth.uid();
    v_owner    UUID;
    v_rule     public.discount_codes%ROWTYPE;
    v_uses     BIGINT;
    v_amount   NUMERIC;
BEGIN
    IF v_uid IS NULL THEN
        RETURN QUERY SELECT 'unauthorized'::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    SELECT o.user_id INTO v_owner FROM public.orders o WHERE o.id = p_order_id;

    IF NOT FOUND OR v_owner IS DISTINCT FROM v_uid THEN
        RETURN QUERY SELECT 'forbidden'::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    SELECT * INTO v_rule
      FROM public.discount_codes d
     WHERE d.code = v_code
       FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT 'not_found'::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF NOT v_rule.is_active THEN
        RETURN QUERY SELECT 'inactive'::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_rule.starts_at IS NOT NULL AND v_rule.starts_at > now() THEN
        RETURN QUERY SELECT 'not_started'::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_rule.expires_at IS NOT NULL AND v_rule.expires_at <= now() THEN
        RETURN QUERY SELECT 'expired'::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    IF v_rule.max_uses IS NOT NULL THEN
        SELECT count(*) INTO v_uses
          FROM public.discount_redemptions r
         WHERE r.discount_id = v_rule.id;

        IF v_uses >= v_rule.max_uses THEN
            RETURN QUERY SELECT 'exhausted'::TEXT, 0::NUMERIC;
            RETURN;
        END IF;
    END IF;

    IF v_rule.per_customer_limit IS NOT NULL THEN
        SELECT count(*) INTO v_uses
          FROM public.discount_redemptions r
         WHERE r.discount_id = v_rule.id AND r.user_id = v_uid;

        IF v_uses >= v_rule.per_customer_limit THEN
            RETURN QUERY SELECT 'already_used'::TEXT, 0::NUMERIC;
            RETURN;
        END IF;
    END IF;

    IF v_subtotal < v_rule.min_subtotal THEN
        RETURN QUERY SELECT 'below_minimum'::TEXT, 0::NUMERIC;
        RETURN;
    END IF;

    v_amount := public.discount_amount_for(v_rule.kind, v_rule.value, v_subtotal);

    BEGIN
        INSERT INTO public.discount_redemptions
            (discount_id, order_id, user_id, code, subtotal, amount)
        VALUES
            (v_rule.id, p_order_id, v_uid, v_rule.code, v_subtotal, v_amount);
    EXCEPTION
        /* The UNIQUE on order_id. A retried checkout, or two requests for one
           order — either way this order already has its code, and the caller
           should not be told the coupon failed. */
        WHEN unique_violation THEN
            RETURN QUERY SELECT 'already_redeemed'::TEXT, v_amount;
            RETURN;
    END;

    RETURN QUERY SELECT 'ok'::TEXT, v_amount;
END;
$redeem_discount$;

REVOKE ALL ON FUNCTION public.redeem_discount(TEXT, UUID, NUMERIC) FROM public;
GRANT EXECUTE ON FUNCTION public.redeem_discount(TEXT, UUID, NUMERIC) TO authenticated;


-- 5.4 Unwinding a checkout that failed after the order was written ---------
--
--     `/api/checkout` writes the order, then its lines, then spends the code.
--     Any of the last two can fail — the lines on a missing column, the code
--     on a cap that ran out in the half-second since it was previewed — and
--     the route's answer has always been to delete the order it had just
--     created and report the failure.
--
--     Except that it could not. There is no DELETE policy on `orders` for a
--     customer (order_lifecycle.sql gives one to admins only, deliberately),
--     and RLS filters rather than raises — so the cleanup matched no rows and
--     PostgREST reported success at having done nothing. Every failed checkout
--     left an order behind: no lines, or a discounted total with no redemption
--     against it. This is the missing half, and it is why the refusal path in
--     the checkout route can now honestly say it rolls back.
--
--     Three guards, and they are what keep this from being the thing
--     order_lifecycle.sql refused to build. It is not "let a customer delete
--     an order":
--
--       * it must be *their* order,
--       * it must have been placed in the last five minutes — this is for
--         unwinding the request that is still in flight, not for editing
--         history,
--       * and it must have no redemption attached, so a checkout that did
--         succeed in spending a code can never be erased from under the ledger
--         that counts it.
--
--     What that leaves a determined caller is the ability to abandon an order
--     they placed moments ago and that nobody has looked at yet, which is what
--     the failed checkout it exists for amounts to anyway.
--
--     `order_items` is ON DELETE CASCADE, and a cascade runs as the system
--     rather than as the caller, so the lines go with the order.
DROP FUNCTION IF EXISTS public.discard_failed_order(UUID);

CREATE FUNCTION public.discard_failed_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $discard_failed_order$
DECLARE
    v_uid     UUID := auth.uid();
    v_deleted INTEGER;
BEGIN
    IF v_uid IS NULL THEN
        RETURN FALSE;
    END IF;

    DELETE FROM public.orders o
     WHERE o.id = p_order_id
       AND o.user_id = v_uid
       AND o.created_at >= now() - interval '5 minutes'
       AND NOT EXISTS (
             SELECT 1 FROM public.discount_redemptions r WHERE r.order_id = o.id
           );

    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RETURN v_deleted > 0;
END;
$discard_failed_order$;

REVOKE ALL ON FUNCTION public.discard_failed_order(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.discard_failed_order(UUID) TO authenticated;


-- ----------------------------------------------------------------------
-- 6. Usage, for the panel and the dashboard
--
--    One function for both screens, because they are asking the same question
--    over different windows. `p_days` null means all time, which is what
--    /admin/discounts lists; the dashboard passes the window its range tabs
--    select, the same way admin_revenue_series does.
--
--    Every code comes back, including the ones nobody has used — a code with
--    no redemptions is often the most interesting row on the screen, and the
--    LEFT JOIN is what stops it disappearing from its own list. The window
--    predicate sits in that JOIN rather than in a WHERE for the same reason:
--    in a WHERE it would quietly turn the outer join back into an inner one.
--
--    `order_total` is what those discounted orders came to in total, which is
--    the number that says whether a coupon paid for itself.
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_discount_usage(INTEGER);

CREATE FUNCTION public.admin_discount_usage(p_days INTEGER DEFAULT NULL)
RETURNS TABLE (
    id           UUID,
    code         TEXT,
    kind         TEXT,
    value        NUMERIC,
    is_active    BOOLEAN,
    min_subtotal NUMERIC,
    max_uses     INTEGER,
    starts_at    TIMESTAMPTZ,
    expires_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ,
    uses         BIGINT,
    customers    BIGINT,
    discounted   NUMERIC,
    order_total  NUMERIC,
    last_used_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $admin_discount_usage$
    SELECT
        d.id,
        d.code,
        d.kind,
        d.value,
        d.is_active,
        d.min_subtotal,
        d.max_uses,
        d.starts_at,
        d.expires_at,
        d.created_at,
        count(r.id),
        count(DISTINCT r.user_id),
        coalesce(sum(r.amount), 0),
        coalesce(sum(o.total_amount), 0),
        max(r.created_at)
      FROM public.discount_codes d
      LEFT JOIN public.discount_redemptions r
             ON r.discount_id = d.id
            AND (p_days IS NULL
                 OR r.created_at >= now() - make_interval(days => p_days))
      LEFT JOIN public.orders o
             ON o.id = r.order_id
     WHERE public.is_admin()
     GROUP BY d.id
     ORDER BY count(r.id) DESC, d.created_at DESC;
$admin_discount_usage$;

REVOKE ALL ON FUNCTION public.admin_discount_usage(INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_discount_usage(INTEGER) TO authenticated;


-- ----------------------------------------------------------------------
-- 7. PostgREST caches the schema, including the two new order columns.
-- ----------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ----------------------------------------------------------------------
-- Verify — the tables, the order columns, the functions and the policies.
-- ----------------------------------------------------------------------
SELECT 'discount_codes table' AS check_name, count(*)::text AS result
  FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name = 'discount_codes'
UNION ALL
SELECT 'discount_redemptions table', count(*)::text
  FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name = 'discount_redemptions'
UNION ALL
SELECT 'orders discount columns', count(*)::text
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'orders'
   AND column_name IN ('discount_code', 'discount_amount')
UNION ALL
SELECT 'functions', count(*)::text
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('discount_amount_for', 'preview_discount',
                     'redeem_discount', 'discard_failed_order',
                     'admin_discount_usage')
UNION ALL
SELECT 'policies', count(*)::text
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('discount_codes', 'discount_redemptions');
