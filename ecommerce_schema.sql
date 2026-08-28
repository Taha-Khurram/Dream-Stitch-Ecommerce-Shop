-- ==============================================================================
-- Supabase PostgreSQL E-Commerce Schema with Row Level Security (RLS)
-- Tables: categories, products, orders, order_items
-- ==============================================================================

-- 1. Enable UUID Extension (standard in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 2. CREATE TABLES
-- ==============================================================================

-- 2.1 Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.2 Products Table
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    image_url TEXT,
    is_featured BOOLEAN NOT NULL DEFAULT false,
    rating NUMERIC(2, 1) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5.0),
    reviews_count INTEGER NOT NULL DEFAULT 0 CHECK (reviews_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.3 Orders Table
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    shipping_address JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.4 Order Items Table
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. INDEXES FOR PERFORMANCE
-- ==============================================================================

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON public.products(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_slug ON public.categories(slug);

-- Orders indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);

-- Order Items indexes
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) ACTIVATION
-- ==============================================================================

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 5. RLS POLICIES
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 5.1 Categories Policies
-- Anyone (anon, authenticated) can read categories
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access on categories" ON public.categories;
CREATE POLICY "Allow public read access on categories"
ON public.categories
FOR SELECT
TO anon, authenticated
USING (true);

-- ------------------------------------------------------------------------------
-- 5.2 Products Policies
-- Anyone (anon, authenticated) can read products
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow public read access on products" ON public.products;
CREATE POLICY "Allow public read access on products"
ON public.products
FOR SELECT
TO anon, authenticated
USING (true);

-- ------------------------------------------------------------------------------
-- 5.3 Orders Policies
-- Authenticated users can ONLY view their own orders
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders"
ON public.orders
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

-- Authenticated users can ONLY insert their own orders
DROP POLICY IF EXISTS "Users can insert their own orders" ON public.orders;
CREATE POLICY "Users can insert their own orders"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------------------
-- 5.4 Order Items Policies
-- Authenticated users can view order items belonging to their own orders
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their own order items" ON public.order_items;
CREATE POLICY "Users can view their own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE public.orders.id = public.order_items.order_id
        AND public.orders.user_id = (select auth.uid())
    )
);

-- Authenticated users can insert order items belonging to their own orders
DROP POLICY IF EXISTS "Users can insert their own order items" ON public.order_items;
CREATE POLICY "Users can insert their own order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE public.orders.id = public.order_items.order_id
        AND public.orders.user_id = (select auth.uid())
    )
);

-- ==============================================================================
-- 6. SAMPLE SEED DATA (Run to immediately test the storefront)
-- ==============================================================================

-- Seed Categories
INSERT INTO public.categories (id, name, slug, description, image_url) VALUES
('11111111-1111-1111-1111-111111111111', 'Audio & Headphones', 'audio', 'High fidelity studio gear and noise-cancelling headphones', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80'),
('22222222-2222-2222-2222-222222222222', 'Smart Wearables', 'wearables', 'Next-generation smartwatches, trackers, and tactical wearables', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80'),
('33333333-3333-3333-3333-333333333333', 'Computing & Workstation', 'computing', 'Ultra-fast laptops, mechanical peripherals, and productivity hubs', 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80'),
('44444444-4444-4444-4444-444444444444', 'Photography & Optics', 'optics', 'Mirrorless cameras, cinema lenses, and studio accessories', 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=800&q=80')
ON CONFLICT (slug) DO NOTHING;

-- Seed Products
INSERT INTO public.products (id, category_id, name, slug, description, price, stock, image_url, is_featured, rating, reviews_count) VALUES
(
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111111',
    'Aura Pro Wireless ANC Headphones',
    'aura-pro-wireless-headphones',
    'Engineered for true audiophiles. Features custom 45mm neodymium drivers, active hybrid noise cancellation up to 42dB, spatial audio tracking, and ultra-plush memory foam earpads for 40 hours of continuous high-fidelity playback.',
    349.99,
    25,
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1000&q=80',
    true,
    4.9,
    128
),
(
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'Chronos Apex Titanium Smartwatch',
    'chronos-apex-smartwatch',
    'Precision forged Grade-5 titanium bezel with sapphire crystal touch display. Comprehensive biometric monitoring including continuous ECG, VO2 max, dual-frequency GPS navigation, and 14-day battery endurance.',
    499.00,
    18,
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1000&q=80',
    true,
    4.8,
    94
),
(
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '33333333-3333-3333-3333-333333333333',
    'CyberDesk Mechanical Precision Keyboard',
    'cyberdesk-mechanical-keyboard',
    'Gasket-mounted custom aluminum chassis with hot-swappable lubricated linear switches, per-key RGB backlighting, rotary media encoder, and seamless multi-device Bluetooth 5.3 + 2.4GHz wireless connectivity.',
    189.50,
    42,
    'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=1000&q=80',
    true,
    4.9,
    215
),
(
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '44444444-4444-4444-4444-444444444444',
    'Lumix Prime 35mm F/1.4 Cinema Lens',
    'lumix-prime-35mm-cinema-lens',
    'Ultra-fast cinema prime lens engineered with zero chromatic aberration, circular 11-blade aperture for dreamy creamy bokeh, weather-sealed all-metal barrel, and buttery manual focus damping.',
    799.00,
    8,
    'https://images.unsplash.com/photo-1617005082133-548c4dd27f35?w=1000&q=80',
    false,
    4.7,
    46
),
(
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
    '11111111-1111-1111-1111-111111111111',
    'SonicPulse True Wireless Earbuds',
    'sonicpulse-wireless-earbuds',
    'Compact in-ear monitors with planar magnetic micro-drivers, IPX7 water resistance, transparent ambient mode, and intuitive haptic touch controls in an aerospace matte black charging case.',
    149.99,
    60,
    'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=1000&q=80',
    false,
    4.6,
    83
),
(
    'ffffffff-ffff-ffff-ffff-ffffffffffff',
    '33333333-3333-3333-3333-333333333333',
    'ProStudio Ergonomic Wireless Mouse',
    'prostudio-ergonomic-mouse',
    'Sculpted 57-degree natural handshake angle designed to reduce forearm muscle strain. Equipped with an ultra-accurate 8,000 DPI sensor that tracks on any surface, including glass.',
    99.00,
    35,
    'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=1000&q=80',
    false,
    4.8,
    110
)
ON CONFLICT (slug) DO NOTHING;
