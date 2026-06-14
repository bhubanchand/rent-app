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
  IndianRupee,
  ShieldCheck,
  Printer,
  Share2,
  Check,
  Trash2
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
        phone?: string | null;
        phone_number?: string | null;
        address?: string | null;
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
                phone,
                address
              )
            )
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Normalize potential array outputs from PostgREST joins to singular objects
      const normalized = ((data as any) || []).map((receipt: any) => {
        let payment = receipt.payment;
        if (Array.isArray(payment)) payment = payment[0];

        let invoice = payment?.invoice;
        if (Array.isArray(invoice)) invoice = invoice[0];

        let customer = invoice?.customer;
        if (Array.isArray(customer)) customer = customer[0];

        return {
          ...receipt,
          payment: payment ? {
            ...payment,
            invoice: invoice ? {
              ...invoice,
              customer: customer || null
            } : null
          } : null
        };
      });

      setReceipts(normalized);
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
          phone: customer?.phone_number || customer?.phone || null,
          address: customer?.address || null
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
          phone: customer?.phone_number || customer?.phone || null,
          address: customer?.address || null
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
        const token = crypto.randomUUID().replace(/-/g, '');
        const { data: newLink, error: createError } = await supabase
          .from('share_links')
          .insert([
            {
              customer_id: customerId,
              token,
              is_active: true,
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
      toast.success('Secure customer portal link copied!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate share link.');
    } finally {
      setSharingId(null);
    }
  };

  const handleDeleteReceipt = async (receipt: ReceiptItem) => {
    const paymentId = receipt.payment?.id;
    const invoiceId = receipt.payment?.invoice?.id;

    if (!paymentId || !invoiceId) {
      toast.error('Invalid receipt data, cannot delete.');
      return;
    }

    const confirm = window.confirm(`Are you sure you want to delete receipt ${receipt.receipt_number}? This will delete the payment of ₹${receipt.payment.amount} and recalculate the status of invoice ${receipt.payment.invoice.invoice_number}.`);
    if (!confirm) return;

    try {
      toast.loading('Deleting receipt and updating invoice...');
      
      // 1. Fetch the invoice and its payments (excluding the current payment)
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('amount, due_date, status, payments(id, amount)')
        .eq('id', invoiceId)
        .single();

      if (invoiceError) throw invoiceError;

      const payments = invoiceData.payments || [];
      const remainingPayments = payments.filter((p: any) => p.id !== paymentId);
      const newPaidTotal = remainingPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      // Determine new status
      let newStatus = invoiceData.status;
      if (invoiceData.status !== 'cancelled' && invoiceData.status !== 'draft') {
        if (newPaidTotal >= Number(invoiceData.amount) - 0.01) {
          newStatus = 'paid';
        } else if (newPaidTotal > 0) {
          newStatus = 'partially_paid';
        } else {
          const isOverdue = new Date(invoiceData.due_date).getTime() < Date.now();
          newStatus = isOverdue ? 'overdue' : 'pending';
        }
      }

      // 2. Update invoice status
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      // 3. Delete the payment (will cascade and delete receipt)
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (deleteError) throw deleteError;

      toast.dismiss();
      toast.success(`Receipt ${receipt.receipt_number} has been deleted.`);
      fetchReceipts();
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || 'Failed to delete receipt.');
    }
  };

  // Filter & Search Logic
  const filteredReceipts = receipts.filter((receipt) => {
    const customer = receipt.payment?.invoice?.customer;
    const invoiceNum = receipt.payment?.invoice?.invoice_number;
    const phoneVal = customer?.phone_number || customer?.phone || '';
    
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      receipt.receipt_number.toLowerCase().includes(searchLower) ||
      (customer?.full_name || '').toLowerCase().includes(searchLower) ||
      (customer?.company_name || '').toLowerCase().includes(searchLower) ||
      (invoiceNum || '').toLowerCase().includes(searchLower) ||
      phoneVal.includes(searchQuery);

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
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Receipt className="h-8 w-8 text-indigo-650 dark:text-indigo-500" /> Receipts Ledger
          </h1>
          <p className="text-slate-555 dark:text-slate-400 text-sm mt-1">
            Browse payment receipts, download PDF duplicates, and verify digital signature integrity seals.
          </p>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold block">Total Collection</span>
              <h3 className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-500">
                ₹{totalVolume.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
            </div>
            <div className="h-10 w-10 bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 rounded-xl flex items-center justify-center">
              <IndianRupee className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold block">Total Receipts Issued</span>
              <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">
                {filteredReceipts.length}
              </h3>
            </div>
            <div className="h-10 w-10 bg-indigo-550/10 text-indigo-650 dark:text-indigo-400 rounded-xl flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm sm:col-span-2 lg:col-span-1">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold block">Cryptographic Status</span>
              <h3 className="text-2xl font-bold mt-1 text-indigo-650 dark:text-indigo-400 flex items-center gap-1.5">
                100% Sealed
              </h3>
            </div>
            <div className="h-10 w-10 bg-indigo-550/10 text-indigo-650 dark:text-indigo-400 rounded-xl flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search Toolbar */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-550" />
            <Input
              placeholder="Search by receipt #, customer name, phone or invoice..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg pl-10 focus:border-indigo-500 w-full"
            />
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <select
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 flex-1 md:flex-initial outline-none cursor-pointer"
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
              className="border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Receipts List Table/Cards */}
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <span className="text-slate-500 text-xs">Fetching cryptographic receipts...</span>
          </div>
        ) : filteredReceipts.length === 0 ? (
          <div className="text-center py-16 text-slate-550 dark:text-slate-500 text-sm space-y-2">
            <Receipt className="h-10 w-10 text-slate-400 dark:text-slate-650 mx-auto" />
            <p>No receipts matched your filters.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs uppercase font-bold bg-slate-50/50 dark:bg-slate-950/20">
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
                      <tr key={receipt.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-mono font-bold text-indigo-650 dark:text-indigo-400">{receipt.receipt_number}</td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-900 dark:text-white">{customer?.full_name || 'N/A'}</div>
                          {customer?.company_name && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-450">{customer.company_name}</div>
                          )}
                          <div className="text-[10px] text-slate-400 mt-0.5">Phone: {customer?.phone_number || customer?.phone || 'N/A'}</div>
                        </td>
                        <td className="p-4 font-mono text-slate-600 dark:text-slate-350">{invoice?.invoice_number || 'N/A'}</td>
                        <td className="p-4 text-xs text-slate-500 dark:text-slate-400">
                          <div>{receipt.payment?.payment_date}</div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold mt-0.5">
                            {receipt.payment?.payment_method?.replace('_', ' ')}
                          </div>
                        </td>
                        <td className="p-4 text-right font-bold text-slate-900 dark:text-white">
                          ₹{Number(receipt.payment?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              onClick={() => handleDownload(receipt)}
                              variant="ghost"
                              className="h-8 w-8 p-0 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                              title="Download PDF Receipt"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              onClick={() => handlePrint(receipt)}
                              variant="ghost"
                              className="h-8 w-8 p-0 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                              title="Print Receipt"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              onClick={() => handleCopyShareLink(receipt)}
                              variant="ghost"
                              disabled={sharingId === receipt.id}
                              className="h-8 w-8 p-0 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                              title="Copy Customer Share Link"
                            >
                              {sharingId === receipt.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />
                              ) : copiedId === receipt.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" />
                              ) : (
                                <Share2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            
                            <Button
                              onClick={() => router.push(`/verify?code=${receipt.verification_code}`)}
                              variant="ghost"
                              className="h-8 w-8 p-0 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                              title="Verify Seal Online"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              onClick={() => handleDeleteReceipt(receipt)}
                              variant="ghost"
                              className="h-8 w-8 p-0 border border-slate-200 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-500 cursor-pointer"
                              title="Delete Receipt"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
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
            <div className="block md:hidden divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReceipts.map((receipt) => {
                const customer = receipt.payment?.invoice?.customer;
                const invoice = receipt.payment?.invoice;

                return (
                  <div key={receipt.id} className="p-4 space-y-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                     <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono font-bold text-indigo-650 dark:text-indigo-400 text-sm">{receipt.receipt_number}</span>
                        <div className="text-xs text-slate-800 dark:text-white font-semibold mt-0.5">{customer?.full_name}</div>
                        {customer?.company_name && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-450">{customer.company_name}</div>
                        )}
                        <div className="text-[10px] text-slate-400 mt-0.5">Phone: {customer?.phone_number || customer?.phone || 'N/A'}</div>
                      </div>
                      <span className="font-bold text-slate-900 dark:text-white text-base">
                        ₹{Number(receipt.payment?.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
                      <div>
                        <span className="block text-[10px] text-slate-400 dark:text-slate-550">Related Invoice</span>
                        <span className="font-mono text-slate-800 dark:text-slate-300">{invoice?.invoice_number}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 dark:text-slate-550">Method</span>
                        <span className="uppercase text-slate-800 dark:text-slate-300">{receipt.payment?.payment_method?.replace('_', ' ')}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 dark:text-slate-550">Payment Date</span>
                        <span className="text-slate-800 dark:text-slate-300">{receipt.payment?.payment_date}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] text-slate-400 dark:text-slate-550">Verification Link</span>
                        <button
                          onClick={() => router.push(`/verify?code=${receipt.verification_code}`)}
                          className="text-indigo-650 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
                        >
                          Verify Seal &rarr;
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <Button
                        onClick={() => handleDownload(receipt)}
                        className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-350 text-xs py-2 h-auto flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" /> PDF
                      </Button>

                      <Button
                        onClick={() => handlePrint(receipt)}
                        className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-350 text-xs py-2 h-auto flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5" /> Print
                      </Button>

                      <Button
                        onClick={() => handleCopyShareLink(receipt)}
                        disabled={sharingId === receipt.id}
                        className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-350 text-xs py-2 h-auto flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {sharingId === receipt.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : copiedId === receipt.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-500" /> Copied
                          </>
                        ) : (
                          <>
                            <Share2 className="h-3.5 w-3.5" /> Share
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={() => handleDeleteReceipt(receipt)}
                        className="flex-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-755 dark:text-slate-350 hover:text-red-600 dark:hover:text-red-500 text-xs py-2 h-auto flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
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
