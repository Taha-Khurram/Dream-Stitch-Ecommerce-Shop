-- ============================================================================
-- DREAM STITCH By Sk — bedding columns only
--
-- Fixes: "Could not find the 'compare_at_price' column of 'products' in the
-- schema cache" (PostgREST PGRST204) when saving from /admin/products.
--
-- This is section 1 of bedding_seed.sql on its own, so an existing catalogue
-- can gain the columns WITHOUT the seed's delete-and-reinsert.
-- Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================================

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS images           TEXT[],
    ADD COLUMN IF NOT EXISTS sizes            TEXT[],
    ADD COLUMN IF NOT EXISTS colors           TEXT[],
    ADD COLUMN IF NOT EXISTS fabric           TEXT,
    ADD COLUMN IF NOT EXISTS pieces           TEXT,
    ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(10, 2);

-- The CHECK is added separately: ADD COLUMN IF NOT EXISTS skips the whole
-- clause on a re-run, so on a database that already had the column without
-- the constraint it would never arrive.
DO $$
BEGIN
    ALTER TABLE public.products
        ADD CONSTRAINT products_compare_at_price_check
        CHECK (compare_at_price IS NULL OR compare_at_price >= 0);
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

-- PostgREST caches the schema; without this the API keeps returning PGRST204
-- until the connection pooler happens to restart.
NOTIFY pgrst, 'reload schema';

-- ----------------------------------------------------------------------
-- Verify — should list all six columns.
-- ----------------------------------------------------------------------
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'products'
   AND column_name IN ('images', 'sizes', 'colors', 'fabric', 'pieces',
                       'compare_at_price')
 ORDER BY column_name;
