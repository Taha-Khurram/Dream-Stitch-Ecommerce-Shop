import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LAST_SEEN_COOKIE,
  TIMEOUT_REASON,
  isPrefetch,
  isSessionExpired,
  lastSeenCookieOptions,
} from "@/lib/auth/session";

/** Supabase's own auth cookies all carry this prefix. */
const AUTH_COOKIE_PREFIX = "sb-";

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * Strip every trace of the session from a response we are about to return.
 *
 * `signOut()` writes its Set-Cookie headers through the client's cookie
 * adapter, which targets the response object built during `createServerClient`
 * — not the redirect or 401 we hand back here. So the cookies are cleared
 * again, explicitly, on the response that actually reaches the browser.
 */
function clearSession(request: NextRequest, response: NextResponse): NextResponse {
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith(AUTH_COOKIE_PREFIX)) {
      response.cookies.delete(cookie.name);
    }
  }
  response.cookies.delete(LAST_SEEN_COOKIE);
  return response;
}

/**
 * Drop the activity stamp when there is no session behind it.
 *
 * Signing out clears the `sb-*` cookies but leaves this one, and it outlives
 * the idle window by design. Left alone, the next sign-in an hour later would
 * arrive to find an hour-old stamp, be judged idle on its very first request,
 * and be bounced straight back to the sign-in page — a loop that only clearing
 * cookies by hand would break.
 *
 * Doing it here rather than in the sign-out action covers every way a session
 * can end: the action, an expired refresh token, a revoked session.
 */
function dropStaleStamp(request: NextRequest, response: NextResponse): NextResponse {
  if (request.cookies.has(LAST_SEEN_COOKIE)) {
    response.cookies.delete(LAST_SEEN_COOKIE);
  }
  return response;
}

/**
 * End an idle session and tell the caller in the idiom it speaks: JSON with a
 * 401 for an API client, a redirect to the sign-in page for a browser.
 */
async function endIdleSession(
  request: NextRequest,
  supabase: SupabaseClient
): Promise<NextResponse> {
  /* `local` scope, not the default `global`: idling on a laptop should not
     sign the same person out on their phone. It still revokes this session's
     refresh token, so the cleared cookies cannot be replayed. */
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* GoTrue unreachable. The cookie clearing below is what actually ends the
       session for this browser, so this is not worth failing the request over. */
  }

  const { pathname } = request.nextUrl;

  if (isApiRequest(pathname)) {
    return clearSession(
      request,
      NextResponse.json(
        { success: false, error: "Session expired. Please sign in again." },
        { status: 401 }
      )
    );
  }

  /* Already heading for the sign-in page — redirecting there again would
     loop. Clear the cookies and let the request through. */
  if (pathname.startsWith("/signin") || pathname.startsWith("/signup")) {
    return clearSession(request, NextResponse.next({ request }));
  }

  const signIn = request.nextUrl.clone();
  signIn.pathname = "/signin";
  signIn.search = `?reason=${TIMEOUT_REASON}&next=${encodeURIComponent(pathname)}`;

  return clearSession(request, NextResponse.redirect(signIn));
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh auth token
  const {
    data: { user },
  } = await supabase.auth.getUser();

  /* No session. Nothing to expire — but the activity stamp must not be left
     behind to poison the next sign-in. */
  if (!user) {
    // The admin layout re-checks the role and RLS enforces every write; this
    // only spares anonymous visitors a pointless round trip to a gated page.
    if (request.nextUrl.pathname.startsWith("/admin")) {
      const signIn = request.nextUrl.clone();
      signIn.pathname = "/signin";
      signIn.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
      return dropStaleStamp(request, NextResponse.redirect(signIn));
    }

    return dropStaleStamp(request, supabaseResponse);
  }

  /* Idle enforcement sits after the refresh on purpose: `getUser()` is what
     proves the session is real, and there is nothing to expire without one. */
  const now = Date.now();

  if (isSessionExpired(request.cookies.get(LAST_SEEN_COOKIE)?.value, now)) {
    return await endIdleSession(request, supabase);
  }

  if (!isPrefetch(request.headers)) {
    supabaseResponse.cookies.set(LAST_SEEN_COOKIE, String(now), lastSeenCookieOptions());
  }

  return supabaseResponse;
}
