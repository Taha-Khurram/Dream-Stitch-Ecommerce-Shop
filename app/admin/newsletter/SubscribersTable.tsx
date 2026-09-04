import React from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SubscriberStatusPill } from "@/components/admin/InboxPills";
import { SubscriberRowActions } from "@/components/admin/SubscriberActions";
import { InboxNotInstalled } from "@/components/admin/InboxNotInstalled";
import { Pagination, PaginationSkeleton } from "@/components/admin/Pagination";
import { Skeleton } from "@/components/motion/Skeleton";
import { buildPageHref, lastPageFor, rangeFor, type PerPage } from "@/lib/pagination";
import { isMissingInstall } from "@/lib/inbox/install";
import {
  SUBSCRIBER_STATUSES,
  SUBSCRIBER_STATUS_COPY,
  sourceLabel,
} from "@/lib/inbox/lifecycle";
import { Mail } from "lucide-react";
import type { NewsletterSubscriber } from "@/types/ecommerce";

export const BASE_PATH = "/admin/newsletter";

/** Everything, or one status. Derived, so a third status could not go missing. */
export const FILTERS = ["all", ...SUBSCRIBER_STATUSES] as const;
export type SubscriberFilter = (typeof FILTERS)[number];

export function filterLabel(filter: SubscriberFilter): string {
  return filter === "all" ? "All" : SUBSCRIBER_STATUS_COPY[filter].label;
}

export function filterParams(status: SubscriberFilter): URLSearchParams {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  return params;
}

const COLUMNS = "id, email, status, source, created_at, updated_at, unsubscribed_at";

function shortDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function SubscribersTable({
  status,
  page,
  perPage,
}: {
  status: SubscriberFilter;
  page: number;
  perPage: PerPage;
}) {
  const supabase = await createClient();
  const { from, to } = rangeFor(page, perPage);

  let request = supabase
    .from("newsletter_subscribers")
    .select(COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (status !== "all") request = request.eq("status", status);

  const { data, count, error } = await request;

  if (error) {
    if (isMissingInstall(error)) return <InboxNotInstalled noun="newsletter subscribers" />;

    return (
      <p className="mt-10 border border-sale/30 bg-sale/5 p-10 text-center text-sm text-sale">
        Could not load the list. {error.message}
      </p>
    );
  }

  const subscribers = (data ?? []) as NewsletterSubscriber[];
  const total = count ?? 0;
  const lastPage = lastPageFor(total, perPage);

  if (subscribers.length === 0 && total > 0 && page > lastPage) {
    redirect(buildPageHref(BASE_PATH, filterParams(status), { page: lastPage, perPage }));
  }

  if (subscribers.length === 0) {
    return (
      <p className="mt-10 border border-line bg-white p-12 text-center text-sm text-muted">
        {status === "all"
          ? "Nobody has signed up yet. The form at the foot of the homepage lands here."
          : `No ${filterLabel(status).toLowerCase()} addresses.`}
      </p>
    );
  }

  return (
    <>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[48rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-ink">
              {["Address", "Status", "Signed up via", "Joined"].map((head) => (
                <th key={head} className="admin-th pb-3">
                  {head}
                </th>
              ))}
              <th className="admin-th pb-3 text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((subscriber) => (
              <tr
                key={subscriber.id}
                className="border-b border-line transition-colors hover:bg-frost"
              >
                <td className="max-w-[20rem] py-3.5">
                  <a
                    href={`mailto:${subscriber.email}`}
                    className="flex items-center gap-1.5 text-ink transition-colors hover:text-purple"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0 text-faint" strokeWidth={1.5} />
                    <span className="truncate font-medium">{subscriber.email}</span>
                  </a>
                </td>

                <td className="py-3.5">
                  <SubscriberStatusPill status={subscriber.status} />
                  {/* Only for the rows it says something about — an
                      unsubscribe date under an active subscriber would be a
                      blank column pretending to be data. */}
                  {subscriber.unsubscribed_at && (
                    <span className="admin-hint mt-1 block whitespace-nowrap">
                      Left {shortDate(subscriber.unsubscribed_at)}
                    </span>
                  )}
                </td>

                <td className="py-3.5 whitespace-nowrap text-ink-soft">
                  {sourceLabel(subscriber.source)}
                </td>

                <td className="py-3.5 whitespace-nowrap text-muted">
                  {shortDate(subscriber.created_at)}
                </td>

                <td className="py-3.5 text-right">
                  <SubscriberRowActions
                    id={subscriber.id}
                    email={subscriber.email}
                    status={subscriber.status}
                  />
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
        noun="subscriber"
      />
    </>
  );
}

/* Capped rather than tracking `perPage`: see the note in ProductsTable. */
const SKELETON_ROWS = 10;

export function SubscribersTableSkeleton() {
  return (
    <>
      <div className="mt-4 border border-line" aria-hidden>
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-line-soft px-4 py-4">
            <Skeleton className="h-3 w-56" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="ml-auto h-3 w-24" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-36" />
          </div>
        ))}
      </div>
      <PaginationSkeleton />
    </>
  );
}
