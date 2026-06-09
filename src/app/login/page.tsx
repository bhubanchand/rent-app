'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Lock, Mail, Loader2, AlertTriangle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Safely check for client initialization error
  const [initError, setInitError] = useState<string | null>(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url) return 'NEXT_PUBLIC_SUPABASE_URL is missing from environment.';
    if (!key) return 'NEXT_PUBLIC_SUPABASE_ANON_KEY is missing from environment.';
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `NEXT_PUBLIC_SUPABASE_URL is not a valid HTTP/HTTPS URL (got "${url}"). Please verify if you accidentally swapped the URL and publishable key values in your environment configuration.`;
    }
    return null;
  });

  // Safely initialize client
  const supabase = useMemo(() => {
    try {
      return createClient();
    } catch (err) {
      return null;
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter both email and password.');
      return;
    }

    if (!supabase) {
      toast.error(initError || 'Supabase client is not configured correctly.');
      return;
    }

    setLoading(true);
    console.log('[Login Page] Attempting signInWithPassword for user:', email);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('[Login Page] Auth handler returned error response:', error);
        
        let friendlyMessage = error.message;
        
        // Map common Supabase Auth gateway messages
        if (error.message.toLowerCase().includes('email logins are disabled')) {
          friendlyMessage = 'Authentication Provider Disabled: Email/password authentication is not enabled for this project.';
        } else if (error.message.toLowerCase().includes('invalid login credentials')) {
          friendlyMessage = 'Invalid Credentials: Click show and verify your email or password.';
        } else if (error.message.toLowerCase().includes('database error')) {
          friendlyMessage = 'Database Connection Failed: The Supabase authentication backend could not write or read credentials.';
        }

        toast.error(friendlyMessage);
        setLoading(false);
        return;
      }

      console.log('[Login Page] Auth succeeded, checking Multi-Factor Authentication (MFA)...');
      toast.success('Successfully authenticated!');

      // Check MFA status
      const { data: aalData, error: mfaError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (mfaError) {
        console.error('[Login Page] MFA check failed:', mfaError);
      }
      
      const currentLevel = aalData?.currentLevel || 'aal1';
      const hasEnrolledFactors = aalData?.nextLevel === 'aal2';

      if (currentLevel === 'aal1') {
        if (hasEnrolledFactors) {
          console.log('[Login Page] MFA challenge required. Routing to /login/mfa');
          router.push('/login/mfa');
        } else {
          console.log('[Login Page] No MFA factor enrolled. Routing to setup /mfa/setup');
          router.push('/mfa/setup');
        }
      } else {
        console.log('[Login Page] Account satisfies aal2. Routing to /dashboard');
        router.push('/dashboard');
      }
    } catch (err: any) {
      console.error('[Login Page] Catch block caught exception:', err);
      
      let friendlyError = err.message || 'An error occurred during login.';
      
      if (friendlyError.includes('Failed to fetch')) {
        const isUrlMissing = !process.env.NEXT_PUBLIC_SUPABASE_URL;
        const isKeyMissing = !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const isKeyInvalid = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && 
          !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.startsWith('eyJ') && 
          !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.startsWith('sb_publishable_') &&
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length <= 10;

        if (isUrlMissing) {
          friendlyError = 'Missing Supabase URL: NEXT_PUBLIC_SUPABASE_URL is not set.';
        } else if (isKeyMissing) {
          friendlyError = 'Missing Publishable Key: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set.';
        } else if (isKeyInvalid) {
          friendlyError = 'Invalid API Key: NEXT_PUBLIC_SUPABASE_ANON_KEY must be a valid JWT or modern sb_publishable_* key.';
        } else {
          friendlyError = 'Network Error: Failed to connect to Supabase. This may be due to custom firewall rules, CORS configurations, or an unregistered/unmatching publishable key.';
        }
      }

      toast.error(friendlyError);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(15,23,42,0.8),transparent)] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-3">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            RentApp Portal
          </h1>
          <p className="text-sm text-slate-400 mt-1">Invoice, Receipt, and Receivables System</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-2xl text-slate-200">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-white text-center">Administrator Sign In</CardTitle>
            <CardDescription className="text-slate-400 text-center">
              Enter credentials to access your console
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-4">
              {initError && (
                <div className="p-3.5 rounded-xl border border-rose-900/50 bg-rose-950/30 text-rose-200 text-xs flex items-start space-x-2.5">
                  <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-rose-300">Integration Configuration Error</p>
                    <p className="leading-normal">{initError}</p>
                    <p className="pt-1">
                      Check variables or run the{' '}
                      <a href="/debug/supabase" className="underline hover:text-white font-medium">
                        Supabase Diagnostics Utility
                      </a>.
                    </p>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300 font-medium">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-slate-950/80 border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-600 rounded-lg py-5.5"
                    disabled={loading || !!initError}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300 font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 bg-slate-950/80 border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-600 rounded-lg py-5.5"
                    disabled={loading || !!initError}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-6 rounded-lg transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                disabled={loading || !!initError}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
              {initError && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/debug/supabase')}
                  className="w-full border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300 py-6 rounded-lg"
                >
                  Open Integration Diagnostics
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>

        <p className="text-center text-xs text-slate-500 mt-6">
          Authorized personnel only. Sessions are audited.
        </p>
      </div>
    </div>
  );
}
