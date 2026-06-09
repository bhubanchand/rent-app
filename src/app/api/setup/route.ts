import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();
    
    // Count existing users in public.users table
    const { count, error } = await adminSupabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;

    const isFirstLaunch = (count || 0) === 0;

    return NextResponse.json({ isFirstLaunch });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient();

    // 1. Guard check: Ensure no users exist in the database
    const { count, error: countError } = await adminSupabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    if (count && count > 0) {
      return NextResponse.json(
        { error: 'Signup is disabled forever. An administrator already exists.' },
        { status: 403 }
      );
    }

    // 2. Parse payload
    const body = await request.json();
    const { email, password, full_name } = body;

    if (!email || !password || !full_name) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 });
    }

    // 3. Create first admin using the service role admin client
    // This bypasses email confirmation prompts so they can sign in immediately
    const { data: user, error: signUpError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (signUpError || !user.user) {
      throw signUpError || new Error('Failed to register administrator.');
    }

    // Sync trigger "on_auth_user_created" in public.users is called automatically by Supabase.
    // However, in case triggers take a moment or need assistance, we can verify or let it handle it.

    return NextResponse.json({ success: true, message: 'First administrator successfully registered.' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Registration failed.' }, { status: 500 });
  }
}
