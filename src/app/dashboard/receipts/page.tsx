'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  Receipt,
  Search,
  Download,
  ExternalLink,
  Loader2,
  Calendar,
  User,
  FileText,
  IndianRupee,
  ShieldCheck,
  TrendingUp,
  Printer,
  Share2,
  Copy,
  Check
} from 'lucide-react';
import { buildReceiptPdfDoc, generateReceiptPdf } from '@/lib/pdf-generator';

type ReceiptItem = {
  id: string;
  receipt_number: string;
  verification_code: string;
  sha256_hash: string;
  digital_signature: string;
  created_at: string;
  payment: {
    id: string;
    amount: number;
    payment_date: string;
    payment_method: string;
    transaction_id: string | null;
    invoice: {
      id: string;
      invoice_number: string;
      customer: {
        id: string;
        full_name: string;
        company_name: string | null;
        email: string;
        phone: string | null;
      };
    };
  };
};

export default function ReceiptsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [methodFilter, setMethodFilter] = useState('all');
  
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('receipts')
        .select(`
          id,
          receipt_number,
          verification_code,
          sha256_hash,
          digital_signature,
          created_at,
          payment:payments(
            id,
            amount,
            payment_date,
            payment_method,
            transaction_id,
            invoice:invoices(
              id,
              invoice_number,
              customer:customers(
                id,
                full_name,
                company_name,
                email,
                phone
              )
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReceipts((data as any) || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch receipts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [supabase]);

  const handleDownload = async (receipt: ReceiptItem) => {
    try {
      toast.info(`Generating receipt ${receipt.receipt_number}...`);
      const customer = receipt.payment?.invoice?.customer;
      
      await generateReceiptPdf({
        receipt_number: receipt.receipt_number,
        verification_code: receipt.verification_code,
        sha256_hash: receipt.sha256_hash,
        digital_signature: receipt.digital_signature,
        payment: {
          amount: Number(receipt.payment?.amount || 0),
          payment_date: receipt.payment?.payment_date,
          payment_method: receipt.payment?.payment_method || 'cash',
          transaction_id: receipt.payment?.transaction_id,
          invoice: {
            invoice_number: receipt.payment?.invoice?.invoice_number || 'N/A'
          }
        },
        customer: {
          full_name: customer?.full_name || 'N/A',
          company_name: customer?.company_name || null,
          email: customer?.email || '',
          phone: customer?.phone || null
        }
      });
      toast.success('Receipt PDF downloaded!');
    } catch (err: any) {
      toast.error('Failed to generate Receipt PDF.');
    }
  };

  const handlePrint = async (receipt: ReceiptItem) => {
    try {
      toast.info(`Preparing print preview for ${receipt.receipt_number}...`);
      const customer = receipt.payment?.invoice?.customer;

      const doc = await buildReceiptPdfDoc({
        receipt_number: receipt.receipt_number,
        verification_code: receipt.verification_code,
        sha256_hash: receipt.sha256_hash,
        digital_signature: receipt.digital_signature,
        payment: {
          amount: Number(receipt.payment?.amount || 0),
          payment_date: receipt.payment?.payment_date,
          payment_method: receipt.payment?.payment_method || 'cash',
          transaction_id: receipt.payment?.transaction_id,
          invoice: {
            invoice_number: receipt.payment?.invoice?.invoice_number || 'N/A'
          }
        },
        customer: {
          full_name: customer?.full_name || 'N/A',
          company_name: customer?.company_name || null,
          email: customer?.email || '',
          phone: customer?.phone || null
        }
      });

      const pdfBlob = doc.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);
      const printWindow = window.open(blobUrl, '_blank');
      if (printWindow) {
        printWindow.focus();
      } else {
        toast.error('Print preview blocked by pop-up blocker.');
      }
    } catch (err: any) {
      toast.error('Failed to open print preview.');
    }
  };

  const handleCopyShareLink = async (receipt: ReceiptItem) => {
    const customerId = receipt.payment?.invoice?.customer?.id;
    if (!customerId) return;

    setSharingId(receipt.id);
    try {
      // 1. Fetch or create a Customer Share Portal link
      let { data: shareLink, error: shareError } = await supabase
        .from('share_links')
        .select('*')
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .maybeSingle();

      if (shareError) throw shareError;

      if (!shareLink) {
        // Create new secure token
        const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        const { data: newLink, error: createError } = await supabase
          .from('share_links')
          .insert([
            {
              customer_id: customerId,
              token,
              is_active: true,
              expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
            }
          ])
          .select()
          .single();

        if (createError) throw createError;
        shareLink = newLink;
      }

      const appUrl = window.location.origin;
      const portalUrl = `${appUrl}/share/${shareLink.token}`;
      
      await navigator.clipboard.writeText(portalUrl);
      setCopiedId(receipt.id);
      toast.success('Secure customer billing portal link copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate share link.');
    } finally {
      setSharingId(null);
    }
  };

  // Filter & Search Logic
  const filteredReceipts = receipts.filter((receipt) => {
    const customer = receipt.payment?.invoice?.customer;
    const invoiceNum = receipt.payment?.invoice?.invoice_number;
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      receipt.receipt_number.toLowerCase().includes(searchLower) ||
      (customer?.full_name || '').toLowerCase().includes(searchLower) ||
      (customer?.company_name || '').toLowerCase().includes(searchLower) ||
      (invoiceNum || '').toLowerCase().includes(searchLower);

    const matchesMethod = 
      methodFilter === 'all' || 
      receipt.payment?.payment_method === methodFilter;

    return matchesSearch && matchesMethod;
  });

  // Calculate Metrics
  const totalVolume = filteredReceipts.reduce(
    (sum, r) => sum + Number(r.payment?.amount || 0), 
    0
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            <Receipt className="h-8 w-8 text-indigo-500" /> Receipts Ledger
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Browse payment receipts, download PDF duplicates, and audit cryptographic integrity seals.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Collection</span>
              <h3 className="text-2xl font-bold mt-1 text-emerald-450">
                ₹{totalVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center">
              <IndianRupee className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Receipts Issued</span>
              <h3 className="text-2xl font-bold mt-1 text-white">
                {filteredReceipts.length}
              </h3>
            </div>
            <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white sm:col-span-2 lg:col-span-1">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Cryptographic Status</span>
              <h3 className="text-2xl font-bold mt-1 text-indigo-450 flex items-center gap-1.5">
                100% Sealed
              </h3>
            </div>
            <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search Toolbar */}
      <Card className="bg-slate-900 border-slate-800 text-slate-200">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <Input
              placeholder="Search by receipt #, customer name, or invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border-slate-800 text-white rounded-lg pl-10 focus:border-indigo-500 w-full"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="bg-slate-950 border-slate-800 text-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 flex-1 md:flex-initial outline-none"
            >
              <option value="all">All Payment Methods</option>
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>

            <Button
              onClick={fetchReceipts}
              variant="outline"
              disabled={loading}
              className="border-slate-800 text-slate-300 hover:text-white"
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Receipts List Table/Cards */}
      <Card className="bg-slate-900 border-slate-800 text-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <span className="text-slate-400 text-xs">Fetching cryptographic receipts...</span>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm space-y-2">
            <Receipt className="h-10 w-10 text-slate-700 mx-auto" />
            <p>No receipts matched your filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase font-bold bg-slate-950/20">
                    <th className="p-4">Receipt #</th>
                    <th className="p-4">Customer</th>
                    <th className="p-4">Invoice</th>
                    <th className="p-4">Date / Method</th>
                    <th className="p-4 text-right">Amount</th>
                    <th className="p-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceipts.map((receipt) => {
                    const customer = receipt.payment?.invoice?.customer;
                    const invoice = receipt.payment?.invoice;
                    
                    return (
                      <tr key={receipt.id} className="border-b border-slate-850 hover:bg-slate-800/40 transition-colors">
                        <td className="p-4 font-mono font-bold text-indigo-400">{receipt.receipt_number}</td>
                        <td className="p-4">
                          <div className="font-semibold text-white">{customer?.full_name || 'N/A'}</div>
                          {customer?.company_name && (
                            <div className="text-[11px] text-slate-500">{customer.company_name}</div>
                          )}
                        </td>
                        <td className="p-4 font-mono text-slate-350">{invoice?.invoice_number || 'N/A'}</td>
                        <td className="p-4 text-xs text-slate-400">
                          <div>{receipt.payment?.payment_date}</div>
                          <div className="text-[10px] text-slate-500 uppercase font-semibold mt-0.5">
                            {receipt.payment?.payment_method?.replace('_', ' ')}
                          </div>
                        </td>
                        <td className="p-4 text-right font-bold text-white">
                          ₹{Number(receipt.payment?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              onClick={() => handleDownload(receipt)}
                              variant="ghost"
                              className="h-8 w-8 p-0 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white"
                              title="Download PDF Receipt"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              onClick={() => handlePrint(receipt)}
                              variant="ghost"
                              className="h-8 w-8 p-0 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white"
                              title="Print Receipt"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              onClick={() => handleCopyShareLink(receipt)}
                              variant="ghost"
                              disabled={sharingId === receipt.id}
                              className="h-8 w-8 p-0 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white"
                              title="Copy Customer Share Link"
                            >
                              {sharingId === receipt.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                              ) : copiedId === receipt.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Share2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            
                            <Button
                              onClick={() => router.push(`/verify?code=${receipt.verification_code}`)}
                              variant="ghost"
                              className="h-8 w-8 p-0 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white"
                              title="Verify Seal Online"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="block md:hidden divide-y divide-slate-850">
              {filteredReceipts.map((receipt) => {
                const customer = receipt.payment?.invoice?.customer;
                const invoice = receipt.payment?.invoice;

                return (
                  <div key={receipt.id} className="p-4 space-y-3 hover:bg-slate-800/20 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono font-bold text-indigo-400 text-sm">{receipt.receipt_number}</span>
                        <div className="text-xs text-slate-400 font-semibold mt-0.5">{customer?.full_name}</div>
                        {customer?.company_name && (
                          <div className="text-[10px] text-slate-500">{customer.company_name}</div>
                        )}
                      </div>
                      <span className="font-bold text-white text-base">
                        ₹{Number(receipt.payment?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 border-t border-slate-850/60 pt-2">
                      <div>
                        <span className="block text-[10px] text-slate-500">Related Invoice</span>
                        <span className="font-mono text-slate-300">{invoice?.invoice_number}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">Method</span>
                        <span className="uppercase text-slate-300">{receipt.payment?.payment_method?.replace('_', ' ')}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">Payment Date</span>
                        <span>{receipt.payment?.payment_date}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-500">Verification Link</span>
                        <button
                          onClick={() => router.push(`/verify?code=${receipt.verification_code}`)}
                          className="text-indigo-450 hover:underline flex items-center gap-0.5"
                        >
                          Verify Seal &rarr;
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-850/60">
                      <Button
                        onClick={() => handleDownload(receipt)}
                        className="flex-1 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-300 text-xs py-2 h-auto flex items-center justify-center gap-1.5"
                      >
                        <Download className="h-3.5 w-3.5" /> PDF
                      </Button>

                      <Button
                        onClick={() => handlePrint(receipt)}
                        className="flex-1 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-300 text-xs py-2 h-auto flex items-center justify-center gap-1.5"
                      >
                        <Printer className="h-3.5 w-3.5" /> Print
                      </Button>

                      <Button
                        onClick={() => handleCopyShareLink(receipt)}
                        disabled={sharingId === receipt.id}
                        className="flex-1 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-300 text-xs py-2 h-auto flex items-center justify-center gap-1.5"
                      >
                        {sharingId === receipt.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : copiedId === receipt.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" /> Share
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
