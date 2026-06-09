import { createClient } from '@supabase/supabase-js';
import { createDummyClient } from './dummy';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[Supabase Admin Client] Loading admin-side environment...');

  if (!url || !key) {
    console.warn('[Supabase Admin Client] NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
    return createDummyClient('Missing Supabase URL or Service Role Key');
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.warn('[Supabase Admin Client] NEXT_PUBLIC_SUPABASE_URL is not a valid HTTP/HTTPS URL:', url);
    return createDummyClient(`Invalid Supabase URL: ${url}`);
  }

  try {
    return createClient(
      url,
      key,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  } catch (err: any) {
    console.error('[Supabase Admin Client] Instantiation failed:', err);
    return createDummyClient(err.message || 'Initialization failed');
  }
}
