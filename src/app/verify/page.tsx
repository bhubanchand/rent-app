'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  ShieldCheck, 
  ShieldAlert, 
  Shield, 
  Loader2, 
  Search, 
  CheckCircle2, 
  XCircle,
  Download,
  FileText,
  Receipt as ReceiptIcon,
  Calendar,
  User,
  Lock
} from 'lucide-react';
import { generateInvoicePdf, generateReceiptPdf } from '@/lib/pdf-generator';

type VerificationResult = {
  status: 'VALID' | 'INVALID';
  type?: 'invoice' | 'receipt';
  number?: string;
  customerName?: string;
  amount?: number;
  date?: string;
  statusText?: string;
  message?: string;
  details?: any; // Sanitized document details
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

  const handleDownloadPdf = async (res: VerificationResult) => {
    if (!res.details) return;
    try {
      toast.info(`Generating ${res.type === 'invoice' ? 'Invoice' : 'Receipt'} PDF...`);
      if (res.type === 'invoice') {
        // Ensure amount is parsed as float for safety
        const details = {
          ...res.details,
          amount: Number(res.details.amount)
        };
        await generateInvoicePdf(details);
      } else {
        await generateReceiptPdf(res.details);
      }
      toast.success('Document PDF downloaded!');
    } catch (err) {
      toast.error('Failed to generate PDF document.');
    }
  };

  return (
    <div className="w-full max-w-lg z-10 my-8">
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
                <p className="font-bold">Verification Error</p>
                <p className="mt-0.5 text-slate-400 leading-relaxed">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Validation Results */}
          {result && (
            <div className="border-t border-slate-800 pt-6 space-y-5">
              {result.status === 'VALID' ? (
                <div className="space-y-5">
                  {/* Verified Seal */}
                  <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 text-emerald-450 rounded-2xl flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm text-white">VALID DOCUMENT RECORD</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        This digital document is authentic and matches a registered transaction in our secure database ledger.
                      </p>
                    </div>
                  </div>

                  {/* Sanitized fields - Invoice Details */}
                  {result.type === 'invoice' && result.details && (
                    <div className="space-y-4">
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                        <h3 className="font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-indigo-400" /> Invoice Details
                        </h3>
                        <div className="grid grid-cols-2 gap-3 text-slate-400">
                          <div>
                            <span className="block text-[10px] text-slate-500">Invoice Number</span>
                            <span className="font-mono font-bold text-indigo-400">{result.details.invoice_number}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-500">Status</span>
                            <span className={`inline-block px-2 py-0.5 border text-[9px] font-semibold rounded-full uppercase ${
                              result.details.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              result.details.status === 'partially_paid' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                              'bg-slate-800 text-slate-400 border-slate-700'
                            }`}>
                              {result.details.status.replace('_', ' ')}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-500">Issue Date</span>
                            <span className="font-semibold text-white">{result.details.issue_date}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-500">Due Date</span>
                            <span className="font-semibold text-white">{result.details.due_date}</span>
                          </div>
                        </div>
                        <div className="border-t border-slate-800/60 pt-2 text-slate-400">
                          <span className="block text-[10px] text-slate-500">Description</span>
                          <span className="text-white font-medium">{result.details.description || 'Billing Services / Rental Charges'}</span>
                        </div>
                        <div className="border-t border-slate-800/60 pt-2 flex justify-between items-center">
                          <span className="text-slate-500">Total Amount</span>
                          <span className="font-bold text-white text-sm">
                            ₹{Number(result.details.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Customer info block */}
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                        <h3 className="font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-indigo-400" /> Customer Information
                        </h3>
                        <div className="text-slate-400 space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Name</span>
                            <span className="font-semibold text-white">{result.details.customer.full_name}</span>
                          </div>
                          {result.details.customer.company_name && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Company</span>
                              <span className="font-semibold text-white">{result.details.customer.company_name}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-500">Email</span>
                            <span className="text-white">{result.details.customer.email}</span>
                          </div>
                          {result.details.customer.phone && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Phone</span>
                              <span className="text-white">{result.details.customer.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Payment History block */}
                      {result.details.payments && result.details.payments.length > 0 && (
                        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                          <h3 className="font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-1.5">
                            <ReceiptIcon className="h-3.5 w-3.5 text-indigo-400" /> Payment Ledger
                          </h3>
                          <div className="space-y-2">
                            {result.details.payments.map((p: any, idx: number) => (
                              <div key={idx} className="flex justify-between items-center text-slate-400 border-b border-slate-900/60 pb-1.5 last:border-b-0 last:pb-0">
                                <div>
                                  <span className="font-semibold text-white block">Partial Payment #{idx + 1}</span>
                                  <span className="text-[10px] text-slate-550">{p.payment_date} ({p.payment_method.toUpperCase()})</span>
                                </div>
                                <span className="font-bold text-white">
                                  ₹{Number(p.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Sanitized fields - Receipt Details */}
                  {result.type === 'receipt' && result.details && (
                    <div className="space-y-4">
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                        <h3 className="font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-1.5">
                          <ReceiptIcon className="h-3.5 w-3.5 text-indigo-400" /> Receipt Details
                        </h3>
                        <div className="grid grid-cols-2 gap-3 text-slate-400">
                          <div>
                            <span className="block text-[10px] text-slate-500">Receipt Number</span>
                            <span className="font-mono font-bold text-indigo-400">{result.details.receipt_number}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-500">Payment Date</span>
                            <span className="font-semibold text-white">{result.details.payment.payment_date}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-500">Payment Method</span>
                            <span className="font-semibold text-white uppercase">{result.details.payment.payment_method.replace('_', ' ')}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-500">Invoice Ref</span>
                            <span className="font-mono font-semibold text-white">{result.details.payment.invoice.invoice_number}</span>
                          </div>
                        </div>
                        {result.details.payment.transaction_id && (
                          <div className="border-t border-slate-800/60 pt-2 text-slate-400">
                            <span className="block text-[10px] text-slate-500">Transaction ID</span>
                            <span className="font-mono font-semibold text-white">{result.details.payment.transaction_id}</span>
                          </div>
                        )}
                        <div className="border-t border-slate-800/60 pt-2 flex justify-between items-center bg-emerald-950/20 -mx-4 px-4 py-2 mt-2">
                          <span className="text-emerald-400 font-bold">Amount Paid</span>
                          <span className="font-bold text-emerald-450 text-sm">
                            ₹{Number(result.details.payment.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Customer info block */}
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                        <h3 className="font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-indigo-400" /> Customer Information
                        </h3>
                        <div className="text-slate-400 space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Name</span>
                            <span className="font-semibold text-white">{result.details.customer.full_name}</span>
                          </div>
                          {result.details.customer.company_name && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Company</span>
                              <span className="font-semibold text-white">{result.details.customer.company_name}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-slate-500">Email</span>
                            <span className="text-white">{result.details.customer.email}</span>
                          </div>
                          {result.details.customer.phone && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Phone</span>
                              <span className="text-white">{result.details.customer.phone}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Cryptographic block */}
                      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                        <h3 className="font-semibold text-white border-b border-slate-800 pb-2 flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5 text-amber-500" /> Cryptographic Integrity Seal
                        </h3>
                        <div className="text-[10px] text-slate-400 space-y-2.5 leading-relaxed">
                          <div>
                            <span className="block text-[9px] text-slate-500 uppercase font-semibold">SHA-256 Integrity Hash</span>
                            <span className="font-mono text-slate-300 block break-all bg-slate-900 p-2 rounded border border-slate-800 mt-0.5">{result.details.sha256_hash}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-500 uppercase font-semibold">HMAC Digital Signature</span>
                            <span className="font-mono text-slate-300 block break-all bg-slate-900 p-2 rounded border border-slate-800 mt-0.5">{result.details.digital_signature}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Download PDF CTA Button */}
                  <Button
                    onClick={() => handleDownloadPdf(result)}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-5.5 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                  >
                    <Download className="h-4 w-4" /> Download Official PDF
                  </Button>
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
          Secure cryptographic seal. Protected against tampering.
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
