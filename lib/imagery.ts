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
  heroLawn: "photo-1610030469983-98e550d6193c",
  heroFestive: "photo-1617922001439-4a2e6562f328",
  heroPret: "photo-1594633312681-425c7b97ccd1",

  catReadyToWear: "photo-1583744946564-b52ac1c389c8",
  catFabrics: "photo-1595777457583-95e059d581b8",
  catFestive: "photo-1611601322175-ef8ec8c85f01",
  catMen: "photo-1602810318383-e386cc2a3ccf",
  catKids: "photo-1596755094514-f87e34085b2c",
  catHome: "photo-1591369822096-ffd140ec948f",
  catFragrance: "photo-1571908599407-cdb918ed83bf",
  catAccessories: "photo-1618375569909-3c8616cf7733",

  editorialUnstitched: "photo-1609505848912-b7c3b8b4beda",
  editorialPret: "photo-1585487000160-6ebcfceb0d03",
  editorialWide: "photo-1544441893-675973e31985",
  editorialCraft: "photo-1601924994987-69e26d50dc26",
  editorialStitching: "photo-1617137968427-85924c800a22",

  lookbook: [
    "photo-1490481651871-ab68de25d43d",
    "photo-1483985988355-763728e1935b",
    "photo-1445205170230-053b83016050",
    "photo-1469334031218-e382a71b716b",
    "photo-1594938298603-c8148c4dae35",
    "photo-1512436991641-6745cdb1723f",
  ],

  storyAtelier: "photo-1519741497674-611481863552",
  storyArtisan: "photo-1620799140408-edc6dcb6d633",
  storyFabric: "photo-1523381210434-271e8be1f52b",
} as const;
