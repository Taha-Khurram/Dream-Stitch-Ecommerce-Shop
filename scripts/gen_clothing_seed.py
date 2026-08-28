"""
Generates `clothing_seed.sql` — the apparel migration + catalogue for the store.

Run with `python scripts/gen_clothing_seed.py` after editing CATEGORIES or
PRODUCTS below; the SQL file is the artefact that actually gets applied.

Every Unsplash id used here has been checked to return 200.
"""

from pathlib import Path

U = "https://images.unsplash.com/{}?w=1200&q=80&auto=format&fit=crop"


def q(value):
    """Quote a Python value as a Postgres literal."""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, list):
        inner = ", ".join("'" + str(v).replace("'", "''") + "'" for v in value)
        return "ARRAY[" + inner + "]::text[]"
    return "'" + str(value).replace("'", "''") + "'"


CATEGORIES = [
    ("c1000000-0000-4000-8000-000000000001", "Ready to Wear", "ready-to-wear",
     "Stitched kurtas, co-ords and separates in the relaxed AASHNA fit.",
     "photo-1583744946564-b52ac1c389c8"),
    ("c1000000-0000-4000-8000-000000000002", "Unstitched Fabrics", "fabrics",
     "Lawn, cambric and khaddar suits sold by the piece, yours to cut as you like.",
     "photo-1595777457583-95e059d581b8"),
    ("c1000000-0000-4000-8000-000000000003", "Festive & Formals", "festive",
     "Hand-worked organza, jacquard and raw silk for weddings and Eid.",
     "photo-1611601322175-ef8ec8c85f01"),
    ("c1000000-0000-4000-8000-000000000004", "Menswear", "men",
     "Kameez shalwar, waistcoats and kurtas cut for everyday wear.",
     "photo-1602810318383-e386cc2a3ccf"),
    ("c1000000-0000-4000-8000-000000000005", "Kids", "kids",
     "Small-scale versions of the pieces you already love.",
     "photo-1596755094514-f87e34085b2c"),
    ("c1000000-0000-4000-8000-000000000006", "Home & Living", "home",
     "Block-printed bedlinen, throws and table textiles from the same studio.",
     "photo-1591369822096-ffd140ec948f"),
    ("c1000000-0000-4000-8000-000000000007", "Fragrances", "fragrances",
     "Body mists and eau de parfum, layered like fabric.",
     "photo-1571908599407-cdb918ed83bf"),
    ("c1000000-0000-4000-8000-000000000008", "Accessories", "accessories",
     "Dupattas, stoles, bags and everyday jewellery.",
     "photo-1618375569909-3c8616cf7733"),
]

CAT = {slug: cid for cid, _, slug, _, _ in CATEGORIES}

# name, slug, category, price, compare_at, stock, fabric, pieces, sizes, colors,
# featured, rating, reviews, images[], description
PRODUCTS = [
    # ── Unstitched fabrics ────────────────────────────────────────────────
    ("Sawan Printed Lawn 3 Piece", "sawan-printed-lawn-3-piece", "fabrics",
     6990, 8490, 42, "Lawn", "3 Piece", None, ["Ivory", "Blush", "Indigo"],
     True, 4.8, 214,
     ["photo-1595777457583-95e059d581b8", "photo-1610030181087-540017dc9d61", "photo-1600180758890-6b94519a8ba6"],
     "A featherweight lawn suit printed in three passes: digital ground, hand-blocked border and a screen-printed dupatta. Includes 2.5m shirt, 2.5m trouser and a 2.5m chiffon dupatta."),

    ("Meher Embroidered Lawn 3 Piece", "meher-embroidered-lawn-3-piece", "fabrics",
     8990, None, 28, "Lawn", "3 Piece", None, ["Sand", "Jade", "Maroon"],
     True, 4.9, 168,
     ["photo-1606760227091-3dd870d97f1d", "photo-1621184455862-c163dfb30e0f"],
     "Thread-embroidered front panel with a hand-finished neckline, paired with plain-dyed cambric trousers and an organza dupatta. Sold unstitched."),

    ("Khaddar Winter 2 Piece", "khaddar-winter-2-piece", "fabrics",
     4990, 5990, 55, "Khaddar", "2 Piece", None, ["Olive", "Charcoal", "Rust"],
     False, 4.6, 96,
     ["photo-1596993100471-c3905dafa78e", "photo-1604176354204-9268737828e4"],
     "Brushed khaddar in a heavier winter weight, woven in Faisalabad and dyed in-house. Two-piece: 2.5m shirt and 2.5m trouser."),

    ("Cambric Solid 1 Piece", "cambric-solid-1-piece", "fabrics",
     2490, None, 90, "Cambric", "1 Piece", None, ["Chalk", "Beige", "Teal", "Black"],
     False, 4.5, 61,
     ["photo-1589810635657-232948472d98", "photo-1618932260643-eee4a2f652a6"],
     "A plain-dyed cambric shirt piece, colourfast and pre-shrunk. Perfect as a base for a printed dupatta or on its own."),

    ("Chikankari Cotton Net 3 Piece", "chikankari-cotton-net-3-piece", "fabrics",
     12900, 15900, 14, "Cotton Net", "3 Piece", None, ["Ivory", "Lilac"],
     True, 4.9, 87,
     ["photo-1566174053879-31528523f8ae", "photo-1581044777550-4cfa60707c03"],
     "Hand-worked chikankari on cotton net, six weeks on the frame per shirt. Comes with a cotton slip and a schiffli-worked dupatta."),

    # ── Ready to wear ─────────────────────────────────────────────────────
    ("Aab Everyday Cotton Kurta", "aab-everyday-cotton-kurta", "ready-to-wear",
     3490, None, 64, "Cotton", "Kurta", ["XS", "S", "M", "L", "XL", "XXL"],
     ["Chalk", "Indigo", "Rust"], True, 4.7, 302,
     ["photo-1583744946564-b52ac1c389c8", "photo-1552374196-c4e7ffc6e126"],
     "The kurta we make most of: a straight A-line cut in mid-weight cotton, side slits at the hip, and a placket finished with covered buttons."),

    ("Rutba Embroidered Kurta", "rutba-embroidered-kurta", "ready-to-wear",
     5990, 7490, 31, "Lawn", "Kurta", ["S", "M", "L", "XL"],
     ["Sand", "Blush", "Jade"], True, 4.8, 149,
     ["photo-1618354691373-d851c5c3a990", "photo-1509319117193-57bab727e09d"],
     "Chest and cuff embroidery in tonal thread, with a gathered sleeve and a curved hem. Fully lined through the yoke."),

    ("Noor Angrakha 2 Piece", "noor-angrakha-2-piece", "ready-to-wear",
     8490, None, 22, "Cambric", "2 Piece", ["S", "M", "L", "XL"],
     ["Ivory", "Henna"], False, 4.7, 74,
     ["photo-1524805444758-089113d48a6d", "photo-1616627561950-9f746e330187"],
     "A wrap-front angrakha with a tie fastening at the shoulder, sold with matching straight trousers. Cut long, sits below the knee."),

    ("Saanjh Co-ord Set", "saanjh-co-ord-set", "ready-to-wear",
     7990, 9490, 26, "Linen Blend", "2 Piece", ["XS", "S", "M", "L", "XL"],
     ["Olive", "Chalk", "Charcoal"], False, 4.6, 58,
     ["photo-1600185365483-26d7a4cc7519", "photo-1595425970377-c9703cf48b6d"],
     "A relaxed shirt and wide-leg trouser in washed linen blend. Wear together or split across the week."),

    ("Basic Cotton Trousers", "basic-cotton-trousers", "ready-to-wear",
     1990, None, 120, "Cotton", "Trousers", ["XS", "S", "M", "L", "XL", "XXL"],
     ["Chalk", "Black", "Beige", "Navy"], False, 4.4, 210,
     ["photo-1594633312681-425c7b97ccd1", "photo-1583846783214-7229a91b20ed"],
     "Straight-cut cotton trousers with an elasticated back waist and side pockets. The house staple, restocked year round."),

    ("Zohra Tunic", "zohra-tunic", "ready-to-wear",
     4490, None, 38, "Viscose", "Tunic", ["S", "M", "L", "XL"],
     ["Rose", "Teal", "Black"], False, 4.5, 66,
     ["photo-1587049352846-4a222e784d38", "photo-1560243563-062bfc001d68"],
     "A short, fluid tunic in viscose with a mandarin collar and quarter placket. Falls to mid-thigh."),

    # ── Festive ───────────────────────────────────────────────────────────
    ("Shab Organza Formal 3 Piece", "shab-organza-formal-3-piece", "festive",
     24900, 29900, 9, "Organza", "3 Piece", ["S", "M", "L", "XL"],
     ["Ivory", "Maroon"], True, 4.9, 41,
     ["photo-1611601322175-ef8ec8c85f01", "photo-1631541909061-71e349d1f203"],
     "Sequin and zari work laid over silk organza, with a raw-silk slip and a hand-finished organza dupatta. Made to order in limited numbers."),

    ("Gulposh Zari Kurta", "gulposh-zari-kurta", "festive",
     16900, None, 12, "Raw Silk", "Kurta", ["S", "M", "L", "XL"],
     ["Henna", "Navy", "Jade"], True, 4.8, 33,
     ["photo-1617922001439-4a2e6562f328", "photo-1612817159949-195b6eb9e31a"],
     "Raw silk with a hand-worked zari border at the hem and cuff. Lined throughout, with a concealed side zip."),

    ("Mehr Jacquard 2 Piece", "mehr-jacquard-2-piece", "festive",
     13900, 16900, 17, "Jacquard", "2 Piece", ["S", "M", "L", "XL"],
     ["Mustard", "Maroon", "Teal"], False, 4.7, 52,
     ["photo-1522335789203-aabd1fc54bc9", "photo-1596462502278-27bfdc403348"],
     "Self-woven jacquard in a deep festive palette, cut as a straight kameez with matching culottes."),

    ("Banarsi Organza Dupatta", "banarsi-organza-dupatta", "festive",
     6490, None, 34, "Organza", "Dupatta", None, ["Ivory", "Rose", "Indigo"],
     False, 4.6, 88,
     ["photo-1583846783214-7229a91b20ed", "photo-1566174053879-31528523f8ae"],
     "A 2.5m organza dupatta with a woven banarsi border on all four sides. Finishes any plain-dyed kurta."),

    # ── Menswear ──────────────────────────────────────────────────────────
    ("Classic Cotton Kameez Shalwar", "classic-cotton-kameez-shalwar", "men",
     6990, None, 46, "Cotton", "2 Piece", ["S", "M", "L", "XL", "XXL"],
     ["Chalk", "Sand", "Charcoal", "Navy"], True, 4.7, 176,
     ["photo-1602810318383-e386cc2a3ccf", "photo-1622470953794-aa9c70b0fb9d"],
     "Wash-and-wear cotton in the traditional cut, with a shirt collar, chest pocket and a full shalwar. Pre-shrunk and colourfast."),

    ("Kaaj Waistcoat", "kaaj-waistcoat", "men",
     5490, 6990, 19, "Wool Blend", "Waistcoat", ["S", "M", "L", "XL"],
     ["Charcoal", "Black", "Olive"], False, 4.5, 47,
     ["photo-1594938298603-c8148c4dae35", "photo-1512436991641-6745cdb1723f"],
     "A five-button waistcoat in a wool blend, fully lined, cut to sit over a kameez without pulling."),

    ("Men's Embroidered Kurta", "mens-embroidered-kurta", "men",
     4990, None, 33, "Cotton Blend", "Kurta", ["S", "M", "L", "XL", "XXL"],
     ["Ivory", "Sand", "Black"], False, 4.6, 71,
     ["photo-1622470953794-aa9c70b0fb9d", "photo-1519741497674-611481863552"],
     "Tone-on-tone neckline embroidery on a straight kurta, finished with a side slit and a chest pocket."),

    # ── Kids ──────────────────────────────────────────────────────────────
    ("Girls Printed Lawn Suit", "girls-printed-lawn-suit", "kids",
     3490, 4290, 40, "Lawn", "2 Piece", ["2-3Y", "4-5Y", "6-7Y", "8-9Y", "10-11Y"],
     ["Blush", "Lilac", "Mustard"], False, 4.6, 63,
     ["photo-1596755094514-f87e34085b2c", "photo-1503342217505-b0a15ec3261c"],
     "The same lawn we print for adults, cut small. Soft elastic waist and a roomy armhole for play."),

    ("Boys Kameez Shalwar", "boys-kameez-shalwar", "kids",
     3990, None, 28, "Cotton", "2 Piece", ["2-3Y", "4-5Y", "6-7Y", "8-9Y"],
     ["Chalk", "Navy", "Olive"], False, 4.5, 39,
     ["photo-1503342217505-b0a15ec3261c", "photo-1490114538077-0a7f8cb49891"],
     "A scaled-down cotton kameez shalwar with a soft collar and an adjustable drawstring."),

    ("Kids Festive Frock", "kids-festive-frock", "kids",
     4990, 5990, 16, "Organza", "Frock", ["2-3Y", "4-5Y", "6-7Y"],
     ["Ivory", "Rose"], False, 4.7, 24,
     ["photo-1490114538077-0a7f8cb49891", "photo-1495121605193-b116b5b9c5fe"],
     "A gathered organza frock over a cotton slip, with a hand-finished sequin border at the hem."),

    # ── Home & living ─────────────────────────────────────────────────────
    ("Block Print Bedsheet Set", "block-print-bedsheet-set", "home",
     8990, 10900, 21, "Cotton Percale", "3 Piece", None, ["Indigo", "Rust", "Jade"],
     True, 4.8, 112,
     ["photo-1591369822096-ffd140ec948f", "photo-1556905055-8f358a7a47b2"],
     "A king bedsheet with two pillowcases, hand-blocked in a 400-thread cotton percale. Softens with every wash."),

    ("Handwoven Cotton Throw", "handwoven-cotton-throw", "home",
     4490, None, 30, "Handloom Cotton", "Single", None, ["Sand", "Charcoal", "Olive"],
     False, 4.6, 44,
     ["photo-1556905055-8f358a7a47b2", "photo-1567401893414-76b7b1e5a7a5"],
     "Woven on a pit loom in Multan, with a knotted fringe on both ends. 130 × 180cm."),

    ("Printed Table Runner", "printed-table-runner", "home",
     2990, 3490, 48, "Cotton Canvas", "Single", None, ["Ivory", "Mustard"],
     False, 4.4, 27,
     ["photo-1567401893414-76b7b1e5a7a5", "photo-1584917865442-de89df76afd3"],
     "A hand-blocked canvas runner, 40 × 180cm, finished with a mitred hem."),

    # ── Fragrances ────────────────────────────────────────────────────────
    ("Sawan Body Mist 250ml", "sawan-body-mist-250ml", "fragrances",
     1890, None, 88, "Body Mist", "250ml", None, ["Chalk"],
     False, 4.5, 133,
     ["photo-1571908599407-cdb918ed83bf", "photo-1541643600914-78b084683601"],
     "Wet earth, jasmine and vetiver — the smell of the first monsoon rain on hot ground."),

    ("Meher Eau de Parfum 50ml", "meher-eau-de-parfum-50ml", "fragrances",
     4500, 5200, 25, "Eau de Parfum", "50ml", None, ["Chalk"],
     True, 4.8, 76,
     ["photo-1541643600914-78b084683601", "photo-1631679706909-1844bbd07221"],
     "Rose absolute over oud and sandalwood, with a long, warm dry-down. Concentration 18%."),

    ("Layering Gift Set", "layering-gift-set", "fragrances",
     6900, 8400, 18, "Gift Set", "3 Piece", None, ["Chalk"],
     False, 4.7, 31,
     ["photo-1631679706909-1844bbd07221", "photo-1615397349754-cfa2066a298e"],
     "Three 30ml eau de parfums built to be layered — citrus, floral and woody — in a printed box."),

    # ── Accessories ───────────────────────────────────────────────────────
    ("Handloom Cotton Stole", "handloom-cotton-stole", "accessories",
     2490, None, 52, "Handloom Cotton", "Single", None, ["Ivory", "Indigo", "Rust", "Olive"],
     False, 4.5, 58,
     ["photo-1618375569909-3c8616cf7733", "photo-1620916566398-39f1143ab7be"],
     "A lightweight handloom stole with a hand-knotted fringe. Wide enough to wear as a dupatta."),

    ("Block Print Tote", "block-print-tote", "accessories",
     1890, 2490, 64, "Cotton Canvas", "Single", None, ["Ivory", "Navy"],
     False, 4.4, 92,
     ["photo-1620916566398-39f1143ab7be", "photo-1608248543803-ba4f8c70ae0b"],
     "A heavy canvas tote with a hand-blocked panel, an inner pocket and shoulder-length handles."),

    ("Enamel Jhumka Earrings", "enamel-jhumka-earrings", "accessories",
     3490, None, 27, "Brass & Enamel", "Pair", None, ["Mustard", "Jade", "Maroon"],
     False, 4.6, 41,
     ["photo-1608248543803-ba4f8c70ae0b", "photo-1615397349754-cfa2066a298e"],
     "Hand-painted enamel over cast brass, with a hypoallergenic post. Light enough for all day."),
]

# The electronics demo rows this catalogue replaces
LEGACY_CATEGORY_IDS = [
    "11111111-1111-1111-1111-111111111111",
    "22222222-2222-2222-2222-222222222222",
    "33333333-3333-3333-3333-333333333333",
    "44444444-4444-4444-4444-444444444444",
]


def build():
    out = []
    add = out.append

    add("-- " + "=" * 76)
    add("-- AASHNA — clothing catalogue")
    add("--")
    add("-- Adds the apparel columns the storefront reads, clears the electronics")
    add("-- demo rows, and seeds categories and products priced in PKR.")
    add("-- Safe to re-run: every statement is idempotent.")
    add("-- " + "=" * 76)
    add("")

    add("-- ----------------------------------------------------------------------")
    add("-- 1. Apparel columns")
    add("-- ----------------------------------------------------------------------")
    add("ALTER TABLE public.products")
    add("    ADD COLUMN IF NOT EXISTS images           TEXT[],")
    add("    ADD COLUMN IF NOT EXISTS sizes            TEXT[],")
    add("    ADD COLUMN IF NOT EXISTS colors           TEXT[],")
    add("    ADD COLUMN IF NOT EXISTS fabric           TEXT,")
    add("    ADD COLUMN IF NOT EXISTS pieces           TEXT,")
    add("    ADD COLUMN IF NOT EXISTS compare_at_price NUMERIC(10, 2)")
    add("        CHECK (compare_at_price IS NULL OR compare_at_price >= 0);")
    add("")

    add("-- ----------------------------------------------------------------------")
    add("-- 2. Retire the electronics demo catalogue")
    add("--    Products referenced by a placed order are left alone (order_items")
    add("--    is ON DELETE RESTRICT), so this never breaks order history.")
    add("-- ----------------------------------------------------------------------")
    add("DELETE FROM public.products p")
    add(" WHERE p.category_id IN (")
    add("           " + ",\n           ".join(f"'{cid}'::uuid" for cid in LEGACY_CATEGORY_IDS))
    add("       )")
    add("   AND NOT EXISTS (")
    add("           SELECT 1 FROM public.order_items oi WHERE oi.product_id = p.id")
    add("       );")
    add("")
    add("DELETE FROM public.categories c")
    add(" WHERE c.id IN (")
    add("           " + ",\n           ".join(f"'{cid}'::uuid" for cid in LEGACY_CATEGORY_IDS))
    add("       )")
    add("   AND NOT EXISTS (")
    add("           SELECT 1 FROM public.products p WHERE p.category_id = c.id")
    add("       );")
    add("")

    add("-- ----------------------------------------------------------------------")
    add("-- 3. Categories")
    add("-- ----------------------------------------------------------------------")
    add("INSERT INTO public.categories (id, name, slug, description, image_url) VALUES")
    rows = []
    for cid, name, slug, desc, image in CATEGORIES:
        rows.append(
            f"    ('{cid}'::uuid, {q(name)}, {q(slug)}, {q(desc)}, {q(U.format(image))})"
        )
    add(",\n".join(rows))
    add("ON CONFLICT (slug) DO UPDATE SET")
    add("    name        = EXCLUDED.name,")
    add("    description = EXCLUDED.description,")
    add("    image_url   = EXCLUDED.image_url,")
    add("    updated_at  = timezone('utc'::text, now());")
    add("")

    add("-- ----------------------------------------------------------------------")
    add("-- 4. Products")
    add("-- ----------------------------------------------------------------------")
    add("INSERT INTO public.products (")
    add("    category_id, name, slug, description, price, compare_at_price, stock,")
    add("    image_url, images, sizes, colors, fabric, pieces,")
    add("    is_featured, rating, reviews_count")
    add(") VALUES")

    rows = []
    for (name, slug, cat, price, compare, stock, fabric, pieces, sizes, colors,
         featured, rating, reviews, images, desc) in PRODUCTS:
        urls = [U.format(i) for i in images]
        rows.append(
            "    (\n"
            f"        '{CAT[cat]}'::uuid,\n"
            f"        {q(name)},\n"
            f"        {q(slug)},\n"
            f"        {q(desc)},\n"
            f"        {price}, {q(compare)}, {stock},\n"
            f"        {q(urls[0])},\n"
            f"        {q(urls)},\n"
            f"        {q(sizes)},\n"
            f"        {q(colors)},\n"
            f"        {q(fabric)}, {q(pieces)},\n"
            f"        {q(featured)}, {rating}, {reviews}\n"
            "    )"
        )
    add(",\n".join(rows))
    add("ON CONFLICT (slug) DO UPDATE SET")
    add("    category_id      = EXCLUDED.category_id,")
    add("    name             = EXCLUDED.name,")
    add("    description      = EXCLUDED.description,")
    add("    price            = EXCLUDED.price,")
    add("    compare_at_price = EXCLUDED.compare_at_price,")
    add("    stock            = EXCLUDED.stock,")
    add("    image_url        = EXCLUDED.image_url,")
    add("    images           = EXCLUDED.images,")
    add("    sizes            = EXCLUDED.sizes,")
    add("    colors           = EXCLUDED.colors,")
    add("    fabric           = EXCLUDED.fabric,")
    add("    pieces           = EXCLUDED.pieces,")
    add("    is_featured      = EXCLUDED.is_featured,")
    add("    rating           = EXCLUDED.rating,")
    add("    reviews_count    = EXCLUDED.reviews_count,")
    add("    updated_at       = timezone('utc'::text, now());")
    add("")

    return "\n".join(out) + "\n"


if __name__ == "__main__":
    target = Path(__file__).resolve().parent.parent / "clothing_seed.sql"
    target.write_text(build(), encoding="utf-8")
    print(f"wrote {target} ({len(PRODUCTS)} products, {len(CATEGORIES)} categories)")
