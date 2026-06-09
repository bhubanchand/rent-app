import { createBrowserClient } from '@supabase/ssr';
import { createDummyClient } from './dummy';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  console.log('[Supabase Client Diagnostics] Loading client-side environment...');

  if (!url || !key) {
    console.warn('[Supabase Client Diagnostics] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing.');
    return createDummyClient('Missing Supabase URL or Anon Key');
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.warn('[Supabase Client Diagnostics] NEXT_PUBLIC_SUPABASE_URL is not a valid HTTP/HTTPS URL:', url);
    return createDummyClient(`Invalid Supabase URL: ${url}`);
  }

  try {
    return createBrowserClient(url, key);
  } catch (err: any) {
    console.error('[Supabase Client Diagnostics] Browser client instantiation failed:', err);
    return createDummyClient(err.message || 'Initialization failed');
  }
}
