'use client';

import { useState, useEffect, use, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  FileText,
  Search,
  Plus,
  ArrowUpDown,
  Calendar,
  Loader2,
  ChevronRight,
  AlertCircle,
  FileSpreadsheet,
  Building2,
} from 'lucide-react';

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
  };
  payments?: { amount: number }[];
};

type CustomerOption = {
  id: string;
  full_name: string;
  company_name: string | null;
};

const DESCRIPTION_TEMPLATES = [
  { value: 'Rental Agreement Fee', label: 'Rental Agreement Fee' },
  { value: 'Rent Collection Fee', label: 'Rent Collection Fee' },
  { value: 'Documentation Fee', label: 'Documentation Fee' },
  { value: 'Verification Fee', label: 'Verification Fee' },
  { value: 'Service Fee', label: 'Service Fee' },
  { value: 'Processing Fee', label: 'Processing Fee' },
];

function InvoicesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'number_desc' | 'amount_desc' | 'due_date_asc'>('number_desc');

  // Form State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState('');

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [issueDate, setIssueDate] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [templateSelect, setTemplateSelect] = useState('custom');

  // Fetch Invoices, Customers, & generate invoice number
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch invoices with customer profiles & payments
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*, customer:customers(id, full_name, company_name), payments(amount)');

      if (invoiceError) throw invoiceError;

      // Fetch customer list for selection
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, full_name, company_name')
        .order('full_name', { ascending: true });

      if (customerError) throw customerError;

      setInvoices(invoiceData || []);
      setCustomers(customerData || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch invoice data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [supabase]);

  // Open dialog if search param `create=true` is present (from Quick Action FAB)
  useEffect(() => {
    if (searchParams.get('create') === 'true') {
      const cid = searchParams.get('customer_id') || '';
      setSelectedCustomerId(cid);
      setCreateDialogOpen(true);
      router.replace('/dashboard/invoices');
    }
  }, [searchParams, router]);

  // Generate the automatic invoice number when opening the dialog
  useEffect(() => {
    if (createDialogOpen) {
      // Default dates: Issue date = today, Due date = today + 30 days
      const today = new Date();
      const thirtyDaysLater = new Date();
      thirtyDaysLater.setDate(today.getDate() + 30);

      setIssueDate(today.toISOString().split('T')[0]);
      setDueDate(thirtyDaysLater.toISOString().split('T')[0]);

      async function fetchNextNum() {
        const year = today.getFullYear();
        const { count, error } = await supabase
          .from('invoices')
          .select('*', { count: 'exact', head: true })
          .like('invoice_number', `INV-${year}-%`);

        if (error) {
          toast.error('Failed to calculate next invoice number.');
          return;
        }

        const nextNum = (count || 0) + 1;
        setNextInvoiceNumber(`INV-${year}-${String(nextNum).padStart(6, '0')}`);
      }

      fetchNextNum();
    }
  }, [createDialogOpen, supabase]);

  // Submit form to create invoice
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !amount || !nextInvoiceNumber || !issueDate || !dueDate) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        customer_id: selectedCustomerId,
        invoice_number: nextInvoiceNumber,
        amount: Number(amount),
        currency,
        issue_date: issueDate,
        due_date: dueDate,
        description: description || null,
        status: 'pending', // Starts in pending status waiting for payment
      };

      const { data, error } = await supabase.from('invoices').insert([payload]).select().single();

      if (error) throw error;

      toast.success(`Invoice ${nextInvoiceNumber} created!`);
      setCreateDialogOpen(false);
      
      // Reset Form fields
      setSelectedCustomerId('');
      setAmount('');
      setDescription('');
      setTemplateSelect('custom');
      
      // Redirect to the newly created invoice detail page
      router.push(`/dashboard/invoices/${data.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save invoice.');
      setFormLoading(false);
    }
  };

  // Helper: Compute paid amount
  const getPaidAmount = (invoice: Invoice) => {
    if (!invoice.payments) return 0;
    return invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  };

  // Filtering & Sorting
  const filteredInvoices = invoices
    .filter((inv) => {
      const matchesSearch =
        inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.customer.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.customer.company_name &&
          inv.customer.company_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'amount_desc') return b.amount - a.amount;
      if (sortBy === 'due_date_asc') return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      return b.invoice_number.localeCompare(a.invoice_number);
    });

  // Global receivables summary
  const totalOutstanding = invoices
    .filter((i) => i.status !== 'cancelled' && i.status !== 'paid')
    .reduce((sum, i) => sum + (Number(i.amount) - getPaidAmount(i)), 0);

  const totalCollected = invoices.reduce((sum, i) => sum + getPaidAmount(i), 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-8 w-8 text-indigo-650 dark:text-indigo-500" />
            Invoices
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Generate invoices, trace partial payments, and issue receipts</p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-indigo-650 hover:bg-indigo-600 text-white font-semibold py-5.5 px-4 rounded-xl shadow-md shadow-indigo-650/10 flex items-center gap-2 active:scale-98 transition-transform sm:w-auto w-full justify-center"
        >
          <Plus className="h-5 w-5" />
          Create Invoice
        </Button>
      </div>

      {/* Receivables Stats Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-center">
            <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold">Outstanding Balance</span>
            <span className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-500">
              ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-sm">
          <CardContent className="p-5 flex flex-col justify-center">
            <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold">Total Revenue Collected</span>
            <span className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-500">
              ₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-400 dark:text-slate-550" />
            <Input
              placeholder="Search by invoice number or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 py-5.5 bg-slate-50/50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:border-indigo-500 rounded-xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-550 dark:text-slate-400 font-medium shrink-0">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs py-2 px-3 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Invoices</option>
                <option value="pending">Pending</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
                <option value="overdue">Overdue</option>
                <option value="draft">Draft</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-550 dark:text-slate-400 font-medium flex items-center gap-1 shrink-0">
                <ArrowUpDown className="h-3.5 w-3.5" /> Sort:
              </span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs py-2 px-3 focus:outline-none focus:border-indigo-500"
              >
                <option value="number_desc">Invoice Number</option>
                <option value="amount_desc">Amount (Highest)</option>
                <option value="due_date_asc">Due Date (Earliest)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-650 dark:text-indigo-500" />
          <span>Loading invoices directory...</span>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <FileSpreadsheet className="h-10 w-10 text-slate-400 dark:text-slate-650 mx-auto mb-3" />
          <p className="text-slate-800 dark:text-slate-400 font-medium">No invoices found</p>
          <p className="text-xs text-slate-550 dark:text-slate-650 mt-1">Try expanding your search parameters or issue a new invoice</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredInvoices.map((invoice) => {
            const paid = getPaidAmount(invoice);
            const balance = Math.max(0, Number(invoice.amount) - paid);
            
            const statusColors = {
              draft: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
              pending: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-500/20',
              partially_paid: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-100 dark:border-amber-500/20',
              paid: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20',
              overdue: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20',
              cancelled: 'bg-red-50 dark:bg-red-950/30 text-red-650 dark:text-red-500 border-red-100 dark:border-red-900/30',
            };

            return (
              <Card
                key={invoice.id}
                onClick={() => router.push(`/dashboard/invoices/${invoice.id}`)}
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer shadow-sm hover:shadow-md transition-all rounded-2xl group flex flex-col text-slate-800 dark:text-slate-200"
              >
                <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-450 dark:text-slate-500 font-semibold uppercase tracking-wider block">
                      {invoice.invoice_number}
                    </span>
                    <CardTitle className="text-md font-bold text-slate-900 dark:text-white group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors truncate mt-0.5">
                      {invoice.customer.full_name}
                    </CardTitle>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-550 group-hover:translate-x-1 transition-transform shrink-0" />
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs mt-1">
                    <span className="text-slate-550 dark:text-slate-400 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400 dark:text-slate-600 shrink-0" /> Due: {invoice.due_date}
                    </span>
                    <span
                      className={`px-2 py-0.5 border text-[9px] font-semibold rounded-full uppercase ${
                        statusColors[invoice.status]
                      }`}
                    >
                      {invoice.status.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Summary of invoice math */}
                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-2 grid grid-cols-2 gap-4">
                    <div className="space-y-0.5">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold block">Total Amount</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        ₹{Number(invoice.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="space-y-0.5 text-right">
                      <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold block">Remaining Balance</span>
                      <span
                        className={`text-sm font-bold ${
                          balance > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-slate-450 dark:text-slate-400'
                        }`}
                      >
                        ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Invoice Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">Create New Invoice</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
              Generate a pending invoice for dynamic customer billing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateInvoice} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-600 dark:text-slate-300 font-medium text-xs">Invoice Number</Label>
              <div className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-indigo-650 dark:text-indigo-400 rounded-lg font-mono text-sm tracking-wider flex items-center gap-1.5 select-none">
                <AlertCircle className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-655" />
                {nextInvoiceNumber || 'Generating...'}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customerSelect" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                Select Customer <span className="text-red-500">*</span>
              </Label>
              {customers.length === 0 ? (
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-500 text-xs rounded-lg flex items-center justify-between">
                  <span>No customers available</span>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => router.push('/dashboard/customers?create=true')}
                    className="p-0 text-indigo-600 dark:text-indigo-455 h-auto font-semibold"
                  >
                    Add Customer
                  </Button>
                </div>
              ) : (
                <select
                  id="customerSelect"
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg text-sm py-2.5 px-3 focus:outline-none focus:border-indigo-500"
                  required
                >
                  <option value="" className="text-slate-500">Select a customer profile...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} {c.company_name ? `(${c.company_name})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="amountInput" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                  Invoice Amount <span className="text-red-500">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 dark:text-slate-500 text-sm font-semibold">₹</span>
                  <Input
                    id="amountInput"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="pl-7 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currencySelect" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                  Currency
                </Label>
                <select
                  id="currencySelect"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg text-sm py-2.5 px-3 focus:outline-none focus:border-indigo-500"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="issueDateInput" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                  Issue Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="issueDateInput"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dueDateInput" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                  Due Date <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dueDateInput"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                  required
                />
              </div>
            </div>

            {/* Selectable Billing Description Template Dropdown */}
            <div className="space-y-1.5">
              <Label htmlFor="templateSelect" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                Billing Description Template
              </Label>
              <select
                id="templateSelect"
                value={templateSelect}
                onChange={(e) => {
                  const val = e.target.value;
                  setTemplateSelect(val);
                  if (val && val !== 'custom') {
                    setDescription(val);
                  }
                }}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg text-sm py-2.5 px-3 focus:outline-none focus:border-indigo-500"
              >
                <option value="custom">-- Custom Description / Write My Own --</option>
                {DESCRIPTION_TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="descInput" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                Billing Description Details
              </Label>
              <Textarea
                id="descInput"
                placeholder="Write specific billing details, hours, or lease terms here..."
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  // If user manually edits to something not in templates, sync select to custom
                  const match = DESCRIPTION_TEMPLATES.find((t) => t.value === e.target.value);
                  if (!match) {
                    setTemplateSelect('custom');
                  } else {
                    setTemplateSelect(match.value);
                  }
                }}
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg h-24 resize-none"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-800/60">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateDialogOpen(false)}
                className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                disabled={formLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-650 hover:bg-indigo-600 text-white font-semibold px-6"
                disabled={formLoading || !selectedCustomerId}
              >
                {formLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Create Invoice'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 text-slate-550 dark:text-slate-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650 dark:text-indigo-500" />
        <span>Loading invoices ledger...</span>
      </div>
    }>
      <InvoicesContent />
    </Suspense>
  );
}
