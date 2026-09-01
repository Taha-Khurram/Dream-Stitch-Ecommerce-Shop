"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BRAND, SIZE_GUIDE, FABRICS } from "@/lib/constants";
import { IMG, img } from "@/lib/imagery";
import { Check, MessageCircle, Ruler, Scissors, Truck } from "lucide-react";

/**
 * Custom Demand — the made-to-measure service. This is the one thing the
 * high-street cannot match, so it gets its own route rather than a line in an
 * FAQ.
 */

/* A real sequence: the customer measures, we quote, we cut. Hence the numbering. */
const STEPS = [
  {
    icon: Ruler,
    title: "Send three numbers",
    copy: "Mattress width, mattress length, and the drop you want hanging over each side. A tape measure and two minutes is all it takes.",
  },
  {
    icon: MessageCircle,
    title: "We confirm the price",
    copy: "We reply the same working day with the exact price for your size in the fabric you picked. Nothing is cut until you say yes.",
  },
  {
    icon: Scissors,
    title: "Cut, stitched, dispatched",
    copy: "Your set is cut to your numbers, double-hemmed, checked by hand and dispatched within 7–10 working days.",
  },
];

export default function CustomOrderPage() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    fabric: FABRICS[0],
    width: "",
    length: "",
    drop: "",
    notes: "",
  });

  const inputClass =
    "w-full border-b border-line bg-transparent py-2.5 text-[13px] text-ink placeholder-faint transition-colors focus:border-purple focus:outline-none";

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="pb-8">
      {/* Hero */}
      <section className="relative h-[320px] w-full overflow-hidden bg-lilac sm:h-[420px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img(IMG.editorialCustom, 1900)}
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-purple/80" />
        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="eyebrow text-white/75">Custom Demand</span>
          <h1 className="mt-4 max-w-2xl font-[family-name:var(--font-display)] text-[36px] leading-tight text-white sm:text-[50px]">
            Your bed isn&apos;t standard. Your sheet shouldn&apos;t be.
          </h1>
          <p className="mt-5 max-w-lg text-[13px] leading-relaxed text-white/85">
            King, single, or something in between — send us your measurements and we will stitch a
            set to fit it exactly. Same fabrics, same finish, no premium for being unusual.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="mx-auto max-w-[1500px] px-6 py-16 sm:py-20 xl:px-10 scroll-mt-28"
      >
        <div className="text-center">
          <span className="eyebrow text-purple">How It Works</span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink sm:text-[38px]">
            Three steps, one bed
          </h2>
        </div>

        <ol className="mt-14 grid grid-cols-1 gap-px bg-line md:grid-cols-3" data-reveal-stagger suppressHydrationWarning>
          {STEPS.map(({ icon: Icon, title, copy }, i) => (
            <li key={title} className="bg-white p-8">
              <div className="flex items-center gap-4">
                <span className="font-[family-name:var(--font-display)] text-[30px] leading-none text-faint">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Icon className="h-5 w-5 text-purple" strokeWidth={1.3} />
              </div>
              <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl text-ink">
                {title}
              </h3>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{copy}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Measuring guide + standard sizes */}
      <section id="measuring" className="border-y border-line bg-frost scroll-mt-28">
        <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-14 px-6 py-16 lg:grid-cols-2 lg:gap-20 sm:py-20 xl:px-10">
          <div>
            <span className="eyebrow text-purple">Measuring Guide</span>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-[28px] leading-tight text-ink sm:text-[34px]">
              How to measure your bed
            </h2>

            <ol className="mt-8 space-y-6">
              {[
                {
                  label: "Width",
                  copy: "Measure the mattress across, from edge to edge, with the bedding stripped off.",
                },
                {
                  label: "Length",
                  copy: "Measure from the head of the mattress to the foot, along the centre.",
                },
                {
                  label: "Drop",
                  copy: "Measure the mattress depth, then add how much you want tucked under — most people ask for 6 to 10 inches on top of the depth.",
                },
              ].map((row, i) => (
                <li key={row.label} className="flex gap-5">
                  <span className="font-[family-name:var(--font-display)] text-xl text-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="text-[14px] font-medium text-ink">{row.label}</h3>
                    <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">{row.copy}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-8 border-l-2 border-purple bg-white px-4 py-3 text-[12px] leading-relaxed text-ink-soft">
              Measure in inches, and measure twice. If a number looks unusual to us we will call
              before cutting — it is cheaper for everyone than a sheet that does not fit.
            </p>
          </div>

          <div>
            <span className="eyebrow text-purple">For Reference</span>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-[28px] leading-tight text-ink sm:text-[34px]">
              Our standard sizes
            </h2>

            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[26rem] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-ink">
                    {["Size", "Bedsheet", "Pillow Cover", "Set"].map((head) => (
                      <th key={head} className="eyebrow pb-3 text-ink">
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SIZE_GUIDE.map((row) => (
                    <tr key={row.size} className="border-b border-line">
                      <td className="py-3.5 font-medium text-ink">{row.size}</td>
                      <td className="py-3.5 text-ink-soft">{row.sheet}</td>
                      <td className="py-3.5 text-ink-soft">{row.pillow}</td>
                      <td className="py-3.5 text-ink-soft">{row.pieces}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-6 text-[12px] leading-relaxed text-muted">
              Dimensions are of the finished sheet, measured flat — the side drop is already
              included. Falling between two sizes is exactly what this service is for.
            </p>

            <Link href="/shop" className="btn-outline mt-8">
              Browse Stocked Sizes
            </Link>
          </div>
        </div>
      </section>

      {/* Request form */}
      <section id="request" className="mx-auto max-w-3xl px-6 py-16 sm:py-20 scroll-mt-28">
        <div className="text-center">
          <span className="eyebrow text-purple">Start Here</span>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-ink sm:text-[38px]">
            Request your size
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[13px] leading-relaxed text-ink-soft">
            Send your numbers and we will come back the same working day with a price. Prefer to
            talk it through? Message us on WhatsApp at {BRAND.whatsapp}.
          </p>
        </div>

        {submitted ? (
          <div className="mt-12 border border-line bg-frost p-10 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-purple text-white">
              <Check className="h-5 w-5" />
            </span>
            <h3 className="mt-5 font-[family-name:var(--font-display)] text-xl text-ink">
              Measurements received
            </h3>
            <p className="mx-auto mt-3 max-w-sm text-[13px] leading-relaxed text-ink-soft">
              Thank you{form.name ? `, ${form.name}` : ""}. We will confirm the price for a{" "}
              {form.width || "—"}&quot; × {form.length || "—"}&quot; set in {form.fabric} and come
              back to you within one working day.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="btn-outline mt-8 cursor-pointer"
            >
              Send Another
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
            className="mt-12 space-y-8"
          >
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div>
                <label htmlFor="cs-name" className="eyebrow text-muted">
                  Name
                </label>
                <input
                  id="cs-name"
                  required
                  value={form.name}
                  onChange={(e) => set("name")(e.target.value)}
                  placeholder="Your name"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="cs-phone" className="eyebrow text-muted">
                  Phone or WhatsApp
                </label>
                <input
                  id="cs-phone"
                  required
                  value={form.phone}
                  onChange={(e) => set("phone")(e.target.value)}
                  placeholder="03xx xxxxxxx"
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <span className="eyebrow text-muted">Fabric</span>
              <div className="mt-3 flex flex-wrap gap-2">
                {FABRICS.map((fabric) => (
                  <button
                    key={fabric}
                    type="button"
                    onClick={() => set("fabric")(fabric)}
                    aria-pressed={form.fabric === fabric}
                    className={`h-11 cursor-pointer border px-4 text-[12px] font-medium tracking-wider transition-colors ${
                      form.fabric === fabric
                        ? "border-purple bg-purple text-white"
                        : "border-line text-ink hover:border-purple"
                    }`}
                  >
                    {fabric}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              {(
                [
                  { key: "width", label: "Mattress width (in)", placeholder: "72" },
                  { key: "length", label: "Mattress length (in)", placeholder: "78" },
                  { key: "drop", label: "Drop per side (in)", placeholder: "10" },
                ] as const
              ).map((field) => (
                <div key={field.key}>
                  <label htmlFor={`cs-${field.key}`} className="eyebrow text-muted">
                    {field.label}
                  </label>
                  <input
                    id={`cs-${field.key}`}
                    required
                    inputMode="decimal"
                    value={form[field.key]}
                    onChange={(e) => set(field.key)(e.target.value)}
                    placeholder={field.placeholder}
                    className={inputClass}
                  />
                </div>
              ))}
            </div>

            <div>
              <label htmlFor="cs-notes" className="eyebrow text-muted">
                Anything else?
              </label>
              <textarea
                id="cs-notes"
                rows={4}
                value={form.notes}
                onChange={(e) => set("notes")(e.target.value)}
                placeholder="Colour preference, number of pillow covers, a deadline…"
                className={`${inputClass} resize-none`}
              />
            </div>

            <button type="submit" className="btn-primary w-full cursor-pointer sm:w-auto">
              Send My Measurements
            </button>
          </form>
        )}
      </section>

      {/* Reassurance strip */}
      <section className="border-t border-line bg-frost">
        <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-px bg-line sm:grid-cols-3">
          {[
            { icon: Scissors, title: "No premium for odd sizes", copy: "You pay for cloth, not for being unusual." },
            { icon: Truck, title: "7–10 working days", copy: "Cut, finished and dispatched from Karachi." },
            { icon: Ruler, title: "We check your numbers", copy: "If something looks off, we call before cutting." },
          ].map(({ icon: Icon, title, copy }) => (
            <div key={title} className="flex flex-col items-center gap-2 bg-frost px-6 py-10 text-center">
              <Icon className="h-5 w-5 text-purple" strokeWidth={1.3} />
              <h3 className="eyebrow mt-1 text-ink">{title}</h3>
              <p className="text-[12px] text-muted">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
