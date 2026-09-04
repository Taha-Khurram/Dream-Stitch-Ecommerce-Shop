-- ============================================================================
-- DREAM STITCH By Sk — the inbox: contact messages and newsletter subscribers
--
-- The two storefront forms that were, until now, decorative. The newsletter
-- field on the homepage and the "Send a message" form on /contact both had no
-- destination — one posted to `#`, the other flipped a React boolean and threw
-- the message away. This file is the destination.
--
-- Two tables, and — following presence_schema.sql — no anon policy on either.
-- RLS is on with admin-only policies, and the public writes go through two
-- SECURITY DEFINER functions instead. The reasoning is the same one presence
-- gives: an INSERT policy for `anon` hands the shape of the row to the client,
-- so anyone able to reach PostgREST could post a message that arrives already
-- marked `replied`, or a subscriber row backdated to last year. Routing the
-- write through a function means the caller supplies the four fields it is
-- entitled to supply and Postgres decides the rest.
--
-- The same functions are where the throttles live, for the same reason: a
-- public form with no rate limit is a public form that fills the admin's inbox
-- overnight. Neither raises — both answer with an outcome string, so the route
-- handler maps a value rather than parsing an error message.
--
-- Run AFTER admin_schema.sql (it depends on `is_admin()`).
-- Safe to re-run: every statement is idempotent.
--
-- One note on time. The `created_at` defaults follow the house style from
-- ecommerce_schema.sql, `timezone('utc'::text, now())`, but everything inside
-- the functions uses a bare `now()`. That is not an inconsistency to tidy up:
-- `timezone('utc', now())` yields a *timestamp*, and comparing one against a
-- TIMESTAMPTZ column drags the session's TimeZone into the answer. On Supabase
-- that setting is UTC and the two agree exactly; `now()` is what keeps the
-- throttle windows correct on a database where it is not.
--
-- Nothing here is required for the app to work. Both admin screens report that
-- the inbox is not installed and both public endpoints answer 501 — the same
-- fallback contract as lib/api/settings.ts and presence_schema.sql.
-- ============================================================================


-- ----------------------------------------------------------------------
-- 1. Contact messages
--
--    `user_id` is null for a visitor who wrote in signed out, which is most
--    of them. It is not the identity — `email` is, and it is what a reply
--    goes to. What the link buys is context the message body will not have:
--    this person has an account, so their order history is one click away.
--
--    The lengths are CHECK constraints as well as Zod rules in
--    lib/validations/inbox.ts, because the schema is the boundary that holds
--    when a caller skips the route handler entirely.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name       TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 100),
    email      TEXT NOT NULL CHECK (position('@' IN email) > 1 AND length(email) <= 254),
    subject    TEXT NOT NULL CHECK (length(btrim(subject)) BETWEEN 2 AND 150),
    message    TEXT NOT NULL CHECK (length(btrim(message)) BETWEEN 10 AND 4000),
    -- Mirrors MESSAGE_STATUSES in lib/inbox/lifecycle.ts. Changing this list
    -- means changing that module too.
    status     TEXT NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new', 'read', 'replied', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- The inbox reads newest first, unfiltered.
CREATE INDEX IF NOT EXISTS idx_contact_messages_created_at
    ON public.contact_messages (created_at DESC);

-- ...and filtered by status, which is what the tabs on /admin/contacts do.
-- Leading with `status` is what lets one index serve both the tab and its
-- ORDER BY; a bare created_at index cannot, same reasoning as
-- idx_orders_status_created.
CREATE INDEX IF NOT EXISTS idx_contact_messages_status_created
    ON public.contact_messages (status, created_at DESC);

-- Both throttles below are "what has this address sent recently", so neither
-- should ever read the table.
CREATE INDEX IF NOT EXISTS idx_contact_messages_email_created
    ON public.contact_messages (email, created_at DESC);


-- ----------------------------------------------------------------------
-- 2. Newsletter subscribers
--
--    Unsubscribing sets a status rather than deleting the row. Deleting it
--    would mean the next import, or the same person subscribing again out of
--    habit, silently resurrects an address that asked to be left alone —
--    a suppression list only works if it remembers.
--
--    `source` is a whitelist rather than free text because an anonymous caller
--    supplies it. Without the CHECK it is an unauthenticated write into a
--    column an admin later reads on screen.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Stored lower-cased and trimmed by subscribe_to_newsletter(), so this
    -- UNIQUE is on the address itself and not on how it happened to be typed.
    email           TEXT NOT NULL UNIQUE
                      CHECK (position('@' IN email) > 1 AND length(email) <= 254),
    status          TEXT NOT NULL DEFAULT 'subscribed'
                      CHECK (status IN ('subscribed', 'unsubscribed')),
    source          TEXT NOT NULL DEFAULT 'home'
                      CHECK (source IN ('home', 'footer', 'checkout', 'admin')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_created_at
    ON public.newsletter_subscribers (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status_created
    ON public.newsletter_subscribers (status, created_at DESC);


-- ----------------------------------------------------------------------
-- 3. Row Level Security
--
--    Admins only, on both tables, for every verb. There is deliberately no
--    policy for `anon` or for a signed-in customer: nobody reads this data
--    but the panel, and the public writes arrive through the two functions
--    in section 4, which run as the definer and so bypass these policies.
--
--    No INSERT policy at all, not even for admins — an admin does not type
--    other people's messages, and adding a subscriber by hand is a feature
--    nobody asked for. If it is ever wanted, it belongs in a function beside
--    the others rather than as a table-wide grant.
-- ----------------------------------------------------------------------
ALTER TABLE public.contact_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- 3.1 Contact messages ---------------------------------------------------
DROP POLICY IF EXISTS "Admins read contact messages" ON public.contact_messages;
CREATE POLICY "Admins read contact messages"
ON public.contact_messages FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins update contact messages" ON public.contact_messages;
CREATE POLICY "Admins update contact messages"
ON public.contact_messages FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete contact messages" ON public.contact_messages;
CREATE POLICY "Admins delete contact messages"
ON public.contact_messages FOR DELETE TO authenticated USING (public.is_admin());

-- 3.2 Newsletter subscribers ---------------------------------------------
DROP POLICY IF EXISTS "Admins read subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins read subscribers"
ON public.newsletter_subscribers FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins update subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins update subscribers"
ON public.newsletter_subscribers FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete subscribers" ON public.newsletter_subscribers;
CREATE POLICY "Admins delete subscribers"
ON public.newsletter_subscribers FOR DELETE TO authenticated USING (public.is_admin());


-- ----------------------------------------------------------------------
-- 4. The public writes
--
--    Both are called from route handlers — /api/contact and /api/newsletter —
--    and never from the browser directly, though nothing breaks if they are:
--    the definer's rights extend to inserting one well-formed row and no
--    further, and the throttles apply either way.
--
--    Neither raises an exception. A form submission has three ordinary
--    outcomes beyond "it worked" — the address is already on the list, this
--    is the same message twice, you are sending too fast — and none of them
--    is exceptional. Returning them as values keeps the route handler mapping
--    a string to a status code instead of pattern-matching on SQLSTATE.
-- ----------------------------------------------------------------------

-- 4.1 "Put me on the list" ------------------------------------------------
--
--     Answers 'subscribed' for a new address, 'resubscribed' for one coming
--     back off the suppression list, 'already_subscribed' when it is a no-op,
--     and 'invalid' for something that is not an address.
--
--     The distinction matters to the form: telling someone who signed up last
--     month that they have been added is a small lie, and telling them nothing
--     looks broken.
/* DROP first, here and below: CREATE OR REPLACE cannot change a return type,
   so without it an edit to either signature turns a re-run into an error. */
DROP FUNCTION IF EXISTS public.subscribe_to_newsletter(TEXT, TEXT);

CREATE FUNCTION public.subscribe_to_newsletter(
    p_email  TEXT,
    p_source TEXT DEFAULT 'home'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $subscribe_to_newsletter$
DECLARE
    v_email  TEXT := lower(btrim(coalesce(p_email, '')));
    /* Anything the whitelist does not recognise becomes 'home' rather than
       failing the CHECK — the visitor did nothing wrong, and where the form
       sat is not worth losing a subscriber over. */
    v_source TEXT := CASE
                        WHEN btrim(coalesce(p_source, '')) IN ('home', 'footer', 'checkout', 'admin')
                            THEN btrim(p_source)
                        ELSE 'home'
                     END;
    v_before TEXT;
BEGIN
    IF position('@' IN v_email) < 2 OR length(v_email) > 254 THEN
        RETURN 'invalid';
    END IF;

    SELECT s.status INTO v_before
      FROM public.newsletter_subscribers s
     WHERE s.email = v_email;

    IF v_before = 'subscribed' THEN
        RETURN 'already_subscribed';
    END IF;

    INSERT INTO public.newsletter_subscribers (email, source, status)
    VALUES (v_email, v_source, 'subscribed')
    ON CONFLICT (email) DO UPDATE
        SET status          = 'subscribed',
            unsubscribed_at = NULL,
            updated_at      = now();
    /* `source` is deliberately not updated on conflict: it records where
       someone first joined, which is a fact about the past. */

    RETURN CASE WHEN v_before IS NULL THEN 'subscribed' ELSE 'resubscribed' END;
END;
$subscribe_to_newsletter$;

REVOKE ALL ON FUNCTION public.subscribe_to_newsletter(TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.subscribe_to_newsletter(TEXT, TEXT) TO anon, authenticated;


-- 4.2 "Send a message" ----------------------------------------------------
--
--     Answers ('accepted', id) on the happy path, ('duplicate', the existing
--     id) for the same message from the same address inside five minutes, and
--     ('throttled', null) past the hourly cap.
--
--     The duplicate window is what makes the endpoint safe to retry. A slow
--     connection, an impatient second click on Send, a browser replaying the
--     POST — all of them arrive here as a byte-identical message, and none of
--     them should land in the inbox twice. Returning the original id rather
--     than an error means the form still shows its success panel, which is
--     what the person meant to happen.
DROP FUNCTION IF EXISTS public.submit_contact_message(TEXT, TEXT, TEXT, TEXT);

CREATE FUNCTION public.submit_contact_message(
    p_name    TEXT,
    p_email   TEXT,
    p_subject TEXT,
    p_message TEXT
)
RETURNS TABLE (outcome TEXT, message_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $submit_contact_message$
DECLARE
    /* One cap per address per hour. Generous for anyone with a real problem,
       and short of the volume that makes the inbox useless. */
    c_hourly_cap   CONSTANT INTEGER  := 5;
    c_repeat_window CONSTANT INTERVAL := INTERVAL '5 minutes';

    v_name    TEXT := btrim(coalesce(p_name, ''));
    v_email   TEXT := lower(btrim(coalesce(p_email, '')));
    v_subject TEXT := btrim(coalesce(p_subject, ''));
    v_body    TEXT := btrim(coalesce(p_message, ''));
    v_existing UUID;
    v_recent   INTEGER;
    v_new      UUID;
BEGIN
    /* The same bounds as the CHECK constraints. Checked here so a value out
       of range comes back as an outcome the form can render against the right
       field, rather than as a constraint violation the route has to decode. */
    IF position('@' IN v_email) < 2
       OR length(v_email) > 254
       OR length(v_name) NOT BETWEEN 2 AND 100
       OR length(v_subject) NOT BETWEEN 2 AND 150
       OR length(v_body) NOT BETWEEN 10 AND 4000
    THEN
        RETURN QUERY SELECT 'invalid'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    /* Serialize submissions from one address for the rest of this
       transaction, so the two checks below cannot be raced.
       Without it, a double-clicked Send button sends two requests that both
       read the table before either has written to it, both conclude there is
       no recent duplicate, and both insert — which is the exact case the
       duplicate window exists to prevent. Taken on a hash of the address, so
       it only ever blocks the same sender against themselves. */
    PERFORM pg_advisory_xact_lock(
        ('x' || substr(md5(v_email), 1, 16))::bit(64)::bigint
    );

    SELECT m.id INTO v_existing
      FROM public.contact_messages m
     WHERE m.email   = v_email
       AND m.subject = v_subject
       AND m.message = v_body
       AND m.created_at > now() - c_repeat_window
     ORDER BY m.created_at DESC
     LIMIT 1;

    IF v_existing IS NOT NULL THEN
        RETURN QUERY SELECT 'duplicate'::TEXT, v_existing;
        RETURN;
    END IF;

    SELECT count(*) INTO v_recent
      FROM public.contact_messages m
     WHERE m.email = v_email
       AND m.created_at > now() - INTERVAL '1 hour';

    IF v_recent >= c_hourly_cap THEN
        RETURN QUERY SELECT 'throttled'::TEXT, NULL::UUID;
        RETURN;
    END IF;

    INSERT INTO public.contact_messages (user_id, name, email, subject, message)
    VALUES ((SELECT auth.uid()), v_name, v_email, v_subject, v_body)
    RETURNING id INTO v_new;

    RETURN QUERY SELECT 'accepted'::TEXT, v_new;
END;
$submit_contact_message$;

REVOKE ALL ON FUNCTION public.submit_contact_message(TEXT, TEXT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_contact_message(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;


-- ----------------------------------------------------------------------
-- 5. PostgREST caches the schema. Without this the API keeps returning
--    PGRST202 for the new functions until the pooler happens to restart.
-- ----------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ----------------------------------------------------------------------
-- Verify — four rows: both tables are there with RLS on, and both functions
-- are installed.
-- ----------------------------------------------------------------------
SELECT 'contact_messages rows' AS check_name, count(*)::text AS result
  FROM public.contact_messages
UNION ALL
SELECT 'newsletter_subscribers rows', count(*)::text
  FROM public.newsletter_subscribers
UNION ALL
SELECT 'inbox RLS enabled', count(*)::text
  FROM pg_class
 WHERE relnamespace = 'public'::regnamespace
   AND relname IN ('contact_messages', 'newsletter_subscribers')
   AND relrowsecurity
UNION ALL
SELECT 'inbox functions', count(*)::text
  FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace
   AND proname IN ('subscribe_to_newsletter', 'submit_contact_message');
