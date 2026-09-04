import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MessageStatusPill } from "@/components/admin/InboxPills";
import { MarkRepliedButton } from "@/components/admin/MessageActions";
import { InboxNotInstalled } from "@/components/admin/InboxNotInstalled";
import { Pagination, PaginationSkeleton } from "@/components/admin/Pagination";
import { Skeleton } from "@/components/motion/Skeleton";
import { buildPageHref, lastPageFor, rangeFor, type PerPage } from "@/lib/pagination";
import { isMissingInstall } from "@/lib/inbox/install";
import {
  MESSAGE_STATUSES,
  MESSAGE_STATUS_COPY,
  OPEN_MESSAGE_STATUSES,
  isOpenMessage,
} from "@/lib/inbox/lifecycle";
import type { ContactMessage } from "@/types/ecommerce";

export const BASE_PATH = "/admin/contacts";

/**
 * The filter rail: everything, the two that are still owed an answer, then
 * each status on its own.
 *
 * Derived from `MESSAGE_STATUSES` rather than hand-listed, so a status added to
 * the lifecycle cannot end up unreachable here. `unanswered` is the one that is
 * not a column value — it spans `new` and `read`, which is the distinction the
 * screen exists to make: opening a message is not the same as dealing with it.
 */
export const FILTERS = ["all", "unanswered", ...MESSAGE_STATUSES] as const;
export type MessageFilter = (typeof FILTERS)[number];

export function filterLabel(filter: MessageFilter): string {
  if (filter === "all") return "All";
  if (filter === "unanswered") return "Unanswered";
  return MESSAGE_STATUS_COPY[filter].label;
}

/** The status filter as search params — the shape the pager URLs build on. */
export function filterParams(status: MessageFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  return params;
}

/**
 * How much of the body the list shows.
 *
 * Sliced on the server rather than clamped in CSS, so a four-thousand-character
 * message does not travel to the browser twenty times over to render one line
 * of it. The preview is what makes an inbox scannable — a column of subjects
 * alone tells you almost nothing about which one to open first.
 */
const PREVIEW_LENGTH = 150;

function preview(message: string): string {
  /* Newlines collapse: the preview is one line, and a message that opens with
     a blank line would otherwise render as an empty cell. */
  const flat = message.replace(/\s+/g, " ").trim();
  return flat.length > PREVIEW_LENGTH ? `${flat.slice(0, PREVIEW_LENGTH).trimEnd()}…` : flat;
}

const COLUMNS = "id, name, email, subject, message, status, created_at";

export async function ContactsTable({
  status,
  page,
  perPage,
}: {
  status: MessageFilter;
  page: number;
  perPage: PerPage;
}) {
  const supabase = await createClient();
  const { from, to } = rangeFor(page, perPage);

  let request = supabase
    .from("contact_messages")
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status === "unanswered") request = request.in("status", [...OPEN_MESSAGE_STATUSES]);
  else if (status !== "all") request = request.eq("status", status);

  const { data, count, error } = await request;

  /* The table only exists once inbox_schema.sql has been applied. Say so
     plainly rather than rendering an empty list that reads as "nobody has
     written in" — see the note in InboxNotInstalled. */
  if (error) {
    if (isMissingInstall(error)) return <InboxNotInstalled noun="contact messages" />;

    return (
      <p className="mt-10 border border-sale/30 bg-sale/5 p-10 text-center text-sm text-sale">
        Could not load the inbox. {error.message}
      </p>
    );
  }

  const messages = (data ?? []) as ContactMessage[];
  const total = count ?? 0;
  const lastPage = lastPageFor(total, perPage);

  /* Past the end — a stale bookmark, or the filter narrowed since. Land on the
     last real page rather than an empty table. */
  if (messages.length === 0 && total > 0 && page > lastPage) {
    redirect(buildPageHref(BASE_PATH, filterParams(status), { page: lastPage, perPage }));
  }

  if (messages.length === 0) {
    return (
      <p className="mt-10 border border-line bg-white p-12 text-center text-sm text-muted">
        {status === "all"
          ? "No messages yet. Anything sent through the form on /contact lands here."
          : `No ${filterLabel(status).toLowerCase()} messages.`}
      </p>
    );
  }

  return (
    <>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              {["From", "Message", "Received", "Status"].map((head) => (
                <th key={head} className="admin-th pb-3">
                  {head}
                </th>
              ))}
              {/* Screen readers only — a visible "Actions" label over one
                  button earns nothing but width. */}
              <th className="admin-th pb-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {messages.map((message) => (
              <tr
                key={message.id}
                className="border-b border-line align-top transition-colors hover:bg-frost"
              >
                <td className="max-w-[13rem] py-3.5">
                  <span className="block truncate font-medium text-ink">{message.name}</span>
                  <a
                    href={`mailto:${message.email}`}
                    className="admin-hint block max-w-full truncate transition-colors hover:text-purple"
                  >
                    {message.email}
                  </a>
                </td>

                {/* The subject is the link, and it carries the weight — the
                    preview under it is there to be skimmed, not clicked. */}
                <td className="max-w-[24rem] py-3.5">
                  <Link
                    href={`${BASE_PATH}/${message.id}`}
                    className="block truncate font-medium text-ink transition-colors hover:text-purple"
                  >
                    {message.subject}
                  </Link>
                  <span className="admin-hint mt-0.5 block truncate">
                    {preview(message.message)}
                  </span>
                </td>

                <td className="py-3.5 whitespace-nowrap text-muted">
                  {new Date(message.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>

                <td className="py-3.5">
                  <MessageStatusPill status={message.status} />
                </td>

                {/* Ticking a message off from the list is worth a button; the
                    rest of its states are a decision made with the message in
                    front of you, so those rows link to it instead. */}
                <td className="py-3.5 text-right">
                  {isOpenMessage(message.status) ? (
                    <div className="flex justify-end">
                      <MarkRepliedButton id={message.id} />
                    </div>
                  ) : (
                    <Link
                      href={`${BASE_PATH}/${message.id}`}
                      className="text-[12px] font-medium text-muted transition-colors hover:text-purple"
                    >
                      Open
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination
        basePath={BASE_PATH}
        total={total}
        page={page}
        perPage={perPage}
        noun="message"
      />
    </>
  );
}

/* Capped rather than tracking `perPage`: see the note in ProductsTable. */
const SKELETON_ROWS = 10;

export function ContactsTableSkeleton() {
  return (
    <>
      <div className="mt-4 border border-line" aria-hidden>
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-soft px-4 py-4">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="ml-auto h-3 w-24" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-6 w-24" />
          </div>
        ))}
      </div>
      <PaginationSkeleton />
    </>
  );
}
