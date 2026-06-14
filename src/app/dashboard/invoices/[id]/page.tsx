'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import QRCode from 'qrcode';
import {
  FileText,
  Calendar,
  ChevronLeft,
  Loader2,
  Download,
  Share2,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  Printer,
  Sparkles,
  PlusCircle,
  QrCode,
  Check,
  Building,
  Trash2,
  Ban,
} from 'lucide-react';
import { generateInvoicePdf, generateReceiptPdf, buildInvoicePdfDoc, buildReceiptPdfDoc } from '@/lib/pdf-generator';

type Payment = {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  transaction_id: string | null;
  notes: string | null;
  receipt?: {
    id: string;
    receipt_number: string;
    verification_code: string;
    sha256_hash: string;
    digital_signature: string;
  };
};

type Invoice = {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  issue_date: string;
  due_date: string;
  description: string | null;
  status: 'draft' | 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  created_at: string;
  customer: {
    id: string;
    full_name: string;
    company_name: string | null;
    email?: string | null;
    phone?: string | null;
    phone_number?: string | null;
    address?: string | null;
    gst_number?: string | null;
  };
  payments?: Payment[];
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function InvoiceDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id: invoiceId } = use(params);
  const supabase = createClient();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  // Status and payments dialog state
  const [statusLoading, setStatusLoading] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Add Payment Form state
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [transactionId, setTransactionId] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  // Share link automation state
  const [shareLoading, setShareLoading] = useState(false);

  const fetchInvoiceDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(id, full_name, company_name, email, phone, address, gst_number),
          payments(*, receipt:receipts(*))
        `)
        .eq('id', invoiceId)
        .single();

      if (error) throw error;

      // Normalize potential array outputs from PostgREST joins to singular objects
      let normalizedInvoice = { ...data };
      if (Array.isArray(normalizedInvoice.customer)) {
        normalizedInvoice.customer = normalizedInvoice.customer[0];
      }

      if (normalizedInvoice.payments) {
        normalizedInvoice.payments = normalizedInvoice.payments.map((p: any) => {
          let receipt = p.receipt;
          if (Array.isArray(receipt)) {
            receipt = receipt.length > 0 ? receipt[0] : null;
          }
          return {
            ...p,
            receipt: receipt || null
          };
        });
      }

      setInvoice(normalizedInvoice);

      // Default payment date to today
      setPaymentDate(new Date().toISOString().split('T')[0]);

      // Generate verification QR code
      if (data) {
        let sig = '';
        try {
          const res = await fetch(`/api/invoices/sign?code=${data.invoice_number}`);
          if (res.ok) {
            const json = await res.json();
            sig = json.sig || '';
          }
        } catch (e) {
          console.error('Failed to sign invoice code for QR:', e);
        }
        const sigParam = sig ? `&sig=${sig}` : '';
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
        const verificationUrl = `${appUrl}/verify?code=${data.invoice_number}${sigParam}`;
        const codeUrl = await QRCode.toDataURL(verificationUrl, { margin: 1, width: 250 });
        setQrCodeUrl(codeUrl);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch invoice.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoiceDetails();
  }, [invoiceId, supabase]);

  // Update Status
  const handleUpdateStatus = async (newStatus: Invoice['status']) => {
    setStatusLoading(true);
    try {
      const { error } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoiceId);

      if (error) throw error;
      toast.success(`Invoice status updated to ${newStatus.replace('_', ' ')}`);
      fetchInvoiceDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update invoice status.');
    } finally {
      setStatusLoading(false);
    }
  };

  // Delete Invoice
  const handleDeleteInvoice = async () => {
    if (!invoice) return;
    
    // Safety checks
    if (invoice.status !== 'draft' && invoice.status !== 'cancelled') {
      toast.error('Only draft or cancelled invoices can be deleted. Change the invoice status first.');
      return;
    }

    const hasPayments = invoice.payments && invoice.payments.length > 0;
    if (hasPayments) {
      toast.error('Cannot delete invoice with recorded payments. Please delete all payments first.');
      return;
    }

    const confirm = window.confirm(`Are you sure you want to permanently delete invoice ${invoice.invoice_number}? This action cannot be undone.`);
    if (!confirm) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;
      toast.success(`Invoice ${invoice.invoice_number} has been deleted.`);
      router.push('/dashboard/invoices');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete invoice.');
    }
  };

  const handleDeletePayment = async (paymentId: string, amount: number, receiptNumber?: string) => {
    if (!invoice) return;

    const label = receiptNumber ? `receipt ${receiptNumber}` : 'this payment record';
    const confirm = window.confirm(`Are you sure you want to permanently delete ${label} of ₹${amount}? This will update the invoice balance and status.`);
    if (!confirm) return;

    try {
      // 1. Calculate new status based on remaining payments
      const remainingPayments = (invoice.payments || []).filter((p) => p.id !== paymentId);
      const newPaidTotal = remainingPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      let newStatus = invoice.status;
      if (invoice.status !== 'cancelled' && invoice.status !== 'draft') {
        if (newPaidTotal >= Number(invoice.amount) - 0.01) {
          newStatus = 'paid';
        } else if (newPaidTotal > 0) {
          newStatus = 'partially_paid';
        } else {
          const isOverdue = new Date(invoice.due_date).getTime() < Date.now();
          newStatus = isOverdue ? 'overdue' : 'pending';
        }
      }

      // 2. Update invoice status
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ status: newStatus })
        .eq('id', invoiceId);

      if (updateError) throw updateError;

      // 3. Delete the payment
      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', paymentId);

      if (deleteError) throw deleteError;

      toast.success('Payment/Receipt deleted successfully.');
      fetchInvoiceDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete payment.');
    }
  };

  // Submit Partial Payment
  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0 || !paymentDate || !paymentMethod) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setPaymentLoading(true);
    try {
      const response = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoiceId,
          amount: Number(paymentAmount),
          payment_date: paymentDate,
          payment_method: paymentMethod,
          transaction_id: transactionId || null,
          notes: paymentNotes || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to apply payment.');
      }

      toast.success(`Payment of ₹${Number(paymentAmount).toLocaleString('en-IN')} added and Receipt generated!`);
      setPaymentDialogOpen(false);
      setPaymentAmount('');
      setTransactionId('');
      setPaymentNotes('');
      
      fetchInvoiceDetails();
    } catch (err: any) {
      toast.error(err.message || 'Error occurred while creating payment.');
    } finally {
      setPaymentLoading(false);
    }
  };

  // "Generate & Share" automated workflow / Copy Share Link
  const handleGenerateAndShare = async () => {
    if (!invoice) return;
    setShareLoading(true);
    try {
      // 1. Fetch or create a Customer Share Portal link
      let { data: shareLink, error: shareError } = await supabase
        .from('share_links')
        .select('*')
        .eq('customer_id', invoice.customer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (shareError) throw shareError;

      // 2. If no share link exists, create one now
      if (!shareLink || !shareLink.is_active) {
        const token = crypto.randomUUID().replace(/-/g, '');
        const { data: newLink, error: createError } = await supabase
          .from('share_links')
          .insert([
            {
              customer_id: invoice.customer.id,
              token,
              is_active: true,
            },
          ])
          .select()
          .single();

        if (createError) throw createError;
        shareLink = newLink;
      }

      // 3. Update invoice status to 'pending' if it was a draft
      if (invoice.status === 'draft') {
        const { error: statusError } = await supabase
          .from('invoices')
          .update({ status: 'pending' })
          .eq('id', invoiceId);
        
        if (statusError) throw statusError;
        invoice.status = 'pending';
      }

      // 4. Construct URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const portalUrl = `${appUrl}/share/${shareLink.token}`;

      // 5. Copy link to clipboard
      await navigator.clipboard.writeText(portalUrl);
      
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5 text-xs">
            <Sparkles className="h-4 w-4 text-indigo-650" /> Copy Share Link Success
          </span>
          <span className="text-[10px] text-slate-500">
            Secure client portal link has been copied to your clipboard.
          </span>
        </div>
      );

      fetchInvoiceDetails();
    } catch (err: any) {
      toast.error(err.message || 'Generate and Share workflow failed.');
    } finally {
      setShareLoading(false);
    }
  };

  // Helper: Trigger Invoice PDF Download
  const downloadInvoicePdf = async () => {
    if (!invoice) return;
    try {
      toast.info('Compiling invoice PDF...');
      await generateInvoicePdf({
        invoice_number: invoice.invoice_number,
        amount: Number(invoice.amount),
        currency: invoice.currency,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        description: invoice.description,
        status: invoice.status,
        customer: invoice.customer,
        payments: invoice.payments || [],
      });
      toast.success('Invoice PDF downloaded!');
    } catch (err: any) {
      toast.error('Failed to generate PDF.');
    }
  };

  // Helper: Trigger Invoice PDF Print
  const printInvoicePdf = async () => {
    if (!invoice) return;
    try {
      toast.info('Preparing invoice print preview...');
      const doc = await buildInvoicePdfDoc({
        invoice_number: invoice.invoice_number,
        amount: Number(invoice.amount),
        currency: invoice.currency,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        description: invoice.description,
        status: invoice.status,
        customer: invoice.customer,
        payments: invoice.payments || [],
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

  // Helper: Trigger Receipt PDF Download
  const downloadReceiptPdf = async (payment: Payment) => {
    if (!invoice || !payment.receipt) return;
    try {
      toast.info(`Compiling receipt ${payment.receipt.receipt_number} PDF...`);
      await generateReceiptPdf({
        receipt_number: payment.receipt.receipt_number,
        verification_code: payment.receipt.verification_code,
        sha256_hash: payment.receipt.sha256_hash,
        digital_signature: payment.receipt.digital_signature,
        payment: {
          amount: Number(payment.amount),
          payment_date: payment.payment_date,
          payment_method: payment.payment_method,
          transaction_id: payment.transaction_id,
          invoice: {
            invoice_number: invoice.invoice_number,
          },
        },
        customer: {
          full_name: invoice.customer.full_name,
          company_name: invoice.customer.company_name,
          phone: invoice.customer.phone_number || invoice.customer.phone,
          address: invoice.customer.address,
        },
      });
      toast.success('Receipt PDF downloaded!');
    } catch (err: any) {
      toast.error('Failed to generate Receipt PDF.');
    }
  };

  // Helper: Trigger Receipt PDF Print
  const printReceiptPdf = async (payment: Payment) => {
    if (!invoice || !payment.receipt) return;
    try {
      toast.info(`Preparing print preview for receipt ${payment.receipt.receipt_number}...`);
      const doc = await buildReceiptPdfDoc({
        receipt_number: payment.receipt.receipt_number,
        verification_code: payment.receipt.verification_code,
        sha256_hash: payment.receipt.sha256_hash,
        digital_signature: payment.receipt.digital_signature,
        payment: {
          amount: Number(payment.amount),
          payment_date: payment.payment_date,
          payment_method: payment.payment_method,
          transaction_id: payment.transaction_id,
          invoice: {
            invoice_number: invoice.invoice_number,
          },
        },
        customer: {
          full_name: invoice.customer.full_name,
          company_name: invoice.customer.company_name,
          phone: invoice.customer.phone_number || invoice.customer.phone,
          address: invoice.customer.address,
        },
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

  // Math totals
  const totalAmount = invoice ? Number(invoice.amount) : 0;
  const paidAmount = invoice?.payments
    ? invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0)
    : 0;
  const remainingAmount = Math.max(0, totalAmount - paidAmount);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-slate-405 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span>Loading invoice details...</span>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-sm mx-auto mt-12">
        <ChevronLeft className="h-5 w-5 text-slate-500 cursor-pointer mb-4 mx-auto hover:text-slate-800" onClick={() => router.push('/dashboard/invoices')} />
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Invoice not found</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-xs">The requested invoice does not exist or has been deleted.</p>
      </div>
    );
  }

  const statusColors = {
    draft: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
    pending: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20',
    partially_paid: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-100 dark:border-amber-500/20',
    paid: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20',
    overdue: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20',
    cancelled: 'bg-red-50 dark:bg-red-950/30 text-red-650 dark:text-red-500 border-red-100 dark:border-red-900/30',
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/invoices')}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all active:scale-95 shrink-0"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <span className="text-[10px] text-indigo-650 dark:text-indigo-400 uppercase tracking-widest font-semibold">
              Invoice Details
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {invoice.invoice_number}
            </h1>
          </div>
        </div>

        {/* Action Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Copy Share Link button */}
          <Button
            onClick={handleGenerateAndShare}
            className="bg-indigo-650 hover:bg-indigo-600 text-white font-semibold py-5 rounded-xl shadow-md shadow-indigo-650/10 flex items-center gap-1.5 active:scale-95 transition-transform"
            disabled={shareLoading}
          >
            {shareLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Share2 className="h-4 w-4" />
                Copy Share Link
              </>
            )}
          </Button>

          <Button
            onClick={downloadInvoicePdf}
            variant="outline"
            className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl py-5 flex items-center gap-1.5 active:scale-95 transition-transform"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>

          <Button
            onClick={printInvoicePdf}
            variant="outline"
            className="border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl py-5 flex items-center gap-1.5 active:scale-95 transition-transform"
          >
            <Printer className="h-4 w-4" />
            Print Invoice
          </Button>

          {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
            <Button
              onClick={() => handleUpdateStatus('cancelled')}
              variant="outline"
              className="border-red-200 dark:border-red-950/30 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-650 dark:text-red-400 rounded-xl py-5 flex items-center gap-1.5 active:scale-95 transition-transform"
              disabled={statusLoading}
            >
              <Ban className="h-4 w-4" />
              Cancel Invoice
            </Button>
          )}

          {(invoice.status === 'draft' || invoice.status === 'cancelled') && (!invoice.payments || invoice.payments.length === 0) && (
            <Button
              onClick={handleDeleteInvoice}
              variant="outline"
              className="border-red-200 dark:border-red-950/30 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-650 dark:text-red-400 rounded-xl py-5 flex items-center gap-1.5 active:scale-95 transition-transform"
            >
              <Trash2 className="h-4 w-4" />
              Delete Invoice
            </Button>
          )}
        </div>
      </div>

      {/* Primary Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Side: Summary and Payments */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-row items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">Invoice Details</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
                  Financial ledger summary
                </CardDescription>
              </div>

              {/* Status Select dropdown */}
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 border text-[10px] font-bold rounded-full uppercase ${statusColors[invoice.status]}`}>
                  {invoice.status.replace('_', ' ')}
                </span>
                <select
                  disabled={statusLoading}
                  value={invoice.status}
                  onChange={(e: any) => handleUpdateStatus(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-300 rounded-lg text-xs py-1.5 px-2 focus:outline-none focus:border-indigo-500 cursor-pointer"
                >
                  <option value="draft">Draft</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </CardHeader>
            <CardContent className="p-5 space-y-6 text-sm">
              {/* Issued By & Bill To Layout (Side by Side) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pb-6 border-b border-slate-100 dark:border-slate-800/80">
                {/* Provider Info */}
                <div className="space-y-2">
                  <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold block">Issued By</span>
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block text-sm">BHUBAN RECORDS</span>
                    <span className="text-xs text-slate-500 dark:text-slate-450 block">bhuban@chand.co.in</span>
                    <span className="text-xs text-slate-500 dark:text-slate-455 block">invoice.chand.co.in</span>
                  </div>
                </div>

                {/* Client Info */}
                <div className="space-y-2">
                  <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold block">Bill To</span>
                  <div>
                    <span
                      onClick={() => router.push(`/dashboard/customers/${invoice.customer.id}`)}
                      className="font-bold text-slate-900 dark:text-white hover:text-indigo-650 dark:hover:text-indigo-400 cursor-pointer flex items-center gap-1 text-sm"
                    >
                      {invoice.customer.full_name}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </span>
                    {invoice.customer.company_name && (
                      <span className="text-xs text-slate-500 dark:text-slate-450 block">{invoice.customer.company_name}</span>
                    )}
                    <span className="text-xs text-slate-500 dark:text-slate-450 block">Phone: {invoice.customer.phone_number || invoice.customer.phone || 'N/A'}</span>
                    {invoice.customer.address && (
                      <span className="text-xs text-slate-500 dark:text-slate-450 block max-w-xs">{invoice.customer.address}</span>
                    )}
                    {invoice.customer.gst_number && (
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-350 block mt-1">GSTIN: {invoice.customer.gst_number}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-1">
                  <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold block">Issue Date</span>
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">{invoice.issue_date}</span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold block">Due Date</span>
                  <span className="text-slate-700 dark:text-slate-300 font-semibold">{invoice.due_date}</span>
                </div>
              </div>

              {/* Description Details */}
              <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800/80 pt-4">
                <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold block">Billing Description</span>
                <p className="text-slate-650 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {invoice.description || 'No description provided.'}
                </p>
              </div>

              {/* Emphasized Balance Due Summary */}
              <div className="grid grid-cols-3 gap-4 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl text-center bg-slate-50/50 dark:bg-slate-950/20">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400 dark:text-slate-550 uppercase tracking-widest font-semibold block">Invoice Total</span>
                  <span className="text-base font-bold text-slate-800 dark:text-white">
                    ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="space-y-1 border-x border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-400 dark:text-slate-550 uppercase tracking-widest font-semibold block">Total Paid</span>
                  <span className="text-base font-bold text-emerald-600 dark:text-emerald-500">
                    ₹{paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="space-y-1 bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 rounded-xl py-1 px-2">
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 uppercase tracking-widest font-bold block">Balance Due</span>
                  <span
                    className={`text-base font-extrabold text-amber-600 dark:text-amber-500`}
                  >
                    ₹{remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payments & Receipts Ledger */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">Receipts & Payments</CardTitle>
                <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">
                  Review payment collection receipts
                </CardDescription>
              </div>
              {remainingAmount > 0.01 && (
                <Button
                  onClick={() => setPaymentDialogOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-semibold py-1.5 px-3 rounded-lg active:scale-95 flex items-center gap-1.5"
                >
                  <PlusCircle className="h-4 w-4" /> Add Payment
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {!invoice.payments || invoice.payments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs flex flex-col items-center justify-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-slate-400 dark:text-slate-600" />
                  <span>No payments registered on this ledger.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs uppercase font-semibold bg-slate-50/50 dark:bg-slate-950/20">
                        <th className="p-4">Date</th>
                        <th className="p-4">Receipt #</th>
                        <th className="p-4">Method</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoice.payments.map((p) => (
                        <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="p-4 text-xs text-slate-650 dark:text-slate-350">{p.payment_date}</td>
                          <td className="p-4 font-mono font-bold text-indigo-650 dark:text-indigo-400 text-xs">
                            {p.receipt?.receipt_number || 'GENERATE ERR'}
                          </td>
                          <td className="p-4 text-xs text-slate-500 dark:text-slate-400 uppercase">{p.payment_method.replace('_', ' ')}</td>
                          <td className="p-4 font-semibold text-slate-900 dark:text-white">
                            ₹{Number(p.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex justify-end gap-1.5">
                              {p.receipt && (
                                <>
                                  <Button
                                    onClick={() => downloadReceiptPdf(p)}
                                    variant="ghost"
                                    className="h-8 py-1 px-2.5 text-xs border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg flex items-center gap-1 cursor-pointer"
                                  >
                                    <Download className="h-3 w-3" /> PDF
                                  </Button>
                                  <Button
                                    onClick={() => printReceiptPdf(p)}
                                    variant="ghost"
                                    className="h-8 py-1 px-2.5 text-xs border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg flex items-center gap-1 cursor-pointer"
                                  >
                                    <Printer className="h-3 w-3" /> Print
                                  </Button>
                                </>
                              )}
                              <Button
                                onClick={() => handleDeletePayment(p.id, p.amount, p.receipt?.receipt_number)}
                                variant="ghost"
                                className="h-8 w-8 p-0 border border-slate-200 dark:border-slate-800 hover:bg-red-50 dark:hover:bg-red-950/20 text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-500 rounded-lg flex items-center justify-center cursor-pointer"
                                title="Delete Payment/Receipt"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Verification block */}
        <div className="space-y-6">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <CardTitle className="text-md font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <QrCode className="h-4.5 w-4.5 text-indigo-650 dark:text-indigo-400" /> Invoice Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex flex-col items-center text-center space-y-4">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Scan the QR code to verify the authenticity of this document.
              </p>
              
              {qrCodeUrl ? (
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-md">
                  <img src={qrCodeUrl} alt="Invoice Verification QR Code" className="w-40 h-40" />
                </div>
              ) : (
                <div className="h-40 w-40 flex items-center justify-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                  <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
              )}

              <div className="w-full text-xs space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Signer Authority</span>
                  <span className="font-semibold text-slate-800 dark:text-white">BHUBAN RECORDS Server</span>
                </div>
                <div className="flex justify-between items-center text-slate-500">
                  <span>Status Audit</span>
                  <span className="text-emerald-600 dark:text-emerald-500 font-semibold flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Authenticated
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">Apply Payment & Issue Receipt</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
              Apply payment amount to update this invoice balance.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAddPayment} className="space-y-4 py-2">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold block">Maximum Payable</span>
              <span className="text-sm font-bold text-slate-900 dark:text-white">
                ₹{remainingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="paymentAmountInput" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                  Amount Received <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 text-sm font-semibold">₹</span>
                  <Input
                    id="paymentAmountInput"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    max={remainingAmount + 0.01}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="pl-7 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="paymentDateInput" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                  Payment Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="paymentDateInput"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="paymentMethodSelect" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                  Payment Method <span className="text-red-500">*</span>
                </Label>
                <select
                  id="paymentMethodSelect"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg text-sm py-2.5 px-3 focus:outline-none focus:border-indigo-500"
                  required
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI (GPay/PhonePe)</option>
                  <option value="cash">Cash</option>
                  <option value="card">Credit/Debit Card</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="transactionIdInput" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                  Transaction ID
                </Label>
                <Input
                  id="transactionIdInput"
                  placeholder="TXN987654321"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paymentNotesInput" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                Internal Notes <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="paymentNotesInput"
                placeholder="Details of payments, source..."
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg h-20 resize-none"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800/60">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPaymentDialogOpen(false)}
                className="text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-white"
                disabled={paymentLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6"
                disabled={paymentLoading || !paymentAmount}
              >
                {paymentLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Apply Payment'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
