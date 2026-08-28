# AASHNA — storefront design notes

The store is designed as a Pakistani clothing retailer (pret, unstitched fabric,
festive formals, menswear, kids, home textiles, fragrance and accessories),
following the structure and visual language of [pk.khaadi.com](https://pk.khaadi.com/).

## One required step: seed the catalogue

The database still holds the original electronics demo rows. Run
[`clothing_seed.sql`](clothing_seed.sql) in the **Supabase SQL editor** to:

1. add the apparel columns (`images`, `sizes`, `colors`, `fabric`, `pieces`,
   `compare_at_price`),
2. remove the electronics demo categories and products (rows referenced by a
   placed order are left untouched),
3. insert 8 categories and 30 products priced in PKR.

The script is idempotent — re-running it refreshes the catalogue in place. To
change the catalogue, edit `scripts/gen_clothing_seed.py` and re-run it; the SQL
file is generated output.

Until the seed is applied the site renders correctly but shows the old
electronics products: every apparel field is optional, and
`lib/product-attributes.ts` fills in sensible defaults (standard size run,
placeholder colourways) when a column is missing.

## Design system

Tokens live in `app/globals.css`.

| | |
|---|---|
| Display type | Cormorant Garamond — headings, prices, hero |
| UI type | Jost — nav, labels, body, product names |
| Ink | `#1b1a18` on white, with `cream` / `sand` section grounds |
| Accent | `clay` `#97452f`; `sale` red `#b02318` reserved for markdowns |
| Corners | Square. Only badges and swatches are round. |
| Buttons | `.btn-ink` / `.btn-outline` — uppercase, letter-spaced, no radius |
| Micro-labels | `.eyebrow` (10px, 0.22em tracking) — used everywhere |

Currency and order maths are centralised:

- `lib/format.ts` — `formatPrice(7000)` → `PKR 7,000`. Change `CURRENCY` to
  re-denominate the whole store.
- `lib/pricing.ts` — free delivery above PKR 3,000, otherwise PKR 250. Prices
  are GST-inclusive, so no tax line is added. The cart drawer and
  `app/api/checkout/route.ts` both import from here, so the total a customer
  sees is the total that gets recorded.

## Structure

- **Header** (`components/layout/Header.tsx`) — announcement marquee, utility
  bar, centred wordmark, and a hover mega-menu driven by `NAV_ITEMS` in
  `lib/constants.ts`. Editing that array restructures the whole navigation.
- **Home** — hero carousel, category tiles, New In, split editorial, Bestsellers,
  wide banner, house promises, community grid.
- **Collection** (`/shop`) — banner, breadcrumb, sticky filter rail
  (category / size / colour / price / fabric) with a mobile slide-over, sort
  menu, 4-up grid.
- **Product** (`/shop/[id]`) — thumbnail gallery, colourway and size selection
  with a size-guide dialog, service promises, and detail accordions.
- **Bag** — a slide-over with a free-delivery progress bar and an inline
  delivery-details step.

## Cart variants

Cart lines are keyed by product **and** variant (`productId::size::colour`), so
the same kurta in two sizes is two rows. Stock is held per product, so quantity
is capped against every line of that product combined. The checkout API works
per product, so `CartDrawer` merges lines by `productId` before posting.

## Imagery

Editorial photography ids live in `lib/imagery.ts`. Every id has been checked to
return 200 from `images.unsplash.com` — a dead id renders as an empty tile, so
verify before adding one.
