/**
 * Click-to-chat plumbing for the storefront's WhatsApp concierge.
 *
 * WhatsApp's own `wa.me` endpoint does the routing — it picks the app on a
 * phone and WhatsApp Web on a desktop — so there is nothing to detect here
 * and no third-party widget script to load.
 */

/** What lands in the compose box when nobody picks a specific topic. */
export const WHATSAPP_DEFAULT_MESSAGE =
  "Hi dreamstitchbysk, I want to inquire about your bedsheets.";

/**
 * `wa.me` wants a bare international number — digits only, no `+`, no spaces,
 * no leading zero. The admin settings field accepts whatever an owner types
 * ("+92 333 1166929", "0333 1166929"), so normalise here rather than asking
 * them to remember the format.
 */
export function waLink(phone: string, message: string = WHATSAPP_DEFAULT_MESSAGE): string {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  // A Pakistani number given in local form ("3331166929") still needs its code.
  const intl = digits.startsWith("92") ? digits : `92${digits}`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
}

export interface WhatsAppTopic {
  /** Row label. */
  label: string;
  /** Pre-typed message — written in the customer's voice, not the shop's. */
  message: string;
  /** Key into the icon map in `WhatsAppFab`. */
  icon: "sizing" | "order" | "custom" | "chat";
}

/**
 * The four things people actually message a bedsheet shop about. Each row is
 * a finished sentence so the customer never has to compose the first message —
 * which is the whole point of pre-typed inquiries.
 */
export const WHATSAPP_TOPICS: WhatsAppTopic[] = [
  {
    label: "Fabric & Sizing Guidance",
    message:
      "Hi dreamstitchbysk, I need help choosing a fabric and the right size for my bed.",
    icon: "sizing",
  },
  {
    label: "Track My Order",
    message: "Hi dreamstitchbysk, I would like to check the status of my order.",
    icon: "order",
  },
  {
    label: "Custom Stitching & Dispatch",
    message:
      "Hi dreamstitchbysk, I want a bedsheet stitched to my own measurements. Can you share the process and dispatch time?",
    icon: "custom",
  },
  {
    label: "Order Directly on WhatsApp",
    message: WHATSAPP_DEFAULT_MESSAGE,
    icon: "chat",
  },
];
