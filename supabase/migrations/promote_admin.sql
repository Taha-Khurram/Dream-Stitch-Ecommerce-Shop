-- ============================================================================
-- DREAM STITCH By Sk — grant the store's admin account
--
-- Section 5 of `admin_schema.sql` documents this step but leaves it manual on
-- purpose: no signup path grants admin, so promotion happens in SQL only.
--
-- The auth user for dreamstitchbysk@gmail.com already exists — it was created
-- through the normal GoTrue signup endpoint, so its password is hashed by
-- GoTrue and its `auth.identities` row is in place. This file does the two
-- things signup deliberately cannot do:
--
--   1. confirms the address, so the account can sign in without waiting on
--      the confirmation email, and
--   2. flips its profile role to 'admin'.
--
-- Section C repairs two accounts that predate `admin_schema.sql` and never
-- got the profile row its backfill was supposed to give them. It grants
-- nobody admin.
--
-- Depends on: admin_schema.sql (profiles, the role CHECK, is_admin()).
-- Safe to re-run: every statement is idempotent.
-- ============================================================================


-- ----------------------------------------------------------------------
-- A. Confirm the address
--
--    `coalesce` leaves an already-confirmed timestamp untouched, so a second
--    run does not silently re-date the confirmation.
--
--    Skip this section if you would rather click the confirmation link that
--    signup already emailed to the address — it has the same effect.
-- ----------------------------------------------------------------------
UPDATE auth.users
   SET email_confirmed_at = coalesce(email_confirmed_at, now())
 WHERE email = 'dreamstitchbysk@gmail.com';


-- ----------------------------------------------------------------------
-- B. Promote to admin
--
--    This is the only thing that grants admin: `lib/auth/admin.ts` reads
--    `profiles.role`, and `is_admin()` backs every RLS write policy, so the
--    role here is what the whole admin panel keys off.
-- ----------------------------------------------------------------------
UPDATE public.profiles
   SET role      = 'admin',
       full_name = coalesce(full_name, 'Dream Stitch Admin'),
       updated_at = now()
 WHERE email = 'dreamstitchbysk@gmail.com';


-- ----------------------------------------------------------------------
-- C. Backfill the accounts admin_schema.sql missed
--
--    Both existing users have no `profiles` row at all, so the admin layout
--    and the storefront account pages read NULL for them. They land on the
--    'customer' default — this promotes nobody.
-- ----------------------------------------------------------------------
INSERT INTO public.profiles (id, email, full_name)
SELECT u.id,
       u.email,
       NULLIF(u.raw_user_meta_data ->> 'full_name', '')
  FROM auth.users u
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------
-- D. Confirm it took
--
--    Expect exactly one row: dreamstitchbysk@gmail.com / admin / t
-- ----------------------------------------------------------------------
SELECT p.email, p.role, u.email_confirmed_at IS NOT NULL AS confirmed
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
 WHERE p.role = 'admin';
