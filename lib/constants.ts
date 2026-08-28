/**
 * Storefront-wide catalogue constants: the mega-menu tree, size runs and
 * colour swatches. Kept out of the database so the navigation can be
 * restructured without a migration.
 */

export const BRAND = {
  name: "AASHNA",
  tagline: "Pakistani Pret, Fabrics & Festive",
  email: "care@aashna.pk",
  phone: "+92 21 111 927 462",
  address:
    "18th Floor, Ocean Tower, Block 9, Clifton, Karachi, Pakistan",
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

export const NAV_ITEMS: NavItem[] = [
  {
    name: "New In",
    href: "/shop?sort=newest",
    columns: [
      {
        title: "Shop New",
        href: "/shop?sort=newest",
        links: [
          { name: "Ready to Wear", href: "/shop?category=ready-to-wear&sort=newest" },
          { name: "Unstitched Fabrics", href: "/shop?category=fabrics&sort=newest" },
          { name: "Festive Edit", href: "/shop?category=festive&sort=newest" },
          { name: "Everyday Kurtas", href: "/shop?search=kurta&sort=newest" },
        ],
      },
      {
        title: "Collections",
        href: "/shop",
        links: [
          { name: "Sawan Lawn '26", href: "/shop?search=lawn" },
          { name: "Chikankari Edit", href: "/shop?search=chikankari" },
          { name: "Khaas Formals", href: "/shop?category=festive" },
          { name: "Studio Basics", href: "/shop?search=cotton" },
        ],
      },
    ],
    feature: {
      label: "Just Landed",
      title: "Sawan Lawn Vol. I",
      href: "/shop?sort=newest",
      image:
        "https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=900&q=80",
    },
  },
  {
    name: "Ready to Wear",
    href: "/shop?category=ready-to-wear",
    columns: [
      {
        title: "Essentials",
        href: "/shop?category=ready-to-wear",
        links: [
          { name: "1 Piece", href: "/shop?category=ready-to-wear&search=1 piece" },
          { name: "2 Piece", href: "/shop?category=ready-to-wear&search=2 piece" },
          { name: "3 Piece", href: "/shop?category=ready-to-wear&search=3 piece" },
          { name: "Kurta", href: "/shop?category=ready-to-wear&search=kurta" },
        ],
      },
      {
        title: "Signature",
        href: "/shop?category=ready-to-wear&sort=rating",
        links: [
          { name: "Embroidered Kurta", href: "/shop?search=embroidered" },
          { name: "Angrakha", href: "/shop?search=angrakha" },
          { name: "Trousers & Pants", href: "/shop?search=trouser" },
          { name: "Dupattas", href: "/shop?search=dupatta" },
        ],
      },
      {
        title: "Casuals",
        href: "/shop?category=ready-to-wear",
        links: [
          { name: "Shirts", href: "/shop?search=shirt" },
          { name: "Tunics", href: "/shop?search=tunic" },
          { name: "Co-ord Sets", href: "/shop?search=co-ord" },
          { name: "Shalwar", href: "/shop?search=shalwar" },
        ],
      },
    ],
    feature: {
      label: "Signature",
      title: "Hand-worked Pret",
      href: "/shop?category=ready-to-wear",
      image:
        "https://images.unsplash.com/photo-1583744946564-b52ac1c389c8?w=900&q=80",
    },
  },
  {
    name: "Fabrics",
    href: "/shop?category=fabrics",
    columns: [
      {
        title: "Unstitched",
        href: "/shop?category=fabrics",
        links: [
          { name: "1 Piece", href: "/shop?category=fabrics&search=1 piece" },
          { name: "2 Piece", href: "/shop?category=fabrics&search=2 piece" },
          { name: "3 Piece", href: "/shop?category=fabrics&search=3 piece" },
        ],
      },
      {
        title: "By Fabric",
        href: "/shop?category=fabrics",
        links: [
          { name: "Lawn", href: "/shop?search=lawn" },
          { name: "Cambric", href: "/shop?search=cambric" },
          { name: "Khaddar", href: "/shop?search=khaddar" },
          { name: "Silk & Organza", href: "/shop?search=silk" },
        ],
      },
    ],
    feature: {
      label: "Unstitched",
      title: "Printed Lawn 3 Piece",
      href: "/shop?category=fabrics",
      image:
        "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=900&q=80",
    },
  },
  {
    name: "Festive",
    href: "/shop?category=festive",
    columns: [
      {
        title: "Occasion",
        href: "/shop?category=festive",
        links: [
          { name: "Eid Edit", href: "/shop?category=festive" },
          { name: "Mehndi", href: "/shop?search=mehndi" },
          { name: "Formal Nights", href: "/shop?search=formal" },
          { name: "Bridal Adjacent", href: "/shop?search=zari" },
        ],
      },
    ],
    feature: {
      label: "Khaas",
      title: "Zari & Organza Formals",
      href: "/shop?category=festive",
      image:
        "https://images.unsplash.com/photo-1617922001439-4a2e6562f328?w=900&q=80",
    },
  },
  { name: "Menswear", href: "/shop?category=men" },
  { name: "Kids", href: "/shop?category=kids" },
  { name: "Home & Living", href: "/shop?category=home" },
  { name: "Fragrances", href: "/shop?category=fragrances" },
  { name: "Sale", href: "/shop?sort=price-asc", accent: true },
];

/** Falls back onto this run when a product carries no `sizes` array. */
export const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

/** Unstitched fabric is sold by the suit, not by body size. */
export const UNSTITCHED_SIZES = ["Unstitched"];

export const COLOR_SWATCHES: Record<string, string> = {
  Ivory: "#f2ece1",
  Chalk: "#f7f5f1",
  Sand: "#ded1bb",
  Beige: "#d8c8ae",
  Clay: "#97452f",
  Rust: "#a8512c",
  Maroon: "#6d2130",
  Henna: "#6d2f3d",
  Blush: "#e3bfc0",
  Rose: "#c98a92",
  Lilac: "#c3b3d4",
  Indigo: "#33406b",
  Navy: "#22304a",
  Teal: "#2f6465",
  Jade: "#3f6b57",
  Olive: "#6a6a3f",
  Mustard: "#c9962f",
  Black: "#1b1a18",
  Charcoal: "#3a3835",
  White: "#ffffff",
};

export function swatchHex(name: string): string {
  return COLOR_SWATCHES[name] ?? "#d5cec3";
}

export const SIZE_GUIDE = [
  { size: "XS", bust: '34"', waist: '28"', hip: '36"', length: '40"' },
  { size: "S", bust: '36"', waist: '30"', hip: '38"', length: '40.5"' },
  { size: "M", bust: '38"', waist: '32"', hip: '40"', length: '41"' },
  { size: "L", bust: '40"', waist: '34"', hip: '42"', length: '41.5"' },
  { size: "XL", bust: '42"', waist: '36"', hip: '44"', length: '42"' },
  { size: "XXL", bust: '44"', waist: '38"', hip: '46"', length: '42.5"' },
];
