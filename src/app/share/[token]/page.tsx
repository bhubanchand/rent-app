'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import {
  FileText,
  Calendar,
  Download,
  IndianRupee,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  Receipt,
  User,
} from 'lucide-react';
import { generateInvoicePdf, generateReceiptPdf } from '@/lib/pdf-generator';

type Invoice = {
  id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  issue_date: string;
  due_date: string;
  description: string | null;
  status: 'draft' | 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
};

type Payment = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  transaction_id: string | null;
  invoice_id: string;
  receipt?: {
    receipt_number: string;
    verification_code: string;
    sha256_hash: string;
    digital_signature: string;
  };
};

type Customer = {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
};

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export default function SharePortalPage({ params }: SharePageProps) {
  const { token } = use(params);
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchPortalData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/share-portal?token=${token}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load billing portal.');
      }

      setCustomer(data.customer);
      setInvoices(data.invoices || []);
      setPayments(data.payments || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Billing portal link is invalid, disabled, or expired.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPortalData();
    }
  }, [token]);

  // Download Invoice PDF
  const downloadInvoice = async (invoice: Invoice) => {
    if (!customer) return;
    try {
      toast.info(`Generating Invoice PDF...`);
      // Filter payments belonging to this invoice
      const invoicePayments = payments.filter((p) => p.invoice_id === invoice.id);
      
      await generateInvoicePdf({
        invoice_number: invoice.invoice_number,
        amount: invoice.amount,
        currency: invoice.currency,
        issue_date: invoice.issue_date,
        due_date: invoice.due_date,
        description: invoice.description,
        status: invoice.status,
        customer: {
          full_name: customer.full_name,
          company_name: customer.company_name,
          email: customer.email,
          phone: customer.phone,
          address: customer.address,
          gst_number: null, // Public portal does not expose internal/admin GST numbers unless needed, but can map if wanted
        },
        payments: invoicePayments.map((ip) => ({
          amount: ip.amount,
          payment_date: ip.payment_date,
          payment_method: ip.payment_method,
        })),
      });
      toast.success('Invoice PDF downloaded!');
    } catch (err) {
      toast.error('Failed to download PDF.');
    }
  };

  // Download Receipt PDF
  const downloadReceipt = async (payment: Payment) => {
    if (!customer || !payment.receipt) return;
    try {
      // Find matching invoice
      const invoice = invoices.find((i) => i.id === payment.invoice_id);
      if (!invoice) return;

      toast.info(`Generating Receipt PDF...`);
      await generateReceiptPdf({
        receipt_number: payment.receipt.receipt_number,
        verification_code: payment.receipt.verification_code,
        sha256_hash: payment.receipt.sha256_hash,
        digital_signature: payment.receipt.digital_signature,
        payment: {
          amount: payment.amount,
          payment_date: payment.payment_date,
          payment_method: payment.payment_method,
          transaction_id: payment.transaction_id,
          invoice: {
            invoice_number: invoice.invoice_number,
          },
        },
        customer: {
          full_name: customer.full_name,
          company_name: customer.company_name,
          email: customer.email,
          phone: customer.phone,
        },
      });
      toast.success('Receipt PDF downloaded!');
    } catch (err) {
      toast.error('Failed to download Receipt PDF.');
    }
  };

  // Math totals
  const totalInvoiced = invoices
    .filter((i) => i.status !== 'cancelled')
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstandingBalance = Math.max(0, totalInvoiced - totalPaid);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span>Loading secure portal details...</span>
      </div>
    );
  }

  if (errorMsg || !customer) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-950/30 text-red-500 border border-red-900/30">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Link Invalid</h2>
          <p className="text-slate-400 text-sm">
            {errorMsg || 'The portal link you used is invalid or expired. Please request a new link from the administrator.'}
          </p>
          <div className="pt-4">
            <Button
              onClick={() => router.refresh()}
              className="bg-slate-900 hover:bg-slate-800 text-white border border-slate-800 rounded-lg px-6"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 p-4 sm:p-8">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(15,23,42,0.6),transparent)] pointer-events-none" />
      
      <div className="max-w-4xl mx-auto space-y-6 relative">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
              <ShieldCheck className="h-4 w-4" /> Secure Client Billing Portal
            </div>
            <h1 className="text-2xl font-bold text-white">{customer.full_name}</h1>
            {customer.company_name && (
              <p className="text-xs text-slate-400">{customer.company_name}</p>
            )}
          </div>
          <div className="text-sm text-slate-400 shrink-0 self-start sm:self-center">
            <span className="block text-xs text-slate-500">Contact Email</span>
            <span>{customer.email}</span>
          </div>
        </div>

        {/* Balance Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-5 flex flex-col justify-center">
              <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold block">Total Invoiced</span>
              <span className="text-2xl font-bold mt-2">
                ₹{totalInvoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-5 flex flex-col justify-center">
              <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold block">Total Paid</span>
              <span className="text-2xl font-bold mt-2 text-emerald-400">
                ₹{totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 text-white">
            <CardContent className="p-5 flex flex-col justify-center">
              <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold block">Outstanding Balance</span>
              <span
                className={`text-2xl font-bold mt-2 ${
                  outstandingBalance > 0 ? 'text-amber-500' : 'text-slate-400'
                }`}
              >
                ₹{outstandingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Invoices List */}
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
          <CardHeader className="border-b border-slate-800 pb-3">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-indigo-400" /> My Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {invoices.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">No invoices currently posted.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase font-semibold bg-slate-950/20">
                      <th className="p-4">Invoice #</th>
                      <th className="p-4">Due Date</th>
                      <th className="p-4">Amount</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const statusColors = {
                        draft: 'bg-slate-800 text-slate-400 border-slate-700',
                        pending: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                        partially_paid: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                        paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                        overdue: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
                        cancelled: 'bg-red-950/30 text-red-500 border-red-900/30',
                      };

                      return (
                        <tr key={inv.id} className="border-b border-slate-800/60">
                          <td className="p-4 font-bold text-white">{inv.invoice_number}</td>
                          <td className="p-4 text-xs text-slate-400">{inv.due_date}</td>
                          <td className="p-4">₹{Number(inv.amount).toLocaleString('en-IN')}</td>
                          <td className="p-4">
                            <span
                              className={`px-2 py-0.5 border text-[9px] font-semibold rounded-full uppercase ${
                                statusColors[inv.status]
                              }`}
                            >
                              {inv.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <Button
                              onClick={() => downloadInvoice(inv)}
                              variant="ghost"
                              className="h-8 py-1 px-2.5 text-xs border border-slate-800 hover:bg-slate-850 text-slate-300 hover:text-white rounded-lg flex items-center gap-1.5"
                            >
                              <Download className="h-3 w-3" /> PDF
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payments & Receipts list */}
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
          <CardHeader className="border-b border-slate-800 pb-3">
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Receipt className="h-5 w-5 text-indigo-400" /> My Payments & Receipts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {payments.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">No payment records found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase font-semibold bg-slate-950/20">
                      <th className="p-4">Date</th>
                      <th className="p-4">Receipt #</th>
                      <th className="p-4">Method</th>
                      <th className="p-4">Amount Paid</th>
                      <th className="p-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id} className="border-b border-slate-800/60">
                        <td className="p-4 text-xs text-slate-400">{p.payment_date}</td>
                        <td className="p-4 font-mono font-bold text-indigo-400 text-xs">
                          {p.receipt?.receipt_number || 'PROCESSING'}
                        </td>
                        <td className="p-4 text-xs uppercase text-slate-400">{p.payment_method.replace('_', ' ')}</td>
                        <td className="p-4 font-semibold text-white">₹{Number(p.amount).toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right">
                          {p.receipt && (
                            <Button
                              onClick={() => downloadReceipt(p)}
                              variant="ghost"
                              className="h-8 py-1 px-2.5 text-xs border border-slate-800 hover:bg-slate-850 text-slate-300 hover:text-white rounded-lg flex items-center gap-1.5"
                            >
                              <Download className="h-3 w-3" /> PDF Receipt
                            </Button>
                          )}
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
    </div>
  );
}
