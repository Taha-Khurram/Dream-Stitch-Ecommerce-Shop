import React from "react";

/**
 * CSS-only switch. The hidden "off" ahead of the checkbox is what tells the
 * server the field was on the form at all — an unchecked checkbox posts
 * nothing, so without it "off" and "this form does not have that field" arrive
 * looking identical. See `parseContentForm`.
 *
 * Deliberately not a client component: it is a label, two inputs and some
 * `peer-checked:` classes, with no state of its own, so the same markup serves
 * the client-side content editor and the server-rendered settings forms.
 */
export function Switch({
  name,
  checked,
  label,
}: {
  name: string;
  checked: boolean;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input type="hidden" name={name} value="off" />
      <input type="checkbox" name={name} value="on" defaultChecked={checked} className="peer sr-only" />
      <span className="relative block h-5 w-9 shrink-0 border border-line bg-white transition-colors after:absolute after:left-[3px] after:top-1/2 after:h-3 after:w-3 after:-translate-y-1/2 after:bg-line after:transition-transform peer-checked:border-purple peer-checked:bg-purple peer-checked:after:translate-x-4 peer-checked:after:bg-white peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-purple" />
      <span className="text-[13px] font-medium text-ink-soft">{label}</span>
    </label>
  );
}
