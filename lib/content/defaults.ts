import { IMG, img } from "@/lib/imagery";
import { BRAND, NAV_ITEMS, SIZE_GUIDE } from "@/lib/constants";

/**
 * Every piece of storefront copy, imagery and chrome an admin can change from
 * `/admin/settings` — and the values the site falls back to when they have
 * changed nothing (or before `admin_schema.sql` adds `store_settings.content`).
 *
 * This object is the single source of truth for the *shape* as well as the
 * defaults: `SiteContent` is derived from it, the merge in `lib/content/merge`
 * walks it to decide what a stored payload may contain, and the same walk
 * reads the admin form back. Add a key here and all three follow.
 *
 * Two rules keep that walk honest:
 *   1. A leaf is a string, a boolean, a string[] or an array of flat objects.
 *      Nothing deeper — a repeater row cannot itself hold a repeater.
 *   2. Every array carries at least one element, because element zero is the
 *      template a submitted row is validated against.
 */
export const DEFAULT_CONTENT = {
  /* ── Header ───────────────────────────────────────────────────────────── */
  header: {
    show_announcement_bar: true,
    show_search: true,
    show_account: true,
    show_wishlist: true,
    show_cart: true,
    show_suffix: true,
    nav: NAV_ITEMS.map((item) => ({ name: item.name, href: item.href })),
    search_placeholder: "Search bedsheets, fabrics, sizes…",
    search_suggestions: [
      "King Size Bedsheet",
      "Pure Cotton",
      "Cotton Satin",
      "Single Bed Set",
      "Custom Size",
    ],
  },

  /* ── Footer ───────────────────────────────────────────────────────────── */
  footer: {
    enabled: true,
    blurb:
      "Premium bedsheets in pure cotton, cotton zeen and cotton satin — cut, stitched and checked by hand in Karachi.",
    show_contact: true,
    show_social: true,
    instagram_url: "#",
    facebook_url: "#",
    youtube_url: "#",
    show_columns: true,
    /* Flat rows, grouped by `column` at render time in the order given here. */
    links: [
      { column: "Shop", name: "Pure Cotton", href: "/shop?category=pure-cotton" },
      { column: "Shop", name: "Cotton Zeen", href: "/shop?category=cotton-zeen" },
      { column: "Shop", name: "Cotton Satin", href: "/shop?category=cotton-satin" },
      { column: "Shop", name: "King Size", href: "/shop?size=King%20Size" },
      { column: "Shop", name: "Single Bed", href: "/shop?size=Single" },
      { column: "Help", name: "Size Guide", href: "/custom" },
      { column: "Help", name: "Fabric Care", href: "/contact" },
      { column: "Help", name: "Delivery & Returns", href: "/contact" },
      { column: "Help", name: "Track Your Order", href: "/contact" },
      { column: "Help", name: "FAQs", href: "/contact" },
      { column: "Dream Stitch", name: "Our Story", href: "/about" },
      { column: "Dream Stitch", name: "Custom Orders", href: "/custom" },
      { column: "Dream Stitch", name: "Contact Us", href: "/contact" },
      { column: "Dream Stitch", name: "WhatsApp Us", href: "/contact" },
    ],
    show_payments: true,
    payments_label: "Secure payments",
    payments: ["VISA", "MASTER", "JAZZCASH", "EASYPAISA", "COD"],
    legal_note: "All rights reserved.",
  },

  /* ── Home ─────────────────────────────────────────────────────────────── */
  home: {
    hero: {
      enabled: true,
      slides: [
        {
          eyebrow: "Pure Cotton · Cotton Zeen · Cotton Satin",
          title: "Sleep Wrapped in\nSomething Softer",
          copy: "Premium bedsheets woven to stay soft wash after wash. Available in king and single, or made to your exact measurements.",
          cta_label: "Shop the Collection",
          cta_href: "/shop",
          secondary_label: "Order a Custom Size",
          secondary_href: "/custom",
          image: img(IMG.heroCotton, 1900),
          align: "left",
        },
        {
          eyebrow: "Cotton Satin",
          title: "A Quiet Kind\nof Luxury",
          copy: "Cotton finished in a satin weave for a low, liquid sheen that catches the light without shouting. Cool to the touch, smooth against skin.",
          cta_label: "Shop Cotton Satin",
          cta_href: "/shop?category=cotton-satin",
          secondary_label: "",
          secondary_href: "",
          image: img(IMG.heroSatin, 1900),
          align: "center",
        },
        {
          eyebrow: "Custom Demand",
          title: "Made for Your Bed.\nLiterally.",
          copy: "Odd frame, deeper mattress, extra drop? Send us the numbers and we cut a set to fit it exactly — same fabric, same finish.",
          cta_label: "Start a Custom Order",
          cta_href: "/custom",
          secondary_label: "",
          secondary_href: "",
          image: img(IMG.heroCustom, 1900),
          align: "left",
        },
      ],
    },
    featured: {
      enabled: true,
      eyebrow: "Featured",
      title: "Picked For You",
      copy: "The sets we would put on our own beds — photographed on the same bed, in the same light, so the cloth is the only thing that changes.",
      action_label: "View All Bedsheets",
    },
    custom_banner: {
      enabled: true,
      eyebrow: "Custom Demand",
      title: "Your bed isn’t standard. Your sheet shouldn’t be.",
      copy: "King, single, or something in between — send us your measurements and we will stitch a set to fit it exactly. Same fabrics, same finish, no compromise on the drop.",
      cta_label: "Start a Custom Order",
      cta_href: "/custom",
      image: img(IMG.editorialWide, 1900),
    },
    promises: {
      enabled: true,
      eyebrow: "Why Dream Stitch",
      title: "Stitched With Intention",
      copy: "We started because bedsheets that looked beautiful in the shop gave up after three washes. So we began choosing our own cloth.",
      items: [
        {
          title: "Fabric First",
          copy: "We buy the cloth before we design the print. Pure cotton, cotton zeen and cotton satin — nothing we cannot name.",
        },
        {
          title: "Made to Your Measurements",
          copy: "Odd bed? Old frame? Extra drop? Send us the numbers and we will cut to them.",
        },
        {
          title: "Colour That Stays",
          copy: "Dyed and finished to survive real laundry, not just a photoshoot.",
        },
        {
          title: "Finished by Hand",
          copy: "Every hem, every corner, checked by a person before it is folded.",
        },
      ],
    },
    newsletter: {
      enabled: true,
      title: "First look, before anyone else",
      copy: "New prints, restocks and the occasional quiet sale. One email, now and then — never a flood.",
      placeholder: "Your email address",
      button_label: "Subscribe",
      success_copy: "You are on the list. Look out for the first look.",
    },
  },

  /* ── Shop ─────────────────────────────────────────────────────────────── */
  shop: {
    banner: {
      enabled: true,
      eyebrow: "Collection",
      title: "All Bedsheets",
      copy: "Every set we make, in pure cotton, cotton zeen and cotton satin — king, single or cut to your own measurements.",
      image: img(IMG.editorialCraft, 1900),
    },
    empty: {
      title: "Nothing here yet",
      copy: "No sets match these filters. Try widening your search, browse the full collection, or have this made in your own size.",
    },
    new_in: {
      enabled: true,
      eyebrow: "Just Landed",
      title: "New In",
      copy: "The most recent sets off the table, updated every week.",
      action_label: "View All New In",
    },
    bestsellers: {
      enabled: true,
      eyebrow: "Loved Most",
      title: "Bestsellers",
      copy: "The sets our customers come back for a second time.",
      action_label: "Shop All",
    },
  },

  /* ── Product page ─────────────────────────────────────────────────────── */
  product: {
    /**
     * The measurement table behind the "Size Guide" link in the buy box.
     *
     * Two flat lists rather than one nested one, because a repeater row cannot
     * hold a repeater: `charts` is the heading and note per category, `rows`
     * is every table row tagged with the category it belongs to. A blank
     * `category` on either is the fallback used by any category without its
     * own — which is how a single store-wide chart stays a two-field edit.
     */
    size_guide: {
      enabled: true,
      link_label: "Size Guide",
      charts: [
        {
          category: "",
          eyebrow: "Finished Dimensions",
          title: "Bed Size Guide",
          headings: "Size, Bedsheet, Pillow Cover, Set, Fits",
          note: "Dimensions are of the finished sheet, measured flat — the side drop is already included. Allow an inch either way on hand-finished hems. Falling between two sizes? We will cut it to your numbers.",
        },
      ],
      rows: SIZE_GUIDE.map((row) => ({
        category: "",
        size: row.size,
        sheet: row.sheet,
        pillow: row.pillow,
        set: row.pieces,
        fits: row.fits,
      })),
    },
  },

  /* ── Custom orders ────────────────────────────────────────────────────── */
  custom: {
    hero: {
      enabled: true,
      eyebrow: "Custom Demand",
      title: "Your bed isn’t standard. Your sheet shouldn’t be.",
      copy: "King, single, or something in between — send us your measurements and we will stitch a set to fit it exactly. Same fabrics, same finish, no premium for being unusual.",
      image: img(IMG.editorialCustom, 1900),
    },
    steps: {
      enabled: true,
      eyebrow: "How It Works",
      title: "Three steps, one bed",
      items: [
        {
          title: "Send three numbers",
          copy: "Mattress width, mattress length, and the drop you want hanging over each side. A tape measure and two minutes is all it takes.",
        },
        {
          title: "We confirm the price",
          copy: "We reply the same working day with the exact price for your size in the fabric you picked. Nothing is cut until you say yes.",
        },
        {
          title: "Cut, stitched, dispatched",
          copy: "Your set is cut to your numbers, double-hemmed, checked by hand and dispatched within 7–10 working days.",
        },
      ],
    },
    request: {
      enabled: true,
      eyebrow: "Start Here",
      title: "Request your size",
      copy: "Every bedsheet we make can be cut to your own measurements — no premium for an odd size. Browse the range, pick the fabric and finish you want, then send us your width, length and drop. We confirm the price the same working day, before anything is cut.",
      show_whatsapp: true,
      cta_label: "Order a Custom Size",
      cta_href: "/shop",
    },
    reassurance: {
      enabled: true,
      items: [
        { title: "No premium for odd sizes", copy: "You pay for cloth, not for being unusual." },
        { title: "7–10 working days", copy: "Cut, finished and dispatched from Karachi." },
        { title: "We check your numbers", copy: "If something looks off, we call before cutting." },
      ],
    },
  },

  /* ── About ────────────────────────────────────────────────────────────── */
  about: {
    hero: {
      enabled: true,
      eyebrow: "Our Story",
      title: "Chosen, cut and finished by hand",
      image: img(IMG.editorialCraft, 1900),
    },
    intro: {
      enabled: true,
      lead: `${BRAND.name} ${BRAND.suffix} began with a simple frustration: bedsheets that looked beautiful in the shop and gave up after three washes.`,
      copy: "So we started choosing our own fabric, cutting our own sizes, and finishing every seam ourselves. What you get is a bedsheet that fits your bed properly, holds its colour, and gets softer instead of thinner. No mystery blends, no filler — just cotton we would put on our own beds.",
    },
    values: {
      enabled: true,
      eyebrow: "What We Hold To",
      title: "Three rules we don’t bend",
      image: img(IMG.storyFabric, 1100),
      items: [
        {
          title: "Fabric first",
          copy: "We buy the cloth before we design the print. Pure cotton, cotton zeen and cotton satin — three weaves we can name, source and stand behind, with no mystery blends and no filler.",
        },
        {
          title: "Cut to the bed, not to a chart",
          copy: "Standard sizes are a convenience, not a rule. If your mattress is deeper, your frame older or your drop longer, we cut to your measurements at no drama and no premium for being unusual.",
        },
        {
          title: "Made to survive the laundry",
          copy: "Colourfast dyes, double-stitched hems and reinforced corners, because a bedsheet is judged on its twentieth wash and not its first.",
        },
      ],
    },
    closing: {
      enabled: true,
      title: "See what came off the table this week",
      image: img(IMG.editorialFinish, 1900),
      cta_label: "Shop New In",
      cta_href: "/shop?sort=newest",
      secondary_label: "Order a Custom Size",
      secondary_href: "/custom",
    },
  },

  /* ── Contact ──────────────────────────────────────────────────────────── */
  contact: {
    hero: {
      enabled: true,
      eyebrow: "We’re Here",
      title: "Customer Care",
      copy: "We are available 24/7 online for your concerns — send a message any time and we answer within a few hours.",
      image: img(IMG.storyAtelier, 1900),
    },
    form: {
      enabled: true,
      eyebrow: "Write to Us",
      title: "Send a message",
      button_label: "Send Message",
      success_title: "Message received",
      success_copy: "Our care team will reply within one working day.",
    },
    faqs: {
      enabled: true,
      eyebrow: "Answers",
      title: "Frequently Asked",
      note: "Still stuck? Write to us above — a person always replies.",
      note_cta_label: "Start a custom order",
      note_cta_href: "/custom",
      items: [
        {
          question: "How long does delivery take?",
          answer:
            "Stocked sets leave our Karachi studio within 24 hours. Delivery takes 3–5 working days nationwide, and 2 days within Karachi. You will receive a tracking link by SMS. Custom-size orders are cut first and dispatch in 7–10 working days.",
        },
        {
          question: "How does the custom size service work?",
          answer:
            "Send us three numbers — mattress width, mattress length and the drop you want on each side — through the custom order page or on WhatsApp. We confirm the price, cut the same fabric to your measurements, and dispatch in 7–10 working days.",
        },
        {
          question: "What is the difference between pure cotton, cotton zeen and cotton satin?",
          answer:
            "Pure cotton is the coolest and most breathable, best for hot months. Cotton zeen is close-woven and crease-resistant, our easiest everyday option. Cotton satin is cotton finished in a satin weave, with a low sheen and a smoother hand.",
        },
        {
          question: "Can I exchange a bedsheet I bought online?",
          answer:
            "Yes — within 7 days, unused and in its original packing, by courier or at the studio. Made-to-order sets are cut for one bed only, so they cannot be exchanged.",
        },
        {
          question: "Will the colour fade?",
          answer:
            "Our sets are dyed for repeated machine washing. Wash cold with like colours and dry in shade rather than direct sun, and the colour will hold for years.",
        },
      ],
    },
  },
};

/** The shape of `store_settings.content`, derived so the two cannot drift. */
export type SiteContent = typeof DEFAULT_CONTENT;
