'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

/**
 * Only same-origin relative paths are honoured, so a crafted
 * `?next=https://evil.example` cannot turn sign-in into an open redirect.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const path = String(value ?? '');
  return path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

export async function signIn(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const next = safeNext(formData.get('next'));
  const supabase = await createClient();

  if (!email || !password) {
    redirect('/signin?error=' + encodeURIComponent('Email and password are required.'));
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(`/signin?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath('/', 'layout');
  redirect(next);
}

export async function signUp(formData: FormData) {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host') || 'localhost:3001';
  const proto = headerList.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  const origin = headerList.get('origin') || `${proto}://${host}`;
  
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;
  const supabase = await createClient();

  if (!email || !password) {
    redirect('/signup?error=' + encodeURIComponent('Email and password are required.'));
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  }

  // Handle case where user already exists
  if (data?.user && data.user.identities && data.user.identities.length === 0) {
    redirect('/signup?error=' + encodeURIComponent('An account with this email already exists.'));
  }

  if (data?.session) {
    revalidatePath('/', 'layout');
    redirect('/');
  }

  redirect('/signup?message=' + encodeURIComponent('Please check your email for a confirmation link to activate your account.'));
}

export async function signInWithGoogle() {
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') || headerList.get('host') || 'localhost:3001';
  const proto = headerList.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  const origin = headerList.get('origin') || `${proto}://${host}`;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) {
    redirect(`/signin?error=${encodeURIComponent(error.message)}`);
  }

  if (data?.url) {
    redirect(data.url);
  }
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}
