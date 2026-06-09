import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('[Supabase Server Client] Checking environment variables...');

  if (!url) {
    console.error('[Supabase Server Client] NEXT_PUBLIC_SUPABASE_URL is missing.');
    throw new Error('Missing Supabase URL');
  }

  if (!key) {
    console.error('[Supabase Server Client] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.');
    throw new Error('Missing Publishable Key');
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error('[Supabase Server Client] NEXT_PUBLIC_SUPABASE_URL is not a valid HTTP/HTTPS URL:', url);
    throw new Error('Invalid Supabase URL');
  }

  console.log('[Supabase Server Client] Initializing createServerClient...');

  try {
    return createServerClient(
      url,
      key,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Can be ignored if middleware handles refreshing.
            }
          },
        },
      }
    );
  } catch (err: any) {
    console.error('[Supabase Server Client] Instantiation failed:', err);
    throw err;
  }
}
