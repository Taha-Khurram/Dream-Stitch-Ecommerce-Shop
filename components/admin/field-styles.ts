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
/**
 * The box every control in these forms draws: border, padding, type scale and
 * the purple focus treatment. Kept separate so the custom select trigger in
 * `SelectField` is the *same* box as the inputs beside it rather than a
 * lookalike that drifts the next time one of them is touched.
 */
const fieldBox =
  "w-full border border-line bg-white px-3 py-2.5 text-sm text-ink transition-colors hover:border-faint focus:border-purple focus:ring-2 focus:ring-purple/15 focus:outline-none";

export const inputClass = `block ${fieldBox} placeholder-faint`;

/**
 * `SelectField`'s trigger. `flex` replaces `block` to seat the chevron against
 * the right edge, and the open list borrows the focus colours so the control
 * reads as one object with the panel hanging off it.
 */
export const selectTriggerClass = `flex items-center justify-between gap-2 text-left ${fieldBox}`;
