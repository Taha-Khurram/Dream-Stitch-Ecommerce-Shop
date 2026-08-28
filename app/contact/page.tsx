"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BRAND } from "@/lib/constants";
import { IMG, img } from "@/lib/imagery";
import { Mail, Phone, MessageCircle, MapPin, Plus, Minus, Check } from "lucide-react";

const STORES = [
  { city: "Karachi", address: "Dolmen Mall Clifton, Block 4, Marine Drive", hours: "11am – 11pm" },
  { city: "Lahore", address: "Packages Mall, Walton Road, Nishtar Town", hours: "11am – 11pm" },
  { city: "Islamabad", address: "Centaurus Mall, F-8 Markaz, Jinnah Avenue", hours: "11am – 10pm" },
  { city: "Faisalabad", address: "Boulevard Mall, Kohinoor City, Jaranwala Road", hours: "12pm – 10pm" },
];

const FAQS = [
  {
    q: "How long does delivery take?",
    a: "Orders leave our Karachi studio within 24 hours. Delivery takes 3–5 working days nationwide, and 2 days within Karachi. You'll receive a tracking link by SMS.",
  },
  {
    q: "Can I exchange something I bought online?",
    a: "Yes — within 14 days, with tags intact and the original invoice, either by courier or at any AASHNA store. Sale pieces are exchange-only, not refundable.",
  },
  {
    q: "How does the stitching service work?",
    a: "Add stitching to any unstitched suit at checkout, then enter your measurements or pick a standard size. Stitched orders ship in 7–10 working days.",
  },
  {
    q: "Do you ship internationally?",
    a: "We ship to the UK, UAE, Saudi Arabia, the US and Canada. International delivery takes 7–12 working days and duties are calculated at checkout.",
  },
  {
    q: "How should I care for embroidered pieces?",
    a: "Dry clean embroidered and embellished panels. Everything else can be cold hand-washed separately, dried in shade and ironed warm on the reverse.",
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
      <section className="relative h-[260px] w-full overflow-hidden bg-sand sm:h-[340px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img(IMG.storyAtelier, 1900)}
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-ink/40" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="eyebrow text-white/80">We&apos;re Here</span>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[36px] leading-tight text-white sm:text-[48px]">
            Customer Care
          </h1>
          <p className="mt-3 max-w-md text-[13px] leading-relaxed text-white/85">
            Monday to Saturday, 9am – 9pm PKT. We answer most messages within a few hours.
          </p>
        </div>
      </section>

      {/* Contact channels */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-px bg-line sm:grid-cols-3">
          {[
            { icon: Phone, label: "Call Us", value: BRAND.phone, href: `tel:${BRAND.phone.replace(/\s/g, "")}` },
            { icon: Mail, label: "Email", value: BRAND.email, href: `mailto:${BRAND.email}` },
            { icon: MessageCircle, label: "WhatsApp", value: "+92 300 927 4620", href: "#" },
          ].map(({ icon: Icon, label, value, href }) => (
            <a
              key={label}
              href={href}
              className="group flex flex-col items-center gap-2 bg-white px-6 py-10 text-center transition-colors hover:bg-cream"
            >
              <Icon className="h-5 w-5 text-clay" strokeWidth={1.3} />
              <span className="eyebrow mt-1 text-ink">{label}</span>
              <span className="text-[13px] text-ink-soft transition-colors group-hover:text-clay">
                {value}
              </span>
            </a>
          ))}
        </div>
      </section>

      {/* Form + stores */}
      <section className="mx-auto grid max-w-[1500px] grid-cols-1 gap-16 px-6 py-16 lg:grid-cols-2 sm:py-20 xl:px-10">
        <div>
          <span className="eyebrow text-clay">Write to Us</span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink">
            Send a message
          </h2>

          {submitted ? (
            <div className="mt-8 border border-line bg-cream p-8 text-center">
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
                    placeholder="Ayesha Khan"
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
                  placeholder="Order #12345 — exchange request"
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

              <button type="submit" className="btn-ink w-full cursor-pointer sm:w-auto">
                Send Message
              </button>
            </form>
          )}
        </div>

        <div>
          <span className="eyebrow text-clay">Visit Us</span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink">
            Our stores
          </h2>

          <div className="mt-8 divide-y divide-line border-y border-line">
            {STORES.map((store) => (
              <div key={store.city} className="flex items-start gap-4 py-5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-clay" strokeWidth={1.4} />
                <div>
                  <h3 className="text-[14px] text-ink">{store.city}</h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{store.address}</p>
                  <p className="mt-1 text-[11px] text-muted">Open daily · {store.hours}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 bg-cream p-6">
            <span className="eyebrow text-muted">Head Office</span>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{BRAND.address}</p>
          </div>
        </div>
      </section>

      {/* FAQs */}
      <section className="border-t border-line bg-cream">
        <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
          <div className="text-center">
            <span className="eyebrow text-clay">Answers</span>
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
            <Link href="/shop" className="link-rule text-ink">
              Browse the collection
            </Link>{" "}
            or call us — a person picks up.
          </p>
        </div>
      </section>
    </div>
  );
}
