'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  LayoutDashboard,
  Users,
  FileText,
  Receipt,
  Settings,
  LogOut,
  Plus,
  User,
  Menu,
  X,
  PlusCircle,
  FilePlus,
  UserPlus,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type UserProfile = {
  email?: string;
  fullName?: string;
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);

  useEffect(() => {
    async function fetchUser() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setProfile({
          email: user.email,
          fullName: user.user_metadata?.full_name || 'Administrator',
        });
      }
    }
    fetchUser();
  }, [supabase]);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Signed out successfully.');
      router.push('/login');
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign out.');
    }
  };

  // Auto-logout if inactive for 3 minutes (180,000 ms)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        handleSignOut();
        toast.info('Logged out automatically due to inactivity.');
      }, 180000); // 3 minutes = 180,000 ms
    };

    // Events to monitor for user activity
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    // Add listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    // Initialize the timer
    resetTimer();

    // Cleanup listeners and timeout on unmount
    return () => {
      clearTimeout(timeoutId);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [supabase]);

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Customers', href: '/dashboard/customers', icon: Users },
    { name: 'Invoices', href: '/dashboard/invoices', icon: FileText },
    { name: 'Receipts', href: '/dashboard/receipts', icon: Receipt },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 flex flex-col md:flex-row">
      {/* 1. Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-4 shrink-0 shadow-sm dark:shadow-none">
        <div className="flex items-center gap-2 px-2 py-4 mb-6">
          <div className="h-8 w-8 rounded-lg bg-indigo-650 flex items-center justify-center font-bold text-white text-lg shadow-md shadow-indigo-650/20">
            B
          </div>
          <span className="font-bold text-xl text-slate-900 dark:text-white">
            BHUBAN RECORDS
          </span>
        </div>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-650 text-white shadow-md shadow-indigo-650/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-auto">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-3 w-full p-2 hover:bg-slate-105/50 dark:hover:bg-slate-800/60 rounded-lg text-left transition-all border-none outline-none cursor-pointer">
              <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 font-bold border border-slate-200 dark:border-slate-700">
                <User className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{profile?.fullName}</p>
                <p className="text-[10px] text-slate-550 dark:text-slate-500 truncate">{profile?.email}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200" align="end">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-800" />
              <DropdownMenuItem
                className="focus:bg-slate-100 dark:focus:bg-slate-800 focus:text-slate-900 dark:focus:text-white cursor-pointer"
                onClick={() => router.push('/dashboard/settings')}
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-800" />
              <DropdownMenuItem
                className="focus:bg-destructive focus:text-white text-destructive cursor-pointer"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* 2. Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-md bg-indigo-650 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-indigo-650/20">
            B
          </div>
          <span className="font-bold text-lg text-slate-900 dark:text-white">BHUBAN RECORDS</span>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setQuickActionOpen(true)}
            className="p-1.5 bg-indigo-650 hover:bg-indigo-600 rounded-lg text-white shadow-md shadow-indigo-650/10 active:scale-90 transition-transform"
          >
            <Plus className="h-4.5 w-4.5" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger className="h-7 w-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700 cursor-pointer">
              <User className="h-3.5 w-3.5 text-slate-650 dark:text-slate-300" />
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200" align="end">
              <DropdownMenuLabel className="truncate text-xs">{profile?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-slate-200 dark:bg-slate-800" />
              <DropdownMenuItem
                className="focus:bg-destructive focus:text-white text-destructive cursor-pointer"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* 3. Main Dashboard Wrapper */}
      <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        <div className="flex-1 p-4 md:p-8 overflow-y-auto max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>

      {/* 4. Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around px-2 z-30 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center w-14 h-full gap-1 transition-all ${
                isActive ? 'text-indigo-650 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-650'
              }`}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium tracking-tight truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* 5. Desktop Floating Action Button (FAB) */}
      <div className="hidden md:block fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setQuickActionOpen(true)}
          className="h-14 w-14 rounded-full bg-indigo-650 hover:bg-indigo-600 text-white shadow-xl shadow-indigo-650/20 flex items-center justify-center transition-all hover:scale-105 active:scale-95 group"
        >
          <Plus className="h-6 w-6 transition-transform group-hover:rotate-90" />
        </button>
      </div>

      {/* 6. Quick Action Dialog */}
      <Dialog open={quickActionOpen} onOpenChange={setQuickActionOpen}>
        <DialogContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white text-center">Quick Actions</DialogTitle>
            <DialogDescription className="text-slate-500 dark:text-slate-400 text-center">
              Select an action to launch immediately
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <button
              onClick={() => {
                setQuickActionOpen(false);
                router.push('/dashboard/invoices?create=true');
              }}
              className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl gap-2 text-slate-700 dark:text-slate-300 hover:text-indigo-650 dark:hover:text-white transition-all group"
            >
              <FilePlus className="h-6 w-6 text-indigo-550 dark:text-indigo-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Create Invoice</span>
            </button>
            <button
              onClick={() => {
                setQuickActionOpen(false);
                router.push('/dashboard/customers?create=true');
              }}
              className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl gap-2 text-slate-700 dark:text-slate-300 hover:text-emerald-650 dark:hover:text-white transition-all group"
            >
              <UserPlus className="h-6 w-6 text-emerald-650 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-semibold">Add Customer</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
