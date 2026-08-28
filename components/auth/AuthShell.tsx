import React from "react";
import Link from "next/link";
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

/** Split editorial layout shared by sign in and register. */
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
    <div className="grid min-h-[calc(100vh-190px)] grid-cols-1 lg:grid-cols-2">
      {/* Editorial panel */}
      <div className="relative hidden overflow-hidden bg-sand lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img(image, 1200)}
          alt=""
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-ink/35" />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <span className="font-[family-name:var(--font-display)] text-2xl tracking-[0.3em] text-white">
            {BRAND.name}
          </span>
          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-white/85">
            Members get first access to every drop, private sale previews and free stitching on
            their first unstitched order.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-16 sm:px-12">
        <div className="w-full max-w-sm">
          <span className="eyebrow text-clay">{eyebrow}</span>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[32px] leading-tight text-ink">
            {title}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{copy}</p>

          {error && (
            <div className="mt-6 border-l-2 border-sale bg-cream px-4 py-3 text-[12px] text-ink-soft">
              {error}
            </div>
          )}
          {message && (
            <div className="mt-6 border-l-2 border-jade bg-cream px-4 py-3 text-[12px] text-ink-soft">
              {message}
            </div>
          )}

          <div className="mt-8">{children}</div>

          <div className="mt-8 border-t border-line pt-6 text-center text-[12px] text-muted">
            {footer}
          </div>

          <p className="mt-6 text-center text-[11px] leading-relaxed text-faint">
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
  "w-full border-b border-line bg-transparent py-2.5 text-[13px] text-ink placeholder-faint transition-colors focus:border-ink focus:outline-none";

export function GoogleButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="label-track flex w-full cursor-pointer items-center justify-center gap-3 border border-line px-4 py-3.5 text-[11px] font-medium text-ink transition-colors hover:border-ink"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          fill="#EA4335"
        />
      </svg>
      {label}
    </button>
  );
}

export function OrDivider({ label }: { label: string }) {
  return (
    <div className="my-7 flex items-center gap-4">
      <span className="h-px flex-1 bg-line" />
      <span className="eyebrow text-faint">{label}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
