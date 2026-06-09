'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ShieldAlert, Loader2, KeyRound } from 'lucide-react';

export default function MfaChallengePage() {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    async function checkFactors() {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      const currentLevel = aalData?.currentLevel || 'aal1';
      const hasEnrolledFactors = aalData?.nextLevel === 'aal2';

      if (currentLevel === 'aal2') {
        router.push('/dashboard');
        return;
      }

      if (!hasEnrolledFactors) {
        toast.error('No MFA factors enrolled. Setting up MFA...');
        router.push('/mfa/setup');
        return;
      }

      // Retrieve TOTP factor ID
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error || !data?.all?.length) {
        toast.error('Failed to retrieve MFA factors.');
        router.push('/login');
        return;
      }

      const totpFactor = data.all.find((f: any) => f.factor_type === 'totp' && f.status === 'verified');
      if (!totpFactor) {
        toast.error('No verified TOTP factors found.');
        router.push('/mfa/setup');
        return;
      }

      setFactorId(totpFactor.id);
    }

    checkFactors();
  }, [router, supabase]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast.error('Please enter a valid 6-digit code.');
      return;
    }

    if (!factorId) {
      toast.error('MFA factor not initialized.');
      return;
    }

    setLoading(true);
    try {
      // Create challenge
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });

      if (challengeError) {
        toast.error(challengeError.message);
        setLoading(false);
        return;
      }

      // Verify challenge
      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) {
        toast.error(verifyError.message || 'Invalid verification code.');
        setLoading(false);
        return;
      }

      toast.success('Security code verified. Access granted.');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'Verification failed.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(15,23,42,0.8),transparent)] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 shadow-lg shadow-amber-500/10 mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Two-Factor Challenge
          </h1>
          <p className="text-sm text-slate-400 mt-1">This account requires additional verification</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-2xl text-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-white text-center">Security Verification</CardTitle>
            <CardDescription className="text-slate-400 text-center">
              Enter the 6-digit code from your authenticator app
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleVerify}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code" className="text-slate-300 font-medium text-center block mb-2">
                  Authenticator Code
                </Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-500" />
                  <Input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000 000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="pl-10 text-center tracking-[0.4em] font-mono text-xl bg-slate-950/80 border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-white placeholder-slate-700 rounded-lg py-6"
                    disabled={loading || !factorId}
                    required
                    autoFocus
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-6 rounded-lg transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                disabled={loading || !factorId}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Code'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  supabase.auth.signOut();
                  router.push('/login');
                }}
                className="w-full text-slate-400 hover:text-white hover:bg-slate-800/50"
              >
                Cancel & Sign Out
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
