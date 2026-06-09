'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ShieldAlert, Loader2, Sparkles, User, Mail, Lock } from 'lucide-react';

export default function SetupWizardPage() {
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    async function checkFirstLaunch() {
      try {
        const response = await fetch('/api/setup');
        const data = await response.json();
        
        if (!data.isFirstLaunch) {
          toast.info('System setup is already completed.');
          router.push('/login');
        } else {
          setLoading(false);
        }
      } catch (err) {
        toast.error('Failed to communicate with setup api.');
      }
    }

    checkFirstLaunch();
  }, [router]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password || !confirmPassword) {
      toast.error('Please fill in all fields.');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    setFormLoading(true);
    try {
      const response = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          email_confirm: true,
          full_name: fullName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to complete registration.');
      }

      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-bold text-slate-100 flex items-center gap-1.5 text-xs">
            <Sparkles className="h-4 w-4 text-indigo-400" /> Setup Complete!
          </span>
          <span className="text-[10px] text-slate-400">
            Admin console is configured. Sign up is now disabled forever.
          </span>
        </div>
      );

      // Redirect to login to set up MFA
      router.push('/login');
    } catch (err: any) {
      toast.error(err.message || 'Registration failed.');
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-400 gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span className="text-xs">Checking system ledger status...</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(15,23,42,0.8),transparent)] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 mb-3 animate-bounce">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            RentApp Setup Wizard
          </h1>
          <p className="text-sm text-slate-400 mt-1">Configure your system console on first launch</p>
        </div>

        <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-2xl text-slate-200">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-white text-center">Create Administrator</CardTitle>
            <CardDescription className="text-slate-400 text-center">
              Define the master account. Signups will lock after this step.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleRegister}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-slate-300 font-medium">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                  <Input
                    id="fullName"
                    placeholder="Jane Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 bg-slate-950/80 border-slate-800 focus:border-indigo-500 text-white rounded-lg py-5.5"
                    disabled={formLoading}
                    required
                  />
                </div>
              </div>

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
                    className="pl-10 bg-slate-950/80 border-slate-800 focus:border-indigo-500 text-white rounded-lg py-5.5"
                    disabled={formLoading}
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
                    className="pl-10 bg-slate-950/80 border-slate-800 focus:border-indigo-500 text-white rounded-lg py-5.5"
                    disabled={formLoading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-300 font-medium">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4.5 w-4.5 text-slate-500" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 bg-slate-950/80 border-slate-800 focus:border-indigo-500 text-white rounded-lg py-5.5"
                    disabled={formLoading}
                    required
                  />
                </div>
              </div>

              <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs flex gap-2.5 mt-2">
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Permanent Security Note:</strong> Once this account is configured, public registration API endpoints will shut down and deny any new accounts.
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-6 rounded-lg transition-all shadow-lg"
                disabled={formLoading}
              >
                {formLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Initializing system console...
                  </>
                ) : (
                  'Configure Master Console'
                )}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
