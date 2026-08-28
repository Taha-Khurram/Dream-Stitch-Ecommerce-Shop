-- ============================================================================
-- AASHNA — clothing catalogue
--
-- Adds the apparel columns the storefront reads, clears the electronics
-- demo rows, and seeds categories and products priced in PKR.
-- Safe to re-run: every statement is idempotent.
-- ============================================================================

-- ----------------------------------------------------------------------
-- 1. Apparel columns
-- ----------------------------------------------------------------------
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS images           TEXT[],
    ADD COLUMN IF NOT EXISTS sizes            TEXT[],
    ADD COLUMN IF NOT EXISTS colors           TEXT[],
    ADD COLUMN IF NOT EXISTS fabric           TEXT,
    ADD COLUMN IF NOT EXISTS pieces           TEXT,
    ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(10, 2)
        CHECK (compare_at_price IS NULL OR compare_at_price >= 0);

-- ----------------------------------------------------------------------
-- 2. Retire the electronics demo catalogue
--    Products referenced by a placed order are left alone (order_items
--    is ON DELETE RESTRICT), so this never breaks order history.
-- ----------------------------------------------------------------------
DELETE FROM public.products p
 WHERE p.category_id IN (
           '11111111-1111-1111-1111-111111111111'::uuid,
           '22222222-2222-2222-2222-222222222222'::uuid,
           '33333333-3333-3333-3333-333333333333'::uuid,
           '44444444-4444-4444-4444-444444444444'::uuid
       )
   AND NOT EXISTS (
           SELECT 1 FROM public.order_items oi WHERE oi.product_id = p.id
       );

DELETE FROM public.categories c
 WHERE c.id IN (
           '11111111-1111-1111-1111-111111111111'::uuid,
           '22222222-2222-2222-2222-222222222222'::uuid,
           '33333333-3333-3333-3333-333333333333'::uuid,
           '44444444-4444-4444-4444-444444444444'::uuid
       )
   AND NOT EXISTS (
           SELECT 1 FROM public.products p WHERE p.category_id = c.id
       );

-- ----------------------------------------------------------------------
-- 3. Categories
-- ----------------------------------------------------------------------
INSERT INTO public.categories (id, name, slug, description, image_url) VALUES
    ('c1000000-0000-4000-8000-000000000001'::uuid, 'Ready to Wear', 'ready-to-wear', 'Stitched kurtas, co-ords and separates in the relaxed AASHNA fit.', 'https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=1200&q=80&auto=format&fit=crop'),
    ('c1000000-0000-4000-8000-000000000002'::uuid, 'Unstitched Fabrics', 'fabrics', 'Lawn, cambric and khaddar suits sold by the piece, yours to cut as you like.', 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=80&auto=format&fit=crop'),
    ('c1000000-0000-4000-8000-000000000003'::uuid, 'Festive & Formals', 'festive', 'Hand-worked organza, jacquard and raw silk for weddings and Eid.', 'https://images.unsplash.com/photo-1611601322175-ef8ec8c85f01?w=1200&q=80&auto=format&fit=crop'),
    ('c1000000-0000-4000-8000-000000000004'::uuid, 'Menswear', 'men', 'Kameez shalwar, waistcoats and kurtas cut for everyday wear.', 'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=1200&q=80&auto=format&fit=crop'),
    ('c1000000-0000-4000-8000-000000000005'::uuid, 'Kids', 'kids', 'Small-scale versions of the pieces you already love.', 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=1200&q=80&auto=format&fit=crop'),
    ('c1000000-0000-4000-8000-000000000006'::uuid, 'Home & Living', 'home', 'Block-printed bedlinen, throws and table textiles from the same studio.', 'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=1200&q=80&auto=format&fit=crop'),
    ('c1000000-0000-4000-8000-000000000007'::uuid, 'Fragrances', 'fragrances', 'Body mists and eau de parfum, layered like fabric.', 'https://images.unsplash.com/photo-1571908599407-cdb918ed83bf?w=1200&q=80&auto=format&fit=crop'),
    ('c1000000-0000-4000-8000-000000000008'::uuid, 'Accessories', 'accessories', 'Dupattas, stoles, bags and everyday jewellery.', 'https://images.unsplash.com/photo-1618375569909-3c8616cf7733?w=1200&q=80&auto=format&fit=crop')
ON CONFLICT (slug) DO UPDATE SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    image_url   = EXCLUDED.image_url,
    updated_at  = timezone('utc'::text, now());

-- ----------------------------------------------------------------------
-- 4. Products
-- ----------------------------------------------------------------------
INSERT INTO public.products (
    category_id, name, slug, description, price, compare_at_price, stock,
    image_url, images, sizes, colors, fabric, pieces,
    is_featured, rating, reviews_count
) VALUES
    (
        'c1000000-0000-4000-8000-000000000002'::uuid,
        'Sawan Printed Lawn 3 Piece',
        'sawan-printed-lawn-3-piece',
        'A featherweight lawn suit printed in three passes: digital ground, hand-blocked border and a screen-printed dupatta. Includes 2.5m shirt, 2.5m trouser and a 2.5m chiffon dupatta.',
        6990, 8490, 42,
        'https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1610030181087-540017dc9d61?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1600180758890-6b94519a8ba6?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Ivory', 'Blush', 'Indigo']::text[],
        'Lawn', '3 Piece',
        true, 4.8, 214
    ),
    (
        'c1000000-0000-4000-8000-000000000002'::uuid,
        'Meher Embroidered Lawn 3 Piece',
        'meher-embroidered-lawn-3-piece',
        'Thread-embroidered front panel with a hand-finished neckline, paired with plain-dyed cambric trousers and an organza dupatta. Sold unstitched.',
        8990, NULL, 28,
        'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1621184455862-c163dfb30e0f?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Sand', 'Jade', 'Maroon']::text[],
        'Lawn', '3 Piece',
        true, 4.9, 168
    ),
    (
        'c1000000-0000-4000-8000-000000000002'::uuid,
        'Khaddar Winter 2 Piece',
        'khaddar-winter-2-piece',
        'Brushed khaddar in a heavier winter weight, woven in Faisalabad and dyed in-house. Two-piece: 2.5m shirt and 2.5m trouser.',
        4990, 5990, 55,
        'https://images.unsplash.com/photo-1596993100471-c3905dafa78e?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1596993100471-c3905dafa78e?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1604176354204-9268737828e4?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Olive', 'Charcoal', 'Rust']::text[],
        'Khaddar', '2 Piece',
        false, 4.6, 96
    ),
    (
        'c1000000-0000-4000-8000-000000000002'::uuid,
        'Cambric Solid 1 Piece',
        'cambric-solid-1-piece',
        'A plain-dyed cambric shirt piece, colourfast and pre-shrunk. Perfect as a base for a printed dupatta or on its own.',
        2490, NULL, 90,
        'https://images.unsplash.com/photo-1589810635657-232948472d98?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1589810635657-232948472d98?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1618932260643-eee4a2f652a6?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Chalk', 'Beige', 'Teal', 'Black']::text[],
        'Cambric', '1 Piece',
        false, 4.5, 61
    ),
    (
        'c1000000-0000-4000-8000-000000000002'::uuid,
        'Chikankari Cotton Net 3 Piece',
        'chikankari-cotton-net-3-piece',
        'Hand-worked chikankari on cotton net, six weeks on the frame per shirt. Comes with a cotton slip and a schiffli-worked dupatta.',
        12900, 15900, 14,
        'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1581044777550-4cfa60707c03?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Ivory', 'Lilac']::text[],
        'Cotton Net', '3 Piece',
        true, 4.9, 87
    ),
    (
        'c1000000-0000-4000-8000-000000000001'::uuid,
        'Aab Everyday Cotton Kurta',
        'aab-everyday-cotton-kurta',
        'The kurta we make most of: a straight A-line cut in mid-weight cotton, side slits at the hip, and a placket finished with covered buttons.',
        3490, NULL, 64,
        'https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1552374196-c4e7ffc6e126?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL']::text[],
        ARRAY['Chalk', 'Indigo', 'Rust']::text[],
        'Cotton', 'Kurta',
        true, 4.7, 302
    ),
    (
        'c1000000-0000-4000-8000-000000000001'::uuid,
        'Rutba Embroidered Kurta',
        'rutba-embroidered-kurta',
        'Chest and cuff embroidery in tonal thread, with a gathered sleeve and a curved hem. Fully lined through the yoke.',
        5990, 7490, 31,
        'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1509319117193-57bab727e09d?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['S', 'M', 'L', 'XL']::text[],
        ARRAY['Sand', 'Blush', 'Jade']::text[],
        'Lawn', 'Kurta',
        true, 4.8, 149
    ),
    (
        'c1000000-0000-4000-8000-000000000001'::uuid,
        'Noor Angrakha 2 Piece',
        'noor-angrakha-2-piece',
        'A wrap-front angrakha with a tie fastening at the shoulder, sold with matching straight trousers. Cut long, sits below the knee.',
        8490, NULL, 22,
        'https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1616627561950-9f746e330187?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['S', 'M', 'L', 'XL']::text[],
        ARRAY['Ivory', 'Henna']::text[],
        'Cambric', '2 Piece',
        false, 4.7, 74
    ),
    (
        'c1000000-0000-4000-8000-000000000001'::uuid,
        'Saanjh Co-ord Set',
        'saanjh-co-ord-set',
        'A relaxed shirt and wide-leg trouser in washed linen blend. Wear together or split across the week.',
        7990, 9490, 26,
        'https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1595425970377-c9703cf48b6d?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['XS', 'S', 'M', 'L', 'XL']::text[],
        ARRAY['Olive', 'Chalk', 'Charcoal']::text[],
        'Linen Blend', '2 Piece',
        false, 4.6, 58
    ),
    (
        'c1000000-0000-4000-8000-000000000001'::uuid,
        'Basic Cotton Trousers',
        'basic-cotton-trousers',
        'Straight-cut cotton trousers with an elasticated back waist and side pockets. The house staple, restocked year round.',
        1990, NULL, 120,
        'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1583846783214-7229a91b20ed?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['XS', 'S', 'M', 'L', 'XL', 'XXL']::text[],
        ARRAY['Chalk', 'Black', 'Beige', 'Navy']::text[],
        'Cotton', 'Trousers',
        false, 4.4, 210
    ),
    (
        'c1000000-0000-4000-8000-000000000001'::uuid,
        'Zohra Tunic',
        'zohra-tunic',
        'A short, fluid tunic in viscose with a mandarin collar and quarter placket. Falls to mid-thigh.',
        4490, NULL, 38,
        'https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1560243563-062bfc001d68?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['S', 'M', 'L', 'XL']::text[],
        ARRAY['Rose', 'Teal', 'Black']::text[],
        'Viscose', 'Tunic',
        false, 4.5, 66
    ),
    (
        'c1000000-0000-4000-8000-000000000003'::uuid,
        'Shab Organza Formal 3 Piece',
        'shab-organza-formal-3-piece',
        'Sequin and zari work laid over silk organza, with a raw-silk slip and a hand-finished organza dupatta. Made to order in limited numbers.',
        24900, 29900, 9,
        'https://images.unsplash.com/photo-1611601322175-ef8ec8c85f01?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1611601322175-ef8ec8c85f01?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1631541909061-71e349d1f203?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['S', 'M', 'L', 'XL']::text[],
        ARRAY['Ivory', 'Maroon']::text[],
        'Organza', '3 Piece',
        true, 4.9, 41
    ),
    (
        'c1000000-0000-4000-8000-000000000003'::uuid,
        'Gulposh Zari Kurta',
        'gulposh-zari-kurta',
        'Raw silk with a hand-worked zari border at the hem and cuff. Lined throughout, with a concealed side zip.',
        16900, NULL, 12,
        'https://images.unsplash.com/photo-1617922001439-4a2e6562f328?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1617922001439-4a2e6562f328?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1612817159949-195b6eb9e31a?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['S', 'M', 'L', 'XL']::text[],
        ARRAY['Henna', 'Navy', 'Jade']::text[],
        'Raw Silk', 'Kurta',
        true, 4.8, 33
    ),
    (
        'c1000000-0000-4000-8000-000000000003'::uuid,
        'Mehr Jacquard 2 Piece',
        'mehr-jacquard-2-piece',
        'Self-woven jacquard in a deep festive palette, cut as a straight kameez with matching culottes.',
        13900, 16900, 17,
        'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['S', 'M', 'L', 'XL']::text[],
        ARRAY['Mustard', 'Maroon', 'Teal']::text[],
        'Jacquard', '2 Piece',
        false, 4.7, 52
    ),
    (
        'c1000000-0000-4000-8000-000000000003'::uuid,
        'Banarsi Organza Dupatta',
        'banarsi-organza-dupatta',
        'A 2.5m organza dupatta with a woven banarsi border on all four sides. Finishes any plain-dyed kurta.',
        6490, NULL, 34,
        'https://images.unsplash.com/photo-1583846783214-7229a91b20ed?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1583846783214-7229a91b20ed?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Ivory', 'Rose', 'Indigo']::text[],
        'Organza', 'Dupatta',
        false, 4.6, 88
    ),
    (
        'c1000000-0000-4000-8000-000000000004'::uuid,
        'Classic Cotton Kameez Shalwar',
        'classic-cotton-kameez-shalwar',
        'Wash-and-wear cotton in the traditional cut, with a shirt collar, chest pocket and a full shalwar. Pre-shrunk and colourfast.',
        6990, NULL, 46,
        'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1622470953794-aa9c70b0fb9d?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['S', 'M', 'L', 'XL', 'XXL']::text[],
        ARRAY['Chalk', 'Sand', 'Charcoal', 'Navy']::text[],
        'Cotton', '2 Piece',
        true, 4.7, 176
    ),
    (
        'c1000000-0000-4000-8000-000000000004'::uuid,
        'Kaaj Waistcoat',
        'kaaj-waistcoat',
        'A five-button waistcoat in a wool blend, fully lined, cut to sit over a kameez without pulling.',
        5490, 6990, 19,
        'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['S', 'M', 'L', 'XL']::text[],
        ARRAY['Charcoal', 'Black', 'Olive']::text[],
        'Wool Blend', 'Waistcoat',
        false, 4.5, 47
    ),
    (
        'c1000000-0000-4000-8000-000000000004'::uuid,
        'Men''s Embroidered Kurta',
        'mens-embroidered-kurta',
        'Tone-on-tone neckline embroidery on a straight kurta, finished with a side slit and a chest pocket.',
        4990, NULL, 33,
        'https://images.unsplash.com/photo-1622470953794-aa9c70b0fb9d?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1622470953794-aa9c70b0fb9d?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['S', 'M', 'L', 'XL', 'XXL']::text[],
        ARRAY['Ivory', 'Sand', 'Black']::text[],
        'Cotton Blend', 'Kurta',
        false, 4.6, 71
    ),
    (
        'c1000000-0000-4000-8000-000000000005'::uuid,
        'Girls Printed Lawn Suit',
        'girls-printed-lawn-suit',
        'The same lawn we print for adults, cut small. Soft elastic waist and a roomy armhole for play.',
        3490, 4290, 40,
        'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['2-3Y', '4-5Y', '6-7Y', '8-9Y', '10-11Y']::text[],
        ARRAY['Blush', 'Lilac', 'Mustard']::text[],
        'Lawn', '2 Piece',
        false, 4.6, 63
    ),
    (
        'c1000000-0000-4000-8000-000000000005'::uuid,
        'Boys Kameez Shalwar',
        'boys-kameez-shalwar',
        'A scaled-down cotton kameez shalwar with a soft collar and an adjustable drawstring.',
        3990, NULL, 28,
        'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['2-3Y', '4-5Y', '6-7Y', '8-9Y']::text[],
        ARRAY['Chalk', 'Navy', 'Olive']::text[],
        'Cotton', '2 Piece',
        false, 4.5, 39
    ),
    (
        'c1000000-0000-4000-8000-000000000005'::uuid,
        'Kids Festive Frock',
        'kids-festive-frock',
        'A gathered organza frock over a cotton slip, with a hand-finished sequin border at the hem.',
        4990, 5990, 16,
        'https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1490114538077-0a7f8cb49891?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1495121605193-b116b5b9c5fe?w=1200&q=80&auto=format&fit=crop']::text[],
        ARRAY['2-3Y', '4-5Y', '6-7Y']::text[],
        ARRAY['Ivory', 'Rose']::text[],
        'Organza', 'Frock',
        false, 4.7, 24
    ),
    (
        'c1000000-0000-4000-8000-000000000006'::uuid,
        'Block Print Bedsheet Set',
        'block-print-bedsheet-set',
        'A king bedsheet with two pillowcases, hand-blocked in a 400-thread cotton percale. Softens with every wash.',
        8990, 10900, 21,
        'https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1591369822096-ffd140ec948f?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Indigo', 'Rust', 'Jade']::text[],
        'Cotton Percale', '3 Piece',
        true, 4.8, 112
    ),
    (
        'c1000000-0000-4000-8000-000000000006'::uuid,
        'Handwoven Cotton Throw',
        'handwoven-cotton-throw',
        'Woven on a pit loom in Multan, with a knotted fringe on both ends. 130 × 180cm.',
        4490, NULL, 30,
        'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Sand', 'Charcoal', 'Olive']::text[],
        'Handloom Cotton', 'Single',
        false, 4.6, 44
    ),
    (
        'c1000000-0000-4000-8000-000000000006'::uuid,
        'Printed Table Runner',
        'printed-table-runner',
        'A hand-blocked canvas runner, 40 × 180cm, finished with a mitred hem.',
        2990, 3490, 48,
        'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Ivory', 'Mustard']::text[],
        'Cotton Canvas', 'Single',
        false, 4.4, 27
    ),
    (
        'c1000000-0000-4000-8000-000000000007'::uuid,
        'Sawan Body Mist 250ml',
        'sawan-body-mist-250ml',
        'Wet earth, jasmine and vetiver — the smell of the first monsoon rain on hot ground.',
        1890, NULL, 88,
        'https://images.unsplash.com/photo-1571908599407-cdb918ed83bf?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1571908599407-cdb918ed83bf?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Chalk']::text[],
        'Body Mist', '250ml',
        false, 4.5, 133
    ),
    (
        'c1000000-0000-4000-8000-000000000007'::uuid,
        'Meher Eau de Parfum 50ml',
        'meher-eau-de-parfum-50ml',
        'Rose absolute over oud and sandalwood, with a long, warm dry-down. Concentration 18%.',
        4500, 5200, 25,
        'https://images.unsplash.com/photo-1541643600914-78b084683601?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1541643600914-78b084683601?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Chalk']::text[],
        'Eau de Parfum', '50ml',
        true, 4.8, 76
    ),
    (
        'c1000000-0000-4000-8000-000000000007'::uuid,
        'Layering Gift Set',
        'layering-gift-set',
        'Three 30ml eau de parfums built to be layered — citrus, floral and woody — in a printed box.',
        6900, 8400, 18,
        'https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1631679706909-1844bbd07221?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1615397349754-cfa2066a298e?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Chalk']::text[],
        'Gift Set', '3 Piece',
        false, 4.7, 31
    ),
    (
        'c1000000-0000-4000-8000-000000000008'::uuid,
        'Handloom Cotton Stole',
        'handloom-cotton-stole',
        'A lightweight handloom stole with a hand-knotted fringe. Wide enough to wear as a dupatta.',
        2490, NULL, 52,
        'https://images.unsplash.com/photo-1618375569909-3c8616cf7733?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1618375569909-3c8616cf7733?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Ivory', 'Indigo', 'Rust', 'Olive']::text[],
        'Handloom Cotton', 'Single',
        false, 4.5, 58
    ),
    (
        'c1000000-0000-4000-8000-000000000008'::uuid,
        'Block Print Tote',
        'block-print-tote',
        'A heavy canvas tote with a hand-blocked panel, an inner pocket and shoulder-length handles.',
        1890, 2490, 64,
        'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Ivory', 'Navy']::text[],
        'Cotton Canvas', 'Single',
        false, 4.4, 92
    ),
    (
        'c1000000-0000-4000-8000-000000000008'::uuid,
        'Enamel Jhumka Earrings',
        'enamel-jhumka-earrings',
        'Hand-painted enamel over cast brass, with a hypoallergenic post. Light enough for all day.',
        3490, NULL, 27,
        'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=1200&q=80&auto=format&fit=crop',
        ARRAY['https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?w=1200&q=80&auto=format&fit=crop', 'https://images.unsplash.com/photo-1615397349754-cfa2066a298e?w=1200&q=80&auto=format&fit=crop']::text[],
        NULL,
        ARRAY['Mustard', 'Jade', 'Maroon']::text[],
        'Brass & Enamel', 'Pair',
        false, 4.6, 41
    )
ON CONFLICT (slug) DO UPDATE SET
    category_id      = EXCLUDED.category_id,
    name             = EXCLUDED.name,
    description      = EXCLUDED.description,
    price            = EXCLUDED.price,
    compare_at_price = EXCLUDED.compare_at_price,
    stock            = EXCLUDED.stock,
    image_url        = EXCLUDED.image_url,
    images           = EXCLUDED.images,
    sizes            = EXCLUDED.sizes,
    colors           = EXCLUDED.colors,
    fabric           = EXCLUDED.fabric,
    pieces           = EXCLUDED.pieces,
    is_featured      = EXCLUDED.is_featured,
    rating           = EXCLUDED.rating,
    reviews_count    = EXCLUDED.reviews_count,
    updated_at       = timezone('utc'::text, now());

