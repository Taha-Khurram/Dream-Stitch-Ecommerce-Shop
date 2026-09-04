"use client";

import React, { useId, useRef, useState } from "react";
import { Section } from "@/components/layout/Section";
import type { SiteContent } from "@/lib/content/defaults";
import { newsletterSubscribeSchema } from "@/lib/validations/inbox";
import { ArrowRight, Check, Loader2 } from "lucide-react";

/**
 * The newsletter — the homepage's closing note.
 *
 * This used to sit in the global footer and so repeated on every page. It also
 * used to post to `#`, which threw the address away; it now goes to
 * /api/newsletter and lands in `newsletter_subscribers`, where the panel reads
 * it at /admin/newsletter.
 *
 * Three things shape the interaction, all of them about not making somebody
 * think:
 *
 * 1. **The address is validated here before it is sent.** A typo comes back in
 *    the same tick, under the field, rather than after a round trip.
 *
 * 2. **"You are already subscribed" is a success.** The API says so too. It is
 *    what happened, the person did nothing wrong, and a red box for a harmless
 *    repeat is a small insult. The only difference is the sentence.
 *
 * 3. **The confirmation replaces the form in place.** Same block, same height —
 *    nothing below it moves. A layout that jumps at the moment of success
 *    reads as a failure for the half-second before you can re-read it.
 */
export function HomeClosing({ content }: { content: SiteContent["home"]["newsletter"] }) {
  const inputId = useId();
  const errorId = `${inputId}-error`;

  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending) return;

    const parsed = newsletterSubscribeSchema.safeParse({ email, source: "home" });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check that address and try again.");
      inputRef.current?.focus();
      return;
    }

    setError(null);
    setPending(true);

    try {
      const response = await fetch("/api/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        setError(
          payload?.error ??
            "Could not sign you up just now. Please try again in a moment."
        );
        inputRef.current?.focus();
        return;
      }

      /* The API sends the sentence for the outcome it actually recorded —
         subscribed, welcomed back, or already on the list. The editable copy
         is the fallback for the ordinary case. */
      setDone(payload.message ?? content.success_copy);
      setEmail("");
    } catch {
      /* Offline, or the request never left. Nothing was recorded, so the form
         stays exactly as it was and can simply be sent again. */
      setError("No connection. Check it and try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <Section>
      <div className="flex flex-col items-center gap-6 text-center lg:flex-row lg:justify-between lg:gap-16 lg:text-left">
        <div className="max-w-md">
          <h2 className="font-[family-name:var(--font-display)] text-[26px] leading-tight text-ink">
            {content.title}
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{content.copy}</p>
        </div>

        {/* Both states live in a block of the same width, so the column does
            not resize when one replaces the other. */}
        <div className="w-full max-w-md">
          {done ? (
            <p
              role="status"
              className="animate-confirm flex items-center justify-center gap-2.5 border-b border-jade py-3 text-[13px] text-ink lg:justify-start"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-jade text-white">
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
              {done}
            </p>
          ) : (
            <form onSubmit={submit} noValidate>
              <div
                className={`flex items-center border-b transition-colors ${
                  error ? "border-sale" : "border-ink"
                }`}
              >
                <input
                  ref={inputRef}
                  id={inputId}
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    /* Clear on the first keystroke after a rejection: the
                       message was about the old value, and leaving it up while
                       someone fixes the typo is the form arguing with them. */
                    if (error) setError(null);
                  }}
                  disabled={pending}
                  placeholder={content.placeholder}
                  aria-label="Email address"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className="w-full bg-transparent py-3 text-[13px] text-ink placeholder-muted focus:outline-none disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={pending}
                  className="eyebrow flex shrink-0 cursor-pointer items-center gap-1.5 py-3 pl-4 text-ink transition-colors hover:text-purple disabled:cursor-wait disabled:text-muted"
                >
                  {pending ? (
                    <>
                      Sending
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    </>
                  ) : (
                    <>
                      {content.button_label}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>

              {/* Always mounted so the announcement is picked up, and so the
                  line appearing does not shove the footer down a pixel. */}
              <p
                id={errorId}
                role="status"
                className={`mt-2 min-h-[1.25rem] text-[12px] leading-tight text-sale transition-opacity ${
                  error ? "opacity-100" : "opacity-0"
                }`}
              >
                {error}
              </p>
            </form>
          )}
        </div>
      </div>
    </Section>
  );
}
