/**
 * Storefront-wide catalogue constants: the navigation tree, bed-size runs and
 * fabric list. Kept out of the database so the navigation can be restructured
 * without a migration.
 */

export const BRAND = {
  name: "Dream Stitch",
  suffix: "By Sk",
  tagline: "Premium Bedsheets, Made to Fit",
  email: "care@dreamstitch.pk",
  phone: "03331166929",
  whatsapp: "+92 333 1166929",
  address: "Plot 42, Textile Avenue, S.I.T.E. Industrial Area, Karachi, Pakistan",
} as const;

export interface NavItem {
  name: string;
  href: string;
}

/**
 * Four plain links, no dropdowns. Fabrics and bed sizes are reachable from the
 * shop filter rail and the footer, so nothing here needs a mega panel to be
 * findable.
 *
 * These are the *defaults*: the live list is `header.nav` in the site content,
 * editable at /admin/settings?tab=header.
 */
export const NAV_ITEMS: NavItem[] = [
  { name: "Shop", href: "/shop" },
  { name: "Custom Orders", href: "/custom" },
  { name: "About", href: "/about" },
  { name: "Contact", href: "/contact" },
];

/** Bed sizes carried on every stocked set. */
export const DEFAULT_SIZES = ["Single", "King Size"];

/** Made-to-order sets are cut to the customer's numbers, not to a size run. */
export const CUSTOM_SIZES = ["Custom Size"];

/** Sizes offered in the shop filter rail. */
export const FILTER_SIZES = ["Single", "King Size", "Custom Size"];

/** The three materials the house weaves. */
export const FABRICS = ["Pure Cotton", "Cotton Zeen", "Cotton Satin"];

/**
 * Finished sheet dimensions, not mattress dimensions — the drop is already
 * included, which is the number people actually get wrong.
 */
export const SIZE_GUIDE = [
  {
    size: "Single",
    sheet: '90" x 60"',
    pillow: '30" x 20"',
    fits: "Single mattress up to 42\" wide",
    pieces: "1 sheet + 1 pillow cover",
  },
  {
    size: "King Size",
    sheet: '108" x 96"',
    pillow: '30" x 20"',
    fits: "King mattress up to 78\" wide",
    pieces: "1 sheet + 2 pillow covers",
  },
  {
    size: "Custom Size",
    sheet: "Your measurements",
    pillow: "Your measurements",
    fits: "Any frame, any drop",
    pieces: "Built to your order",
  },
];
