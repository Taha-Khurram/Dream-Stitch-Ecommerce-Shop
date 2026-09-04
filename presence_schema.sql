-- ============================================================================
-- DREAM STITCH By Sk — live visitor presence
--
-- "How many people are on the store right now", for the admin dashboard.
--
-- One table and two functions. The table is deliberately tiny and short
-- lived: one row per open browser session, holding a random id, an optional
-- link to the auth account, and the last time that session said hello. There
-- is no page history, no IP, no user agent, and nothing that outlives the
-- visit — a presence feature does not need any of it.
--
-- Run AFTER admin_schema.sql (it depends on `is_admin()`).
-- Safe to re-run: every statement is idempotent.
--
-- Nothing here is required for the app to work. The dashboard tile reports
-- that presence is not installed and the beacon stops pinging — same
-- fallback contract as lib/api/settings.ts.
-- ============================================================================


-- ----------------------------------------------------------------------
-- 1. The table
--
--    `visitor_id` is a random uuid minted server-side and handed to the
--    browser in a session cookie, so it dies when the browser does. It is a
--    primary key, which is what makes one person one row however many times
--    they ping — the beacon upserts rather than appends, so this table never
--    grows with time, only with concurrent visitors.
--
--    `user_id` is null for a guest. It is what lets the dashboard say "two
--    of these five are signed in" rather than just counting bodies.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_sessions (
    visitor_id   UUID PRIMARY KEY,
    user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Both things anyone ever asks this table — who is live, and what is stale
-- enough to delete — are ranges over last_seen_at.
CREATE INDEX IF NOT EXISTS idx_live_sessions_last_seen
    ON public.live_sessions (last_seen_at DESC);


-- ----------------------------------------------------------------------
-- 2. Row Level Security
--
--    RLS is enabled with NO policies, which denies everything to `anon` and
--    `authenticated`. That is the intent, not an oversight: nobody reaches
--    this table directly. The two SECURITY DEFINER functions below are the
--    only way in, and each one gates itself.
--
--    The alternative — an anon INSERT policy so the browser could write its
--    own row — would let anyone hand-craft PostgREST calls and invent as
--    many live visitors as they liked. Routing writes through a function at
--    least keeps the shape of the row out of the client's hands.
-- ----------------------------------------------------------------------
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;


-- ----------------------------------------------------------------------
-- 3. "I am here"
--
--    Called once every PRESENCE_PING_INTERVAL by every open storefront tab,
--    through /api/presence — never from the browser directly, so the visitor
--    id comes from an httpOnly cookie the page's own JavaScript cannot read.
--
--    `user_id` is re-read from the JWT on every ping rather than only on
--    insert: the same tab can sign in or out without the cookie changing,
--    and the count would otherwise keep reporting the stale answer.
-- ----------------------------------------------------------------------
/* DROP first, here and below. CREATE OR REPLACE cannot change a function's
   return type, so without this an edit to either signature turns a re-run of
   this file into an error — the same trap dashboard_schema.sql calls out. */
DROP FUNCTION IF EXISTS public.record_presence(UUID);

CREATE FUNCTION public.record_presence(p_visitor UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $record_presence$
BEGIN
    IF p_visitor IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.live_sessions (visitor_id, user_id, last_seen_at)
    VALUES (p_visitor, (SELECT auth.uid()), now())
    ON CONFLICT (visitor_id) DO UPDATE
        SET last_seen_at = now(),
            user_id      = (SELECT auth.uid());
END;
$record_presence$;

REVOKE ALL ON FUNCTION public.record_presence(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.record_presence(UUID) TO anon, authenticated;


-- ----------------------------------------------------------------------
-- 4. "How many are here"
--
--    Admin only, and it prunes as it counts.
--
--    The prune lives here rather than in a scheduled job because this is the
--    one query that runs on a timer anyway — the dashboard polls it while an
--    admin is watching, which is exactly when a few dead rows are free to
--    clear. Retention is far longer than the live window so the DELETE is
--    almost always a no-op against the index.
--
--    If you would rather not depend on someone opening the dashboard, this
--    is a one-line pg_cron job; see the README.
--
--    plpgsql rather than sql, because a bare `WHERE public.is_admin()` would
--    gate the SELECT and leave the DELETE running for anyone.
-- ----------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_live_visitors(INTEGER);

CREATE FUNCTION public.admin_live_visitors(p_window_seconds INTEGER DEFAULT 90)
RETURNS TABLE (
    total     BIGINT,
    signed_in BIGINT,
    guests    BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $admin_live_visitors$
DECLARE
    /* Clamped, so a caller cannot turn "right now" into "this week". */
    v_window INTERVAL := make_interval(
        secs => greatest(15, least(3600, coalesce(p_window_seconds, 90)))
    );
BEGIN
    /* Zero rows for a non-admin, so the caller falls back exactly as it does
       for admin_dashboard_stats(). */
    IF NOT public.is_admin() THEN
        RETURN;
    END IF;

    DELETE FROM public.live_sessions
     WHERE last_seen_at < now() - INTERVAL '1 hour';

    RETURN QUERY
    SELECT count(*),
           count(user_id),
           count(*) - count(user_id)
      FROM public.live_sessions
     WHERE last_seen_at > now() - v_window;
END;
$admin_live_visitors$;

REVOKE ALL ON FUNCTION public.admin_live_visitors(INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_live_visitors(INTEGER) TO authenticated;


-- ----------------------------------------------------------------------
-- 5. PostgREST caches the schema. Without this the API keeps returning
--    PGRST202 for the new functions until the pooler happens to restart.
-- ----------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ----------------------------------------------------------------------
-- Verify — three rows: the table is there, RLS is on, and both functions
-- are installed.
-- ----------------------------------------------------------------------
SELECT 'live_sessions rows' AS check_name, count(*)::text AS result
  FROM public.live_sessions
UNION ALL
SELECT 'live_sessions RLS enabled', max(relrowsecurity::text)
  FROM pg_class
 WHERE relname = 'live_sessions'
   AND relnamespace = 'public'::regnamespace
UNION ALL
SELECT 'presence functions', count(*)::text
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname IN ('record_presence', 'admin_live_visitors');
