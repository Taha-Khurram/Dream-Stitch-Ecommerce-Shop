import React from "react";
import {
  messageStatusLabel,
  subscriberStatusLabel,
  type MessageStatus,
  type SubscriberStatus,
} from "@/lib/inbox/lifecycle";

/**
 * Inbox status as colour and shape, on the same terms as `StatusPill` for
 * orders — the dot carries the colour, the word carries the meaning, and the
 * states are separated by fill weight rather than by hue so the pill reads
 * before the label does.
 *
 * `new` is the loud one here for the same reason it is on an order: it is the
 * only status that is a request for the admin to do something, and it has to
 * be findable down a long table without reading a word.
 */

const MESSAGE_TONE: Record<MessageStatus, { chip: string; dot: string }> = {
  new: { chip: "border-purple bg-purple text-white", dot: "bg-white" },
  read: { chip: "border-purple bg-white text-purple", dot: "bg-purple" },
  replied: { chip: "border-jade/30 bg-jade/10 text-jade", dot: "bg-jade" },
  archived: { chip: "border-line bg-white text-muted", dot: "bg-faint" },
};

const SUBSCRIBER_TONE: Record<SubscriberStatus, { chip: string; dot: string }> = {
  subscribed: { chip: "border-jade/30 bg-jade/10 text-jade", dot: "bg-jade" },
  unsubscribed: { chip: "border-line bg-white text-muted", dot: "bg-faint" },
};

const UNKNOWN = { chip: "border-line bg-white text-ink-soft", dot: "bg-faint" };

const BASE =
  "inline-flex items-center gap-1.5 border px-2.5 py-1 text-[12px] font-medium";

function Pill({ tone, label }: { tone: { chip: string; dot: string }; label: string }) {
  return (
    <span className={`${BASE} ${tone.chip}`}>
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone.dot}`} />
      {label}
    </span>
  );
}

/**
 * Both take `string` rather than the narrowed type, for the reason
 * `Order.status` is widened: a row written by a migration this build has not
 * seen still has to render, and falling back to a neutral pill is a better
 * answer than a crash on a screen whose whole job is showing what is there.
 */
export function MessageStatusPill({ status }: { status: string }) {
  const tone = (MESSAGE_TONE as Record<string, typeof UNKNOWN>)[status] ?? UNKNOWN;
  return <Pill tone={tone} label={messageStatusLabel(status)} />;
}

export function SubscriberStatusPill({ status }: { status: string }) {
  const tone = (SUBSCRIBER_TONE as Record<string, typeof UNKNOWN>)[status] ?? UNKNOWN;
  return <Pill tone={tone} label={subscriberStatusLabel(status)} />;
}
