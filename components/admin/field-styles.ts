/**
 * Shared field styling for the admin forms.
 *
 * This lives outside ActionForm on purpose: ActionForm is a `"use client"`
 * module, and a plain constant exported from a client module reaches the
 * server components that render these forms as a client reference rather
 * than as the string itself — so `${inputClass} extra` silently produced an
 * unstyled control. A neutral module is safe for both sides of the boundary.
 *
 * The controls are deliberately larger than the storefront's: this is a form
 * someone fills in for an hour, not a one-off checkout field.
 */
export const inputClass =
  "block w-full border border-line bg-white px-3 py-2.5 text-sm text-ink transition-colors placeholder-faint hover:border-faint focus:border-purple focus:ring-2 focus:ring-purple/15 focus:outline-none";
