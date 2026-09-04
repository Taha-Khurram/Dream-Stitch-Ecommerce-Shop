-- ============================================================================
-- store_settings_row.sql — guarantee the single settings row exists, and let
-- admins create it if it does not.
--
-- Why this file exists
-- --------------------
-- `admin_schema.sql` seeds `store_settings` row 1 with `ON CONFLICT DO NOTHING`
-- in the same file that creates the table. On a database where that INSERT
-- never landed — the file was applied in pieces, or the row was deleted later —
-- the table sits empty, and nothing in the app says so:
--
--   * `saveSettings()` ran `UPDATE ... WHERE id = 1`, which matched no row.
--     Postgres reports that as success, so the admin form said "Settings saved."
--   * `getSettings()` read no row and fell back to `DEFAULT_SETTINGS`, so the
--     next render put the compiled-in defaults back in every field.
--
-- The app now upserts instead of updating, which needs an INSERT policy the
-- original schema never granted. Both halves are below.
--
-- Depends on: admin_schema.sql (the table, and `public.is_admin()`).
-- Idempotent — safe to re-run.
-- ============================================================================

-- 1. Admins may create the row, not just update it -------------------------
--    The `CHECK (id = 1)` on the table keeps this to exactly one row, so there
--    is no "admin inserts a second settings row" to guard against.
DROP POLICY IF EXISTS "Admins insert store settings" ON public.store_settings;
CREATE POLICY "Admins insert store settings"
ON public.store_settings FOR INSERT TO authenticated
WITH CHECK (public.is_admin());

-- 2. Seed row 1 if it is missing -------------------------------------------
--    Same values as `admin_schema.sql`; an install that already has the row
--    keeps whatever the admin has since saved.
INSERT INTO public.store_settings (
    id, brand_email, brand_phone, brand_whatsapp, brand_address,
    free_shipping_threshold, shipping_fee, announcements
) VALUES (
    1,
    'care@dreamstitch.pk',
    '03331166929',
    '+92 300 373 8480',
    'Plot 42, Textile Avenue, S.I.T.E. Industrial Area, Karachi, Pakistan',
    5000,
    250,
    ARRAY[
        'Free delivery on orders above PKR 5,000',
        'Custom sizes made to order — any bed, any drop',
        'Easy 7-day exchange, unused and in original packing',
        'Cash on delivery available nationwide'
    ]::TEXT[]
) ON CONFLICT (id) DO NOTHING;

-- 3. Confirm it took --------------------------------------------------------
--        SELECT id, brand_email, updated_at FROM public.store_settings;
--    One row, id 1. If this is empty, the INSERT above was rolled back.
