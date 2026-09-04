-- ============================================================================
-- DREAM STITCH By Sk — dashboard mock data
--
-- Ten rows in each of the three tables from the brief: customers, products,
-- orders (plus the order lines, so the order detail screen has something to
-- show).
--
-- Run AFTER dashboard_schema.sql.
-- Safe to re-run: every row carries a fixed id and every insert is ON CONFLICT
-- DO NOTHING, so a second run changes nothing.
--
-- ⚠️  THIS WRITES INTO THE LIVE TABLES. The store already has a real
--     catalogue from bedding_seed.sql, so the ten demo products below are
--     slugged `demo-*` and priced normally — they WILL appear in the shop
--     until you remove them. The rollback block at the bottom of this file
--     deletes everything this seed inserts, and nothing else.
--
--     If you only want the dashboard to light up and not the storefront,
--     run sections A and C and skip section B: the KPI tiles, the revenue
--     chart and the recent-orders table read customers and orders only.
--
-- Money is PKR, matching CURRENCY in lib/format.ts.
-- ============================================================================


-- ----------------------------------------------------------------------
-- A. Customers — 10 rows
--
--    user_id is left NULL: these are records for people who have not (or not
--    yet) registered an account. A real signup gets its customer row from the
--    on_auth_user_created_customer trigger instead.
-- ----------------------------------------------------------------------
INSERT INTO public.customers (id, name, email, phone, created_at) VALUES
    ('d1a70000-0000-4000-a000-000000000001', 'Ayesha Siddiqui',   'ayesha.siddiqui@gmail.com',   '+92 300 2145877', timezone('utc'::text, now()) - interval '54 days'),
    ('d1a70000-0000-4000-a000-000000000002', 'Bilal Ahmed Khan',  'bilal.akhan@outlook.com',     '+92 321 4408912', timezone('utc'::text, now()) - interval '47 days'),
    ('d1a70000-0000-4000-a000-000000000003', 'Fatima Noor',       'fatima.noor@yahoo.com',       '+92 333 7761204', timezone('utc'::text, now()) - interval '39 days'),
    ('d1a70000-0000-4000-a000-000000000004', 'Hamza Tariq',       'hamza.tariq@gmail.com',       '+92 302 9983155', timezone('utc'::text, now()) - interval '31 days'),
    ('d1a70000-0000-4000-a000-000000000005', 'Zainab Rehman',     'zainab.rehman@gmail.com',     '+92 345 2230876', timezone('utc'::text, now()) - interval '26 days'),
    ('d1a70000-0000-4000-a000-000000000006', 'Usman Sheikh',      'usman.sheikh@hotmail.com',    '+92 311 6674390', timezone('utc'::text, now()) - interval '19 days'),
    ('d1a70000-0000-4000-a000-000000000007', 'Maryam Javed',      'maryam.javed@gmail.com',      '+92 336 1129548', timezone('utc'::text, now()) - interval '14 days'),
    ('d1a70000-0000-4000-a000-000000000008', 'Ali Raza Bhatti',   'ali.raza.bhatti@gmail.com',   '+92 300 8845721', timezone('utc'::text, now()) - interval '9 days'),
    ('d1a70000-0000-4000-a000-000000000009', 'Sana Iqbal',        'sana.iqbal@outlook.com',      '+92 322 3390647', timezone('utc'::text, now()) - interval '5 days'),
    ('d1a70000-0000-4000-a000-00000000000a', 'Danish Mehmood',    'danish.mehmood@gmail.com',    '+92 313 7702918', timezone('utc'::text, now()) - interval '2 days')
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------
-- B. Products — 10 rows   (OPTIONAL — see the warning at the top)
--
--    Only the columns guaranteed by ecommerce_schema.sql are written here,
--    so this seed does not depend on products_bedding_columns.sql having
--    been run. Slugs are `demo-*` so they can never collide with the real
--    catalogue, and so the rollback can find them again.
-- ----------------------------------------------------------------------
INSERT INTO public.products (id, name, slug, description, price, stock, is_featured, created_at) VALUES
    ('d1a70000-0001-4000-a000-000000000001', 'Noor Cotton Satin Bedsheet — King',      'demo-noor-cotton-satin-king',      'Long-staple cotton satin in ivory, 300 thread count. 1 bedsheet + 2 pillow covers.', 8500.00,  42, true,  timezone('utc'::text, now()) - interval '60 days'),
    ('d1a70000-0001-4000-a000-000000000002', 'Guldasta Printed Bedsheet — Double',     'demo-guldasta-printed-double',     'Hand-drawn floral print on pure cotton, colour-fast to forty washes.',                6200.00,  28, false, timezone('utc'::text, now()) - interval '58 days'),
    ('d1a70000-0001-4000-a000-000000000003', 'Sadaf Cotton Zeen Bedsheet — King',      'demo-sadaf-cotton-zeen-king',      'Cotton zeen with a soft matte finish. 1 bedsheet + 2 pillow covers.',                 7400.00,  15, false, timezone('utc'::text, now()) - interval '51 days'),
    ('d1a70000-0001-4000-a000-000000000004', 'Meher Embroidered Duvet Cover',          'demo-meher-embroidered-duvet',     'Tone-on-tone embroidery along the border, hidden button closure.',                   13900.00,   9, true,  timezone('utc'::text, now()) - interval '45 days'),
    ('d1a70000-0001-4000-a000-000000000005', 'Roshni Quilted Bed Spread — King',       'demo-roshni-quilted-spread-king',  'Lightly wadded and channel-quilted, warm without weight.',                           16500.00,   6, false, timezone('utc'::text, now()) - interval '40 days'),
    ('d1a70000-0001-4000-a000-000000000006', 'Chandni Pillow Cover Pair',              'demo-chandni-pillow-pair',         'Pair of standard covers in matching cotton satin.',                                   2200.00, 120, false, timezone('utc'::text, now()) - interval '35 days'),
    ('d1a70000-0001-4000-a000-000000000007', 'Sitara Cushion Cover Set of 4',          'demo-sitara-cushion-set-4',        'Four 18x18 covers, concealed zip, filler not included.',                              3600.00,  64, false, timezone('utc'::text, now()) - interval '30 days'),
    ('d1a70000-0001-4000-a000-000000000008', 'Aab-e-Rawan Muslin Summer Throw',        'demo-aab-e-rawan-muslin-throw',    'Four-layer muslin throw that softens with every wash.',                               5400.00,   3, false, timezone('utc'::text, now()) - interval '24 days'),
    ('d1a70000-0001-4000-a000-000000000009', 'Shabnam Fitted Sheet — Queen',           'demo-shabnam-fitted-queen',        'Deep 12-inch pocket with an all-round elastic hem.',                                  4300.00,  51, false, timezone('utc'::text, now()) - interval '17 days'),
    ('d1a70000-0001-4000-a000-00000000000a', 'Zeb Bridal Bedding Set — 7 Piece',       'demo-zeb-bridal-set-7pc',          'Seven-piece set: bedsheet, duvet cover, two pillow covers, three cushion covers.',   32000.00,   0, true,  timezone('utc'::text, now()) - interval '11 days')
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------
-- C. Orders — 10 rows
--
--    user_id stays NULL (that is what the DROP NOT NULL in dashboard_schema
--    bought us) and customer_id carries the relationship instead.
--
--    `shipping_address.fullName` repeats the customer name on purpose: the
--    existing /admin/orders table reads the name out of this JSON, so the
--    demo rows render correctly there too, not just on the new dashboard.
--
--    Statuses use the values the live CHECK constraint allows. The brief's
--    vocabulary maps onto them as:
--        Pending  -> 'pending'   (and 'processing' for work in flight)
--        Fulfilled-> 'completed'
--        Canceled -> 'cancelled'
--
--    created_at is spread across the last seven days so the revenue chart
--    has a real shape, including one deliberately quiet day.
-- ----------------------------------------------------------------------
INSERT INTO public.orders (id, customer_id, user_id, status, total_amount, shipping_address, created_at) VALUES
    ('d1a70000-0002-4000-a000-000000000001', 'd1a70000-0000-4000-a000-000000000001', NULL, 'completed',  16700.00, '{"fullName":"Ayesha Siddiqui","email":"ayesha.siddiqui@gmail.com","streetAddress":"House 42, Street 7, F-8/3","city":"Islamabad","state":"Islamabad Capital Territory","postalCode":"44000","country":"Pakistan","phone":"+92 300 2145877"}'::jsonb, timezone('utc'::text, now()) - interval '6 days' - interval '4 hours'),
    ('d1a70000-0002-4000-a000-000000000002', 'd1a70000-0000-4000-a000-000000000002', NULL, 'completed',   8500.00, '{"fullName":"Bilal Ahmed Khan","email":"bilal.akhan@outlook.com","streetAddress":"Flat 3B, Askari 11, Sector B","city":"Lahore","state":"Punjab","postalCode":"54000","country":"Pakistan","phone":"+92 321 4408912"}'::jsonb, timezone('utc'::text, now()) - interval '6 days' - interval '1 hour'),
    ('d1a70000-0002-4000-a000-000000000003', 'd1a70000-0000-4000-a000-000000000003', NULL, 'completed',  32000.00, '{"fullName":"Fatima Noor","email":"fatima.noor@yahoo.com","streetAddress":"12-C, Khayaban-e-Shahbaz, DHA Phase 6","city":"Karachi","state":"Sindh","postalCode":"75500","country":"Pakistan","phone":"+92 333 7761204"}'::jsonb, timezone('utc'::text, now()) - interval '5 days' - interval '7 hours'),
    ('d1a70000-0002-4000-a000-000000000004', 'd1a70000-0000-4000-a000-000000000004', NULL, 'cancelled',  13900.00, '{"fullName":"Hamza Tariq","email":"hamza.tariq@gmail.com","streetAddress":"House 88, Gulberg III, Block M","city":"Lahore","state":"Punjab","postalCode":"54660","country":"Pakistan","phone":"+92 302 9983155"}'::jsonb, timezone('utc'::text, now()) - interval '4 days' - interval '9 hours'),
    ('d1a70000-0002-4000-a000-000000000005', 'd1a70000-0000-4000-a000-000000000005', NULL, 'completed',   9800.00, '{"fullName":"Zainab Rehman","email":"zainab.rehman@gmail.com","streetAddress":"27 Cantt View Road, Saddar","city":"Rawalpindi","state":"Punjab","postalCode":"46000","country":"Pakistan","phone":"+92 345 2230876"}'::jsonb, timezone('utc'::text, now()) - interval '4 days' - interval '2 hours'),
    -- Three days ago is deliberately empty: the chart must show a zero, not a gap.
    ('d1a70000-0002-4000-a000-000000000006', 'd1a70000-0000-4000-a000-000000000006', NULL, 'completed',  22100.00, '{"fullName":"Usman Sheikh","email":"usman.sheikh@hotmail.com","streetAddress":"House 5, Phase 4, Hayatabad","city":"Peshawar","state":"Khyber Pakhtunkhwa","postalCode":"25000","country":"Pakistan","phone":"+92 311 6674390"}'::jsonb, timezone('utc'::text, now()) - interval '2 days' - interval '11 hours'),
    ('d1a70000-0002-4000-a000-000000000007', 'd1a70000-0000-4000-a000-000000000007', NULL, 'processing',  6200.00, '{"fullName":"Maryam Javed","email":"maryam.javed@gmail.com","streetAddress":"House 19, Satellite Town, Block C","city":"Quetta","state":"Balochistan","postalCode":"87300","country":"Pakistan","phone":"+92 336 1129548"}'::jsonb, timezone('utc'::text, now()) - interval '2 days' - interval '3 hours'),
    ('d1a70000-0002-4000-a000-000000000008', 'd1a70000-0000-4000-a000-000000000008', NULL, 'processing', 18300.00, '{"fullName":"Ali Raza Bhatti","email":"ali.raza.bhatti@gmail.com","streetAddress":"House 214, Model Town Link Road","city":"Faisalabad","state":"Punjab","postalCode":"38000","country":"Pakistan","phone":"+92 300 8845721"}'::jsonb, timezone('utc'::text, now()) - interval '1 day' - interval '8 hours'),
    ('d1a70000-0002-4000-a000-000000000009', 'd1a70000-0000-4000-a000-000000000009', NULL, 'pending',     4300.00, '{"fullName":"Sana Iqbal","email":"sana.iqbal@outlook.com","streetAddress":"Apartment 704, Bahria Town Phase 8","city":"Islamabad","state":"Islamabad Capital Territory","postalCode":"44000","country":"Pakistan","phone":"+92 322 3390647"}'::jsonb, timezone('utc'::text, now()) - interval '1 day' - interval '2 hours'),
    ('d1a70000-0002-4000-a000-00000000000a', 'd1a70000-0000-4000-a000-00000000000a', NULL, 'pending',    11700.00, '{"fullName":"Danish Mehmood","email":"danish.mehmood@gmail.com","streetAddress":"House 61, Wapda Town, Block G","city":"Multan","state":"Punjab","postalCode":"60000","country":"Pakistan","phone":"+92 313 7702918"}'::jsonb, timezone('utc'::text, now()) - interval '5 hours')
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------
-- D. Order lines — so /admin/orders/[id] is not an empty shell.
--
--    Skip this block if you skipped section B; it references the demo
--    products. Line totals reconcile with each order's total_amount above.
-- ----------------------------------------------------------------------
INSERT INTO public.order_items (id, order_id, product_id, quantity, unit_price) VALUES
    ('d1a70000-0003-4000-a000-000000000001', 'd1a70000-0002-4000-a000-000000000001', 'd1a70000-0001-4000-a000-000000000001', 1,  8500.00),
    ('d1a70000-0003-4000-a000-000000000002', 'd1a70000-0002-4000-a000-000000000001', 'd1a70000-0001-4000-a000-000000000002', 1,  6200.00),
    ('d1a70000-0003-4000-a000-000000000003', 'd1a70000-0002-4000-a000-000000000001', 'd1a70000-0001-4000-a000-000000000006', 1,  2000.00),
    ('d1a70000-0003-4000-a000-000000000004', 'd1a70000-0002-4000-a000-000000000002', 'd1a70000-0001-4000-a000-000000000001', 1,  8500.00),
    ('d1a70000-0003-4000-a000-000000000005', 'd1a70000-0002-4000-a000-000000000003', 'd1a70000-0001-4000-a000-00000000000a', 1, 32000.00),
    ('d1a70000-0003-4000-a000-000000000006', 'd1a70000-0002-4000-a000-000000000004', 'd1a70000-0001-4000-a000-000000000004', 1, 13900.00),
    ('d1a70000-0003-4000-a000-000000000007', 'd1a70000-0002-4000-a000-000000000005', 'd1a70000-0001-4000-a000-000000000003', 1,  7400.00),
    ('d1a70000-0003-4000-a000-000000000008', 'd1a70000-0002-4000-a000-000000000005', 'd1a70000-0001-4000-a000-000000000006', 1,  2400.00),
    ('d1a70000-0003-4000-a000-000000000009', 'd1a70000-0002-4000-a000-000000000006', 'd1a70000-0001-4000-a000-000000000005', 1, 16500.00),
    ('d1a70000-0003-4000-a000-00000000000b', 'd1a70000-0002-4000-a000-000000000006', 'd1a70000-0001-4000-a000-000000000008', 1,  5600.00),
    ('d1a70000-0003-4000-a000-00000000000c', 'd1a70000-0002-4000-a000-000000000007', 'd1a70000-0001-4000-a000-000000000002', 1,  6200.00),
    ('d1a70000-0003-4000-a000-00000000000d', 'd1a70000-0002-4000-a000-000000000008', 'd1a70000-0001-4000-a000-000000000004', 1, 13900.00),
    ('d1a70000-0003-4000-a000-00000000000e', 'd1a70000-0002-4000-a000-000000000008', 'd1a70000-0001-4000-a000-000000000007', 1,  3600.00),
    ('d1a70000-0003-4000-a000-00000000000f', 'd1a70000-0002-4000-a000-000000000008', 'd1a70000-0001-4000-a000-000000000006', 1,   800.00),
    ('d1a70000-0003-4000-a000-000000000010', 'd1a70000-0002-4000-a000-000000000009', 'd1a70000-0001-4000-a000-000000000009', 1,  4300.00),
    ('d1a70000-0003-4000-a000-000000000011', 'd1a70000-0002-4000-a000-00000000000a', 'd1a70000-0001-4000-a000-000000000005', 1, 11700.00)
ON CONFLICT (id) DO NOTHING;


-- ----------------------------------------------------------------------
-- Verify — expect 10 / 10 / 10, plus the seven-day series the chart reads.
-- ----------------------------------------------------------------------
SELECT 'customers'  AS table_name, count(*) AS demo_rows FROM public.customers WHERE id::text LIKE 'd1a70000-0000-%'
UNION ALL
SELECT 'products',  count(*) FROM public.products WHERE slug LIKE 'demo-%'
UNION ALL
SELECT 'orders',    count(*) FROM public.orders   WHERE id::text LIKE 'd1a70000-0002-%';


-- ============================================================================
-- ROLLBACK — removes exactly what this file inserted, and nothing else.
-- Uncomment and run to undo the seed.
-- ============================================================================
-- DELETE FROM public.order_items WHERE id::text LIKE 'd1a70000-0003-%';
-- DELETE FROM public.orders      WHERE id::text LIKE 'd1a70000-0002-%';
-- DELETE FROM public.products    WHERE slug LIKE 'demo-%';
-- DELETE FROM public.customers   WHERE id::text LIKE 'd1a70000-0000-%';
