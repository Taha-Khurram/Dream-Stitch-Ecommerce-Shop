import React from "react";
import Link from "next/link";
import { signIn, signInWithGoogle } from "@/app/auth/actions";
import {
  AuthShell,
  GoogleButton,
  OrDivider,
  authInputClass,
} from "@/components/auth/AuthShell";
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
      <form action={signInWithGoogle}>
        <GoogleButton label="Continue with Google" />
      </form>

      <OrDivider label="Or with email" />

      <form action={signIn} className="space-y-6">
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

        <button type="submit" className="btn-primary w-full cursor-pointer">
          Sign In
        </button>
      </form>
    </AuthShell>
  );
}
