import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // If OAuth error returned
  if (error || errorDescription) {
    const message = errorDescription || error || 'Google authentication failed.';
    return NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent(message)}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } else {
      return NextResponse.redirect(
        `${origin}/signin?error=${encodeURIComponent(exchangeError?.message || 'Failed to exchange authentication code.')}`
      );
    }
  }

  return NextResponse.redirect(
    `${origin}/signin?error=${encodeURIComponent('No authorization code was provided.')}`
  );
}
