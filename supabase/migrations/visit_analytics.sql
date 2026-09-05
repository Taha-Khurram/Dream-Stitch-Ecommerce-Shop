-- ============================================================================
-- DREAM STITCH By Sk — visit history
--
-- "How many people came to the store today, this week, this month."
--
-- presence_schema.sql already knows who is on the site *right now*, but it is
-- built to forget: `live_sessions` holds one row per open browser, is upserted
-- on every ping, and prunes itself after an hour. Nothing in it survives the
-- visit, which is the correct design for a presence tile and useless for a
-- footfall figure — by the time an admin opens /admin/analytics, yesterday is
-- already gone.
--
-- This file adds the one thing that has to persist for that question to be
-- answerable: a row per visitor per day. Nothing else. No page paths, no
-- referrer, no IP, no user agent, and no identifier that outlives the browser
-- — `visitor_id` is still the session cookie minted in /api/presence, so two
-- visits either side of a browser restart are two different visitors as far
-- as this table is concerned.
--
-- That is worth being plain about, because it is the one way these figures
-- are systematically wrong: returning visitors mostly are not recognised as
-- returning, so the multi-day counts lean generous. It is the trade this
-- store is happy with — a footfall number, not a tracking profile — and the
-- fix would be a year-long cookie, which is a different feature with
-- different obligations.
--
--   * visit_days        — the table. One row = one visitor, one day.
--   * record_visit      — what the storefront beacon calls, beside
--                         record_presence.
--   * admin_visit_stats — today / last 7 days / last 30 days, each with the
--                         equal-length window before it so the tiles can carry
--                         a delta the same way the dashboard's do.
--
-- Run AFTER admin_schema.sql (it depends on `is_admin()`). presence_schema.sql
-- is not a hard dependency — the two are written independently and the beacon
-- records whichever of them is installed — but they are meant to be run
-- together, since the same ping feeds both.
-- Safe to re-run: every statement is idempotent.
--
-- Nothing here is required for the app to work. The Visitors panel on
-- /admin/analytics says plainly that the file has not been run, and the
-- storefront beacon carries on feeding presence — the same fallback contract
-- every optional migration in this directory keeps.
-- ============================================================================


-- ----------------------------------------------------------------------
-- 1. The table
--
--    One row per visitor per UTC day, and the primary key is what enforces
--    that: the beacon pings every thirty seconds for as long as a tab is
--    open, and every ping after the first of the day lands on the row that is
--    already there. So this grows with *footfall*, not with traffic — a
--    visitor who reads the whole catalogue for an hour is one row, the same
--    as one who bounces off the homepage.
--
--    Dated in UTC, because every other figure on /admin/analytics is (see
--    analytics_schema.sql) and a visits panel that rolled over at a different
--    midnight from the revenue beside it would quietly be comparing two
--    different Tuesdays.
--
--    `user_id` is null for a guest. It is what lets the panel say how many of
--    the day's visitors were signed in rather than just counting bodies.
--
--    No separate index on visit_date: the primary key is a btree on
--    (visit_date, visitor_id), so it already serves every range scan below —
--    all of which filter on the leading column.
--
--    Retention is forever, deliberately. A row is a few dozen bytes and the
--    history is the entire point of the table; if a store ever wants to cap
--    it, a scheduled `DELETE FROM public.visit_days WHERE visit_date < ...`
--    is the whole change and nothing above this line needs to know.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visit_days (
    visit_date    DATE        NOT NULL DEFAULT timezone('utc'::text, now())::date,
    visitor_id    UUID        NOT NULL,
    user_id       UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (visit_date, visitor_id)
);


-- ----------------------------------------------------------------------
-- 2. Row Level Security
--
--    Enabled with NO policies, exactly as live_sessions is: that denies the
--    table outright to `anon` and `authenticated`, and the two SECURITY
--    DEFINER functions below become the only way in, each gating itself.
--
--    An anon INSERT policy would be the easy alternative and would hand
--    anyone holding the publishable key the ability to invent a thousand
--    visitors an afternoon. Routing the write through a function does not
--    make the number audited — a determined caller can still POST
--    /rpc/record_visit with invented uuids — but it keeps the shape of the
--    row, and the date on it, out of the client's hands.
-- ----------------------------------------------------------------------
ALTER TABLE public.visit_days ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------
-- 3. "Somebody was here today"
--
--    Called by /api/presence on every beacon ping, alongside record_presence
--    and in the same round trip's worth of time — the route fires the two
--    together, so the visit costs no added latency.
--
--    Idempotent by construction, which is what makes it safe to call twice a
--    minute: the first ping of the day inserts, every later one moves
--    `last_seen_at` and nothing else. `first_seen_at` is therefore genuinely
--    the moment the visitor arrived.
--
--    `user_id` is coalesced rather than overwritten, and that is the one
--    place this function deliberately disagrees with record_presence. That
--    one re-reads the JWT on every ping because it answers "who is here
--    now", and a visitor who signs out has to stop being counted as signed
--    in. This one answers "who came today", and somebody who signed in at
--    eleven and out at noon did visit as a customer — letting the sign-out
--    blank the column would reclassify the whole day's visit as a guest's.
-- ----------------------------------------------------------------------
/* DROP first, here and below: CREATE OR REPLACE cannot change a function's
   return type, so without it an edit to either signature turns a re-run of
   this file into an error. The same trap dashboard_schema.sql calls out. */
DROP FUNCTION IF EXISTS public.record_visit(UUID);

CREATE FUNCTION public.record_visit(p_visitor UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $record_visit$
BEGIN
    IF p_visitor IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.visit_days (visit_date, visitor_id, user_id)
    VALUES (timezone('utc'::text, now())::date, p_visitor, (SELECT auth.uid()))
    ON CONFLICT (visit_date, visitor_id) DO UPDATE
        SET last_seen_at = now(),
            user_id      = coalesce((SELECT auth.uid()), visit_days.user_id);
END;
$record_visit$;

REVOKE ALL ON FUNCTION public.record_visit(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.record_visit(UUID) TO anon, authenticated;


-- ----------------------------------------------------------------------
-- 4. Today, the week, the month
--
--    Three rows, one per window, each carrying the equal-length window before
--    it. Rows rather than one wide row because the three are the same
--    question asked at three lengths, and the panel renders them with one
--    component — a function returning `visitors_7`, `visitors_30` … would
--    push that repetition into the TypeScript instead of removing it.
--
--    Two counts per window, because they answer two different questions and
--    the difference between them is the whole story of a returning visitor:
--
--      * `visitors` — DISTINCT visitor ids. A browser that came Monday,
--        Wednesday and Friday is one visitor in the week.
--      * `visits`   — rows, i.e. visitor-days. That same browser is three.
--
--    The daily window holds one day, so its two figures are always equal.
--    That is not redundancy, it is the definitions agreeing: 100 people today
--    is 100 visitors and 100 visits, and that same hundred coming back every
--    day is still 100 visitors for the week but 700 visits. Both are on the
--    tile so neither reading can be mistaken for the other.
--
--    The window arithmetic is the one every other figure on /admin/analytics
--    uses — `p_days` days ending today, in UTC — written as plain date
--    subtraction rather than `- (n - 1) * interval '1 day'` because
--    `visit_date` is already a DATE. Identical boundaries, less ceremony.
--
--    `WHERE public.is_admin()` gates the whole thing, so a non-admin gets
--    zero rows rather than zeroed rows and the caller can tell "not allowed"
--    apart from "nobody came".
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_visit_stats();

CREATE FUNCTION public.admin_visit_stats()
RETURNS TABLE (
    bucket         TEXT,
    days           INTEGER,
    visitors       BIGINT,
    visits         BIGINT,
    signed_in      BIGINT,
    prior_visitors BIGINT,
    prior_visits   BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $admin_visit_stats$
    WITH win AS (
        SELECT s.bucket,
               s.days,
               timezone('utc'::text, now())::date - (s.days - 1)     AS opened,
               timezone('utc'::text, now())::date - (s.days * 2 - 1) AS prior
          FROM (VALUES ('day'::text, 1), ('week', 7), ('month', 30)) AS s(bucket, days)
    )
    SELECT w.bucket,
           w.days,
           (SELECT count(DISTINCT v.visitor_id) FROM public.visit_days v
             WHERE v.visit_date >= w.opened),
           (SELECT count(*) FROM public.visit_days v
             WHERE v.visit_date >= w.opened),
           (SELECT count(DISTINCT v.visitor_id) FROM public.visit_days v
             WHERE v.visit_date >= w.opened
               AND v.user_id IS NOT NULL),
           (SELECT count(DISTINCT v.visitor_id) FROM public.visit_days v
             WHERE v.visit_date >= w.prior
               AND v.visit_date <  w.opened),
           (SELECT count(*) FROM public.visit_days v
             WHERE v.visit_date >= w.prior
               AND v.visit_date <  w.opened)
      FROM win w
     WHERE public.is_admin()
     ORDER BY w.days;
$admin_visit_stats$;

REVOKE ALL ON FUNCTION public.admin_visit_stats() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_visit_stats() TO authenticated;


-- ----------------------------------------------------------------------
-- 5. PostgREST caches the catalogue of callable functions. Without this it
--    keeps answering PGRST202 for both of them until the pooler restarts.
-- ----------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ----------------------------------------------------------------------
-- Verify — the table is there, RLS is on, both functions are installed, and
-- then what the panel will show. Run as an admin, or admin_visit_stats()
-- correctly returns nothing at all.
-- ----------------------------------------------------------------------
SELECT 'visit_days rows' AS check_name, count(*)::text AS result
  FROM public.visit_days
UNION ALL
SELECT 'visit_days RLS enabled', max(relrowsecurity::text)
  FROM pg_class
 WHERE relname = 'visit_days'
   AND relnamespace = 'public'::regnamespace
UNION ALL
SELECT 'visit functions', count(*)::text
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname IN ('record_visit', 'admin_visit_stats');

SELECT * FROM public.admin_visit_stats();
