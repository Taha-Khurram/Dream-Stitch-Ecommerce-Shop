-- ============================================================================
-- DREAM STITCH By Sk — product type (bedsheet / cushion cover)
--
-- The product page used to assume every product was a bedsheet: "Bed Size",
-- a Single/King run when no sizes were entered, and "Bed an odd size?". A
-- cushion cover set carries none of that. This column tells the page which
-- one it is drawing.
--
-- Existing rows become bedsheets, which is what the page already treated them
-- as — nothing changes on the storefront until a product is re-marked.
-- Run in the Supabase SQL editor. Safe to re-run.
-- ============================================================================

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS product_type TEXT NOT NULL DEFAULT 'bedsheet';

-- Separate from ADD COLUMN for the same reason as products_bedding_columns.sql:
-- on a re-run IF NOT EXISTS skips the whole clause, constraint included.
DO $$
BEGIN
    ALTER TABLE public.products
        ADD CONSTRAINT products_product_type_check
        CHECK (product_type IN ('bedsheet', 'cushion_cover'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END
$$;

NOTIFY pgrst, 'reload schema';

-- Verify — should return one row.
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'products'
   AND column_name  = 'product_type';
