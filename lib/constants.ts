/**
 * Storefront-wide catalogue constants: the navigation tree, bed-size runs and
 * colourway swatches. Kept out of the database so the navigation can be
 * restructured without a migration.
 */

export const BRAND = {
  name: "Dream Stitch",
  suffix: "By Sk",
  tagline: "Premium Bedsheets, Made to Fit",
  email: "care@dreamstitch.pk",
  phone: "+92 21 111 373 848",
  whatsapp: "+92 300 373 8480",
  address: "Plot 42, Textile Avenue, S.I.T.E. Industrial Area, Karachi, Pakistan",
} as const;

export interface NavItem {
  name: string;
  href: string;
  accent?: boolean;
}

/**
 * Four plain links, no dropdowns. Fabrics and bed sizes are reachable from the
 * shop filter rail and the footer, so nothing here needs a mega panel to be
 * findable.
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

export const COLOR_SWATCHES: Record<string, string> = {
  White: "#ffffff",
  Ivory: "#f4efe6",
  Pearl: "#f1eef5",
  Lilac: "#cbb9e4",
  Lavender: "#b39ddb",
  Orchid: "#9a6fc4",
  Plum: "#5e2b8a",
  Aubergine: "#3d1c56",
  Blush: "#e6c3cd",
  Rose: "#c98a99",
  Sage: "#a8b8a2",
  Teal: "#3d6f72",
  Indigo: "#33406b",
  Navy: "#22304a",
  Slate: "#6f6b78",
  Charcoal: "#39343f",
  Graphite: "#2a1b33",
  Sand: "#ddd0bd",
  Mustard: "#c9962f",
  Terracotta: "#a8512c",
};

export function swatchHex(name: string): string {
  return COLOR_SWATCHES[name] ?? "#cfc6d8";
}

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
