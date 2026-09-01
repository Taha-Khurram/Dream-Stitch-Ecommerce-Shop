<div align="center">

<br/>

# D R E A M &nbsp; S T I T C H

**B Y &nbsp; S K**

<br/>

**P U R E &nbsp; C O T T O N &nbsp; · &nbsp; C O T T O N &nbsp; Z E E N &nbsp; · &nbsp; C O T T O N &nbsp; S A T I N**

<br/>

A white-and-purple storefront for a premium bedsheet house —<br/>
king and single sets in three cotton weaves, and any size at all<br/>
cut to the customer's own measurements.

<br/>

<img src="https://img.shields.io/badge/Next.js-15-2A1B33?style=flat-square&labelColor=2A1B33&color=5E2B8A" alt="Next.js 15" />
<img src="https://img.shields.io/badge/React-19-2A1B33?style=flat-square&labelColor=2A1B33&color=5E2B8A" alt="React 19" />
<img src="https://img.shields.io/badge/TypeScript-strict-2A1B33?style=flat-square&labelColor=2A1B33&color=5E2B8A" alt="TypeScript" />
<img src="https://img.shields.io/badge/Tailwind-v4-2A1B33?style=flat-square&labelColor=2A1B33&color=5E2B8A" alt="Tailwind v4" />
<img src="https://img.shields.io/badge/Supabase-Postgres%20%2B%20Auth-2A1B33?style=flat-square&labelColor=2A1B33&color=5E2B8A" alt="Supabase" />

<br/><br/>

<img src="docs/banner.jpg" alt="Dream Stitch storefront homepage" width="100%" />

</div>

---

## The store

Four destinations — **Shop · Custom Orders · About · Contact** — in a single
56px bar. Everything else (fabrics, bed sizes, the sale) lives in the Shop
dropdown, so the bar stays short without stranding a route. *Custom Orders*
earns its top-level slot because made-to-measure is the one thing the high
street cannot match.

| | |
| :-- | :-- |
| **Home** | Hero carousel, three fabric tiles, New In, Bestsellers, custom-demand band, house promises, service strip, newsletter |
| **Collection** | `/shop` — banner, breadcrumb, sticky filter rail (fabric · bed size · price), mobile slide-over, sort menu, 4-up grid |
| **Product** | `/shop/[id]` — thumbnail gallery, colourway and bed-size selection, size-guide dialog, service promises, detail accordions |
| **Custom** | `/custom` — how it works, measuring guide, standard-size table, measurement request form |
| **Bag** | Slide-over with a free-delivery progress bar and an inline delivery-details step |
| **Wishlist** | `/wishlist` — saved sets, kept in the browser, no account needed |
| **Editorial** | `/about` and `/contact` — story, milestones, stockists, FAQs |
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
empty, then run [`bedding_seed.sql`](bedding_seed.sql) — both in the
**Supabase SQL editor**. The seed:

1. adds the bedding columns — `images`, `sizes`, `colors`, `fabric`, `pieces`, `compare_at_price`;
2. retires the earlier demo rows, leaving alone anything referenced by a placed order;
3. inserts **3 categories and 19 products** priced in PKR, including two made-to-order sets.

It is idempotent — re-running refreshes the catalogue in place.

> **Already have a catalogue you want to keep?** Run
> [`products_bedding_columns.sql`](products_bedding_columns.sql) instead. It is
> step 1 above on its own — the columns, no delete-and-reinsert. Skipping it is
> what produces `Could not find the 'compare_at_price' column of 'products' in
> the schema cache` when saving a product in `/admin`.

> **Before the seed runs the site still works.** Every bedding field is
> optional, and `lib/product-attributes.ts` fills in sensible defaults — a
> standard bed-size run, placeholder colourways — for any product missing them.

To change the catalogue, edit [`scripts/gen_bedding_seed.py`](scripts/gen_bedding_seed.py)
and re-run it. The `.sql` file is generated output.

---

## Admin panel

`/admin` — catalogue, orders and store settings. Run
[`admin_schema.sql`](admin_schema.sql) in the **Supabase SQL editor** after the
seed, then promote yourself:

```sql
-- register through /signup first, then:
UPDATE public.profiles SET role = 'admin' WHERE email = 'you@example.com';
```

No signup path grants admin, and there is no service-role key in the app.
[`product_media_schema.sql`](product_media_schema.sql) goes last — see
[Product media](#product-media) below.

| | |
| :-- | :-- |
| **Dashboard** | Open orders, revenue, product count, low-stock alerts, recent orders |
| **Products** | Search, create, edit, delete. Price, compare-at, stock, sizes, colourways, gallery |
| **Categories** | Inline editing of the three fabrics, with a product count per category |
| **Orders** | Filter by status, view line items and delivery address, move an order through its states |
| **Settings** | Contact details, free-delivery threshold, delivery fee, announcement bar copy |
| **Settings → page tabs** | Copy, imagery and a show/hide switch for every section of the home, shop, custom, about and contact pages, plus what the header and footer carry |

**Security.** RLS is the enforcement point, not the UI. `admin_schema.sql` adds
an `is_admin()` helper (`SECURITY DEFINER`, so the role lookup is not itself
subject to RLS) and gates every catalogue write and order read behind it.
`requireAdmin()` in [`lib/auth/admin.ts`](lib/auth/admin.ts) only buys a clean
redirect — a forged session that slipped past it would still be refused by
Postgres. Mutations run as the signed-in user through server actions in
[`app/(site)/admin/actions.ts`](app/%28site%29/admin/actions.ts), so there is
one security model to audit.

**What settings actually drive.** Saving is not cosmetic: the delivery
threshold and fee feed the cart's progress bar, the product-page promise and
the total recorded by `app/api/checkout/route.ts`; contact details render in the
footer; announcement lines feed the strip above the header.

**Page content.** The tabs beside *General* edit
`store_settings.content`, a single jsonb document merged over the defaults in
[`lib/content/defaults.ts`](lib/content/defaults.ts) — which stay the fallback,
so the storefront renders unchanged before the column exists or after a row is
emptied. Each tab covers one surface: section switches, headings, body copy,
button labels and links, image URLs, and repeatable lists (hero slides,
promises, steps, FAQs, footer and navigation links). *Restore defaults* puts one
tab back to what the app ships with.

---

## Product media

[`product_media_schema.sql`](product_media_schema.sql) adds a public
`product-media` bucket and a `product_media` table that records what is in it.
Run it in the **Supabase SQL editor** after `admin_schema.sql`.

**The uploaded file is the master.** Nothing on the way in compresses,
re-encodes or resizes — what lands in the bucket is the photographer's
original, byte for byte. Display sizes are asked for at read time from
Supabase's render endpoint, so producing a thumbnail costs the original
nothing. `productMediaSrc()` in
[`lib/supabase/storage.ts`](lib/supabase/storage.ts) makes the choice: a sized
rendering for an image, the master for a video.

| | |
| :-- | :-- |
| **Bucket** | 100 MB ceiling and a MIME allow-list enforced by storage-api itself — jpeg, png, webp, avif; mp4, webm, mov |
| **Keys** | `products/{product-id}/{timestamp}-{name}` for product shots, `site/{field}/…` for storefront chrome. Both shapes are pinned by the storage policy, and an object key is immutable — a replaced shot is a new key, which makes a year-long cache header safe |
| **Transport** | one XHR request up to 6 MB; TUS in 6 MB chunks above it and for all video, fingerprinted on the object key so a dropped connection resumes instead of restarting a 90 MB clip. Four files in flight at once in the media library. tus-js-client loads on demand, not into every admin page |
| **Atomicity** | a `product_media` row is written only once its object commits, and a failed insert deletes the object rather than orphan it in the bucket |
| **Primary shot** | a partial unique index permits one per product, and a trigger demotes the incumbent — so "set as primary" stays a single `UPDATE` |
| **Writes** | RLS on both `storage.objects` and `product_media`, through `can_manage_product_media()`, which already accepts a future `seller` role |

Image transformations are a paid-plan feature — on the free tier the render URL
returns 400 — which is why `productMediaSrc()` takes a `transform` flag that can
be switched off project-wide from one place.

**Where uploading lives.** Two controls, because the storefront reads two
different things:

| | |
| :-- | :-- |
| **Every image field** | The settings tabs (`kind: "image"` fields and repeater image columns), the category editor, and the product form's *Images* list. [`MediaField`](components/admin/MediaField.tsx) keeps the URL box — paste still works — and adds click-or-drop upload with a thumbnail and progress. Images only: these values end up in `<img>` tags, and an `.mp4` there is a broken tile |
| **Media library** | [`ProductMediaUploader`](components/admin/ProductMediaUploader.tsx) below the product form on `/admin/products/[id]`: multi-file, video, resumable, per-file progress, cancel/retry, writing `product_media` rows. This is where footage and full-resolution masters go |

The storefront gallery still renders the `images` text array, so an uploaded
image shows up there immediately; pointing the gallery at `product_media` — and
with it video on the product page — is the next step.

---

## Design system

All tokens live in [`app/globals.css`](app/globals.css).

<div align="center">
  <img src="docs/palette.png" alt="Colour palette" width="100%" />
</div>

<br/>

The colour budget is roughly **85 / 10 / 5** — white and near-white surfaces,
plum ink for type, and true purple reserved for things that actually *do*
something. If a purple element cannot be clicked, question it.

| | |
| :-- | :-- |
| **Display** | Prata — headings, hero, prices |
| **UI** | Jost — navigation, labels, body, product names |
| **Corners** | Square. Only badges, swatches and the bag count are round. |
| **Buttons** | `.btn-primary` / `.btn-outline` — uppercase, `0.16em` tracking, no radius |
| **Micro-labels** | `.eyebrow` — 10px, `0.22em` tracking, uppercase. The workhorse of the whole site. |
| **Accent use** | `purple` for primary buttons, links, active filters and the cart badge; `lilac` as the only section fill; `sale` red reserved strictly for markdowns |
| **Neutrals** | Plum-biased, never pure black — `ink` is `#2a1b33`, so type reads as part of the palette |

Utility classes worth knowing: `.link-rule` (underline wipes in on hover),
`.img-swap` (product image cross-fade), `.marquee-track`, `.swatch`,
`.rule-heading`.

---

## Project structure

Routes are split by route group: `(site)` carries the header and footer,
`(auth)` gets the split editorial shell instead.

```
app/
  layout.tsx            root shell — fonts, metadata, Speed Insights
  (site)/
    page.tsx            home — hero, fabrics, New In, bestsellers, promises
    shop/page.tsx       collection listing with filters and sort
    shop/[id]/page.tsx  product detail
    custom/page.tsx     made-to-measure service and measurement request
    wishlist/           saved sets, held in the browser
    about/  contact/    editorial pages
    admin/              the panel: dashboard, products, categories,
                        orders, settings, and the server actions behind them
  (auth)/               signin, signup — over Supabase Auth
  auth/                 OAuth callback and email-confirmation routes
  api/checkout/         order placement, price-verified server-side
components/
  layout/               Header (one-row bar, mega panel, search overlay),
                        Section (vertical rhythm), SectionHeading, SiteFooter
  home/                 HeroCarousel, FabricCarousel, HomeClosing
  admin/                ActionForm, ProductForm, ProductMediaUploader,
                        CategoryEditor, ContentEditor, Repeater,
                        OrderStatusControl, StatusPill, AdminNav
  products/             ProductCard, QuickAdd, ProductGallery, ProductOptions,
                        FilterPanel, SortMenu, SizeGuideDialog, WishlistGrid, …
  cart/CartDrawer.tsx   bag + delivery details + confirmation
  auth/AuthShell.tsx    split editorial layout shared by sign in / register
  motion/               ScrollReveal, RouteProgress, BackToTop, Skeleton
lib/
  constants.ts          brand, navigation tree, bed sizes, colour swatches
  auth/admin.ts         admin gate for the panel
  api/                  product, settings and page-content queries
  content/              default page copy, the field schema behind the
                        settings tabs, and the merge over the defaults
  format.ts             currency formatting
  pricing.ts            delivery thresholds and order totals
  imagery.ts            verified editorial photography ids
  product-attributes.ts fallbacks for optional bedding columns
  supabase/             browser / server / middleware clients, plus the
                        media bucket contract and its upload transport
scripts/                catalogue and README asset generators
```

Legacy paths redirect rather than 404: `/products` → `/shop`, `/login` →
`/signin`, `/dashboard` → `/`.

---

## Commerce logic

**Currency** — [`lib/format.ts`](lib/format.ts). `formatPrice(7000)` → `PKR 7,000`.
Changing the `CURRENCY` constant re-denominates the entire store.

**Order maths** — [`lib/pricing.ts`](lib/pricing.ts). Free delivery above
PKR 5,000, otherwise PKR 250. Shelf prices are GST-inclusive, so no tax line is
added at checkout. The cart drawer and `app/api/checkout/route.ts` both import
from here, so the total a customer sees is the total that gets recorded.

**Bed sizes** — stocked sets carry `Single` or `King Size`; made-to-order sets
carry `Custom Size` and are detected by `isMadeToOrder()` in
[`lib/product-attributes.ts`](lib/product-attributes.ts), which switches the
product page from a size run to the Custom Demand flow.

**Cart variants** — lines are keyed by product *and* variant
(`productId::size::colour`), so the same set in two colourways is two rows.
Stock is held per product, so quantity is capped against every line of that
product combined. The checkout API works per product, so `CartDrawer` merges
lines by `productId` before posting.

**Security** — the checkout route re-reads prices and stock from the database
and calls `supabase.auth.getUser()` before writing. Nothing about an order is
trusted from the client.

---

## Imagery

Two sources, and they do not overlap. **Editorial** photography — heroes,
section bands, the about page — is Unsplash, by id, in
[`lib/imagery.ts`](lib/imagery.ts); every id has been checked to return `200`
from `images.unsplash.com`, since a dead id renders as an empty tile.
**Product** photography is uploaded, and lives in the bucket described under
[Product media](#product-media).

README images are generated from full-page screenshots:

```bash
python scripts/gen_readme_assets.py banner=<screenshot.png> about=<screenshot.png>
```

Capture them at 1600 wide with **reduced motion** on — the announcement strip
crossfades and the hero autoplays, so without it a frame lands mid-transition
with two headlines on top of each other. The palette strip needs no input: it
is drawn from the token list inside that script, so it cannot drift from the
CSS.

---

## Scripts

| | |
| :-- | :-- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint, via `eslint-config-next` |
| `python scripts/gen_bedding_seed.py` | Regenerate `bedding_seed.sql` |
| `python scripts/gen_readme_assets.py` | Regenerate the README images |

---

<div align="center">

<br/>

**D R E A M &nbsp; S T I T C H &nbsp; B Y &nbsp; S K**

<sub>Premium bedsheets, made to fit.</sub>

<br/>

</div>
