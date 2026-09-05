import type { StoreSettings } from "@/types/ecommerce";

/**
 * Whether the storefront is behind the holding page right now.
 *
 * The gate is a pure function of the settings row and the clock, which is the
 * point: nothing is stored per visitor, so there is no cookie to clear, no
 * session to reset, and no way for one visitor's browser to be let in while
 * another's is not. Turn the switch off, or let the countdown run out, and the
 * shop is open for everybody on the next request.
 *
 * A launch instant in the past therefore opens the gate on its own. That is
 * what makes the visitor's "click to enter" work: their countdown reaches zero
 * against the same instant this function reads, so by the time the click asks
 * the server for the page again, the server already agrees the shop is open.
 */
export function isHoldingPageUp(
  settings: StoreSettings,
  now: number = Date.now()
): boolean {
  if (!settings.coming_soon_enabled) return false;

  const launch = launchInstant(settings.coming_soon_launch_at);

  // No date set — hold until an admin flips the switch back off. An indefinite
  // hold is a deliberate option, not an oversight: a shop that is not ready
  // should not have to invent a date to say so.
  if (launch === null) return true;

  return now < launch;
}

/** An ISO instant from the settings row → epoch ms, or null if unusable. */
export function launchInstant(value: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}
