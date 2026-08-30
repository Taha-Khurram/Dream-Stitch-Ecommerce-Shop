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

export interface NavColumn {
  title: string;
  href: string;
  links: { name: string; href: string }[];
}

export interface NavItem {
  name: string;
  href: string;
  /** Rendered as a full-width mega panel on hover. */
  columns?: NavColumn[];
  /** Editorial tile pinned to the right of the mega panel. */
  feature?: { label: string; title: string; href: string; image: string };
  accent?: boolean;
}

/**
 * Four destinations, nothing more. Everything that used to sit at the top level
 * — bed sizes, the sale — now lives inside the Shop panel, so the bar stays
 * short without stranding any route.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    name: "Shop",
    href: "/shop",
    columns: [
      {
        title: "By Material",
        href: "/shop",
        links: [
          { name: "Pure Cotton", href: "/shop?category=pure-cotton" },
          { name: "Cotton Zeen", href: "/shop?category=cotton-zeen" },
          { name: "Cotton Satin", href: "/shop?category=cotton-satin" },
        ],
      },
      {
        title: "By Bed Size",
        href: "/shop",
        links: [
          { name: "King Size", href: "/shop?size=King%20Size" },
          { name: "Single Bed", href: "/shop?size=Single" },
          { name: "Custom Size", href: "/custom" },
        ],
      },
      {
        title: "Popular",
        href: "/shop?sort=rating",
        links: [
          { name: "Bestsellers", href: "/shop?sort=rating" },
          { name: "Printed Bedsheets", href: "/shop?search=printed" },
          { name: "Plain & Solid", href: "/shop?search=solid" },
          { name: "Embroidered", href: "/shop?search=embroidered" },
          { name: "Sale", href: "/shop?sale=true" },
        ],
      },
    ],
    feature: {
      label: "Softest We Make",
      title: "Cotton Satin, New Colourways",
      href: "/shop?category=cotton-satin",
      image:
        "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=900&q=80&auto=format&fit=crop",
    },
  },
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
