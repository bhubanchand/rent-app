import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Define route groups
  const isPublicRoute =
    pathname === '/login' ||
    pathname.startsWith('/debug') ||
    pathname.startsWith('/share') ||
    pathname.startsWith('/verify') ||
    pathname.startsWith('/api/verify-code') ||
    pathname.startsWith('/api/share-portal') ||
    pathname.startsWith('/api/invoices/sign') ||
    pathname === '/favicon.ico';

  const isDashboardRoute = pathname.startsWith('/dashboard') || pathname.startsWith('/api/dashboard');
  const isMfaSetupRoute = pathname === '/mfa/setup';
  const isMfaChallengeRoute = pathname === '/login/mfa';

  // 2. Initialize Supabase client
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    // If Supabase configuration is missing or invalid, block dashboard access and redirect to login.
    // This still lets the diagnostic page `/debug/supabase` and `/login` load.
    if (isDashboardRoute || isMfaSetupRoute || isMfaChallengeRoute) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  const supabase = createServerClient(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. Retrieve user session & MFA level safely
  let user = null;
  let aalData = null;

  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.warn('[Middleware Auth] getUser returned error:', error.message);
    } else {
      user = data.user;
    }

    if (user) {
      const { data: mfaData, error: mfaError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (mfaError) {
        console.warn('[Middleware Auth] getAuthenticatorAssuranceLevel returned error:', mfaError.message);
      } else {
        aalData = mfaData;
      }
    }
  } catch (err: any) {
    console.error('[Middleware Auth] Network or connection error checking session:', err.message || err);
  }

  if (!user) {
    // If not authenticated and trying to access protected paths, redirect to login
    if (isDashboardRoute || isMfaSetupRoute || isMfaChallengeRoute) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return supabaseResponse;
  }

  // User is authenticated (aal1 or aal2)
  const currentLevel = aalData?.currentLevel || 'aal1';
  const hasEnrolledFactors = aalData?.nextLevel === 'aal2'; // nextLevel is aal2 if there is at least one enrolled factor

  // 4. Enforce MFA redirects
  if (currentLevel === 'aal1') {
    if (hasEnrolledFactors) {
      // User has MFA setup but has not completed the challenge. Redirect to MFA verification.
      if (!isMfaChallengeRoute && !isPublicRoute) {
        return NextResponse.redirect(new URL('/login/mfa', request.url));
      }
    } else {
      // User has no MFA setup. Force them to enroll.
      if (!isMfaSetupRoute && !isPublicRoute) {
        return NextResponse.redirect(new URL('/mfa/setup', request.url));
      }
    }
  } else if (currentLevel === 'aal2') {
    // User is fully authenticated. Prevent them from visiting login/mfa pages.
    if (isMfaChallengeRoute || isMfaSetupRoute || pathname === '/login') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Redirect root path to dashboard if fully authenticated
  if (pathname === '/' && currentLevel === 'aal2') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } else if (pathname === '/' && currentLevel === 'aal1') {
    if (hasEnrolledFactors) {
      return NextResponse.redirect(new URL('/login/mfa', request.url));
    } else {
      return NextResponse.redirect(new URL('/mfa/setup', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|images|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
