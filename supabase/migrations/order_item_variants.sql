-- ============================================================================
-- order_item_variants.sql — record WHICH version of a product was ordered.
--
-- Why this file exists
-- --------------------
-- `order_items` recorded product, quantity and price and nothing else, so the
-- bed size the customer picked was dropped at checkout: `CartDrawer` merged
-- the cart's per-size lines down to one row per product before posting. The
-- admin could see that someone bought two of a sheet, never which sizes.
--
-- Made-to-measure orders make that gap unworkable — an order nobody can read
-- the measurements off is an order nobody can cut — so the variant now travels
-- with the line and lands here.
--
-- Depends on: ecommerce_schema.sql (the table), admin_schema.sql (RLS).
-- Idempotent — safe to re-run.
-- ============================================================================

-- 1. The variant columns ----------------------------------------------------
ALTER TABLE public.order_items
    -- The stocked bed size ("King Size"), or 'Custom' for a made-to-measure
    -- cut. Null on rows written before this migration — unknowable, not empty.
    ADD COLUMN IF NOT EXISTS size          TEXT,
    ADD COLUMN IF NOT EXISTS custom_width  NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS custom_height NUMERIC(6, 2),
    ADD COLUMN IF NOT EXISTS custom_unit   TEXT;

-- 2. A measurement is only a measurement with all three parts ---------------
--    Width, height and unit arrive together or not at all: "82 x 78" with no
--    unit is not something anyone can cut against, and the app is not the only
--    thing that can write to this table.
ALTER TABLE public.order_items
    DROP CONSTRAINT IF EXISTS order_items_custom_size_complete;
ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_custom_size_complete CHECK (
        (custom_width IS NULL AND custom_height IS NULL AND custom_unit IS NULL)
        OR (
            custom_width  IS NOT NULL AND custom_width  > 0
            AND custom_height IS NOT NULL AND custom_height > 0
            AND custom_unit IN ('in', 'cm')
        )
    );

-- 3. Comments, so the columns explain themselves in the table editor --------
COMMENT ON COLUMN public.order_items.size IS
    'Bed size ordered: a stocked size, or ''Custom'' when cut to measurement.';
COMMENT ON COLUMN public.order_items.custom_width IS
    'Made-to-measure width, in custom_unit. Null for a stocked size.';
COMMENT ON COLUMN public.order_items.custom_height IS
    'Made-to-measure height/length, in custom_unit. Null for a stocked size.';
COMMENT ON COLUMN public.order_items.custom_unit IS
    'Unit for custom_width/custom_height: ''in'' or ''cm''.';

-- 4. Confirm it took --------------------------------------------------------
--        SELECT column_name, data_type
--          FROM information_schema.columns
--         WHERE table_name = 'order_items'
--           AND column_name IN ('size','custom_width','custom_height','custom_unit');
--    Four rows. Existing orders keep NULL in all four.
