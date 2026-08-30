-- ============================================================================
-- DREAM STITCH By Sk — admin panel schema
--
-- Adds the pieces the storefront never needed: a role on every account, RLS
-- policies that let an admin write the catalogue and read the order book, and
-- a single-row settings table for the values that used to be constants.
--
-- Run AFTER ecommerce_schema.sql and bedding_seed.sql.
-- Safe to re-run: every statement is idempotent.
--
-- ⚠️  No signup path grants admin. After registering normally, promote
--     yourself with the UPDATE at the bottom of this file.
-- ============================================================================

-- ----------------------------------------------------------------------
-- 1. Profiles — one row per auth user, carrying the role
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email      TEXT,
    full_name  TEXT,
    role       TEXT NOT NULL DEFAULT 'customer'
                 CHECK (role IN ('customer', 'admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role)
    WHERE role = 'admin';

-- Give every existing account a profile, so nobody is stranded without one.
INSERT INTO public.profiles (id, email)
SELECT u.id, u.email FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- New signups get one automatically.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        NULLIF(NEW.raw_user_meta_data ->> 'full_name', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ----------------------------------------------------------------------
-- 2. is_admin() — SECURITY DEFINER so the role lookup itself is not
--    subject to RLS on `profiles` (which would recurse forever).
-- ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
         WHERE id = auth.uid() AND role = 'admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ----------------------------------------------------------------------
-- 3. Store settings — one row, id fixed at 1
-- ----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.store_settings (
    id                      SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    brand_email             TEXT,
    brand_phone             TEXT,
    brand_whatsapp          TEXT,
    brand_address           TEXT,
    free_shipping_threshold NUMERIC(10, 2) NOT NULL DEFAULT 5000
                              CHECK (free_shipping_threshold >= 0),
    shipping_fee            NUMERIC(10, 2) NOT NULL DEFAULT 250
                              CHECK (shipping_fee >= 0),
    announcements           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.store_settings (
    id, brand_email, brand_phone, brand_whatsapp, brand_address,
    free_shipping_threshold, shipping_fee, announcements
) VALUES (
    1,
    'care@dreamstitch.pk',
    '+92 21 111 373 848',
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

-- ----------------------------------------------------------------------
-- 4. Row level security
-- ----------------------------------------------------------------------
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- 4.1 Profiles ---------------------------------------------------------
DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid())
-- Role is deliberately absent from this policy's reach: a user may edit their
-- own name, never their own role. Promotion happens in SQL only.
WITH CHECK (id = auth.uid() AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()));

DROP POLICY IF EXISTS "Admins update any profile" ON public.profiles;
CREATE POLICY "Admins update any profile"
ON public.profiles FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4.2 Catalogue — admins write, everyone still reads ---------------------
DROP POLICY IF EXISTS "Admins insert products" ON public.products;
CREATE POLICY "Admins insert products"
ON public.products FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins update products" ON public.products;
CREATE POLICY "Admins update products"
ON public.products FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete products" ON public.products;
CREATE POLICY "Admins delete products"
ON public.products FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins insert categories" ON public.categories;
CREATE POLICY "Admins insert categories"
ON public.categories FOR INSERT TO authenticated WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins update categories" ON public.categories;
CREATE POLICY "Admins update categories"
ON public.categories FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins delete categories" ON public.categories;
CREATE POLICY "Admins delete categories"
ON public.categories FOR DELETE TO authenticated USING (public.is_admin());

-- 4.3 Orders — admins see and progress the whole book --------------------
DROP POLICY IF EXISTS "Admins view all orders" ON public.orders;
CREATE POLICY "Admins view all orders"
ON public.orders FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins update orders" ON public.orders;
CREATE POLICY "Admins update orders"
ON public.orders FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins view all order items" ON public.order_items;
CREATE POLICY "Admins view all order items"
ON public.order_items FOR SELECT TO authenticated USING (public.is_admin());

-- 4.4 Settings — world readable (the storefront renders them), admin writes
DROP POLICY IF EXISTS "Anyone reads store settings" ON public.store_settings;
CREATE POLICY "Anyone reads store settings"
ON public.store_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins update store settings" ON public.store_settings;
CREATE POLICY "Admins update store settings"
ON public.store_settings FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================================
-- 5. MAKE YOURSELF AN ADMIN
--
--    Register through /signup first, then run this with your own address:
--
--        UPDATE public.profiles SET role = 'admin'
--         WHERE email = 'you@example.com';
--
--    Confirm it took:
--
--        SELECT email, role FROM public.profiles WHERE role = 'admin';
-- ============================================================================
