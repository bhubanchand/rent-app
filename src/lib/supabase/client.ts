import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('[Supabase Client Diagnostics] Checking environment variables...');
  
  if (!url) {
    console.error('[Supabase Client Diagnostics] NEXT_PUBLIC_SUPABASE_URL is missing.');
    throw new Error('Missing Supabase URL');
  }

  if (!key) {
    console.error('[Supabase Client Diagnostics] NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.');
    throw new Error('Missing Publishable Key');
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error('[Supabase Client Diagnostics] NEXT_PUBLIC_SUPABASE_URL is not a valid HTTP/HTTPS URL:', url);
    throw new Error('Invalid Supabase URL');
  }

  console.log('[Supabase Client Diagnostics] Initializing createBrowserClient with URL:', url);
  
  try {
    return createBrowserClient(url, key);
  } catch (err: any) {
    console.error('[Supabase Client Diagnostics] Browser client instantiation failed:', err);
    throw err;
  }
}
