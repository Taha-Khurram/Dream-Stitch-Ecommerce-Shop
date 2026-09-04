-- ============================================================================
-- DREAM STITCH By Sk — product media storage
--
-- One public Storage bucket for product photography and video, one table that
-- tracks what is in it, and RLS on both so the storefront can read everything
-- while only staff can write.
--
-- Design note — originals are never touched. The bucket holds the master file
-- bit for bit; every derivative (thumbnail, card image, PDP hero) is produced
-- at read time by the Smart CDN's render endpoint. See lib/supabase/storage.ts.
--
-- Run AFTER ecommerce_schema.sql and admin_schema.sql.
-- Safe to re-run: every statement is idempotent.
--
-- Run this in the Supabase SQL editor, not through a pooled app connection:
-- sections 1 and 3 touch the `storage` schema, which only the `postgres` role
-- may modify. If section 3 fails with "must be owner of table objects",
-- create those four policies from Dashboard -> Storage -> Policies instead;
-- the USING / WITH CHECK expressions are copied verbatim from below.
-- ============================================================================

-- ----------------------------------------------------------------------
-- 1. The bucket
--
--    100 MB ceiling so a 4K product clip fits without re-encoding, and a
--    MIME allow-list enforced by storage-api itself — the client-side check
--    in the uploader is a courtesy, this is the boundary.
-- ----------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'product-media',
    'product-media',
    true,                        -- public: reads go straight to the CDN, no signing
    104857600,                   -- 100 MB, in bytes
    ARRAY[
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif',
        'video/mp4',
        'video/webm',
        'video/quicktime'
    ]
)
ON CONFLICT (id) DO UPDATE SET
    public             = EXCLUDED.public,
    file_size_limit    = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ----------------------------------------------------------------------
-- 2. Who may manage media
--
--    `is_admin()` from admin_schema.sql is the current answer, but media is
--    the first thing a seller role would need, so the check gets its own
--    function and the storage policies never have to change again.
--
--    To add sellers later:
--        ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
--        ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
--            CHECK (role IN ('customer', 'admin', 'seller'));
--    — this function already accepts them.
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_manage_product_media()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER          -- the role lookup must not be subject to RLS on profiles
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = auth.uid()
           AND role IN ('admin', 'seller')
    );
$$;

REVOKE ALL ON FUNCTION public.can_manage_product_media() FROM public;
GRANT EXECUTE ON FUNCTION public.can_manage_product_media() TO authenticated;

-- ----------------------------------------------------------------------
-- 3. Storage RLS — storage.objects, scoped to this bucket only
--
--    A public bucket already serves reads without a token; the SELECT policy
--    below is what lets a client *list* and inspect objects, which the
--    uploader needs to reconcile a queue after a reload.
-- ----------------------------------------------------------------------
DROP POLICY IF EXISTS "Product media is publicly readable" ON storage.objects;
CREATE POLICY "Product media is publicly readable"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'product-media');

DROP POLICY IF EXISTS "Staff upload product media" ON storage.objects;
CREATE POLICY "Staff upload product media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'product-media'
    AND public.can_manage_product_media()
    -- Two folder shapes, both exactly two levels deep, so a future seller role
    -- can never write anywhere else in the bucket:
    --   products/<product-id>/<file>  product photography and video
    --   site/<field>/<file>           storefront chrome — hero backgrounds,
    --                                 category tiles, section imagery
    AND (storage.foldername(name))[1] IN ('products', 'site')
    AND array_length(storage.foldername(name), 1) = 2
);

DROP POLICY IF EXISTS "Owners and admins update product media" ON storage.objects;
CREATE POLICY "Owners and admins update product media"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id = 'product-media'
    AND (owner = auth.uid() OR public.is_admin())
)
WITH CHECK (
    bucket_id = 'product-media'
    AND public.can_manage_product_media()
);

DROP POLICY IF EXISTS "Owners and admins delete product media" ON storage.objects;
CREATE POLICY "Owners and admins delete product media"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'product-media'
    AND (owner = auth.uid() OR public.is_admin())
);

-- ----------------------------------------------------------------------
-- 4. product_media — the catalogue's view of what is in the bucket
--
--    `file_path` is the object key inside `product-media`, never a full URL:
--    the URL is derived at render time so the project can move buckets or
--    domains without a data migration.
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.product_media (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    file_path  TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- The same object must not be attached twice.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_media_file_path
    ON public.product_media(file_path);

-- The gallery read: every shot for one product, already in display order.
CREATE INDEX IF NOT EXISTS idx_product_media_product_order
    ON public.product_media(product_id, sort_order, created_at);

-- At most one primary per product, enforced by the database rather than hoped
-- for by the UI. The trigger below keeps this from ever being hit.
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_media_one_primary
    ON public.product_media(product_id)
    WHERE is_primary;

-- Promoting a shot demotes the incumbent, so "set as primary" stays a single
-- UPDATE from the client. Recursion is not a concern: the inner update sets
-- is_primary = false, and this body only acts when it is true.
CREATE OR REPLACE FUNCTION public.demote_other_primary_media()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.is_primary THEN
        UPDATE public.product_media
           SET is_primary = false
         WHERE product_id = NEW.product_id
           AND id <> NEW.id
           AND is_primary;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_media_single_primary ON public.product_media;
CREATE TRIGGER product_media_single_primary
    BEFORE INSERT OR UPDATE OF is_primary ON public.product_media
    FOR EACH ROW EXECUTE FUNCTION public.demote_other_primary_media();

-- ----------------------------------------------------------------------
-- 5. product_media RLS — mirrors the catalogue: world reads, staff writes
-- ----------------------------------------------------------------------
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads product media" ON public.product_media;
CREATE POLICY "Anyone reads product media"
ON public.product_media FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Staff insert product media" ON public.product_media;
CREATE POLICY "Staff insert product media"
ON public.product_media FOR INSERT TO authenticated
WITH CHECK (public.can_manage_product_media());

DROP POLICY IF EXISTS "Staff update product media" ON public.product_media;
CREATE POLICY "Staff update product media"
ON public.product_media FOR UPDATE TO authenticated
USING (public.can_manage_product_media())
WITH CHECK (public.can_manage_product_media());

DROP POLICY IF EXISTS "Staff delete product media" ON public.product_media;
CREATE POLICY "Staff delete product media"
ON public.product_media FOR DELETE TO authenticated
USING (public.can_manage_product_media());

-- ============================================================================
-- 6. Housekeeping note
--
--    Deleting a product cascades its product_media rows, but NOT the objects
--    in the bucket — Postgres cannot call the storage API. The uploader
--    deletes the row first and then the object, because a stray object is
--    invisible and sweepable while a stray row renders as a hole in the
--    gallery. Sweep whatever slips through with:
--
--        SELECT o.name FROM storage.objects o
--         WHERE o.bucket_id = 'product-media'
--           AND NOT EXISTS (
--               SELECT 1 FROM public.product_media m WHERE m.file_path = o.name
--           )
--           -- The admin forms store uploads as URLs in these three places
--           -- rather than as product_media rows. Check them before deleting
--           -- anything, or a swept object is a hole in the storefront.
--           AND NOT EXISTS (
--               SELECT 1 FROM public.products p
--                WHERE p.image_url LIKE '%' || o.name
--                   OR EXISTS (
--                       SELECT 1 FROM unnest(coalesce(p.images, '{}')) u
--                        WHERE u LIKE '%' || o.name
--                   )
--           )
--           AND NOT EXISTS (
--               SELECT 1 FROM public.categories c WHERE c.image_url LIKE '%' || o.name
--           )
--           AND NOT EXISTS (
--               SELECT 1 FROM public.store_settings s
--                WHERE s.content::text LIKE '%' || o.name || '%'
--           );
-- ============================================================================
