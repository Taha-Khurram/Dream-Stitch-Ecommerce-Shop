import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Email verification landing point.
 *
 * Supabase can deliver a confirmation link in two shapes, and which one
 * arrives depends on a dashboard template rather than on anything in this
 * repo — so both are handled here:
 *
 *   `?token_hash=…&type=signup`  the template was customised to
 *                                `{{ .TokenHash }}`, and the token is still
 *                                unspent. We redeem it with verifyOtp().
 *
 *   `?code=…`                    the default `{{ .ConfirmationURL }}` template.
 *                                GoTrue already verified the token on its own
 *                                side and bounced the browser here, so what is
 *                                left is a PKCE code to trade for a session.
 *
 * Getting only one of these right is why a correct-looking link still lands on
 * "invalid or has expired".
 */

/** Only same-origin relative paths, so `?next=https://evil.example` cannot redirect off-site. */
function safeNext(value: string | null): string {
  const path = value ?? '/';
  return path.startsWith('/') && !path.startsWith('//') ? path : '/';
}

/**
 * The public origin of this request.
 *
 * Behind Vercel's proxy `request.nextUrl` carries the internal host, so a
 * redirect built from it can land the user on the wrong domain — the same
 * class of bug the OAuth callback already guards against.
 */
function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host');
  if (!forwardedHost) return request.nextUrl.origin;

  const proto =
    request.headers.get('x-forwarded-proto') ??
    (forwardedHost.startsWith('localhost') || forwardedHost.startsWith('127.0.0.1')
      ? 'http'
      : 'https');

  return `${proto}://${forwardedHost}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));
  const origin = publicOrigin(request);

  /* GoTrue reports a rejected link by redirecting here with its own reason
     attached. Surfacing that beats overwriting it with a generic guess. */
  const providerError =
    searchParams.get('error_description') ?? searchParams.get('error');

  if (!providerError) {
    const supabase = await createClient();

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) {
        return NextResponse.redirect(`${origin}${next}?verified=1`);
      }
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}?verified=1`);
      }
    }
  }

  const message =
    providerError ??
    'Verification link is invalid or has expired. Request a new one below.';

  return NextResponse.redirect(
    `${origin}/signin?error=${encodeURIComponent(message)}`
  );
}
