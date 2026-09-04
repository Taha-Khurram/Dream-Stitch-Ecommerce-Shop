import { z } from "zod";
import { SUBSCRIBER_SOURCES } from "@/lib/inbox/lifecycle";

/**
 * What the two public forms are allowed to send.
 *
 * The bounds here are the same ones `inbox_schema.sql` writes as CHECK
 * constraints, and that repetition is deliberate rather than sloppy: the
 * database constraint is the boundary that holds when somebody skips the route
 * handler, and these are what let the *form* say "that is too long" against
 * the offending field instead of the person discovering it after a round trip.
 * Two enforcement points, one set of numbers — so they are written once, here,
 * and the SQL comments point back at this file.
 *
 * Imported by the route handlers and by the client components, which is why
 * there is nothing server-only in it.
 */

/** Longest address the RFCs allow, and what the `email` columns are capped at. */
const MAX_EMAIL = 254;

export const newsletterSubscribeSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, { message: "Enter your email address" })
    .max(MAX_EMAIL, { message: "That email address is too long" })
    .email({ message: "That does not look like an email address" }),
  /* Where the form was. Optional because a caller that omits it gets `home`,
     and unrecognised values are coerced rather than rejected — losing a
     subscriber over an analytics-shaped field would be a poor trade. */
  source: z.enum(SUBSCRIBER_SOURCES).optional(),
});

export type NewsletterSubscribeInput = z.infer<typeof newsletterSubscribeSchema>;

export const contactMessageSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Please give us a name to reply to" })
    .max(100, { message: "Name cannot exceed 100 characters" }),
  email: z
    .string()
    .trim()
    .min(1, { message: "Enter your email address" })
    .max(MAX_EMAIL, { message: "That email address is too long" })
    .email({ message: "That does not look like an email address" }),
  subject: z
    .string()
    .trim()
    .min(2, { message: "Give the message a subject" })
    .max(150, { message: "Subject cannot exceed 150 characters" }),
  message: z
    .string()
    .trim()
    /* Ten, so "hi" does not become a message somebody has to triage, and low
       enough that a genuine one-line question still gets through. */
    .min(10, { message: "Tell us a little more — at least 10 characters" })
    .max(4000, { message: "Message cannot exceed 4000 characters" }),
});

export type ContactMessageInput = z.infer<typeof contactMessageSchema>;

/** The longest a message may be, for the character counter under the field. */
export const MESSAGE_MAX_LENGTH = 4000;

/* ── Admin writes ───────────────────────────────────────────────────────── */

/**
 * The body of a PATCH to either admin endpoint.
 *
 * Kept as loose `string` here on purpose: the endpoints validate the value
 * against `MESSAGE_STATUSES` / `SUBSCRIBER_STATUSES` themselves, so an unknown
 * status comes back as "Unknown status" rather than as a Zod field error about
 * an enum the caller cannot see.
 */
export const statusPatchSchema = z.object({
  status: z.string().trim().min(1, { message: "A status is required" }),
});

export type StatusPatchInput = z.infer<typeof statusPatchSchema>;
