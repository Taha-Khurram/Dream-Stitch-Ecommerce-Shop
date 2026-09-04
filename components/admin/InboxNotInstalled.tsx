import React from "react";

/**
 * What both inbox screens show when `inbox_schema.sql` has not been run.
 *
 * The alternative — rendering the empty state — is the failure mode worth
 * spending a component to avoid. "No messages yet" and "the table does not
 * exist" look identical on screen and mean opposite things, and the one that
 * gets believed is the reassuring one. An admin would conclude that nobody has
 * written in, and the form on /contact would go on answering 501 to every
 * visitor who tried, for as long as it took somebody to notice.
 *
 * Same contract as the panel on /admin/customers, and as the 501 from the two
 * public endpoints: name the file, say what to do with it.
 */
export function InboxNotInstalled({ noun }: { noun: string }) {
  return (
    <div className="mt-10 border border-line bg-white p-10 text-center">
      <p className="text-sm text-ink">The {noun} table is not there yet.</p>
      <p className="admin-hint mx-auto mt-2 max-w-md">
        Run <code className="text-ink">inbox_schema.sql</code> in the Supabase SQL editor, then
        reload this page. Until it has been applied the storefront forms cannot save anything
        either — they answer with the same message.
      </p>
    </div>
  );
}
