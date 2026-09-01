"use client";

import React, { useState } from "react";
import Link from "next/link";
import { IMG, img } from "@/lib/imagery";
import { Plus, Minus, Check } from "lucide-react";

const FAQS = [
  {
    q: "How long does delivery take?",
    a: "Stocked sets leave our Karachi studio within 24 hours. Delivery takes 3–5 working days nationwide, and 2 days within Karachi. You will receive a tracking link by SMS. Custom-size orders are cut first and dispatch in 7–10 working days.",
  },
  {
    q: "How does the custom size service work?",
    a: "Send us three numbers — mattress width, mattress length and the drop you want on each side — through the custom order page or on WhatsApp. We confirm the price, cut the same fabric to your measurements, and dispatch in 7–10 working days.",
  },
  {
    q: "What is the difference between pure cotton, cotton zeen and cotton satin?",
    a: "Pure cotton is the coolest and most breathable, best for hot months. Cotton zeen is close-woven and crease-resistant, our easiest everyday option. Cotton satin is cotton finished in a satin weave, with a low sheen and a smoother hand.",
  },
  {
    q: "Can I exchange a bedsheet I bought online?",
    a: "Yes — within 7 days, unused and in its original packing, by courier or at the studio. Made-to-order sets are cut for one bed only, so they cannot be exchanged.",
  },
  {
    q: "Will the colour fade?",
    a: "Our sets are dyed for repeated machine washing. Wash cold with like colours and dry in shade rather than direct sun, and the colour will hold for years.",
  },
];

export default function ContactPage() {
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
      <section className="relative h-[260px] w-full overflow-hidden bg-lilac sm:h-[340px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img(IMG.storyAtelier, 1900)}
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-aubergine/55" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="eyebrow text-white/80">We&apos;re Here</span>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[36px] leading-tight text-white sm:text-[48px]">
            Customer Care
          </h1>
          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-white/85">
            We are available 24/7 online for your concerns — send a message any time and we
            answer within a few hours.
          </p>
        </div>
      </section>

      {/* Form */}
      <section className="mx-auto max-w-2xl px-6 py-16 sm:py-20">
        <div>
          <span className="eyebrow text-purple">Write to Us</span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink">
            Send a message
          </h2>

          {submitted ? (
            <div className="mt-8 border border-line bg-frost p-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-jade text-white">
                <Check className="h-5 w-5" />
              </span>
              <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl text-ink">
                Message received
              </h3>
              <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-ink-soft">
                Thank you{form.name ? `, ${form.name}` : ""}. Our care team will reply to{" "}
                {form.email || "your email"} within one working day.
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
                Send Message
              </button>
            </form>
          )}
        </div>
      </section>

      {/* FAQs */}
      <section className="border-t border-line bg-frost">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <div className="text-center">
            <span className="eyebrow text-purple">Answers</span>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink sm:text-[36px]">
              Frequently Asked
            </h2>
          </div>

          <div className="mt-10 border-t border-line">
            {FAQS.map((faq, i) => {
              const expanded = openFaq === i;
              return (
                <div key={faq.q} className="border-b border-line">
                  <button
                    onClick={() => setOpenFaq(expanded ? null : i)}
                    aria-expanded={expanded}
                    className="flex w-full cursor-pointer items-center justify-between gap-6 py-5 text-left"
                  >
                    <span className="text-[14px] text-ink">{faq.q}</span>
                    {expanded ? (
                      <Minus className="h-4 w-4 shrink-0 text-muted" />
                    ) : (
                      <Plus className="h-4 w-4 shrink-0 text-muted" />
                    )}
                  </button>
                  {expanded && (
                    <p className="pb-6 text-[13px] leading-relaxed text-ink-soft">{faq.a}</p>
                  )}
                </div>
              );
            })}
          </div>

          <p className="mt-10 text-center text-[13px] text-ink-soft">
            Still stuck?{" "}
            <Link href="/custom" className="link-rule text-ink">
              Start a custom order
            </Link>{" "}
            or write to us above — a person always replies.
          </p>
        </div>
      </section>
    </div>
  );
}
