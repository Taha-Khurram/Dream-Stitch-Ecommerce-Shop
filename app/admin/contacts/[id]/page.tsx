import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminHeading } from "@/components/admin/AdminHeading";
import { MessageStatusPill } from "@/components/admin/InboxPills";
import { InboxNotInstalled } from "@/components/admin/InboxNotInstalled";
import {
  MarkReadOnOpen,
  MessageDeleteButton,
  MessageStatusControl,
} from "@/components/admin/MessageActions";
import { isMissingInstall } from "@/lib/inbox/install";
import { messageReference, replyMailto } from "@/lib/inbox/lifecycle";
import { Mail, MessageSquare, Reply, UserCheck } from "lucide-react";
import type { ContactMessage } from "@/types/ecommerce";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/contacts";

/** How many of the sender's other messages to list beside this one. */
const HISTORY_LIMIT = 5;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fullDate(value: string): string {
  return new Date(value).toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * One message, in full.
 *
 * The screen is arranged around the fact that the reply does not happen here.
 * There is no outbound mail in this app and there should not be one behind an
 * admin panel — an answer sent from the care mailbox lands in a mailbox the
 * rest of the team can search, which a row in this table never would. So the
 * left column is for reading and the right column is for the two things the
 * panel is actually responsible for: recording where the message got to, and
 * handing the reply off to a real mail client with the thread already set up.
 */
export default async function AdminContactMessagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  /* Refused before it reaches Postgres: an id that is not a uuid is a typo or
     a probe, and `.eq()` on a malformed uuid is an error rather than no rows. */
  if (!UUID.test(id)) notFound();

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("contact_messages")
    .select("id, user_id, name, email, subject, message, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error && isMissingInstall(error)) {
    return (
      <div>
        <AdminHeading
          title="Contacts"
          copy="Messages sent through the form on /contact."
          action={
            <Link href={BASE_PATH} className="btn-outline">
              Back
            </Link>
          }
        />
        <InboxNotInstalled noun="contact messages" />
      </div>
    );
  }

  if (!data) notFound();

  const message = data as ContactMessage;

  /* Everything else this address has written, so a reply is not composed
     without the thread. Cheap: idx_contact_messages_email_created serves it
     exactly. Failures are swallowed — the panel is context, and losing it must
     not take the message down with it. */
  const { data: historyRows } = await supabase
    .from("contact_messages")
    .select("id, subject, status, created_at")
    .eq("email", message.email)
    .neq("id", message.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  const history = (historyRows ?? []) as Pick<
    ContactMessage,
    "id" | "subject" | "status" | "created_at"
  >[];

  return (
    <div>
      {/* Renders nothing. Marks this message read now that somebody is
          looking at it — see the note on the component. */}
      <MarkReadOnOpen id={message.id} status={message.status} />

      <AdminHeading
        title={message.subject}
        copy={`${messageReference(message.id)} · from ${message.name} · ${fullDate(
          message.created_at
        )}`}
        action={
          <Link href={BASE_PATH} className="btn-outline">
            Back
          </Link>
        }
      />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* ── Reading column ───────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between gap-4">
            <h2 className="admin-section-title">Message</h2>
            <MessageStatusPill status={message.status} />
          </div>

          {/* `whitespace-pre-wrap` is the whole point of this block: the
              paragraphs and line breaks somebody typed are part of what they
              said, and collapsing them turns a clear question into a wall. */}
          <div className="mt-4 border border-line bg-white p-6">
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">
              {message.message}
            </p>
          </div>

          <p className="admin-hint mt-3">
            {message.message.length.toLocaleString()} characters
            {message.updated_at !== message.created_at && (
              <> · status last changed {fullDate(message.updated_at)}</>
            )}
          </p>

          {history.length > 0 && (
            <section className="mt-10">
              <h2 className="admin-section-title">
                Also from {message.email}
              </h2>
              <p className="admin-hint mt-1">
                The {history.length === 1 ? "other message" : `last ${history.length} messages`}{" "}
                from this address. Worth a glance before replying.
              </p>

              <ul className="mt-4 divide-y divide-line border-y border-line">
                {history.map((other) => (
                  <li key={other.id} className="flex items-center gap-4 py-3">
                    <MessageSquare
                      className="h-3.5 w-3.5 shrink-0 text-faint"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                    <Link
                      href={`${BASE_PATH}/${other.id}`}
                      className="min-w-0 flex-1 truncate text-[13px] text-ink transition-colors hover:text-purple"
                    >
                      {other.subject}
                    </Link>
                    <span className="admin-hint shrink-0">{shortDate(other.created_at)}</span>
                    <span className="shrink-0">
                      <MessageStatusPill status={other.status} />
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ── Acting column ────────────────────────────────────────────── */}
        <div className="space-y-8">
          <section>
            <h2 className="admin-section-title">Sender</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="admin-label">Name</dt>
                <dd className="mt-0.5 text-ink">{message.name}</dd>
              </div>
              <div>
                <dt className="admin-label">Email</dt>
                <dd className="mt-0.5">
                  <a
                    href={`mailto:${message.email}`}
                    className="flex items-center gap-1.5 break-all text-ink-soft transition-colors hover:text-purple"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                    {message.email}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="admin-label">Account</dt>
                <dd className="mt-0.5 text-ink-soft">
                  {/* Not a link: `user_id` points at auth.users, and there is
                      no per-account screen in the panel to send anyone to.
                      What it answers is whether this person can be found in
                      the customer book by the address above. */}
                  {message.user_id ? (
                    <span className="flex items-center gap-1.5 text-jade">
                      <UserCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                      Signed in when they wrote
                    </span>
                  ) : (
                    <span className="text-muted">Wrote in as a guest</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="admin-label">Received</dt>
                <dd className="mt-0.5 text-ink-soft">{fullDate(message.created_at)}</dd>
              </div>
            </dl>

            <a
              href={replyMailto({ email: message.email, subject: message.subject })}
              className="btn-primary mt-5 flex w-full items-center justify-center gap-2"
            >
              <Reply className="h-4 w-4" strokeWidth={1.75} />
              Reply by email
            </a>
            <p className="admin-hint mt-2">
              Opens your mail client with the address and subject filled in. Mark the message
              replied below once it has gone.
            </p>
          </section>

          <section>
            <h2 className="admin-section-title">Status</h2>
            <div className="mt-4">
              <MessageStatusControl id={message.id} current={message.status} />
            </div>
          </section>

          <section>
            <h2 className="admin-section-title">Danger zone</h2>
            <div className="mt-4">
              <MessageDeleteButton id={message.id} onDeleted={BASE_PATH} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
