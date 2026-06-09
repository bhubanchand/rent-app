import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createDummyClient } from './dummy';

export async function createClient() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('[Supabase Server Client] Loading server-side environment...');

  if (!url || !key) {
    console.warn('[Supabase Server Client] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.');
    return createDummyClient('Missing Supabase URL or Anon Key');
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.warn('[Supabase Server Client] NEXT_PUBLIC_SUPABASE_URL is not a valid HTTP/HTTPS URL:', url);
    return createDummyClient(`Invalid Supabase URL: ${url}`);
  }

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
    return createDummyClient(err.message || 'Initialization failed');
  }
}
