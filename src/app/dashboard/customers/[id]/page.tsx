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
import {
  Users,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  IndianRupee,
  Share2,
  ExternalLink,
  Ban,
  CheckCircle2,
  Clock,
  ChevronLeft,
  Loader2,
  History,
  FileText,
  DollarSign,
  UserCheck,
  Edit2,
  Copy,
} from 'lucide-react';

type Invoice = {
  id: string;
  invoice_number: string;
  amount: number;
  issue_date: string;
  due_date: string;
  status: 'draft' | 'pending' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';
  payments?: { amount: number }[];
};

type Payment = {
  id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  transaction_id: string | null;
  invoice: { invoice_number: string };
  receipt?: { id: string; receipt_number: string };
  created_at: string;
};

type ShareLink = {
  id: string;
  token: string;
  is_active: boolean;
  expires_at: string | null;
};

type Customer = {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  gst_number: string | null;
  notes: string | null;
  tags: string[];
  custom_fields: Record<string, any>;
  created_at: string;
};

type TimelineEvent = {
  id: string;
  type: 'invoice' | 'payment' | 'created' | 'share';
  title: string;
  description: string;
  date: string;
  amount?: number;
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CustomerDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id: customerId } = use(params);
  const supabase = createClient();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [shareLink, setShareLink] = useState<ShareLink | null>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit State
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // Share portal management state
  const [shareLoading, setShareLoading] = useState(false);
  const [expiryInput, setExpiryInput] = useState('');

  const fetchCustomerDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch customer details
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (customerError) throw customerError;
      setCustomer(customerData);

      // Set edit form values
      setFullName(customerData.full_name);
      setCompanyName(customerData.company_name || '');
      setEmail(customerData.email);
      setPhone(customerData.phone || '');
      setAddress(customerData.address || '');
      setGstNumber(customerData.gst_number || '');
      setNotes(customerData.notes || '');
      setTagsInput(customerData.tags?.join(', ') || '');

      // 2. Fetch invoices
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*, payments(amount)')
        .eq('customer_id', customerId)
        .order('issue_date', { ascending: false });

      if (invoiceError) throw invoiceError;
      setInvoices(invoiceData || []);

      // 3. Fetch payments
      const invoiceIds = (invoiceData || []).map((i) => i.id);
      let paymentData: Payment[] = [];
      if (invoiceIds.length > 0) {
        const { data, error: paymentError } = await supabase
          .from('payments')
          .select('*, invoice:invoices(invoice_number), receipt:receipts(id, receipt_number)')
          .in('invoice_id', invoiceIds)
          .order('payment_date', { ascending: false });

        if (paymentError) throw paymentError;
        paymentData = data || [];
      }
      setPayments(paymentData);

      // 4. Fetch share link
      const { data: shareData, error: shareError } = await supabase
        .from('share_links')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (shareError) throw shareError;
      setShareLink(shareData);

      // 5. Compile timeline
      const events: TimelineEvent[] = [];
      
      // Customer Creation
      events.push({
        id: 'creation',
        type: 'created',
        title: 'Customer Profile Created',
        description: `Profile initialized for ${customerData.full_name}`,
        date: customerData.created_at,
      });

      // Invoices
      invoiceData?.forEach((inv) => {
        events.push({
          id: inv.id,
          type: 'invoice',
          title: `Invoice ${inv.invoice_number} Issued`,
          description: `Amount: ₹${Number(inv.amount).toLocaleString('en-IN')}, Status: ${inv.status}`,
          date: inv.created_at,
          amount: inv.amount,
        });
      });

      // Payments
      paymentData.forEach((pay) => {
        events.push({
          id: pay.id,
          type: 'payment',
          title: 'Payment Received',
          description: `Amount: ₹${Number(pay.amount).toLocaleString('en-IN')} via ${pay.payment_method.toUpperCase()} for ${pay.invoice.invoice_number}`,
          date: pay.created_at,
          amount: pay.amount,
        });
      });

      // Sort timeline events by date desc
      events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setTimeline(events);

    } catch (err: any) {
      toast.error(err.message || 'Error fetching customer data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerDetails();
  }, [customerId, supabase]);

  // Submit edit customer form
  const handleEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) {
      toast.error('Name and Email are required.');
      return;
    }

    setEditLoading(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const payload = {
        full_name: fullName,
        company_name: companyName || null,
        email,
        phone: phone || null,
        address: address || null,
        gst_number: gstNumber || null,
        notes: notes || null,
        tags,
      };

      const { error } = await supabase
        .from('customers')
        .update(payload)
        .eq('id', customerId);

      if (error) throw error;

      toast.success('Customer details updated.');
      setEditDialogOpen(false);
      fetchCustomerDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update customer.');
    } finally {
      setEditLoading(false);
    }
  };

  // Generate / Regenerate Share Portal Link
  const handleGenerateShareLink = async () => {
    setShareLoading(true);
    try {
      const token = crypto.randomUUID().replace(/-/g, '');
      const expiresAt = expiryInput ? new Date(expiryInput).toISOString() : null;

      let error;
      if (shareLink) {
        // Update existing link
        const { error: err } = await supabase
          .from('share_links')
          .update({
            token,
            expires_at: expiresAt,
            is_active: true,
          })
          .eq('id', shareLink.id);
        error = err;
      } else {
        // Create new link
        const { error: err } = await supabase.from('share_links').insert([
          {
            customer_id: customerId,
            token,
            expires_at: expiresAt,
            is_active: true,
          },
        ]);
        error = err;
      }

      if (error) throw error;

      toast.success('Share link successfully generated!');
      fetchCustomerDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to generate share link.');
    } finally {
      setShareLoading(false);
    }
  };

  // Toggle Share Link (Enable / Disable)
  const handleToggleShareLink = async () => {
    if (!shareLink) return;
    setShareLoading(true);
    try {
      const { error } = await supabase
        .from('share_links')
        .update({ is_active: !shareLink.is_active })
        .eq('id', shareLink.id);

      if (error) throw error;

      toast.success(shareLink.is_active ? 'Share portal disabled.' : 'Share portal enabled.');
      fetchCustomerDetails();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update portal status.');
    } finally {
      setShareLoading(false);
    }
  };

  // Helper: Copy Portal URL
  const copyShareUrl = () => {
    if (!shareLink) return;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const portalUrl = `${baseUrl}/share/${shareLink.token}`;
    
    navigator.clipboard.writeText(portalUrl);
    toast.success('Portal link copied to clipboard!');
  };

  // Compute stats
  const totalInvoiced = invoices
    .filter((i) => i.status !== 'cancelled')
    .reduce((sum, i) => sum + Number(i.amount), 0);

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const outstandingBalance = Math.max(0, totalInvoiced - totalCollected);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span>Loading customer dossier...</span>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <ChevronLeft className="h-5 w-5 text-slate-500 cursor-pointer mb-4" onClick={() => router.back()} />
        <h2 className="text-xl font-bold text-white">Customer dossier not found</h2>
        <p className="text-slate-400 mt-2">The requested record does not exist or has been deleted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/customers')}
          className="p-2 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all active:scale-95 shrink-0"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <span className="text-[10px] text-indigo-400 uppercase tracking-widest font-semibold">Customer Dossier</span>
          <h1 className="text-2xl font-bold text-white truncate">{customer.full_name}</h1>
        </div>
        <Button
          onClick={() => setEditDialogOpen(true)}
          variant="outline"
          className="ml-auto border-slate-800 hover:bg-slate-900 text-slate-300 hover:text-white rounded-xl flex items-center gap-2 active:scale-95"
        >
          <Edit2 className="h-4 w-4" />
          Edit Profile
        </Button>
      </div>

      {/* Metrics Summary Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-5 flex flex-col justify-center">
            <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-indigo-400" />
              Total Invoiced
            </span>
            <span className="text-2xl font-bold mt-2">
              ₹{totalInvoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-5 flex flex-col justify-center">
            <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Total Collected
            </span>
            <span className="text-2xl font-bold mt-2 text-emerald-400">
              ₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-5 flex flex-col justify-center">
            <span className="text-xs text-slate-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              Outstanding Receivables
            </span>
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

      {/* Contact Profile Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Information Card */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="bg-slate-900 border-slate-800 text-slate-200">
            <CardHeader className="border-b border-slate-800 pb-3">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-indigo-400" /> Profile Information
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
              <div className="space-y-1.5">
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Company</span>
                <span className="font-semibold text-white flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-600 shrink-0" />
                  {customer.company_name || 'N/A'}
                </span>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-slate-500 uppercase tracking-wider block">GST Number</span>
                <span className="font-mono text-white bg-slate-950 px-2 py-0.5 border border-slate-800 rounded inline-block">
                  {customer.gst_number || 'N/A'}
                </span>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Email</span>
                <span className="text-white flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-600 shrink-0" />
                  {customer.email}
                </span>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Phone</span>
                <span className="text-white flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-600 shrink-0" />
                  {customer.phone || 'N/A'}
                </span>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-xs text-slate-500 uppercase tracking-wider block">Billing Address</span>
                <span className="text-white flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-slate-600 mt-0.5 shrink-0" />
                  {customer.address || 'N/A'}
                </span>
              </div>

              {/* Custom fields data */}
              {customer.custom_fields && Object.keys(customer.custom_fields).length > 0 && (
                <div className="sm:col-span-2 border-t border-slate-800 pt-4 mt-2 space-y-4">
                  <span className="text-xs text-indigo-400 font-semibold block uppercase tracking-wider">
                    Dynamic Custom Fields
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(customer.custom_fields).map(([key, val]) => (
                      <div key={key} className="space-y-1.5">
                        <span className="text-xs text-slate-500 uppercase tracking-wider block">{key}</span>
                        <span className="font-semibold text-white">{String(val)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoices List */}
          <Card className="bg-slate-900 border-slate-800 text-slate-200">
            <CardHeader className="border-b border-slate-800 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" /> Invoices
              </CardTitle>
              <Button
                onClick={() => router.push(`/dashboard/invoices?create=true&customer_id=${customerId}`)}
                className="bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold py-1.5 px-3 rounded-lg active:scale-95"
              >
                + New Invoice
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {invoices.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">No invoices issued for this customer.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase bg-slate-950/20">
                        <th className="p-4">Invoice #</th>
                        <th className="p-4">Amount</th>
                        <th className="p-4">Due Date</th>
                        <th className="p-4">Status</th>
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
                          <tr
                            key={inv.id}
                            onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                            className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition-colors"
                          >
                            <td className="p-4 font-bold text-white">{inv.invoice_number}</td>
                            <td className="p-4">₹{Number(inv.amount).toLocaleString('en-IN')}</td>
                            <td className="p-4 text-slate-400 text-xs">{inv.due_date}</td>
                            <td className="p-4">
                              <span
                                className={`px-2 py-0.5 border text-[10px] font-semibold rounded-full uppercase ${
                                  statusColors[inv.status]
                                }`}
                              >
                                {inv.status.replace('_', ' ')}
                              </span>
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
        </div>

        {/* Customer Portal Signed Link & Timeline */}
        <div className="space-y-6">
          {/* Signed Portal Link Panel */}
          <Card className="bg-slate-900 border-slate-800 text-slate-200">
            <CardHeader className="border-b border-slate-800 pb-3">
              <CardTitle className="text-md font-bold text-white flex items-center gap-2">
                <Share2 className="h-4.5 w-4.5 text-indigo-400" /> Customer Share Portal
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4 text-xs">
              <p className="text-slate-400 leading-relaxed text-[11px]">
                Create a secure signed access link where the customer can view their invoices, payments, and balances without logging in.
              </p>

              {shareLink ? (
                <div className="space-y-4">
                  <div className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-400 truncate text-[10px]">
                      {shareLink.is_active ? 'Portal is Active' : 'Portal is Disabled'}
                    </span>
                    <span
                      className={`h-2 w-2 rounded-full ${
                        shareLink.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
                      }`}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={copyShareUrl}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-4 flex items-center justify-center gap-1.5 rounded-lg active:scale-95"
                      disabled={!shareLink.is_active}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Link
                    </Button>
                    <Button
                      onClick={() => {
                        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
                        window.open(`${baseUrl}/share/${shareLink.token}`, '_blank');
                      }}
                      variant="outline"
                      className="border-slate-800 hover:bg-slate-800 text-slate-300 rounded-lg"
                      disabled={!shareLink.is_active}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-2 border-t border-slate-800 pt-3 mt-1">
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>Expires</span>
                      <span>{shareLink.expires_at ? new Date(shareLink.expires_at).toLocaleDateString() : 'Never'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 border-t border-slate-800 pt-3 mt-1">
                    <Button
                      onClick={handleToggleShareLink}
                      variant="ghost"
                      className={`flex-1 text-[11px] font-semibold border ${
                        shareLink.is_active
                          ? 'border-red-500/20 text-red-400 hover:bg-red-950/20'
                          : 'border-emerald-500/20 text-emerald-400 hover:bg-emerald-950/20'
                      }`}
                      disabled={shareLoading}
                    >
                      {shareLink.is_active ? 'Disable Link' : 'Enable Link'}
                    </Button>
                    <Button
                      onClick={handleGenerateShareLink}
                      variant="ghost"
                      className="flex-1 text-[11px] font-semibold border border-slate-800 text-slate-300 hover:bg-slate-800"
                      disabled={shareLoading}
                    >
                      Regenerate
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="expiry" className="text-slate-400 text-[10px] font-semibold">
                      Expiration Date (Optional)
                    </Label>
                    <Input
                      id="expiry"
                      type="date"
                      value={expiryInput}
                      onChange={(e) => setExpiryInput(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white text-xs py-4"
                    />
                  </div>
                  <Button
                    onClick={handleGenerateShareLink}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-5 flex items-center justify-center gap-2 rounded-lg"
                    disabled={shareLoading}
                  >
                    {shareLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Generate Signed Portal Link'
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="bg-slate-900 border-slate-800 text-slate-200">
            <CardHeader className="border-b border-slate-800 pb-3">
              <CardTitle className="text-md font-bold text-white flex items-center gap-2">
                <History className="h-4.5 w-4.5 text-indigo-400" /> Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 max-h-[350px] overflow-y-auto space-y-4">
              {timeline.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs">No activity logs recorded.</div>
              ) : (
                <div className="relative pl-4 border-l border-slate-800 space-y-4">
                  {timeline.map((event, idx) => {
                    const icons = {
                      created: 'bg-indigo-950 border-indigo-700 text-indigo-400',
                      invoice: 'bg-blue-950 border-blue-700 text-blue-400',
                      payment: 'bg-emerald-950 border-emerald-700 text-emerald-400',
                      share: 'bg-slate-850 border-slate-700 text-slate-400',
                    };

                    return (
                      <div key={event.id + idx} className="relative group text-xs">
                        <div
                          className={`absolute -left-[23px] top-1.5 h-3.5 w-3.5 rounded-full border-2 flex items-center justify-center ${
                            icons[event.type]
                          }`}
                        />
                        <div className="space-y-0.5">
                          <p className="font-semibold text-white leading-tight">{event.title}</p>
                          <p className="text-[10px] text-slate-400">{event.description}</p>
                          <span className="text-[9px] text-slate-500 block mt-0.5">
                            {new Date(event.date).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Edit Customer Profile</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Update billing details or tags for this customer.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditCustomer} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="editFullName" className="text-slate-300 font-medium text-xs">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="editFullName"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-lg"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editCompanyName" className="text-slate-300 font-medium text-xs">
                  Company Name
                </Label>
                <Input
                  id="editCompanyName"
                  placeholder="ACME Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="editEmail" className="text-slate-300 font-medium text-xs">
                  Email Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="editEmail"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-lg"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editPhone" className="text-slate-300 font-medium text-xs">
                  Phone Number
                </Label>
                <Input
                  id="editPhone"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editAddress" className="text-slate-300 font-medium text-xs">
                Billing Address
              </Label>
              <Textarea
                id="editAddress"
                placeholder="Street address, City, State, ZIP"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white rounded-lg h-20 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="editGstNumber" className="text-slate-300 font-medium text-xs">
                  GST Number
                </Label>
                <Input
                  id="editGstNumber"
                  placeholder="22AAAAA0000A1Z5"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="editTagsInput" className="text-slate-300 font-medium text-xs">
                  Tags (comma-separated)
                </Label>
                <Input
                  id="editTagsInput"
                  placeholder="VIP, monthly, retail"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-white rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="editNotes" className="text-slate-300 font-medium text-xs">
                Internal Notes
              </Label>
              <Textarea
                id="editNotes"
                placeholder="Internal details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white rounded-lg h-20 resize-none"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-slate-800/60">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditDialogOpen(false)}
                className="text-slate-400 hover:text-white"
                disabled={editLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-6"
                disabled={editLoading}
              >
                {editLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
