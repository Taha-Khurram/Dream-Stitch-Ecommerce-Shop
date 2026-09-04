"""
Generates `supabase/migrations/bedding_seed.sql` — the bedding migration +
catalogue for the store.

Run with `python scripts/gen_bedding_seed.py` after editing CATEGORIES or
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
    ("d1000000-0000-4000-8000-000000000001", "Pure Cotton", "pure-cotton",
     "Densely woven pure cotton that stays cool through summer and softens with every wash.",
     "photo-1505693416388-ac5ce068fe85"),
    ("d1000000-0000-4000-8000-000000000002", "Cotton Zeen", "cotton-zeen",
     "Smooth, close-woven cotton zeen with a gentle drape and a forgiving, crease-resistant finish.",
     "photo-1631049307264-da0ec9d70304"),
    ("d1000000-0000-4000-8000-000000000003", "Cotton Satin", "cotton-satin",
     "Cotton finished in a satin weave for a low sheen that catches the light without shouting.",
     "photo-1616486338812-3dadae4b4ace"),
]

CAT = {slug: cid for cid, _, slug, _, _ in CATEGORIES}

KING_SET = "1 bedsheet + 2 pillow covers"
SINGLE_SET = "1 bedsheet + 1 pillow cover"
MADE_TO_ORDER = "Made to Order · cut to your measurements"

# name, slug, category, price, compare_at, stock, fabric, pieces, sizes, colors,
# featured, rating, reviews, images[], description
PRODUCTS = [
    # ── Pure Cotton ───────────────────────────────────────────────────────
    ("Sahar Printed Pure Cotton King Bedsheet", "sahar-printed-pure-cotton-king", "pure-cotton",
     6490, 7990, 38, "Pure Cotton", KING_SET, ["King Size"], ["Ivory", "Lilac", "Sage"],
     True, 4.8, 212,
     ["photo-1522771739844-6a9f6d5f14af", "photo-1550581190-9c1c48d21d6c", "photo-1583845112203-29329902332e"],
     "Our everyday king set in 100% pure cotton, printed on a soft ivory ground. Cut with a full drop on both sides so it stays tucked when you turn over, with double-stitched hems and reinforced corners. Breathes through the hottest months and softens rather than thins with every wash."),

    ("Sahar Printed Pure Cotton Single Bedsheet", "sahar-printed-pure-cotton-single", "pure-cotton",
     3490, 4290, 52, "Pure Cotton", SINGLE_SET, ["Single"], ["Ivory", "Lilac", "Sage"],
     False, 4.7, 96,
     ["photo-1616047006789-b7af5afb8c20", "photo-1567016376408-0226e4d0c1ea"],
     "The single-bed version of our best-selling pure cotton set, in the same print and the same weave. Sized for a standard single mattress with a generous drop, finished with one matching pillow cover."),

    ("Neelum Solid Pure Cotton King Bedsheet", "neelum-solid-pure-cotton-king", "pure-cotton",
     5490, None, 44, "Pure Cotton", KING_SET, ["King Size"], ["White", "Pearl", "Slate", "Charcoal"],
     True, 4.9, 178,
     ["photo-1505693416388-ac5ce068fe85", "photo-1615529182904-14819c35db37"],
     "A plain-dyed pure cotton king set for people who would rather the bed stayed quiet. Reactive-dyed so the colour survives the laundry, with a crisp hand on day one that turns soft by the second week."),

    ("Chandni Block Print Pure Cotton King Bedsheet", "chandni-block-print-pure-cotton-king", "pure-cotton",
     7490, 8990, 21, "Pure Cotton", KING_SET, ["King Size"], ["Ivory", "Orchid", "Indigo"],
     True, 4.9, 143,
     ["photo-1594026112284-02bb6f3352fe", "photo-1600121848594-d8644e57abab", "photo-1526170375885-4d8ecf77b99f"],
     "Hand-blocked in small runs, so no two sets carry exactly the same register. Printed on the same pure cotton base we use across the house, then washed once before packing to take the stiffness out and set the colour."),

    ("Roshni Pure Cotton Single Bedsheet", "roshni-pure-cotton-single", "pure-cotton",
     2990, None, 63, "Pure Cotton", SINGLE_SET, ["Single"], ["White", "Blush", "Sage"],
     False, 4.6, 74,
     ["photo-1598928506311-c55ded91a20c", "photo-1505692952047-1a78307da8f2"],
     "A plain, hard-working single set for guest rooms and children's beds. Pure cotton, machine washable, and cheap enough to keep two in the cupboard."),

    ("Bagh Floral Pure Cotton King Bedsheet", "bagh-floral-pure-cotton-king", "pure-cotton",
     6990, None, 29, "Pure Cotton", KING_SET, ["King Size"], ["Ivory", "Rose", "Teal"],
     False, 4.7, 108,
     ["photo-1616137466211-f939a420be84", "photo-1592229505726-ca121723b8ef"],
     "A full-bleed floral drawn in-house and printed edge to edge, so the pattern carries over the drop instead of stopping at the mattress. Pure cotton throughout, with matching pillow covers."),

    # ── Cotton Zeen ───────────────────────────────────────────────────────
    ("Zeen Everyday King Bedsheet", "zeen-everyday-king", "cotton-zeen",
     4990, 5990, 57, "Cotton Zeen", KING_SET, ["King Size"], ["Pearl", "Lavender", "Slate"],
     True, 4.8, 264,
     ["photo-1631049307264-da0ec9d70304", "photo-1616486029423-aaa4789e8c9a"],
     "The set we sell most of. Cotton zeen is close-woven and slightly heavier than plain cotton, which is why it drapes properly over a deep mattress and comes out of the wash without much creasing. Made for households that change the bed on a Sunday and want it to look made."),

    ("Zeen Everyday Single Bedsheet", "zeen-everyday-single", "cotton-zeen",
     2990, 3590, 71, "Cotton Zeen", SINGLE_SET, ["Single"], ["Pearl", "Lavender", "Slate"],
     False, 4.7, 121,
     ["photo-1615873968403-89e068629265", "photo-1616627547584-bf28cee262db"],
     "Our everyday cotton zeen in a single size. Same weave, same forgiving finish, sized for a standard single mattress with one matching pillow cover."),

    ("Mehr Striped Cotton Zeen King Bedsheet", "mehr-striped-cotton-zeen-king", "cotton-zeen",
     5490, 6490, 33, "Cotton Zeen", KING_SET, ["King Size"], ["Pearl", "Orchid", "Navy"],
     True, 4.8, 156,
     ["photo-1611892440504-42a792e24d32", "photo-1616593969747-4797dc75033e"],
     "A woven stripe rather than a printed one, so the line runs through the cloth and cannot wash off. Cotton zeen holds a stripe cleanly without puckering along the hem."),

    ("Sada Solid Cotton Zeen King Bedsheet", "sada-solid-cotton-zeen-king", "cotton-zeen",
     4790, None, 48, "Cotton Zeen", KING_SET, ["King Size"], ["White", "Lilac", "Sage", "Graphite"],
     False, 4.6, 89,
     ["photo-1618220179428-22790b461013", "photo-1600585152220-90363fe7e115"],
     "Plain cotton zeen in four house colours. The quiet option — no print, no border, just an evenly dyed ground and a well-finished hem."),

    ("Noor Geometric Cotton Zeen King Bedsheet", "noor-geometric-cotton-zeen-king", "cotton-zeen",
     5990, None, 26, "Cotton Zeen", KING_SET, ["King Size"], ["Ivory", "Aubergine", "Teal"],
     False, 4.7, 97,
     ["photo-1629949009765-40fc74c9ec21", "photo-1583847268964-b28dc8f51f92"],
     "A small repeating geometric that reads as texture from across the room and as a pattern up close. Printed on cotton zeen, which takes fine detail without bleeding."),

    ("Zeen Crease-Free Single Bedsheet", "zeen-crease-free-single", "cotton-zeen",
     3290, None, 40, "Cotton Zeen", SINGLE_SET, ["Single"], ["White", "Pearl", "Blush"],
     False, 4.5, 62,
     ["photo-1560448204-e02f11c3d0e2", "photo-1503174971373-b1f69850bded"],
     "Finished for minimum creasing, which matters most on a single bed that gets made in a hurry. Cotton zeen, machine washable, ready to use straight off the line."),

    # ── Cotton Satin ──────────────────────────────────────────────────────
    ("Lustre Cotton Satin King Bedsheet", "lustre-cotton-satin-king", "cotton-satin",
     8990, 10990, 24, "Cotton Satin", KING_SET, ["King Size"], ["Pearl", "Lilac", "Charcoal"],
     True, 4.9, 187,
     ["photo-1616486338812-3dadae4b4ace", "photo-1616627561950-9f746e330187", "photo-1522708323590-d24dbb6b0267"],
     "Cotton, finished in a satin weave for a low, liquid sheen that catches the light without shouting. Cool to the touch and noticeably smoother against skin than a plain weave — the set you make the bed with when guests are coming."),

    ("Lustre Cotton Satin Single Bedsheet", "lustre-cotton-satin-single", "cotton-satin",
     5490, None, 31, "Cotton Satin", SINGLE_SET, ["Single"], ["Pearl", "Lilac", "Charcoal"],
     False, 4.8, 73,
     ["photo-1617103996702-96ff29b1c467", "photo-1615874959474-d609969a20ed"],
     "The single version of our cotton satin set. Same weave and the same finish, cut for a standard single mattress."),

    ("Shab Cotton Satin King Bedsheet", "shab-cotton-satin-king", "cotton-satin",
     9490, None, 17, "Cotton Satin", KING_SET, ["King Size"], ["Aubergine", "Plum", "Navy"],
     True, 4.9, 132,
     ["photo-1616594039964-ae9021a400a0", "photo-1493663284031-b7e3aefcae8e"],
     "Our deepest colourway, dyed on cotton satin so the sheen lifts the colour instead of flattening it. Dark sets show every loose thread, so this one is checked twice before it is folded."),

    ("Aab Cotton Satin King Bedsheet", "aab-cotton-satin-king", "cotton-satin",
     8490, 9990, 22, "Cotton Satin", KING_SET, ["King Size"], ["White", "Pearl", "Teal"],
     False, 4.8, 104,
     ["photo-1512918728675-ed5a9ecdebfd", "photo-1519710164239-da123dc03ef4"],
     "A cool, pale cotton satin set for summer. The satin finish keeps it smooth against skin on nights when a heavier weave feels like too much."),

    ("Zeb Embroidered Cotton Satin King Bedsheet", "zeb-embroidered-cotton-satin-king", "cotton-satin",
     12990, 15990, 9, "Cotton Satin", KING_SET, ["King Size"], ["Ivory", "Blush", "Plum"],
     True, 5.0, 48,
     ["photo-1558618666-fcd25c85cd64", "photo-1604709177225-055f99402ea3", "photo-1600585154340-be6161a56a0c"],
     "Our wedding set. Cotton satin with a hand-guided embroidered border along the top sheet and both pillow covers. Made in small numbers and finished slowly — allow a little longer if the colour you want is not in stock."),

    # ── Custom Demand ─────────────────────────────────────────────────────
    ("Custom Size Pure Cotton Bedsheet", "custom-size-pure-cotton", "pure-cotton",
     7490, None, 99, "Pure Cotton", MADE_TO_ORDER, ["Custom Size"], ["White", "Ivory", "Lilac", "Sage", "Charcoal"],
     True, 4.9, 61,
     ["photo-1567016432779-094069958ea5", "photo-1522444195799-478538b28823"],
     "Pure cotton, cut to your bed rather than to a size chart. Send us your mattress width, mattress length and the drop you want on each side, and we will confirm the exact price before anything is cut. Dispatched in 7 to 10 working days. Priced from the figure shown — your final price depends on your measurements."),

    ("Custom Size Cotton Satin Bedsheet", "custom-size-cotton-satin", "cotton-satin",
     10990, None, 99, "Cotton Satin", MADE_TO_ORDER, ["Custom Size"], ["Pearl", "Lilac", "Aubergine", "Navy"],
     False, 4.9, 34,
     ["photo-1631679706909-1844bbd07221", "photo-1502005229762-cf1b2da7c5d6"],
     "Our cotton satin, made to your measurements. Same weave and finish as the stocked sets, cut for a frame no standard size fits. Send three numbers and we will price it the same working day. Dispatched in 7 to 10 working days."),
]

HEADER = """-- ============================================================================
-- DREAM STITCH By Sk — bedding catalogue
--
-- Adds the bedding columns the storefront reads, clears the previous
-- clothing demo rows, and seeds categories and products priced in PKR.
-- Safe to re-run: every statement is idempotent.
--
-- Generated by scripts/gen_bedding_seed.py — edit that file, not this one.
-- ============================================================================

-- ----------------------------------------------------------------------
-- 1. Bedding columns
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
-- 2. Retire the earlier demo catalogues (electronics, then clothing)
--    Products referenced by a placed order are left alone (order_items
--    is ON DELETE RESTRICT), so this never breaks order history.
-- ----------------------------------------------------------------------
DELETE FROM public.products p
 WHERE p.category_id IN (
           '11111111-1111-1111-1111-111111111111'::uuid,
           '22222222-2222-2222-2222-222222222222'::uuid,
           '33333333-3333-3333-3333-333333333333'::uuid,
           '44444444-4444-4444-4444-444444444444'::uuid,
           'c1000000-0000-4000-8000-000000000001'::uuid,
           'c1000000-0000-4000-8000-000000000002'::uuid,
           'c1000000-0000-4000-8000-000000000003'::uuid,
           'c1000000-0000-4000-8000-000000000004'::uuid,
           'c1000000-0000-4000-8000-000000000005'::uuid,
           'c1000000-0000-4000-8000-000000000006'::uuid,
           'c1000000-0000-4000-8000-000000000007'::uuid,
           'c1000000-0000-4000-8000-000000000008'::uuid
       )
   AND NOT EXISTS (
           SELECT 1 FROM public.order_items oi WHERE oi.product_id = p.id
       );

DELETE FROM public.categories c
 WHERE c.id IN (
           '11111111-1111-1111-1111-111111111111'::uuid,
           '22222222-2222-2222-2222-222222222222'::uuid,
           '33333333-3333-3333-3333-333333333333'::uuid,
           '44444444-4444-4444-4444-444444444444'::uuid,
           'c1000000-0000-4000-8000-000000000001'::uuid,
           'c1000000-0000-4000-8000-000000000002'::uuid,
           'c1000000-0000-4000-8000-000000000003'::uuid,
           'c1000000-0000-4000-8000-000000000004'::uuid,
           'c1000000-0000-4000-8000-000000000005'::uuid,
           'c1000000-0000-4000-8000-000000000006'::uuid,
           'c1000000-0000-4000-8000-000000000007'::uuid,
           'c1000000-0000-4000-8000-000000000008'::uuid
       )
   AND NOT EXISTS (
           SELECT 1 FROM public.products p WHERE p.category_id = c.id
       );
"""


def build():
    out = [HEADER]

    out.append("""
-- ----------------------------------------------------------------------
-- 3. Categories
-- ----------------------------------------------------------------------
INSERT INTO public.categories (id, name, slug, description, image_url) VALUES""")

    rows = []
    for cid, name, slug, desc, image in CATEGORIES:
        rows.append(
            "    ({}::uuid, {}, {}, {}, {})".format(
                q(cid), q(name), q(slug), q(desc), q(U.format(image))
            )
        )
    out.append(",\n".join(rows))
    out.append("""ON CONFLICT (slug) DO UPDATE SET
    name        = EXCLUDED.name,
    description = EXCLUDED.description,
    image_url   = EXCLUDED.image_url,
    updated_at  = NOW();
""")

    out.append("""
-- ----------------------------------------------------------------------
-- 4. Products
-- ----------------------------------------------------------------------
INSERT INTO public.products (
    category_id, name, slug, description, price, compare_at_price, stock,
    image_url, images, sizes, colors, fabric, pieces,
    is_featured, rating, reviews_count
) VALUES""")

    rows = []
    for (name, slug, cat, price, compare_at, stock, fabric, pieces, sizes,
         colors, featured, rating, reviews, images, description) in PRODUCTS:
        urls = [U.format(i) for i in images]
        rows.append(
            "    (\n"
            "        {}::uuid,\n"
            "        {},\n"
            "        {},\n"
            "        {},\n"
            "        {}, {}, {},\n"
            "        {},\n"
            "        {},\n"
            "        {},\n"
            "        {},\n"
            "        {}, {},\n"
            "        {}, {}, {}\n"
            "    )".format(
                q(CAT[cat]), q(name), q(slug), q(description),
                q(price), q(compare_at), q(stock),
                q(urls[0]), q(urls), q(sizes), q(colors),
                q(fabric), q(pieces), q(featured), q(rating), q(reviews),
            )
        )
    out.append(",\n".join(rows))
    out.append("""ON CONFLICT (slug) DO UPDATE SET
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
    updated_at       = NOW();
""")

    return "\n".join(out)


if __name__ == "__main__":
    target = (
        Path(__file__).resolve().parent.parent
        / "supabase"
        / "migrations"
        / "bedding_seed.sql"
    )
    target.write_text(build(), encoding="utf-8")
    print(
        "Wrote {} — {} categories, {} products".format(
            target.name, len(CATEGORIES), len(PRODUCTS)
        )
    )
