import Link from 'next/link';
import { Shield, LayoutDashboard, QrCode } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-4 font-sans text-slate-955 dark:text-slate-100">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(241,245,249,0.9),transparent)] dark:bg-[radial-gradient(circle_at_30%_30%,rgba(15,23,42,0.8),transparent)] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="w-full max-w-lg z-10 space-y-10 text-center">
        {/* Branding block */}
        <div className="space-y-4">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-650 text-white shadow-lg shadow-indigo-650/10 dark:shadow-indigo-650/30 mb-2">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            BHUBAN RECORDS
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            Financial Records & Document Management
          </p>
        </div>

        {/* Action Panel */}
        <div className="grid grid-cols-1 gap-4">
          <Link
            href="/dashboard"
            className="flex items-center justify-between p-6 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-850/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl shadow-sm dark:shadow-xl transition-all group hover:scale-[1.01] active:scale-[0.99] text-left"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-600/10 text-indigo-650 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white text-sm">Administrative Console</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Manage clients, invoices, and logs</p>
              </div>
            </div>
            <span className="text-indigo-650 dark:text-indigo-400 group-hover:translate-x-1 transition-transform text-xs font-semibold">
              Enter &rarr;
            </span>
          </Link>

          <Link
            href="/verify"
            className="flex items-center justify-between p-6 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-850/80 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl shadow-sm dark:shadow-xl transition-all group hover:scale-[1.01] active:scale-[0.99] text-left"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-550 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-white dark:group-hover:text-black transition-all">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white text-sm">Document Verification</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Verify invoice and receipt integrity seals</p>
              </div>
            </div>
            <span className="text-amber-600 dark:text-amber-400 group-hover:translate-x-1 transition-transform text-xs font-semibold">
              Scan &rarr;
            </span>
          </Link>
        </div>

        {/* Footer info */}
        <p className="text-[10px] text-slate-400 dark:text-slate-600 tracking-wider">
          BHUBAN RECORDS &bull; Financial Records & Document Management
        </p>
      </div>
    </div>
  );
}
