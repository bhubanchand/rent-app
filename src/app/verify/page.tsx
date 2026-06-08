'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ShieldCheck, ShieldAlert, Shield, Loader2, Search, CheckCircle2, XCircle } from 'lucide-react';

type VerificationResult = {
  status: 'VALID' | 'INVALID';
  type?: 'invoice' | 'receipt';
  number?: string;
  customerName?: string;
  amount?: number;
  date?: string;
  statusText?: string;
  message?: string;
};

function VerificationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const codeParam = searchParams.get('code') || '';
  const [code, setCode] = useState(codeParam);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const performVerification = async (verifyCode: string) => {
    if (!verifyCode) return;
    setLoading(true);
    setErrorMsg(null);
    setResult(null);

    try {
      const response = await fetch('/api/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: verifyCode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification process failed.');
      }

      setResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during verification.');
    } finally {
      setLoading(false);
    }
  };

  // Auto verify if code param is in url
  useEffect(() => {
    if (codeParam) {
      setCode(codeParam);
      performVerification(codeParam);
    }
  }, [codeParam]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) {
      toast.error('Please enter a verification code.');
      return;
    }
    
    // Push query parameter to URL for shareability
    const newParams = new URLSearchParams();
    newParams.set('code', code.trim().toUpperCase());
    router.push(`/verify?${newParams.toString()}`);
  };

  return (
    <div className="w-full max-w-md z-10">
      <div className="text-center mb-8">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-400 shadow-lg shadow-indigo-600/10 mb-3">
          <Shield className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
          RentApp Verification
        </h1>
        <p className="text-sm text-slate-400 mt-1">Cryptographic Seal Integrity Validator</p>
      </div>

      <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-md shadow-2xl text-slate-200">
        <CardHeader>
          <CardTitle className="text-xl font-bold text-white text-center">Document Authenticator</CardTitle>
          <CardDescription className="text-slate-400 text-center">
            Scan document QR or enter code manually below
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-slate-300 font-medium text-xs">
                Verification / Reference Code
              </Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  placeholder="e.g. RCP-2026-000001 or INV-2026-000001"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="bg-slate-950/80 border-slate-800 focus:border-indigo-500 text-white rounded-lg flex-1 py-5"
                  disabled={loading}
                  required
                />
                <Button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg px-4 active:scale-95 transition-all"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </form>

          {/* Loading details */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 gap-2 border-t border-slate-800 pt-6">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
              <span className="text-xs">Verifying digital ledger seals...</span>
            </div>
          )}

          {/* Rate limiting or generic errors */}
          {errorMsg && (
            <div className="p-4 bg-amber-950/30 border border-amber-900/30 text-amber-400 rounded-xl text-xs flex items-start gap-2.5 mt-4">
              <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Verification Blocked</p>
                <p className="mt-0.5 text-slate-400 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Validation Results */}
          {result && (
            <div className="border-t border-slate-800 pt-6 space-y-4">
              {result.status === 'VALID' ? (
                <div className="space-y-4">
                  {/* Verified Seal */}
                  <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 text-emerald-400 rounded-2xl flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm text-white">VALID DOCUMENT RECORD</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        This digital document matches a registered transaction in our ledger.
                      </p>
                    </div>
                  </div>

                  {/* Sanitized fields */}
                  <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Document Type</span>
                      <span className="font-semibold text-white uppercase">{result.type}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Document Reference</span>
                      <span className="font-mono font-bold text-indigo-400">{result.number}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Customer</span>
                      <span className="font-semibold text-white">{result.customerName}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Total Amount</span>
                      <span className="font-semibold text-white">
                        ₹{Number(result.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Date</span>
                      <span className="font-semibold text-white">{result.date}</span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500">
                      <span>Status</span>
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-semibold text-[10px]">
                        {result.statusText}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-red-950/20 border border-red-900/40 text-red-400 rounded-2xl flex items-start gap-3">
                  <XCircle className="h-5 w-5 shrink-0 text-red-500 mt-0.5" />
                  <div>
                    <p className="font-bold text-sm text-white">INVALID REFERENCE CODE</p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      {result.message || 'No registered invoice or receipt matches this verification signature.'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-center border-t border-slate-800/60 pt-4 text-[10px] text-slate-500">
          Secure cryptographic seal. Protected against scanning scans.
        </CardFooter>
      </Card>
    </div>
  );
}

export default function VerificationPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(15,23,42,0.8),transparent)] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      
      <Suspense fallback={
        <div className="flex flex-col items-center justify-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <span className="text-slate-400">Loading validator...</span>
        </div>
      }>
        <VerificationContent />
      </Suspense>
    </div>
  );
}
