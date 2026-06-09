import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('[Supabase Middleware Client] Checking environment variables...');

  if (!url) {
    console.error('[Supabase Middleware Client] NEXT_PUBLIC_SUPABASE_URL is missing.');
    throw new Error('Missing Supabase URL');
  }

  if (!key) {
    console.error('[Supabase Middleware Client] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.');
    throw new Error('Missing Publishable Key');
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error('[Supabase Middleware Client] NEXT_PUBLIC_SUPABASE_URL is not a valid HTTP/HTTPS URL:', url);
    throw new Error('Invalid Supabase URL');
  }

  console.log('[Supabase Middleware Client] Initializing createServerClient...');

  try {
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

    // refreshing the auth token
    await supabase.auth.getUser();
  } catch (err: any) {
    console.error('[Supabase Middleware Client] Session update failed:', err);
    throw err;
  }

  return supabaseResponse;
}
