import Link from 'next/link';
import { Shield, LayoutDashboard, QrCode, FileText } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 p-4 font-sans text-slate-100">
      {/* Background gradients */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(15,23,42,0.8),transparent)] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/5 blur-[150px] rounded-full pointer-events-none" />

      <div className="w-full max-w-lg z-10 space-y-8 text-center">
        {/* Branding block */}
        <div className="space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 mb-2">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-500 bg-clip-text text-transparent">
            RentApp Ledger
          </h1>
          <p className="text-sm text-slate-400 max-w-xs mx-auto">
            Secure, mobile-first Invoice, Receipt, and Receivables Management System.
          </p>
        </div>

        {/* Action Panel */}
        <div className="grid grid-cols-1 gap-4">
          <Link
            href="/dashboard"
            className="flex items-center justify-between p-5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl shadow-xl transition-all group hover:scale-[1.01] active:scale-[0.99] text-left"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm">Administrative Console</h2>
                <p className="text-xs text-slate-500 mt-0.5">Manage customers, billings, and logs</p>
              </div>
            </div>
            <span className="text-indigo-400 group-hover:translate-x-1 transition-transform text-xs font-semibold">
              Enter &rarr;
            </span>
          </Link>

          <Link
            href="/verify"
            className="flex items-center justify-between p-5 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700/80 rounded-2xl shadow-xl transition-all group hover:scale-[1.01] active:scale-[0.99] text-left"
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-black transition-all">
                <QrCode className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-white text-sm">QR Document Validator</h2>
                <p className="text-xs text-slate-500 mt-0.5">Verify invoice and receipt integrity seals</p>
              </div>
            </div>
            <span className="text-amber-500 group-hover:translate-x-1 transition-transform text-xs font-semibold">
              Scan &rarr;
            </span>
          </Link>
        </div>

        {/* Footer info */}
        <p className="text-[10px] text-slate-650 tracking-wider">
          RentApp Ledger v1.0.0 &bull; Encrypted Sessions &bull; Cryptographic Seals
        </p>
      </div>
    </div>
  );
}
