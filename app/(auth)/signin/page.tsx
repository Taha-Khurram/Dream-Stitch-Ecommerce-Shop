import React from "react";
import Link from "next/link";
import { signIn, signInWithGoogle } from "@/app/auth/actions";
import { AuthShell, OrDivider, authInputClass } from "@/components/auth/AuthShell";
import { AuthForm, GoogleForm } from "@/components/auth/AuthForm";
import { IMG } from "@/lib/imagery";

interface SignInPageProps {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error, message, next } = await searchParams;

  return (
    <AuthShell
      eyebrow="Account"
      title="Welcome back"
      copy="Sign in to track orders, save pieces and check out faster."
      image={IMG.storyAtelier}
      error={error}
      message={message}
      footer={
        <>
          New to Dream Stitch?{" "}
          <Link href="/signup" className="link-rule text-ink">
            Create an account
          </Link>
        </>
      }
    >
      <GoogleForm action={signInWithGoogle} label="Continue with Google" />

      <OrDivider label="Or with email" />

      <AuthForm action={signIn} submitLabel="Sign In" pendingLabel="Signing you in…">
        {next && <input type="hidden" name="next" value={next} />}

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
            autoComplete="current-password"
            placeholder="••••••••"
            className={authInputClass}
          />
        </div>
      </AuthForm>
    </AuthShell>
  );
}
