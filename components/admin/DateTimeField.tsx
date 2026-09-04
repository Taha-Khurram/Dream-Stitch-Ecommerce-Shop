"use client";

import React, { useEffect, useState } from "react";
import { inputClass } from "./field-styles";

/**
 * A date and time, typed in the admin's own timezone and submitted as an
 * instant.
 *
 * A bare `<input type="datetime-local" name="…">` posts `2026-09-10T00:00`
 * with no offset at all, and the server action then has to guess what that
 * meant. `new Date(value)` on the server reads it in the *server's* timezone,
 * which on a deployment is UTC and in Karachi is not — so a code set to start
 * at midnight would quietly start at five in the morning. The bug is invisible
 * in development, where both clocks are the same machine.
 *
 * So the visible control carries no name, and a hidden field beside it carries
 * the ISO instant the browser computed from it. What reaches the action is
 * unambiguous, and what the admin sees is their own clock.
 *
 * The conversion back for an existing value runs in an effect rather than
 * during render, for the same reason: the server has no business rendering a
 * local time, and doing it during render would be a hydration mismatch
 * anywhere the two clocks differ.
 */
export function DateTimeField({
  name,
  defaultValue,
  id,
  "aria-describedby": describedBy,
}: {
  name: string;
  /** An ISO instant, or null for an empty field. */
  defaultValue?: string | null;
  id?: string;
  "aria-describedby"?: string;
}) {
  const [local, setLocal] = useState("");

  useEffect(() => {
    setLocal(toLocalInput(defaultValue));
  }, [defaultValue]);

  return (
    <>
      <input
        type="datetime-local"
        id={id ?? name}
        aria-describedby={describedBy}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        className={inputClass}
      />
      <input type="hidden" name={name} value={toInstant(local)} />
    </>
  );
}

/** `2026-09-10T00:00` in this browser's timezone → the ISO instant it means. */
function toInstant(local: string): string {
  if (!local) return "";
  const parsed = new Date(local);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

/** The reverse, for editing a code that already has a window. */
function toLocalInput(iso?: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (value: number) => String(value).padStart(2, "0");

  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}
