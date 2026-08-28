<div align="center">

<br/>

# A A S H N A

**P A K I S T A N I &nbsp; P R E T &nbsp; · &nbsp; F A B R I C S &nbsp; · &nbsp; F E S T I V E**

<br/>

An editorial, image-led storefront for a Pakistani clothing house —<br/>
unstitched lawn, ready-to-wear pret, festive formals, menswear, kids,<br/>
home textiles, fragrance and accessories.

<br/>

<img src="https://img.shields.io/badge/Next.js-15-1B1A18?style=flat-square&labelColor=1B1A18&color=97452F" alt="Next.js 15" />
<img src="https://img.shields.io/badge/React-19-1B1A18?style=flat-square&labelColor=1B1A18&color=97452F" alt="React 19" />
<img src="https://img.shields.io/badge/TypeScript-strict-1B1A18?style=flat-square&labelColor=1B1A18&color=97452F" alt="TypeScript" />
<img src="https://img.shields.io/badge/Tailwind-v4-1B1A18?style=flat-square&labelColor=1B1A18&color=97452F" alt="Tailwind v4" />
<img src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-1B1A18?style=flat-square&labelColor=1B1A18&color=97452F" alt="Supabase" />

<br/><br/>

<img src="docs/banner.jpg" alt="AASHNA storefront homepage" width="100%" />

</div>

---

## The store

The design follows the structure and visual language of Pakistani retail —
[pk.khaadi.com](https://pk.khaadi.com/) as the reference point. That means an
announcement marquee over a utility bar, a centred serif wordmark, a hover
mega-menu, full-bleed editorial photography, square corners, and prices in
`PKR 7,000` form.

| | |
| :-- | :-- |
| **Home** | Hero carousel, category tiles, New In, split editorial panels, Bestsellers, wide banner, house promises, community grid |
| **Collection** | `/shop` — banner, breadcrumb, sticky filter rail (category · size · colour · price · fabric), mobile slide-over, sort menu, 4-up grid |
| **Product** | `/shop/[id]` — thumbnail gallery, colourway and size selection, size-guide dialog, service promises, detail accordions |
| **Bag** | Slide-over with a free-delivery progress bar and an inline delivery-details step |
| **Editorial** | `/about` and `/contact` — story, milestones, store locator, FAQs |
| **Account** | `/signin` and `/signup` — split editorial layout over Supabase Auth |

<br/>

<div align="center">
  <img src="docs/about.jpg" alt="The About page, showing the editorial type treatment" width="100%" />
</div>

---

## Quick start

**Requires** Node 18.18+ and a Supabase project.

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase URL and anon key
npm run dev
```

`.env.local` needs two values, both from **Supabase → Project Settings → API**:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Then seed the catalogue

Run [`ecommerce_schema.sql`](ecommerce_schema.sql) first if the database is
empty, then run [`clothing_seed.sql`](clothing_seed.sql) — both in the
**Supabase SQL editor**. The seed:

1. adds the apparel columns — `images`, `sizes`, `colors`, `fabric`, `pieces`, `compare_at_price`;
2. retires the electronics demo rows, leaving alone anything referenced by a placed order;
3. inserts **8 categories and 30 products** priced in PKR.

It is idempotent — re-running refreshes the catalogue in place.

> **Before the seed runs the site still works.** Every apparel field is
> optional, and `lib/product-attributes.ts` fills in sensible defaults — a
> standard size run, placeholder colourways — for any product missing them.

To change the catalogue, edit [`scripts/gen_clothing_seed.py`](scripts/gen_clothing_seed.py)
and re-run it. The `.sql` file is generated output.

---

## Design system

All tokens live in [`app/globals.css`](app/globals.css).

<div align="center">
  <img src="docs/palette.png" alt="Colour palette" width="100%" />
</div>

<br/>

| | |
| :-- | :-- |
| **Display** | Cormorant Garamond — headings, hero, prices |
| **UI** | Jost — navigation, labels, body, product names |
| **Corners** | Square. Only badges, swatches and the bag count are round. |
| **Buttons** | `.btn-ink` / `.btn-outline` — uppercase, `0.16em` tracking, no radius |
| **Micro-labels** | `.eyebrow` — 10px, `0.22em` tracking, uppercase. The workhorse of the whole site. |
| **Accent use** | `clay` for links and hover; `sale` red reserved strictly for markdowns |

Utility classes worth knowing: `.link-rule` (underline wipes in on hover),
`.img-swap` (product image cross-fade), `.marquee-track`, `.swatch`,
`.rule-heading`.

---

## Project structure

```
app/
  page.tsx              home — hero, categories, New In, editorial, bestsellers
  shop/page.tsx         collection listing with filters and sort
  shop/[id]/page.tsx    product detail
  about/  contact/      editorial pages
  signin/  signup/      auth, over Supabase
  api/checkout/         order placement, price-verified server-side
components/
  layout/               Header (mega-menu, search overlay), SectionHeading
  home/                 HeroCarousel
  products/             ProductCard, QuickAdd, ProductGallery, ProductOptions,
                        CategoryFilter, SortMenu, SizeGuideDialog, …
  cart/CartDrawer.tsx   bag + delivery details + confirmation
  auth/AuthShell.tsx    split editorial layout shared by sign in / register
lib/
  constants.ts          brand, mega-menu tree, size runs, colour swatches
  format.ts             currency formatting
  pricing.ts            delivery thresholds and order totals
  imagery.ts            verified editorial photography ids
  product-attributes.ts fallbacks for optional apparel columns
  api/products.ts       Supabase queries
  supabase/             browser / server / middleware clients
scripts/                catalogue and README asset generators
```

---

## Commerce logic

**Currency** — [`lib/format.ts`](lib/format.ts). `formatPrice(7000)` → `PKR 7,000`.
Changing the `CURRENCY` constant re-denominates the entire store.

**Order maths** — [`lib/pricing.ts`](lib/pricing.ts). Free delivery above
PKR 3,000, otherwise PKR 250. Shelf prices are GST-inclusive, so no tax line is
added at checkout. The cart drawer and `app/api/checkout/route.ts` both import
from here, so the total a customer sees is the total that gets recorded.

**Cart variants** — lines are keyed by product *and* variant
(`productId::size::colour`), so the same kurta in two sizes is two rows. Stock
is held per product, so quantity is capped against every line of that product
combined. The checkout API works per product, so `CartDrawer` merges lines by
`productId` before posting.

**Security** — the checkout route re-reads prices and stock from the database
and calls `supabase.auth.getUser()` before writing. Nothing about an order is
trusted from the client.

---

## Imagery

Editorial photography ids live in [`lib/imagery.ts`](lib/imagery.ts). Every id
has been checked to return `200` from `images.unsplash.com` — a dead id renders
as an empty tile, so verify before adding one.

README images are generated:

```bash
python scripts/gen_readme_assets.py banner=<screenshot.png> about=<screenshot.png>
```

The palette strip is drawn from the token list in that script, so it cannot
drift from the CSS.

---

## Scripts

| | |
| :-- | :-- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `python scripts/gen_clothing_seed.py` | Regenerate `clothing_seed.sql` |
| `python scripts/gen_readme_assets.py` | Regenerate the README images |

---

<div align="center">
<br/>

**A A S H N A**

<sub>Product photography from Unsplash. Brand, copy and catalogue are fictional.</sub>

</div>
