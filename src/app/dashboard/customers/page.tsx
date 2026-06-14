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
  Users,
  Search,
  Plus,
  ArrowUpDown,
  Building2,
  Mail,
  Phone,
  Tag,
  Loader2,
  ChevronRight,
  TrendingDown,
  Info,
  Trash2,
} from 'lucide-react';

type Customer = {
  id: string;
  full_name: string;
  company_name: string | null;
  email: string;
  phone: string | null;
  phone_number?: string | null;
  address: string | null;
  gst_number: string | null;
  notes: string | null;
  tags: string[];
  custom_fields: Record<string, any>;
  created_at: string;
  invoices?: {
    id: string;
    amount: number;
    status: string;
    payments?: { amount: number }[];
  }[];
};

type CustomFieldDefinition = {
  id: string;
  field_name: string;
  field_type: string;
};

function CustomersContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name_asc' | 'name_desc' | 'newest'>('newest');

  // Form State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [customFieldsSchema, setCustomFieldsSchema] = useState<CustomFieldDefinition[]>([]);

  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // 1. Fetch Customers & Custom Fields definitions
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch customers with invoices & payments
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('*, invoices(id, amount, status, payments(amount))');

      if (customerError) throw customerError;

      // Fetch custom field catalog for customers
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('custom_fields')
        .select('*')
        .eq('entity_type', 'customer');

      if (fieldsError) throw fieldsError;

      setCustomers(customerData || []);
      setCustomFieldsSchema(fieldsData || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch customer data.');
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
      setCreateDialogOpen(true);
      // Remove query param
      router.replace('/dashboard/customers');
    }
  }, [searchParams, router]);

  // 2. Submit form to create customer
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone) {
      toast.error('Name and Phone Number are required fields.');
      return;
    }

    setFormLoading(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const cleanPhone = phone.replace(/[^0-9]/g, '') || '0000000000';
      const dummyEmail = `${fullName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'customer'}-${cleanPhone}@no-email.com`;

      const payload = {
        full_name: fullName,
        company_name: companyName || null,
        address: address || null,
        gst_number: gstNumber || null,
        notes: notes || null,
        tags,
        custom_fields: customFieldValues,
        email: dummyEmail,
      };

      // Try inserting with phone_number first, fallback to phone if column doesn't exist yet
      let data, error;
      try {
        const res = await supabase.from('customers').insert([{ ...payload, phone_number: phone }]).select();
        data = res.data;
        error = res.error;
        if (error && (error.message?.includes('phone_number') || error.code === '42703')) {
          const retryRes = await supabase.from('customers').insert([{ ...payload, phone: phone }]).select();
          data = retryRes.data;
          error = retryRes.error;
        }
      } catch (err) {
        const retryRes = await supabase.from('customers').insert([{ ...payload, phone: phone }]).select();
        data = retryRes.data;
        error = retryRes.error;
      }

      if (error) throw error;

      toast.success('Customer created successfully.');
      setCreateDialogOpen(false);
      
      // Reset Form fields
      setFullName('');
      setCompanyName('');
      setPhone('');
      setAddress('');
      setGstNumber('');
      setNotes('');
      setTagsInput('');
      setCustomFieldValues({});

      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save customer.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteCustomer = async (e: React.MouseEvent, customer: Customer) => {
    e.stopPropagation();
    const invoicesCount = customer.invoices?.length || 0;
    const hasInvoices = invoicesCount > 0;
    const message = hasInvoices
      ? `WARNING: Customer "${customer.full_name}" has ${invoicesCount} invoices. Deleting this customer will permanently delete the customer profile and ALL associated invoices, payments, and receipts.\n\nType DELETE to confirm:`
      : `Are you sure you want to delete customer "${customer.full_name}"? This action cannot be undone.\n\nType DELETE to confirm:`;

    const input = window.prompt(message);
    if (input !== 'DELETE') {
      if (input !== null) {
        toast.error('Deletion cancelled. You must type DELETE to confirm.');
      }
      return;
    }

    try {
      const { error } = await supabase.from('customers').delete().eq('id', customer.id);
      if (error) throw error;
      toast.success(`Customer "${customer.full_name}" has been deleted.`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete customer.');
    }
  };

  // Helper: Compute outstanding balance
  const computeBalance = (customer: Customer) => {
    if (!customer.invoices) return 0;
    
    let totalInvoiced = 0;
    let totalPaid = 0;

    customer.invoices.forEach((inv) => {
      if (inv.status !== 'cancelled') {
        totalInvoiced += Number(inv.amount);
        if (inv.payments) {
          inv.payments.forEach((p) => {
            totalPaid += Number(p.amount);
          });
        }
      }
    });

    return Math.max(0, totalInvoiced - totalPaid);
  };

  // 3. Filtering & Sorting
  const allTags = Array.from(new Set(customers.flatMap((c) => c.tags || [])));

  const filteredCustomers = customers
    .filter((c) => {
      const cPhone = c.phone_number || c.phone || '';
      const cEmail = c.email || '';
      const matchesSearch =
        c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.company_name && c.company_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (cPhone && cPhone.includes(searchQuery));

      const matchesTag = selectedTag === 'all' || c.tags.includes(selectedTag);

      return matchesSearch && matchesTag;
    })
    .sort((a, b) => {
      if (sortBy === 'name_asc') return a.full_name.localeCompare(b.full_name);
      if (sortBy === 'name_desc') return b.full_name.localeCompare(b.full_name);
      // default: newest
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="h-8 w-8 text-indigo-600 dark:text-indigo-500" />
            Customers
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Manage and audit your customer directory</p>
        </div>
        <Button
          onClick={() => setCreateDialogOpen(true)}
          className="bg-indigo-650 hover:bg-indigo-600 text-white font-semibold py-5.5 px-4 rounded-xl shadow-md shadow-indigo-650/10 flex items-center gap-2 active:scale-98 transition-transform sm:w-auto w-full justify-center"
        >
          <Plus className="h-5 w-5" />
          Add Customer
        </Button>
      </div>

      {/* Stats Quick Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white shadow-sm">
          <CardContent className="p-4 flex flex-col justify-center">
            <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">Total Customers</span>
            <span className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{customers.length}</span>
          </CardContent>
        </Card>
        <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white shadow-sm">
          <CardContent className="p-4 flex flex-col justify-center">
            <span className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">With Balances</span>
            <span className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-500">
              {customers.filter((c) => computeBalance(c) > 0).length}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3.5 h-4.5 w-4.5 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Search by name, company or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 py-5.5 bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-indigo-650 rounded-xl"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto shrink-0 pb-1 md:pb-0">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 shrink-0">
              <ArrowUpDown className="h-3.5 w-3.5" /> Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-lg text-xs py-2 px-3 focus:outline-none focus:border-indigo-650"
            >
              <option value="newest">Newest Additions</option>
              <option value="name_asc">Name A-Z</option>
              <option value="name_desc">Name Z-A</option>
            </select>
          </div>
        </div>

        {/* Tag Filters */}
        {allTags.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto py-1 border-t border-slate-100 dark:border-slate-800/60 pt-3">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1 shrink-0">
              <Tag className="h-3.5 w-3.5" /> Tags:
            </span>
            <button
              onClick={() => setSelectedTag('all')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all shrink-0 ${
                selectedTag === 'all'
                  ? 'bg-indigo-650 text-white shadow shadow-indigo-650/10'
                  : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition-all shrink-0 ${
                  selectedTag === tag
                    ? 'bg-indigo-650 text-white shadow shadow-indigo-650/10'
                    : 'bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Customer Directory List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-500" />
          <span>Loading customers directory...</span>
        </div>
      ) : filteredCustomers.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
          <Users className="h-10 w-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-800 dark:text-slate-400 font-medium">No customers found</p>
          <p className="text-xs text-slate-500 dark:text-slate-600 mt-1">Try expanding your search criteria or add a new customer</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCustomers.map((customer) => {
            const balance = computeBalance(customer);
            return (
              <Card
                key={customer.id}
                onClick={() => router.push(`/dashboard/customers/${customer.id}`)}
                className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer shadow-sm hover:shadow-md transition-all rounded-2xl group flex flex-col text-slate-800 dark:text-slate-200"
              >
                <CardHeader className="p-4 pb-2 flex flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors truncate">
                      {customer.full_name}
                    </CardTitle>
                    {customer.company_name && (
                      <CardDescription className="text-slate-500 dark:text-slate-400 text-xs flex items-center gap-1.5 mt-0.5 truncate">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                        {customer.company_name}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 self-center">
                    <button
                      onClick={(e) => handleDeleteCustomer(e, customer)}
                      className="p-1.5 text-slate-400 hover:text-red-655 dark:hover:text-red-450 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
                      title="Delete Customer"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                    <ChevronRight className="h-5 w-5 text-slate-400 dark:text-slate-500 group-hover:translate-x-1 transition-transform" />
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
                      <span>{customer.phone_number || customer.phone || 'No Phone Number'}</span>
                    </div>
                    {customer.address && (
                      <div className="text-[11px] text-slate-450 dark:text-slate-500 line-clamp-1">
                        {customer.address}
                      </div>
                    )}
                  </div>

                  {/* Customer Tags */}
                  {customer.tags && customer.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {customer.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] font-semibold rounded-md text-slate-500 dark:text-slate-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Balance details */}
                  <div className="border-t border-slate-100 dark:border-slate-800/80 pt-3 mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-semibold">
                      Receivables Balance
                    </span>
                    <span
                      className={`text-sm font-bold ${
                        balance > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-slate-450 dark:text-slate-400'
                      }`}
                    >
                      ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Customer Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">Add New Customer</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-xs">
              Add a customer profile to generate invoices and track payments.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateCustomer} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                  Full Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="companyName" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                  Company Name
                </Label>
                <Input
                  id="companyName"
                  placeholder="ACME Corp"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                placeholder="+91 98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                Billing Address
              </Label>
              <Textarea
                id="address"
                placeholder="Street address, City, State, ZIP"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg h-20 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="gstNumber" className="text-slate-600 dark:text-slate-300 font-medium text-xs">
                  GST Number
                </Label>
                <Input
                  id="gstNumber"
                  placeholder="22AAAAA0000A1Z5"
                  value={gstNumber}
                  onChange={(e) => setGstNumber(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tagsInput" className="text-slate-600 dark:text-slate-300 font-medium text-xs flex items-center gap-1">
                  Tags <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">(comma-separated)</span>
                </Label>
                <Input
                  id="tagsInput"
                  placeholder="VIP, monthly, retail"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                />
              </div>
            </div>

            {/* Custom fields definitions catalog injection */}
            {customFieldsSchema.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-800/80 pt-4 mt-2 space-y-4">
                <span className="text-[11px] text-slate-400 dark:text-slate-550 uppercase tracking-widest font-bold flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-indigo-650 dark:text-indigo-400" />
                  Custom Profile Fields
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {customFieldsSchema.map((field) => (
                    <div key={field.id} className="space-y-1.5">
                      <Label htmlFor={`custom-${field.field_name}`} className="text-slate-650 dark:text-slate-300 font-medium text-xs">
                        {field.field_name}
                      </Label>
                      <Input
                        id={`custom-${field.field_name}`}
                        type={field.field_type === 'number' ? 'number' : field.field_type === 'date' ? 'date' : 'text'}
                        value={customFieldValues[field.field_name] || ''}
                        onChange={(e) =>
                          setCustomFieldValues({
                            ...customFieldValues,
                            [field.field_name]:
                              field.field_type === 'number' ? Number(e.target.value) : e.target.value,
                          })
                        }
                        className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-slate-650 dark:text-slate-300 font-medium text-xs">
                Internal Notes <span className="text-[10px] text-slate-400 dark:text-slate-550 font-normal">(Never shown to customer)</span>
              </Label>
              <Textarea
                id="notes"
                placeholder="Payment schedules, preferences..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg h-20 resize-none"
              />
            </div>

            <DialogFooter className="pt-4 border-t border-slate-100 dark:border-slate-850/60">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateDialogOpen(false)}
                className="text-slate-500 dark:text-slate-450 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40"
                disabled={formLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-650 hover:bg-indigo-600 text-white font-semibold px-6 shadow-sm"
                disabled={formLoading}
              >
                {formLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Create Customer'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span>Loading customers directory...</span>
      </div>
    }>
      <CustomersContent />
    </Suspense>
  );
}
