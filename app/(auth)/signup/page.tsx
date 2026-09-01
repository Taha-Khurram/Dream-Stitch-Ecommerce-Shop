import React from "react";
import Link from "next/link";
import { signUp, signInWithGoogle } from "@/app/auth/actions";
import { AuthShell, OrDivider, authInputClass } from "@/components/auth/AuthShell";
import { AuthForm, GoogleForm } from "@/components/auth/AuthForm";
import { IMG } from "@/lib/imagery";

interface SignUpPageProps {
  searchParams: Promise<{ error?: string; message?: string }>;
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const { error, message } = await searchParams;

  return (
    <AuthShell
      eyebrow="Join Us"
      title="Create an account"
      copy="One account for orders, exchanges, saved pieces and early access."
      image={IMG.storyArtisan}
      error={error}
      message={message}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/signin" className="link-rule text-ink">
            Sign in
          </Link>
        </>
      }
    >
      <GoogleForm action={signInWithGoogle} label="Sign up with Google" />

      <OrDivider label="Or with email" />

      <AuthForm action={signUp} submitLabel="Create Account" pendingLabel="Creating your account…">
        <div>
          <label htmlFor="fullName" className="eyebrow text-muted">
            Full Name
          </label>
          <input
            id="fullName"
            name="fullName"
            type="text"
            required
            placeholder="Ayesha Khan"
            className={authInputClass}
          />
        </div>

        <div>
          <label htmlFor="email" className="eyebrow text-muted">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={authInputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className="eyebrow text-muted">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            className={authInputClass}
          />
        </div>
      </AuthForm>
    </AuthShell>
  );
}
