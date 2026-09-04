/**
 * The admin editor's map of `DEFAULT_CONTENT`: which fields to show, in what
 * order, under what label.
 *
 * Only labelling lives here — the shape, the defaults and the parsing all come
 * from `defaults.ts`, so a field left out of this file simply is not editable
 * and keeps whatever value it holds. Every `path`/`key` pair must name a real
 * leaf in `DEFAULT_CONTENT`: the editor resolves them against it and throws on
 * a miss in development, rather than rendering a field that saves nowhere.
 */

import type { ImageSpecKey } from "@/lib/media-specs";

export type FieldKind = "text" | "textarea" | "image" | "url" | "lines" | "list" | "switch";

export interface ColumnSpec {
  key: string;
  label: string;
  kind?: "text" | "textarea" | "url" | "image" | "select";
  /** `image` only — which storefront slot it fills, so the cell can say what fits. */
  image?: ImageSpecKey;
  /**
   * `select` only. Names a list the editor cannot know at build time — the
   * page fetches it and hands it to the editor, so a column can offer the
   * store's live categories without this file importing the database.
   */
  options?: OptionSource;
  /** `select` only. The label for the empty value, e.g. "Every category". */
  emptyLabel?: string;
  /** Column width inside the repeater row, in `fr` units. */
  span?: number;
}

/** Lists resolved at request time and passed into the editor by key. */
export type OptionSource = "categories";

export interface SelectOption {
  value: string;
  label: string;
}

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  /**
   * `image` only. Names the slot on the storefront this picture lands in,
   * which is what lets the field print the dimensions that survive its crop.
   */
  image?: ImageSpecKey;
  /** `list` only. */
  columns?: ColumnSpec[];
  addLabel?: string;
  /** `text`-like fields default to full width; two of these sit side by side. */
  half?: boolean;
}

export interface SectionSpec {
  /** Dotted path into `SiteContent`, e.g. `home.hero`. */
  path: string;
  title: string;
  copy?: string;
  /** Renders the show/hide switch bound to `<path>.enabled`. */
  toggle?: boolean;
  toggleHint?: string;
  fields: FieldSpec[];
}

export interface TabSpec {
  key: string;
  label: string;
  title: string;
  copy: string;
  sections: SectionSpec[];
}

const HEADING_FIELDS: FieldSpec[] = [
  { key: "eyebrow", label: "Eyebrow", kind: "text", half: true },
  { key: "title", label: "Heading", kind: "text", half: true },
  { key: "copy", label: "Copy", kind: "textarea" },
];

export const CONTENT_TABS: TabSpec[] = [
  /* ── Header ───────────────────────────────────────────────────────────── */
  {
    key: "header",
    label: "Header",
    title: "Header",
    copy: "The sticky bar every storefront page carries, and the strip above it.",
    sections: [
      {
        path: "header",
        title: "Bar contents",
        copy: "Switch off anything the shop does not need. The wordmark always stays.",
        fields: [
          { key: "show_announcement_bar", label: "Announcement strip", kind: "switch" },
          { key: "show_suffix", label: "“By Sk” under the wordmark", kind: "switch" },
          { key: "show_search", label: "Search", kind: "switch" },
          { key: "show_account", label: "Account menu", kind: "switch" },
          { key: "show_wishlist", label: "Wishlist", kind: "switch" },
          { key: "show_cart", label: "Cart", kind: "switch" },
        ],
      },
      {
        path: "header",
        title: "Navigation",
        copy: "The centre links, and the same list inside the mobile drawer.",
        fields: [
          {
            key: "nav",
            label: "Links",
            kind: "list",
            addLabel: "Add link",
            columns: [
              { key: "name", label: "Label" },
              { key: "href", label: "Link", kind: "url", span: 4 },
            ],
          },
        ],
      },
      {
        path: "header",
        title: "Search overlay",
        fields: [
          { key: "search_placeholder", label: "Placeholder", kind: "text" },
          {
            key: "search_suggestions",
            label: "Popular searches",
            kind: "lines",
            hint: "One per line. Each becomes a shortcut into the shop.",
          },
        ],
      },
    ],
  },

  /* ── Footer ───────────────────────────────────────────────────────────── */
  {
    key: "footer",
    label: "Footer",
    title: "Footer",
    copy: "The purple block at the foot of every storefront page. It never renders under /admin.",
    sections: [
      {
        path: "footer",
        title: "Footer",
        toggle: true,
        toggleHint: "Off removes the footer from the storefront entirely.",
        fields: [
          { key: "blurb", label: "Blurb", kind: "textarea", hint: "Sits under the wordmark." },
          { key: "show_contact", label: "Address, phone and email", kind: "switch" },
          { key: "show_social", label: "Social icons", kind: "switch" },
          { key: "instagram_url", label: "Instagram", kind: "url", half: true },
          { key: "facebook_url", label: "Facebook", kind: "url", half: true },
          { key: "youtube_url", label: "YouTube", kind: "url", half: true },
        ],
      },
      {
        path: "footer",
        title: "Link columns",
        copy: "Rows sharing a column heading are grouped, in the order listed.",
        fields: [
          { key: "show_columns", label: "Show link columns", kind: "switch" },
          {
            key: "links",
            label: "Links",
            kind: "list",
            addLabel: "Add link",
            columns: [
              { key: "column", label: "Column" },
              { key: "name", label: "Label" },
              { key: "href", label: "Link", kind: "url", span: 2 },
            ],
          },
        ],
      },
      {
        path: "footer",
        title: "Legal bar",
        fields: [
          { key: "show_payments", label: "Payment badges", kind: "switch" },
          { key: "payments_label", label: "Badges heading", kind: "text", half: true },
          {
            key: "legal_note",
            label: "Copyright note",
            kind: "text",
            half: true,
            hint: "The year and brand name are added automatically.",
          },
          {
            key: "payments",
            label: "Badges",
            kind: "lines",
            hint: "One per line, e.g. VISA.",
          },
        ],
      },
    ],
  },

  /* ── Home ─────────────────────────────────────────────────────────────── */
  {
    key: "home",
    label: "Home",
    title: "Home page",
    copy: "Top to bottom, the sections a visitor meets first.",
    sections: [
      {
        path: "home.hero",
        title: "Hero carousel",
        toggle: true,
        fields: [
          {
            key: "slides",
            label: "Slides",
            kind: "list",
            addLabel: "Add slide",
            hint: "Slides cross-fade every 6.5 seconds. Use \\n in a heading for a line break, and leave the secondary button blank to drop it.",
            columns: [
              { key: "eyebrow", label: "Eyebrow" },
              { key: "title", label: "Heading", span: 4 },
              { key: "copy", label: "Copy", kind: "textarea", span: 6 },
              { key: "cta_label", label: "Button", span: 3 },
              { key: "cta_href", label: "Button link", kind: "url", span: 3 },
              { key: "secondary_label", label: "Second button", span: 3 },
              { key: "secondary_href", label: "Second link", kind: "url", span: 3 },
              { key: "image", label: "Image", kind: "image", image: "heroSlide", span: 4 },
              { key: "align", label: "Align", span: 2 },
            ],
          },
        ],
      },
      {
        path: "home.featured",
        title: "Featured rail",
        copy: "The cards are the products you tick as Featured under Products.",
        toggle: true,
        fields: [...HEADING_FIELDS, { key: "action_label", label: "Link label", kind: "text" }],
      },
      {
        path: "home.custom_banner",
        title: "Custom demand banner",
        toggle: true,
        fields: [
          ...HEADING_FIELDS,
          { key: "cta_label", label: "Button", kind: "text", half: true },
          { key: "cta_href", label: "Button link", kind: "url", half: true },
          { key: "image", label: "Background image", kind: "image", image: "wideBanner" },
        ],
      },
      {
        path: "home.promises",
        title: "Why choose us",
        toggle: true,
        fields: [
          ...HEADING_FIELDS,
          {
            key: "items",
            label: "Promises",
            kind: "list",
            addLabel: "Add promise",
            hint: "Four read best on a desktop row. Icons follow the order shown.",
            columns: [
              { key: "title", label: "Title" },
              { key: "copy", label: "Copy", kind: "textarea", span: 4 },
            ],
          },
        ],
      },
      {
        path: "home.newsletter",
        title: "Newsletter",
        toggle: true,
        fields: [
          { key: "title", label: "Heading", kind: "text" },
          { key: "copy", label: "Copy", kind: "textarea" },
          { key: "placeholder", label: "Input placeholder", kind: "text", half: true },
          { key: "button_label", label: "Button", kind: "text", half: true },
          { key: "success_copy", label: "Thank-you line", kind: "text" },
        ],
      },
    ],
  },

  /* ── Shop ─────────────────────────────────────────────────────────────── */
  {
    key: "shop",
    label: "Shop",
    title: "Shop page",
    copy: "The collection banner and the two rails below the grid.",
    sections: [
      {
        path: "shop.banner",
        title: "Collection banner",
        copy: "A category with its own name, description or image overrides the heading and picture below.",
        toggle: true,
        fields: [
          ...HEADING_FIELDS,
          { key: "image", label: "Fallback image", kind: "image", image: "shopBanner" },
        ],
      },
      {
        path: "shop.empty",
        title: "No results",
        copy: "Shown when the filters match nothing.",
        fields: [
          { key: "title", label: "Heading", kind: "text" },
          { key: "copy", label: "Copy", kind: "textarea" },
        ],
      },
      {
        path: "shop.new_in",
        title: "New in rail",
        toggle: true,
        fields: [...HEADING_FIELDS, { key: "action_label", label: "Link label", kind: "text" }],
      },
      {
        path: "shop.bestsellers",
        title: "Bestsellers rail",
        toggle: true,
        fields: [...HEADING_FIELDS, { key: "action_label", label: "Link label", kind: "text" }],
      },
    ],
  },

  /* ── Product ──────────────────────────────────────────────────────────── */
  {
    key: "product",
    label: "Product",
    title: "Product page",
    copy: "The measurement table behind the Size Guide link in the buy box.",
    sections: [
      {
        path: "product.size_guide",
        title: "Size guide",
        copy:
          "One chart per category, or one chart for the whole shop. A product shows the chart matching its category, and falls back to the chart left on Every category when it has none of its own.",
        toggle: true,
        toggleHint: "Off removes the Size Guide link from every product page.",
        fields: [
          { key: "link_label", label: "Link label", kind: "text", half: true },
          {
            key: "charts",
            label: "Charts",
            kind: "list",
            addLabel: "Add chart",
            hint:
              "The heading above the table, its five column headings (comma separated) and the note under it. Add one row per category whose chart should differ.",
            columns: [
              {
                key: "category",
                label: "Category",
                kind: "select",
                options: "categories",
                emptyLabel: "Every category (default)",
                span: 2,
              },
              { key: "eyebrow", label: "Eyebrow", span: 2 },
              { key: "title", label: "Heading", span: 2 },
              {
                key: "headings",
                label: "Column headings, comma separated",
                span: 6,
              },
              { key: "note", label: "Note under the table", kind: "textarea", span: 6 },
            ],
          },
          {
            key: "rows",
            label: "Rows",
            kind: "list",
            addLabel: "Add row",
            hint:
              "Every row of every chart, tagged with the category it belongs to. Column headings come from the chart above, and a column no row fills in is dropped from the table.",
            columns: [
              {
                key: "category",
                label: "Category",
                kind: "select",
                options: "categories",
                emptyLabel: "Every category (default)",
                span: 2,
              },
              { key: "size", label: "Column 1 — Size", span: 2 },
              { key: "sheet", label: "Column 2 — Bedsheet", span: 2 },
              { key: "pillow", label: "Column 3 — Pillow cover", span: 2 },
              { key: "set", label: "Column 4 — Set", span: 2 },
              { key: "fits", label: "Column 5 — Fits", span: 2 },
            ],
          },
        ],
      },
    ],
  },

  /* ── Custom ───────────────────────────────────────────────────────────── */
  {
    key: "custom",
    label: "Custom",
    title: "Custom orders page",
    copy: "The made-to-measure service, start to finish.",
    sections: [
      {
        path: "custom.hero",
        title: "Hero",
        toggle: true,
        fields: [
          ...HEADING_FIELDS,
          { key: "image", label: "Background image", kind: "image", image: "pageHero" },
        ],
      },
      {
        path: "custom.steps",
        title: "How it works",
        toggle: true,
        fields: [
          { key: "eyebrow", label: "Eyebrow", kind: "text", half: true },
          { key: "title", label: "Heading", kind: "text", half: true },
          {
            key: "items",
            label: "Steps",
            kind: "list",
            addLabel: "Add step",
            hint: "Numbered in the order listed.",
            columns: [
              { key: "title", label: "Title" },
              { key: "copy", label: "Copy", kind: "textarea", span: 4 },
            ],
          },
        ],
      },
      {
        path: "custom.request",
        title: "Request block",
        toggle: true,
        fields: [
          ...HEADING_FIELDS,
          {
            key: "show_whatsapp",
            label: "WhatsApp line",
            kind: "switch",
            hint: "Uses the number on the General tab.",
          },
          { key: "cta_label", label: "Button", kind: "text", half: true },
          { key: "cta_href", label: "Button link", kind: "url", half: true },
        ],
      },
      {
        path: "custom.reassurance",
        title: "Reassurance strip",
        toggle: true,
        fields: [
          {
            key: "items",
            label: "Points",
            kind: "list",
            addLabel: "Add point",
            columns: [
              { key: "title", label: "Title" },
              { key: "copy", label: "Copy", span: 4 },
            ],
          },
        ],
      },
    ],
  },

  /* ── About ────────────────────────────────────────────────────────────── */
  {
    key: "about",
    label: "About",
    title: "About page",
    copy: "The story, the values and the closing call to action.",
    sections: [
      {
        path: "about.hero",
        title: "Hero",
        toggle: true,
        fields: [
          { key: "eyebrow", label: "Eyebrow", kind: "text", half: true },
          { key: "title", label: "Heading", kind: "text", half: true },
          { key: "image", label: "Background image", kind: "image", image: "pageHero" },
        ],
      },
      {
        path: "about.intro",
        title: "Opening statement",
        toggle: true,
        fields: [
          { key: "lead", label: "Lead line", kind: "textarea", hint: "Set in the display serif." },
          { key: "copy", label: "Copy", kind: "textarea" },
        ],
      },
      {
        path: "about.values",
        title: "Values",
        toggle: true,
        fields: [
          { key: "eyebrow", label: "Eyebrow", kind: "text", half: true },
          { key: "title", label: "Heading", kind: "text", half: true },
          { key: "image", label: "Side image", kind: "image", image: "portrait" },
          {
            key: "items",
            label: "Values",
            kind: "list",
            addLabel: "Add value",
            hint: "Numbered 01, 02, 03 in the order listed.",
            columns: [
              { key: "title", label: "Title" },
              { key: "copy", label: "Copy", kind: "textarea", span: 4 },
            ],
          },
        ],
      },
      {
        path: "about.closing",
        title: "Closing banner",
        toggle: true,
        fields: [
          { key: "title", label: "Heading", kind: "text" },
          { key: "image", label: "Background image", kind: "image", image: "wideBanner" },
          { key: "cta_label", label: "Button", kind: "text", half: true },
          { key: "cta_href", label: "Button link", kind: "url", half: true },
          { key: "secondary_label", label: "Second button", kind: "text", half: true },
          { key: "secondary_href", label: "Second link", kind: "url", half: true },
        ],
      },
    ],
  },

  /* ── Contact ──────────────────────────────────────────────────────────── */
  {
    key: "contact",
    label: "Contact",
    title: "Contact page",
    copy: "Customer care: the message form and the answers below it.",
    sections: [
      {
        path: "contact.hero",
        title: "Hero",
        toggle: true,
        fields: [
          ...HEADING_FIELDS,
          { key: "image", label: "Background image", kind: "image", image: "pageHero" },
        ],
      },
      {
        path: "contact.form",
        title: "Message form",
        toggle: true,
        fields: [
          { key: "eyebrow", label: "Eyebrow", kind: "text", half: true },
          { key: "title", label: "Heading", kind: "text", half: true },
          { key: "button_label", label: "Button", kind: "text" },
          { key: "success_title", label: "Sent heading", kind: "text", half: true },
          { key: "success_copy", label: "Sent copy", kind: "textarea" },
        ],
      },
      {
        path: "contact.faqs",
        title: "FAQs",
        toggle: true,
        fields: [
          { key: "eyebrow", label: "Eyebrow", kind: "text", half: true },
          { key: "title", label: "Heading", kind: "text", half: true },
          {
            key: "items",
            label: "Questions",
            kind: "list",
            addLabel: "Add question",
            hint: "The first one is open when the page loads.",
            columns: [
              { key: "question", label: "Question", span: 2 },
              { key: "answer", label: "Answer", kind: "textarea", span: 4 },
            ],
          },
          { key: "note", label: "Closing line", kind: "textarea" },
          { key: "note_cta_label", label: "Closing link", kind: "text", half: true },
          { key: "note_cta_href", label: "Closing link target", kind: "url", half: true },
        ],
      },
    ],
  },
];

export function findTab(key: string | undefined): TabSpec | undefined {
  return CONTENT_TABS.find((tab) => tab.key === key);
}

/** Which live lists a tab needs fetched before it can render. */
export function tabOptionSources(tab: TabSpec): OptionSource[] {
  const sources = new Set<OptionSource>();
  for (const section of tab.sections) {
    for (const field of section.fields) {
      for (const column of field.columns ?? []) {
        if (column.options) sources.add(column.options);
      }
    }
  }
  return [...sources];
}

