/**
 * Editorial imagery for the storefront chrome (hero slides, category tiles,
 * lookbook strips). Product photography itself comes from the database.
 *
 * Every id below has been checked to resolve on images.unsplash.com — add new
 * ones only after confirming they return 200, since a dead id renders as an
 * empty tile.
 */

const BASE = "https://images.unsplash.com";

/** Build a sized, quality-capped Unsplash URL. */
export function img(id: string, width = 1200, quality = 80): string {
  return `${BASE}/${id}?w=${width}&q=${quality}&auto=format&fit=crop`;
}

export const IMG = {
  heroCotton: "photo-1522771739844-6a9f6d5f14af",
  heroSatin: "photo-1616627561950-9f746e330187",
  heroCustom: "photo-1560185127-6ed189bf02f4",

  catPureCotton: "photo-1505693416388-ac5ce068fe85",
  catCottonZeen: "photo-1631049307264-da0ec9d70304",
  catCottonSatin: "photo-1616486338812-3dadae4b4ace",

  editorialFabric: "photo-1550581190-9c1c48d21d6c",
  editorialCustom: "photo-1567016432779-094069958ea5",
  editorialWide: "photo-1584100936595-c0654b55a2e2",
  editorialCraft: "photo-1521783593447-5702b9bfd267",
  editorialFinish: "photo-1526170375885-4d8ecf77b99f",

  lookbook: [
    "photo-1522708323590-d24dbb6b0267",
    "photo-1540518614846-7eded433c457",
    "photo-1595526114035-0d45ed16cfbf",
    "photo-1617325247661-675ab4b64ae2",
    "photo-1618221195710-dd6b41faaea6",
    "photo-1571508601891-ca5e7a713859",
  ],

  storyAtelier: "photo-1586023492125-27b2c045efd7",
  storyArtisan: "photo-1611048267451-e6ed903d4a38",
  storyFabric: "photo-1583845112203-29329902332e",
} as const;
