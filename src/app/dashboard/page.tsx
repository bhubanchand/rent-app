'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
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
        .select('*, customer:customers(id, full_name), payments(amount)');

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

      setInvoices(invoiceData || []);
      setPayments(paymentData || []);
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

  // Chart 1: Monthly Revenue
  const monthlyRevenueData = (() => {
    const monthlyMap: Record<string, number> = {};
    payments.forEach((p) => {
      // payment_date is YYYY-MM-DD
      const date = new Date(p.payment_date);
      const monthYear = date.toLocaleString('default', { month: 'short', year: '2-digit' });
      monthlyMap[monthYear] = (monthlyMap[monthYear] || 0) + Number(p.amount);
    });

    return Object.entries(monthlyMap)
      .map(([month, revenue]) => ({ month, revenue }))
      .reverse(); // Newest last for timeline charts
  })();

  // Chart 2: Aging Analysis
  const agingData = (() => {
    let bracket0_30 = 0;
    let bracket31_60 = 0;
    let bracket61_90 = 0;
    let bracket90plus = 0;

    invoices.forEach((inv) => {
      const balance = getBalanceAmount(inv);
      if (balance > 0) {
        const ageInMs = Date.now() - new Date(inv.issue_date).getTime();
        const ageInDays = Math.floor(ageInMs / (1000 * 60 * 60 * 24));

        if (ageInDays <= 30) bracket0_30 += balance;
        else if (ageInDays <= 60) bracket31_60 += balance;
        else if (ageInDays <= 90) bracket61_90 += balance;
        else bracket90plus += balance;
      }
    });

    return [
      { name: '0-30 Days', value: bracket0_30, color: '#4f46e5' }, // indigo-600
      { name: '31-60 Days', value: bracket31_60, color: '#f59e0b' }, // amber-500
      { name: '61-90 Days', value: bracket61_90, color: '#f97316' }, // orange-500
      { name: '90+ Days', value: bracket90plus, color: '#ef4444' }, // red-500
    ].filter((item) => item.value > 0);
  })();

  // Chart 3: Top Customer Rankings
  const customerRankingsData = (() => {
    const rankingsMap: Record<string, number> = {};
    invoices.forEach((inv) => {
      if (inv.status !== 'cancelled') {
        const name = inv.customer.full_name;
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
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
          Dashboard
        </h1>
        <p className="text-slate-400 text-sm mt-1">Real-time collections, outstanding balances, and aging analysis</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Outstanding */}
        <Card className="bg-slate-900 border-slate-800 text-white col-span-2">
          <CardContent className="p-5 flex flex-col justify-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Total Outstanding</span>
            <span className="text-3xl font-bold mt-2 text-amber-500">
              ₹{totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <p className="text-[10px] text-slate-400 mt-1">Pending receivables from customers</p>
          </CardContent>
        </Card>

        {/* Total Collected */}
        <Card className="bg-slate-900 border-slate-800 text-white col-span-2">
          <CardContent className="p-5 flex flex-col justify-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Total Collected</span>
            <span className="text-3xl font-bold mt-2 text-emerald-400">
              ₹{totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <p className="text-[10px] text-slate-400 mt-1">Revenue captured inside ledger</p>
          </CardContent>
        </Card>

        {/* Overdue Amount */}
        <Card className="bg-slate-900 border-slate-800 text-white col-span-2">
          <CardContent className="p-5 flex flex-col justify-center">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-rose-500" /> Overdue Amount
            </span>
            <span className="text-3xl font-bold mt-2 text-rose-500">
              ₹{totalOverdue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <p className="text-[10px] text-slate-400 mt-1">Invoices exceeding set due dates</p>
          </CardContent>
        </Card>

        {/* Directory Count items */}
        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-4 flex flex-col justify-center text-center">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Customers</span>
            <span className="text-xl font-bold mt-1">{customers.length}</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-4 flex flex-col justify-center text-center">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Invoices</span>
            <span className="text-xl font-bold mt-1">{invoices.length}</span>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800 text-white">
          <CardContent className="p-4 flex flex-col justify-center text-center">
            <span className="text-[9px] text-slate-500 uppercase tracking-widest block">Receipts</span>
            <span className="text-xl font-bold mt-1">{payments.length}</span>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Revenue Chart */}
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
          <CardHeader>
            <CardTitle className="text-md font-bold text-white flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-indigo-400" /> Monthly Revenue Collections
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Income recognized by date of payments
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-2">
            {mounted && monthlyRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={monthlyRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} tickFormatter={(v) => `₹${v / 1000}k`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                    formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-600">
                No revenue history recorded.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Receivables Aging Analysis Pie Chart */}
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
          <CardHeader>
            <CardTitle className="text-md font-bold text-white flex items-center gap-2">
              <Calendar className="h-4.5 w-4.5 text-indigo-400" /> Receivables Aging Analysis
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Outstanding balances breakdown by issue age
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 pt-2 flex flex-col sm:flex-row items-center justify-center">
            {mounted && agingData.length > 0 ? (
              <>
                <div className="w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={agingData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {agingData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#fff' }}
                        formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Balance']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 space-y-2 text-xs">
                  {agingData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-400 font-medium">{item.name}</span>
                      </div>
                      <span className="font-bold text-white">₹{item.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-600">
                All receivables are cleared! No outstanding balances.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables Display Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Payments Table */}
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
          <CardHeader className="border-b border-slate-800 pb-3">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-400" /> Recent Payments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentPayments.length === 0 ? (
              <div className="text-center py-6 text-slate-650 text-xs">No payment records.</div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {recentPayments.map((p) => (
                  <div key={p.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-850/40">
                    <div>
                      <p className="font-bold text-white">{p.invoice.customer.full_name}</p>
                      <p className="text-[10px] text-slate-500">Ref: {p.invoice.invoice_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-emerald-400">+₹{Number(p.amount).toLocaleString()}</p>
                      <p className="text-[9px] text-slate-500">{p.payment_date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Invoices Table */}
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
          <CardHeader className="border-b border-slate-800 pb-3">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
              <FileText className="h-4.5 w-4.5 text-indigo-400" /> Recent Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentInvoices.length === 0 ? (
              <div className="text-center py-6 text-slate-650 text-xs">No invoices issued.</div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {recentInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                    className="p-3 flex items-center justify-between text-xs hover:bg-slate-850/40 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-bold text-white">{inv.customer.full_name}</p>
                      <p className="text-[10px] text-slate-500">Ref: {inv.invoice_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-white">₹{Number(inv.amount).toLocaleString()}</p>
                      <p className="text-[9px] text-slate-500">Due: {inv.due_date}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overdue Invoices Table */}
        <Card className="bg-slate-900 border-slate-800 text-slate-200">
          <CardHeader className="border-b border-slate-800 pb-3">
            <CardTitle className="text-sm font-bold text-white flex items-center gap-1.5">
              <AlertTriangle className="h-4.5 w-4.5 text-rose-500" /> Overdue Invoices
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {overdueInvoicesList.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">No overdue invoices! Excellent.</div>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {overdueInvoicesList.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={() => router.push(`/dashboard/invoices/${inv.id}`)}
                    className="p-3 flex items-center justify-between text-xs hover:bg-slate-850/40 cursor-pointer transition-colors"
                  >
                    <div>
                      <p className="font-bold text-white">{inv.customer.full_name}</p>
                      <p className="text-[10px] text-slate-500">Ref: {inv.invoice_number}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-rose-500">₹{getBalanceAmount(inv).toLocaleString()}</p>
                      <p className="text-[9px] text-slate-400">Due: {inv.due_date}</p>
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
