/**
 * The inbox vocabulary, in one place.
 *
 * Two small state machines that the storefront forms feed and the panel works
 * through. They live in one module because they are one feature — the screens
 * import from here, the route handlers validate against here, and
 * `inbox_schema.sql` mirrors both lists in its CHECK constraints.
 *
 * The shape follows lib/orders/lifecycle.ts deliberately: a frozen list of
 * statuses, a label-and-note for each, a type guard, and no React. Anything
 * that needs to render a status reads its words from here rather than
 * inventing its own, so the filter tabs, the pills and the detail controls can
 * never disagree about what `replied` is called.
 *
 * Changing either list means changing inbox_schema.sql too.
 */

/* ── Contact messages ───────────────────────────────────────────────────── */

/**
 * Where a message sits.
 *
 * `new → read` happens on its own the first time an admin opens the message —
 * it is a statement about whether anybody has looked, and making someone click
 * a button to say "yes, I have read this, which I am currently reading" is
 * busywork. The two that follow are real decisions: `replied` means a person
 * answered, `archived` means it needed no answer. Neither is inferable, so
 * neither is automatic.
 */
export const MESSAGE_STATUSES = ["new", "read", "replied", "archived"] as const;

export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

/** Where the contact form puts a message: received, nobody has opened it. */
export const MESSAGE_INTAKE_STATUS = "new" satisfies MessageStatus;

/** Set the moment an admin opens one. See the note above. */
export const MESSAGE_OPENED_STATUS = "read" satisfies MessageStatus;

/**
 * Statuses that mean the message is still someone's job.
 *
 * What the dashboard tile counts, and what the "Unanswered" tab narrows to.
 * A read message is not a handled message — opening something is not the same
 * as dealing with it, and an inbox that forgets that is just a list.
 */
export const OPEN_MESSAGE_STATUSES = ["new", "read"] as const;

export const MESSAGE_STATUS_COPY: Record<MessageStatus, { label: string; note: string }> = {
  new: { label: "New", note: "Just arrived — nobody has opened it yet" },
  read: { label: "Read", note: "Opened, still waiting on an answer" },
  replied: { label: "Replied", note: "Answered by email — nothing outstanding" },
  archived: { label: "Archived", note: "Filed away without a reply" },
};

export function isMessageStatus(value: string): value is MessageStatus {
  return (MESSAGE_STATUSES as readonly string[]).includes(value);
}

/** True while nobody has so much as opened the message. */
export function isUnopened(status: string): boolean {
  return status === MESSAGE_INTAKE_STATUS;
}

/** True while the message is still owed something. */
export function isOpenMessage(status: string): boolean {
  return (OPEN_MESSAGE_STATUSES as readonly string[]).includes(status);
}

/** Display name for any status, including one this build has never heard of. */
export function messageStatusLabel(status: string): string {
  if (isMessageStatus(status)) return MESSAGE_STATUS_COPY[status].label;
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** `#7C1A4E20` — the short reference the panel identifies a message by. */
export function messageReference(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}

/**
 * The `mailto:` an admin answers from, with the thread already set up.
 *
 * There is no outbound mail in this app and there should not be one behind an
 * admin panel — replies come from the care address, in the care team's own
 * client, where the sent copy lands in a mailbox somebody else can search.
 * This just spares them retyping the subject.
 */
export function replyMailto({ email, subject }: { email: string; subject: string }): string {
  const thread = /^re:/i.test(subject.trim()) ? subject.trim() : `Re: ${subject.trim()}`;
  /* The address is NOT encoded: encodeURIComponent turns "@" into %40, and
     while RFC 6068 says a client should decode that, plenty do not and open a
     blank compose window instead. It has already been through the email rule
     in lib/validations/inbox.ts, so there is nothing in it that needs
     escaping. The subject is free text and is encoded properly. */
  return `mailto:${email}?subject=${encodeURIComponent(thread)}`;
}

/* ── Newsletter subscribers ─────────────────────────────────────────────── */

/**
 * On the list, or off it.
 *
 * Coming off is a status rather than a deletion — see the note on the table in
 * inbox_schema.sql. The short version: a suppression list only works if it
 * remembers the addresses that asked to be left alone.
 */
export const SUBSCRIBER_STATUSES = ["subscribed", "unsubscribed"] as const;

export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number];

export const SUBSCRIBER_STATUS_COPY: Record<
  SubscriberStatus,
  { label: string; note: string }
> = {
  subscribed: { label: "Subscribed", note: "Receiving the newsletter" },
  unsubscribed: { label: "Unsubscribed", note: "Kept on file, never mailed" },
};

export function isSubscriberStatus(value: string): value is SubscriberStatus {
  return (SUBSCRIBER_STATUSES as readonly string[]).includes(value);
}

export function subscriberStatusLabel(status: string): string {
  if (isSubscriberStatus(status)) return SUBSCRIBER_STATUS_COPY[status].label;
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Where a subscription came from.
 *
 * Whitelisted rather than free text because the value arrives from an
 * anonymous caller — `inbox_schema.sql` has the same list as a CHECK, and
 * coerces anything else to `home` rather than rejecting the subscriber.
 */
export const SUBSCRIBER_SOURCES = ["home", "footer", "checkout", "admin"] as const;

export type SubscriberSource = (typeof SUBSCRIBER_SOURCES)[number];

export const SOURCE_LABELS: Record<SubscriberSource, string> = {
  home: "Homepage",
  footer: "Footer",
  checkout: "Checkout",
  admin: "Added by admin",
};

export function sourceLabel(source: string): string {
  return (SOURCE_LABELS as Record<string, string>)[source] ?? "Unknown";
}

/* ── What the write functions answer ────────────────────────────────────── */

/**
 * The outcome strings from `subscribe_to_newsletter()`.
 *
 * Four, not two, because "you are already on the list" and "welcome back" are
 * different things to say to somebody, and a form that says "subscribed!" to
 * an address that subscribed last month is telling a small lie.
 */
export const SUBSCRIBE_OUTCOMES = [
  "subscribed",
  "resubscribed",
  "already_subscribed",
  "invalid",
] as const;

export type SubscribeOutcome = (typeof SUBSCRIBE_OUTCOMES)[number];

/** The outcome strings from `submit_contact_message()`. */
export const SUBMIT_OUTCOMES = ["accepted", "duplicate", "throttled", "invalid"] as const;

export type SubmitOutcome = (typeof SUBMIT_OUTCOMES)[number];
