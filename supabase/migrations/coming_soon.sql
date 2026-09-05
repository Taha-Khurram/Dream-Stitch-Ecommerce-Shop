-- ============================================================================
-- coming_soon.sql — the holding page the storefront shows before launch.
--
-- What this adds
-- --------------
-- Six columns on the single `store_settings` row. Together they are the whole
-- feature: a switch, an instant to count down to, and the copy that sits on
-- the page. Nothing here is per-visitor — the gate is a property of the store,
-- so one row is the right shape and there is no new table to police.
--
-- Why the launch instant is TIMESTAMPTZ
-- ------------------------------------
-- The admin types a local time and the browser posts the ISO instant it means
-- (see `components/admin/DateTimeField.tsx`). Storing that as TIMESTAMPTZ is
-- what lets the server open the gate on the same tick the visitor's countdown
-- reaches zero, whatever timezone either of them is sitting in. A naive
-- TIMESTAMP would have made "midnight" mean midnight in Karachi to the admin
-- and midnight in UTC to the server — five hours of the shop being shut.
--
-- Reading these needs no new policy: "Anyone reads store settings" in
-- `admin_schema.sql` already covers every column of the row, which is what
-- lets a signed-out visitor be told the shop is closed.
--
-- Depends on: admin_schema.sql (the table and its policies).
-- Idempotent — safe to re-run.
-- ============================================================================

ALTER TABLE public.store_settings
    -- Off by default: applying a migration must never take a live shop down.
    ADD COLUMN IF NOT EXISTS coming_soon_enabled   BOOLEAN NOT NULL DEFAULT FALSE,
    -- NULL means "no countdown" — the page holds until an admin flips the
    -- switch back off, which is the honest shape for "we are not ready and we
    -- are not promising a date".
    ADD COLUMN IF NOT EXISTS coming_soon_launch_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS coming_soon_heading   TEXT,
    ADD COLUMN IF NOT EXISTS coming_soon_message   TEXT,
    -- The line under the countdown — a stockist, a phone number, whatever the
    -- shop wants reachable while the doors are shut.
    ADD COLUMN IF NOT EXISTS coming_soon_note      TEXT,
    -- What the "we are open, come in" control says once the clock runs out.
    ADD COLUMN IF NOT EXISTS coming_soon_cta       TEXT;

-- Confirm it took ------------------------------------------------------------
--     SELECT coming_soon_enabled, coming_soon_launch_at, coming_soon_heading
--     FROM public.store_settings WHERE id = 1;
-- One row. `coming_soon_enabled` false on an install that has never used it.
