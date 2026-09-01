import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BRAND } from "@/lib/constants";
import { img } from "@/lib/imagery";

interface AuthShellProps {
  eyebrow: string;
  title: string;
  copy: string;
  image: string;
  error?: string;
  message?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}

/** Delay helper so the right column arrives one element at a time. */
const rise = (ms: number) => ({ "--auth-delay": `${ms}ms` }) as React.CSSProperties;

/**
 * Split editorial layout shared by sign in and register. Rendered without site
 * chrome, so it owns the full viewport and its own way back to the store.
 */
export function AuthShell({
  eyebrow,
  title,
  copy,
  image,
  error,
  message,
  children,
  footer,
}: AuthShellProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Editorial panel */}
      <div className="relative hidden overflow-hidden bg-lilac lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img(image, 1200)}
          alt=""
          className="auth-panel-in h-full w-full object-cover object-center"
        />
        <div className="auth-veil-in absolute inset-0 bg-ink/35" />
        <div className="auth-rise absolute inset-x-0 bottom-0 p-12" style={rise(220)}>
          <Link
            href="/"
            className="block font-[family-name:var(--font-script)] text-[38px] leading-[1.15] text-white transition-opacity duration-300 hover:opacity-80"
          >
            {BRAND.name}
          </Link>
          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-white/85">
            Members get first look at new prints, early access to restocks, and free delivery
            on their first custom-size order.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center px-6 py-16 sm:px-12">
        {/* The header is gone on this route, so the way back has to live here. */}
        <Link
          href="/"
          className="group auth-rise label-track absolute left-6 top-8 inline-flex items-center gap-2 text-[10px] font-medium text-muted transition-colors duration-300 hover:text-purple sm:left-12"
          style={rise(60)}
        >
          <ArrowLeft className="h-3 w-3 transition-transform duration-300 group-hover:-translate-x-0.5" />
          Back to store
        </Link>

        <div className="w-full max-w-sm">
          <div className="auth-rise" style={rise(120)}>
            <span className="eyebrow text-purple">{eyebrow}</span>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-tight text-ink">
              {title}
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{copy}</p>
          </div>

          {error && (
            <div
              role="alert"
              className="auth-rise mt-6 border-l-2 border-sale bg-frost px-4 py-3 text-[12px] text-ink-soft"
              style={rise(60)}
            >
              {error}
            </div>
          )}
          {message && (
            <div
              role="status"
              className="auth-rise mt-6 border-l-2 border-jade bg-frost px-4 py-3 text-[12px] text-ink-soft"
              style={rise(60)}
            >
              {message}
            </div>
          )}

          <div className="auth-rise mt-8" style={rise(240)}>
            {children}
          </div>

          <div
            className="auth-rise mt-8 border-t border-line pt-6 text-center text-[12px] text-muted"
            style={rise(340)}
          >
            {footer}
          </div>

          <p
            className="auth-rise mt-6 text-center text-[11px] leading-relaxed text-faint"
            style={rise(400)}
          >
            By continuing you agree to our{" "}
            <Link href="/about" className="link-rule text-muted">
              terms
            </Link>{" "}
            and{" "}
            <Link href="/about" className="link-rule text-muted">
              privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

/** Shared field styling for the auth forms. */
export const authInputClass =
  "w-full border-b border-line bg-transparent py-2.5 text-[13px] text-ink placeholder-faint transition-colors duration-300 focus:border-purple focus:outline-none";

export function OrDivider({ label }: { label: string }) {
  return (
    <div className="my-7 flex items-center gap-4">
      <span className="h-px flex-1 bg-line" />
      <span className="eyebrow text-faint">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
