/**
 * The store's one SMTP connection. **Server-only** — see the guard below.
 *
 * SMTP provider is Gmail (`smtp.gmail.com`, port 465, implicit TLS).
 * `SMTP_USER` must be a Gmail address with 2-Step Verification switched on,
 * and `SMTP_PASS` must be a 16-character Google App Password — a regular
 * Gmail account password is rejected outright by Google's SMTP servers with
 * `535-5.7.8 Username and Password not accepted`, which is the single most
 * common way this file appears to be "broken" when the configuration is the
 * problem.
 *
 * Scaling note: Gmail's free relay caps a sender at roughly 500 recipients a
 * day (Workspace ~2,000). Every order sends two messages, so the ceiling is
 * about 250 orders a day before Google starts deferring mail. Past that this
 * module is the seam to swap for a real transactional provider — Resend,
 * Postmark, SES — and nothing outside it needs to change.
 */

import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
/* `pool: true` selects nodemailer's pooled transport, so the options and the
   send result are SMTPPool's, not SMTPTransport's. */
import type SMTPPool from "nodemailer/lib/smtp-pool";

/**
 * Read a required variable, naming the one that is missing.
 *
 * Deliberately throwing rather than defaulting: a transporter built against a
 * blank password does not fail here, it fails one send at a time, months
 * later, in a log nobody is reading.
 */
function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set — transactional email cannot be sent`);
  return value;
}

/** Gmail's implicit-TLS port. 587 is the STARTTLS alternative. */
const IMPLICIT_TLS_PORT = 465;

function buildOptions(): SMTPPool.Options {
  const port = Number(process.env.SMTP_PORT ?? IMPLICIT_TLS_PORT);

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`SMTP_PORT is not a valid port number: ${process.env.SMTP_PORT}`);
  }

  return {
    host: required("SMTP_HOST"),
    port,
    /* 465 speaks TLS from the first byte; 587 opens in the clear and is
       upgraded by STARTTLS. `requireTLS` is what makes the second case a
       guarantee rather than a preference — without it nodemailer would fall
       back to an unencrypted session if the server declined to upgrade, and
       an App Password would go out in plaintext. */
    secure: port === IMPLICIT_TLS_PORT,
    requireTLS: port !== IMPLICIT_TLS_PORT,
    auth: {
      user: required("SMTP_USER"),
      pass: required("SMTP_PASS"),
    },
    /* One TCP connection, reused across sends. Gmail counts connections as
       well as messages, and opening a fresh one per email is what gets a
       sender rate-limited before it gets anywhere near the daily cap. */
    pool: true,
    maxConnections: 2,
    maxMessages: 100,
    /* A hung SMTP socket must not hold a Server Action open. Gmail answers in
       well under a second when it is healthy. */
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  };
}

/**
 * Built once per server process, on first use rather than at import.
 *
 * Lazy on purpose: `next build` imports every module it traces, and a
 * transporter constructed at import time would make a missing `SMTP_PASS`
 * fail the *build* — including builds of pages that send no mail at all.
 */
let instance: Transporter<SMTPPool.SentMessageInfo> | null = null;

export function transporter(): Transporter<SMTPPool.SentMessageInfo> {
  instance ??= nodemailer.createTransport(buildOptions());
  return instance;
}

/** The envelope sender. Gmail rewrites this to `SMTP_USER` unless the address
 *  is a verified alias, so the two are normally the same mailbox. */
export function fromAddress(): string {
  return process.env.SMTP_FROM?.trim() || required("SMTP_USER");
}

/**
 * Where a new-order notification goes. Falls back to the placeholder the brief
 * specifies; `STORE_OWNER_EMAIL` is what should actually be set.
 */
export function ownerAddress(): string {
  return process.env.STORE_OWNER_EMAIL?.trim() || "owner@store.com";
}

export interface TransporterCheck {
  ok: boolean;
  error?: string;
}

/**
 * Open a connection and authenticate, without sending anything.
 *
 * Call it from an admin health route or a startup hook to find out that the
 * App Password is wrong at a moment somebody is looking, rather than on the
 * first real order. Never throws — a health check that crashes the thing it
 * is checking is worse than useless.
 */
export async function verifyTransporter(): Promise<TransporterCheck> {
  try {
    await transporter().verify();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[email] SMTP verification failed:", message);
    return { ok: false, error: message };
  }
}
