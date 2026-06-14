'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  AreaChart,
  Area,
  BarChart as RechartsBarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  IndianRupee,
  Users,
  FileText,
  Receipt,
  AlertTriangle,
  ArrowUpRight,
  Loader2,
  TrendingUp,
  Calendar,
  CheckCircle,
  TrendingDown,
  Activity,
} from 'lucide-react';

type Invoice = {
  id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  issue_date: string;
  status: string;
  customer: {
    id: string;
    full_name: string;
  };
  payments?: { amount: number }[];
};

type Payment = {
  id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  invoice: {
    invoice_number: string;
    customer: {
      full_name: string;
    };
  };
};

type Customer = {
  id: string;
  full_name: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Set mounted state to prevent hydration errors on charts
  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch invoices
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*, customer:customers(id, full_name), payments(amount)')
        .order('issue_date', { ascending: false });

      if (invoiceError) throw invoiceError;

      // 2. Fetch payments
      const { data: paymentData, error: paymentError } = await supabase
        .from('payments')
        .select('*, invoice:invoices(invoice_number, customer:customers(full_name))')
        .order('payment_date', { ascending: false });

      if (paymentError) throw paymentError;

      // 3. Fetch customers
      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .select('id, full_name');

      if (customerError) throw customerError;

      // Normalize potential array outputs from PostgREST joins to singular objects
      const normalizedInvoices = (invoiceData || []).map((inv: any) => {
        let customer = inv.customer;
        if (Array.isArray(customer)) customer = customer[0];
        return {
          ...inv,
          customer: customer || null
        };
      });

      const normalizedPayments = (paymentData || []).map((p: any) => {
        let invoice = p.invoice;
        if (Array.isArray(invoice)) invoice = invoice[0];
        let customer = invoice?.customer;
        if (Array.isArray(customer)) customer = customer[0];
        return {
          ...p,
          invoice: invoice ? {
            ...invoice,
            customer: customer || null
          } : null
        };
      });

      setInvoices(normalizedInvoices);
      setPayments(normalizedPayments);
      setCustomers(customerData || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [supabase]);

  // Calculations
  const getPaidAmount = (invoice: Invoice) => {
    if (!invoice.payments) return 0;
    return invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  };

  const getBalanceAmount = (invoice: Invoice) => {
    if (invoice.status === 'cancelled') return 0;
    return Math.max(0, Number(invoice.amount) - getPaidAmount(invoice));
  };

  const isOverdue = (invoice: Invoice) => {
    if (invoice.status === 'paid' || invoice.status === 'cancelled') return false;
    return new Date(invoice.due_date).getTime() < Date.now();
  };

  const totalOutstanding = invoices.reduce((sum, inv) => sum + getBalanceAmount(inv), 0);
  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalOverdue = invoices
    .filter(isOverdue)
    .reduce((sum, inv) => sum + getBalanceAmount(inv), 0);

  // Sorting helper for month-year charts (e.g. "Jun 26")
  const sortChronologically = (a: { month: string }, b: { month: string }) => {
    const parseMonthYear = (str: string) => {
      const [m, y] = str.split(' ');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIndex = months.indexOf(m);
      return new Date(2000 + parseInt(y), monthIndex, 1).getTime();
    };
    return parseMonthYear(a.month) - parseMonthYear(b.month);
  };

  // Chart 1: Revenue Trend (Total Invoiced by Month)
  const revenueTrendData = (() => {
    const monthlyMap: Record<string, number> = {};
    invoices.forEach((inv) => {
      if (inv.status !== 'cancelled') {
        const date = new Date(inv.issue_date);
        const monthYear = date.toLocaleString('default', { month: 'short', year: '2-digit' });
        monthlyMap[monthYear] = (monthlyMap[monthYear] || 0) + Number(inv.amount);
      }
    });

    return Object.entries(monthlyMap)
      .map(([month, revenue]) => ({ month, revenue }))
      .sort(sortChronologically);
  })();

  // Chart 2: Collection Trend (Total Payments by Month)
  const collectionTrendData = (() => {
    const monthlyMap: Record<string, number> = {};
    payments.forEach((p) => {
      const date = new Date(p.payment_date);
      const monthYear = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthlyMap[monthYear] = (monthlyMap[monthYear] || 0) + Number(p.amount);
    });

    return Object.entries(monthlyMap)
      .map(([month, amount]) => ({ month, amount }))
      .sort(sortChronologically);
  })();

  // Chart 3: Outstanding Trend (Outstanding Balances by Month)
  const outstandingTrendData = (() => {
    const monthlyMap: Record<string, number> = {};
    invoices.forEach((inv) => {
      if (inv.status !== 'cancelled') {
        const date = new Date(inv.issue_date);
        const monthYear = date.toLocaleString('default', { month: 'short', year: '2-digit' });
        monthlyMap[monthYear] = (monthlyMap[monthYear] || 0) + getBalanceAmount(inv);
      }
    });

    return Object.entries(monthlyMap)
      .map(([month, outstanding]) => ({ month, outstanding }))
      .sort(sortChronologically);
  })();

  // Chart 4: Top Customer Rankings (Horizontal Bar Chart)
  const customerRankingsData = (() => {
    const rankingsMap: Record<string, number> = {};
    invoices.forEach((inv) => {
      if (inv.status !== 'cancelled') {
        const name = inv.customer?.full_name || 'Unknown';
        rankingsMap[name] = (rankingsMap[name] || 0) + Number(inv.amount);
      }
    });

    return Object.entries(rankingsMap)
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5); // top 5
  })();

  // Tables
  const recentInvoices = invoices.slice(0, 5);
  const recentPayments = payments.slice(0, 5);
  const overdueInvoicesList = invoices.filter(isOverdue).slice(0, 5);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-40 text-slate-400 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
        <span>Loading executive metrics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          Dashboard
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Real-time collections, outstanding balances, and analytics</p>
      </div>

      {/* Metrics Grid (6 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Outstanding */}
        <Card className="bg-card border-border text-card-foreground shadow-sm">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1">
              <TrendingDown className="h-3.5 w-3.5 text-amber-500" /> Outstanding
            </span>
            <span className="text-2xl font-bold mt-2 text-amber-600 dark:text-amber-500 truncate">
              ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <p className="text-[9px] text-muted-foreground mt-1">Pending customer collections</p>
          </CardContent>
        </Card>

        {/* Total Collected */}
        <Card className="bg-card border-border text-card-foreground shadow-sm">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Collected
            </span>
            <span className="text-2xl font-bold mt-2 text-emerald-600 dark:text-emerald-500 truncate">
              ₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <p className="text-[9px] text-muted-foreground mt-1">Total revenue collected</p>
          </CardContent>
        </Card>

        {/* Overdue Amount */}
        <Card className="bg-card border-border text-card-foreground shadow-sm">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-rose-500" /> Overdue
            </span>
            <span className="text-2xl font-bold mt-2 text-rose-600 dark:text-rose-500 truncate">
              ₹{totalOverdue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <p className="text-[9px] text-muted-foreground mt-1">Invoices past due date</p>
          </CardContent>
        </Card>

        {/* Customers Count */}
        <Card className="bg-card border-border text-card-foreground shadow-sm">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-indigo-500" /> Customers
            </span>
            <span className="text-2xl font-bold mt-2 text-indigo-600 dark:text-indigo-400">
              {customers.length}
            </span>
            <p className="text-[9px] text-muted-foreground mt-1">Active customer accounts</p>
          </CardContent>
        </Card>

        {/* Invoices Count */}
        <Card className="bg-card border-border text-card-foreground shadow-sm">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-sky-500" /> Invoices
            </span>
            <span className="text-2xl font-bold mt-2 text-sky-600 dark:text-sky-400">
              {invoices.length}
            </span>
            <p className="text-[9px] text-muted-foreground mt-1">Total invoices generated</p>
          </CardContent>
        </Card>

        {/* Receipts Count */}
        <Card className="bg-card border-border text-card-foreground shadow-sm">
          <CardContent className="p-5 flex flex-col justify-center h-full">
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold flex items-center gap-1">
              <Receipt className="h-3.5 w-3.5 text-violet-500" /> Receipts
            </span>
            <span className="text-2xl font-bold mt-2 text-violet-600 dark:text-violet-400">
              {payments.length}
            </span>
            <p className="text-[9px] text-muted-foreground mt-1">Payments recorded in ledger</p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts Grid (4 graphs) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Revenue Trend (Area Chart) */}
        <Card className="bg-card border-border text-card-foreground shadow-sm">
          <CardHeader>
            <CardTitle className="text-md font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-indigo-550 dark:text-indigo-400" /> Revenue Trend (Invoiced)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Monthly sum of total invoiced amounts
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            {mounted && revenueTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueTrendData}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="oklch(var(--primary))" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="oklch(var(--primary))" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'oklch(var(--border))', color: 'var(--foreground)' }}
                    formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Invoiced']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="oklch(var(--primary))" fillOpacity={1} fill="url(#revenueGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No revenue history recorded.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 2: Collection Trend (Bar Chart) */}
        <Card className="bg-card border-border text-card-foreground shadow-sm">
          <CardHeader>
            <CardTitle className="text-md font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-500" /> Collection Trend (Payments)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Monthly sum of payments received
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            {mounted && collectionTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={collectionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'oklch(var(--border))', color: 'var(--foreground)' }}
                    formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Collected']}
                  />
                  <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No collections history recorded.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 3: Outstanding Trend (Line Chart) */}
        <Card className="bg-card border-border text-card-foreground shadow-sm">
          <CardHeader>
            <CardTitle className="text-md font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-amber-500" /> Outstanding Trend
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Unpaid balances by invoice issue month
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            {mounted && outstandingTrendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={outstandingTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'oklch(var(--border))', color: 'var(--foreground)' }}
                    formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Outstanding']}
                  />
                  <Line type="monotone" dataKey="outstanding" stroke="#f59e0b" strokeWidth={2} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No outstanding balances recorded.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chart 4: Top Customer Rankings (Horizontal Bar Chart) */}
        <Card className="bg-card border-border text-card-foreground shadow-sm">
          <CardHeader>
            <CardTitle className="text-md font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-indigo-500" /> Top Customers
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Top 5 customer accounts by total invoice volume
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            {mounted && customerRankingsData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={customerRankingsData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(var(--border))" />
                  <XAxis type="number" stroke="#64748b" fontSize={10} tickFormatter={(v) => `₹${v}`} />
                  <YAxis dataKey="name" type="category" stroke="#64748b" fontSize={10} width={80} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'oklch(var(--border))', color: 'var(--foreground)' }}
                    formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Invoiced']}
                  />
                  <Bar dataKey="total" fill="oklch(var(--primary))" radius={[0, 4, 4, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                No customer statistics found.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables Display Grid (3 tables) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Payments Table */}
        <Card className="bg-card border-border text-card-foreground shadow-sm">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-500" /> Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentPayments.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs">No payment records.</div>
            ) : (
              <div className="divide-y divide-border">
                {recentPayments.map((p) => (
                  <div key={p.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{p.invoice?.customer?.full_name || 'Unknown'}</p>
                      <p className="text-[10px] text-muted-foreground">Ref: {p.invoice?.invoice_number || 'N/A'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-600 dark:text-emerald-500">+₹{Number(p.amount).toLocaleString()}</p>
                      <p className="text-[9px] text-muted-foreground">{p.payment_date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices Table */}
        <Card className="bg-card border-border text-card-foreground shadow-sm">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <FileText className="h-4.5 w-4.5 text-indigo-500" /> Recent Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentInvoices.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs">No invoices issued.</div>
            ) : (
              <div className="divide-y divide-border">
                {recentInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                    className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors animate-fade-in"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{inv.customer?.full_name || 'Unknown'}</p>
                      <p className="text-[10px] text-muted-foreground">Ref: {inv.invoice_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-950 dark:text-slate-100">₹{Number(inv.amount).toLocaleString()}</p>
                      <p className="text-[9px] text-muted-foreground">Due: {inv.due_date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Invoices Table */}
        <Card className="bg-card border-border text-card-foreground shadow-sm">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <AlertTriangle className="h-4.5 w-4.5 text-rose-500" /> Overdue Accounts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {overdueInvoicesList.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">No overdue invoices! Excellent.</div>
            ) : (
              <div className="divide-y divide-border">
                {overdueInvoicesList.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                    className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">{inv.customer?.full_name || 'Unknown'}</p>
                      <p className="text-[10px] text-muted-foreground">Ref: {inv.invoice_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-rose-600 dark:text-rose-500">₹{getBalanceAmount(inv).toLocaleString()}</p>
                      <p className="text-[9px] text-muted-foreground">Due: {inv.due_date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
