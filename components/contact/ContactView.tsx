"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { SiteContent } from "@/lib/content/defaults";
import { Plus, Minus, Check } from "lucide-react";

/**
 * The contact page proper. It is a client component for the form state and the
 * accordion, so the copy arrives as a prop from the server page rather than
 * being read here.
 */
export function ContactView({ content }: { content: SiteContent["contact"] }) {
  const { hero, form: formCopy, faqs } = content;

  const [submitted, setSubmitted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const inputClass =
    "w-full border-b border-line bg-transparent py-2.5 text-[13px] text-ink placeholder-faint transition-colors focus:border-ink focus:outline-none";

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
              <div className="mt-8 border border-line bg-frost p-8 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-jade text-white">
                  <Check className="h-5 w-5" />
                </span>
                <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl text-ink">
                  {formCopy.success_title}
                </h3>
                <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-ink-soft">
                  Thank you{form.name ? `, ${form.name}` : ""}. {formCopy.success_copy}
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setForm({ name: "", email: "", subject: "", message: "" });
                  }}
                  className="btn-outline mt-7 cursor-pointer"
                >
                  Send Another
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label htmlFor="name" className="eyebrow text-muted">
                      Name
                    </label>
                    <input
                      id="name"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your name"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="email" className="eyebrow text-muted">
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="you@example.com"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="subject" className="eyebrow text-muted">
                    Subject
                  </label>
                  <input
                    id="subject"
                    required
                    value={form.subject}
                    onChange={(e) => setForm({ ...form, subject: e.target.value })}
                    placeholder="Custom size for a king bed"
                    className={inputClass}
                  />
                </div>

                <div>
                  <label htmlFor="message" className="eyebrow text-muted">
                    Message
                  </label>
                  <textarea
                    id="message"
                    required
                    rows={5}
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    placeholder="Tell us how we can help…"
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <button type="submit" className="btn-primary w-full cursor-pointer sm:w-auto">
                  {formCopy.button_label}
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
