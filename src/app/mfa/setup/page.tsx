'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ShieldCheck, Loader2, QrCode } from 'lucide-react';

export default function MfaSetupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [enrollData, setEnrollData] = useState<{
    id: string;
    qrCode: string;
    secret: string;
  } | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    async function initEnrollment() {
      // 1. Get authenticated user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // 2. Check if already enrolled in verified factors
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalData?.currentLevel === 'aal2' || aalData?.nextLevel === 'aal2') {
        toast.info('Multi-Factor Authentication is already set up.');
        router.push('/dashboard');
        return;
      }

      // 3. Initiate enrollment
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'BHUBAN RECORDS',
        friendlyName: user.email,
      });

      if (error) {
        toast.error(`MFA Enrollment failed: ${error.message}`);
        return;
      }

      if (data && data.totp) {
        setEnrollData({
          id: data.id,
          qrCode: data.totp.qr_code,
          secret: data.totp.secret,
        });
      }
    }

    initEnrollment();
  }, [router, supabase]);

  const handleVerifyEnrollment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast.error('Please enter a 6-digit verification code.');
      return;
    }

    if (!enrollData) {
      toast.error('Enrollment data not available.');
      return;
    }

    setLoading(true);
    try {
      // Create a challenge for the newly enrolled factor
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: enrollData.id,
      });

      if (challengeError) {
        toast.error(`Challenge failed: ${challengeError.message}`);
        setLoading(false);
        return;
      }

      // Verify the challenge
      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: challengeData.id,
        code,
      });

      if (verifyError) {
        toast.error(`Verification failed: ${verifyError.message}`);
        setLoading(false);
        return;
      }

      toast.success('MFA successfully activated! Redirecting to Dashboard...');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.message || 'MFA setup verification failed.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans text-slate-900 dark:text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(241,245,249,0.9),transparent)] dark:bg-[radial-gradient(circle_at_30%_30%,rgba(15,23,42,0.8),transparent)] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-lg z-10">
        <div className="text-center mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-600/10 text-indigo-650 dark:text-indigo-400 shadow-lg shadow-indigo-650/10 mb-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Secure Administrator Setup
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Configure Multi-Factor Authentication to secure the system</p>
        </div>

        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 backdrop-blur-md shadow-lg dark:shadow-2xl text-slate-800 dark:text-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-slate-900 dark:text-white text-center">Enable 2FA Authenticator</CardTitle>
            <CardDescription className="text-slate-500 dark:text-slate-400 text-center">
              Scan the QR code with Google Authenticator, Authy, or 1Password.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 flex flex-col items-center">
            {enrollData ? (
              <>
                <div className="bg-white p-4 rounded-xl shadow-md border border-slate-200 select-none">
                  {/* Since Supabase returns a base64 encoded SVG image, we put it directly in img src */}
                  <img src={enrollData.qrCode} alt="2FA QR Code" className="w-48 h-48" />
                </div>

                <div className="w-full space-y-2 text-center">
                  <span className="text-xs text-slate-500 uppercase tracking-widest block">Manual Secret Key</span>
                  <code className="px-3 py-1.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-indigo-650 dark:text-indigo-400 rounded-md font-mono text-sm tracking-wider select-all block break-all">
                    {enrollData.secret}
                  </code>
                </div>

                <form onSubmit={handleVerifyEnrollment} className="w-full space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="code" className="text-slate-600 dark:text-slate-300 font-medium text-center block">
                      Enter Verification Code
                    </Label>
                    <Input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      placeholder="000 000"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                      className="text-center tracking-[0.4em] font-mono text-lg bg-slate-50 dark:bg-slate-950/80 border-slate-200 dark:border-slate-800 focus:border-indigo-550 focus:ring-1 focus:ring-indigo-550 text-slate-850 dark:text-white placeholder-slate-400 dark:placeholder-slate-700 rounded-lg py-5.5"
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-indigo-650 hover:bg-indigo-600 text-white font-semibold py-6 rounded-lg transition-all shadow-md shadow-indigo-650/10 active:scale-[0.98]"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Verifying and Saving...
                      </>
                    ) : (
                      'Verify & Activate 2FA'
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                <span>Generating authenticator profiles...</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-center border-t border-slate-200 dark:border-slate-800/60 pt-4">
            <Button
              type="button"
              variant="link"
              onClick={() => {
                supabase.auth.signOut();
                router.push('/login');
              }}
              className="text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white"
            >
              Sign out and try later
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
