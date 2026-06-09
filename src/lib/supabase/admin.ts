import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('[Supabase Admin Client] Checking environment variables...');

  if (!url) {
    console.error('[Supabase Admin Client] NEXT_PUBLIC_SUPABASE_URL is missing.');
    throw new Error('Missing Supabase URL');
  }

  if (!key) {
    console.error('[Supabase Admin Client] SUPABASE_SERVICE_ROLE_KEY is missing.');
    throw new Error('Missing Service Role Key');
  }

  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    console.error('[Supabase Admin Client] NEXT_PUBLIC_SUPABASE_URL is not a valid HTTP/HTTPS URL:', url);
    throw new Error('Invalid Supabase URL');
  }

  console.log('[Supabase Admin Client] Initializing admin client...');

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
    throw err;
  }
}
