"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import type { SiteContent } from "@/lib/content/defaults";
import {
  MESSAGE_MAX_LENGTH,
  contactMessageSchema,
  type ContactMessageInput,
} from "@/lib/validations/inbox";
import { Plus, Minus, Check, AlertCircle, Loader2 } from "lucide-react";

/**
 * The contact page proper. It is a client component for the form state and the
 * accordion, so the copy arrives as a prop from the server page rather than
 * being read here.
 *
 * The form used to be a lie: `handleSubmit` called `preventDefault()`, set a
 * boolean, and rendered the thank-you panel over a message that had gone
 * nowhere. It now POSTs to /api/contact and the message lands in
 * `contact_messages`, where the panel reads it at /admin/contacts.
 *
 * Everything below the fetch is about the four ways this can go and making
 * each one legible:
 *
 * - **Rejected by validation.** Checked here first, against the same Zod schema
 *   the route uses, so the messages appear under the offending fields with no
 *   round trip. If the server disagrees anyway its `details` are keyed by field
 *   name and land in the same places.
 * - **Sent.** The panel appears, the fields are cleared, and Send Another puts
 *   an empty form back.
 * - **Sent twice.** The API treats an identical repeat inside five minutes as
 *   the same message and answers success, so a double-clicked button shows the
 *   thank-you panel rather than an error — and the inbox holds one copy.
 * - **Failed.** The fields keep everything that was typed. Losing a paragraph
 *   somebody has just written because the network blinked is the one outcome
 *   that is genuinely unforgivable.
 */

type FieldName = keyof ContactMessageInput;

const EMPTY: ContactMessageInput = { name: "", email: "", subject: "", message: "" };

export function ContactView({ content }: { content: SiteContent["contact"] }) {
  const { hero, form: formCopy, faqs } = content;

  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [form, setForm] = useState<ContactMessageInput>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  /* Kept so the name can still be greeted on the success panel after the
     fields themselves have been cleared. */
  const [sentName, setSentName] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const set = (field: FieldName) => (value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    /* A field's own message goes on its first keystroke — it described the old
       value. The form-wide one stays until the next attempt, because it is
       about the request rather than about anything being typed. */
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  /** Move focus to the first field that failed, so the fix starts there. */
  const focusFirstError = (fields: Partial<Record<FieldName, string>>) => {
    const order: FieldName[] = ["name", "email", "subject", "message"];
    const first = order.find((field) => fields[field]);
    if (!first) return;
    formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;

    setFormError(null);

    const parsed = contactMessageSchema.safeParse(form);

    if (!parsed.success) {
      const fields: Partial<Record<FieldName, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldName | undefined;
        if (field && !fields[field]) fields[field] = issue.message;
      }
      setErrors(fields);
      focusFirstError(fields);
      return;
    }

    setErrors({});
    setPending(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok || !payload?.success) {
        /* Field-keyed messages from the route's Zod flatten. Only reachable if
           the two schemas ever drift, but it costs one branch to handle it
           properly instead of showing a generic "Validation failed". */
        const details = payload?.details as Record<string, string[]> | undefined;

        if (details) {
          const fields: Partial<Record<FieldName, string>> = {};
          for (const [field, messages] of Object.entries(details)) {
            if (messages?.[0]) fields[field as FieldName] = messages[0];
          }
          if (Object.keys(fields).length > 0) {
            setErrors(fields);
            focusFirstError(fields);
            return;
          }
        }

        setFormError(
          payload?.error ?? "Your message did not send. Please try again in a moment."
        );
        return;
      }

      setSentName(parsed.data.name);
      setSubmitted(true);
      setForm(EMPTY);
    } catch {
      /* The request never left — nothing was written, and everything typed is
         still in state, so sending again is the whole recovery. */
      setFormError("No connection. Your message has not been sent — check and try again.");
    } finally {
      setPending(false);
    }
  };

  const inputClass =
    "w-full border-b bg-transparent py-2.5 text-[13px] text-ink placeholder-faint transition-colors focus:outline-none disabled:opacity-60";

  /** A field's border and describedby, driven by whether it is in error. */
  const fieldProps = (field: FieldName) => ({
    name: field,
    disabled: pending,
    "aria-invalid": errors[field] ? (true as const) : undefined,
    "aria-describedby": errors[field] ? `${field}-error` : undefined,
    className: `${inputClass} ${errors[field] ? "border-sale focus:border-sale" : "border-line focus:border-ink"}`,
  });

  const remaining = MESSAGE_MAX_LENGTH - form.message.length;

  return (
    <div className="pb-8">
      {/* Hero */}
      {hero.enabled && (
        <section className="relative h-[260px] w-full overflow-hidden bg-lilac sm:h-[340px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={hero.image} alt="" className="h-full w-full object-cover object-center" />
          <div className="absolute inset-0 bg-aubergine/55" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <span className="eyebrow text-white/80">{hero.eyebrow}</span>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-[36px] leading-tight text-white sm:text-[48px]">
              {hero.title}
            </h1>
            <p className="mt-3 max-w-md text-[13px] leading-relaxed text-white/85">{hero.copy}</p>
          </div>
        </section>
      )}

      {/* Form */}
      {formCopy.enabled && (
        <section className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
          <div>
            <span className="eyebrow text-purple">{formCopy.eyebrow}</span>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink">
              {formCopy.title}
            </h2>

            {submitted ? (
              <div className="animate-confirm mt-8 border border-line bg-frost p-8 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-jade text-white">
                  <Check className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl text-ink">
                  {formCopy.success_title}
                </h3>
                <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-ink-soft">
                  Thank you{sentName ? `, ${sentName}` : ""}. {formCopy.success_copy}
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setForm(EMPTY);
                    setErrors({});
                    setFormError(null);
                  }}
                  className="btn-outline mt-7 cursor-pointer"
                >
                  Send Another
                </button>
              </div>
            ) : (
              <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-8 space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="eyebrow text-muted">
                      Name
                    </label>
                    <input
                      id="name"
                      autoComplete="name"
                      value={form.name}
                      onChange={(e) => set("name")(e.target.value)}
                      placeholder="Your name"
                      {...fieldProps("name")}
                    />
                    <FieldError field="name" message={errors.name} />
                  </div>
                  <div>
                    <label htmlFor="email" className="eyebrow text-muted">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={(e) => set("email")(e.target.value)}
                      placeholder="you@example.com"
                      {...fieldProps("email")}
                    />
                    <FieldError field="email" message={errors.email} />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="eyebrow text-muted">
                    Subject
                  </label>
                  <input
                    id="subject"
                    value={form.subject}
                    onChange={(e) => set("subject")(e.target.value)}
                    placeholder="Custom size for a king bed"
                    {...fieldProps("subject")}
                  />
                  <FieldError field="subject" message={errors.subject} />
                </div>

                <div>
                  <div className="flex items-baseline justify-between gap-4">
                    <label htmlFor="message" className="eyebrow text-muted">
                      Message
                    </label>
                    {/* Only once it is worth knowing. A counter that watches
                        from character one is a limit being brandished. */}
                    {remaining <= 400 && (
                      <span
                        className={`text-[11px] tabular-nums ${
                          remaining < 0 ? "text-sale" : "text-faint"
                        }`}
                      >
                        {remaining.toLocaleString()} left
                      </span>
                    )}
                  </div>
                  <textarea
                    id="message"
                    rows={5}
                    value={form.message}
                    onChange={(e) => set("message")(e.target.value)}
                    placeholder="Tell us how we can help…"
                    {...fieldProps("message")}
                    className={`${fieldProps("message").className} resize-none`}
                  />
                  <FieldError field="message" message={errors.message} />
                </div>

                {formError && (
                  <p
                    role="alert"
                    className="flex items-start gap-2 border border-sale/30 bg-sale/5 px-4 py-3 text-[13px] leading-relaxed text-sale"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={pending}
                  className="btn-primary inline-flex w-full cursor-pointer items-center justify-center gap-2 disabled:cursor-wait disabled:opacity-70 sm:w-auto"
                >
                  {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {pending ? "Sending…" : formCopy.button_label}
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      {/* FAQs */}
      {faqs.enabled && faqs.items.length > 0 && (
        <section className="border-t border-line bg-frost">
          <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
            <div className="text-center">
              <span className="eyebrow text-purple">{faqs.eyebrow}</span>
              <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink sm:text-[36px]">
                {faqs.title}
              </h2>
            </div>

            <div className="mt-10 border-t border-line">
              {faqs.items.map((faq, i) => {
                const expanded = openFaq === i;
                return (
                  <div key={faq.question} className="border-b border-line">
                    <button
                      onClick={() => setOpenFaq(expanded ? null : i)}
                      aria-expanded={expanded}
                      className="flex w-full cursor-pointer items-center justify-between gap-6 py-5 text-left"
                    >
                      <span className="text-[14px] text-ink">{faq.question}</span>
                      {expanded ? (
                        <Minus className="h-4 w-4 shrink-0 text-muted" />
                      ) : (
                        <Plus className="h-4 w-4 shrink-0 text-muted" />
                      )}
                    </button>
                    {expanded && (
                      <p className="pb-6 text-[13px] leading-relaxed text-ink-soft">{faq.answer}</p>
                    )}
                  </div>
                );
              })}
            </div>

            {(faqs.note || faqs.note_cta_label) && (
              <p className="mt-10 text-center text-[13px] text-ink-soft">
                {faqs.note}{" "}
                {faqs.note_cta_label && (
                  <Link href={faqs.note_cta_href || "/custom"} className="link-rule text-ink">
                    {faqs.note_cta_label}
                  </Link>
                )}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * One field's message.
 *
 * Always mounted, so the row of inputs does not shift downward the moment a
 * message appears — the reserved line is 1rem whether or not it holds text.
 */
function FieldError({ field, message }: { field: string; message?: string }) {
  return (
    <p
      id={`${field}-error`}
      role="status"
      className={`mt-1.5 min-h-4 text-[12px] leading-tight text-sale transition-opacity ${
        message ? "opacity-100" : "opacity-0"
      }`}
    >
      {message}
    </p>
  );
}
