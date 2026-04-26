"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingBag, 
  Users, 
  LogOut, 
  Menu, 
  X,
  ShieldAlert,
} from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isGateReady, setIsGateReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [accessPassword, setAccessPassword] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [gateError, setGateError] = useState('');
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const unlocked = sessionStorage.getItem('admin_access_granted') === '1';
    setIsUnlocked(unlocked);
    setIsGateReady(true);
  }, []);

  const verifyAdminAccess = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setGateError('');
    setIsVerifying(true);

    try {
      const response = await fetch('/api/admin/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: accessPassword }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setGateError(payload?.message || 'Invalid admin password');
        return;
      }

      sessionStorage.setItem('admin_access_granted', '1');
      setIsUnlocked(true);
      setAccessPassword('');
    } catch {
      setGateError('Unable to verify admin password. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  if (!isGateReady) {
    return null;
  }

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-full bg-[#D4AF37]/15 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
              <ShieldAlert size={20} />
            </div>
            <div>
              <h1 className="text-xl font-serif text-[#D4AF37]">Admin Access</h1>
              <p className="text-xs text-[#888] uppercase tracking-widest">Password Required</p>
            </div>
          </div>

          <form onSubmit={verifyAdminAccess} className="space-y-4">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#888] font-bold mb-2">Admin Password</label>
              <input
                required
                type="password"
                value={accessPassword}
                onChange={(e) => setAccessPassword(e.target.value)}
                className="w-full bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none"
                autoFocus
              />
            </div>
            {gateError ? <p className="text-xs text-red-400">{gateError}</p> : null}
            <button
              type="submit"
              disabled={isVerifying}
              className="w-full bg-[#D4AF37] text-black py-3 rounded-xl text-xs tracking-[0.18em] font-bold uppercase hover:bg-[#c6a43a] transition-colors disabled:opacity-70"
            >
              {isVerifying ? 'Verifying...' : 'Unlock Admin Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { name: 'Products', href: '/admin/products', icon: Package },
    { name: 'Orders', href: '/admin/orders', icon: ShoppingBag },
    { name: 'Users', href: '/admin/users', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-[#050505] text-white flex font-sans">
      {/* Sidebar */}
      <aside className={`${isSidebarOpen ? 'w-64' : 'w-20'} bg-[#0a0a0a] border-r border-[#1a1a1a] transition-all duration-300 flex flex-col z-50`}>
        <div className="p-6 flex items-center justify-between border-b border-[#1a1a1a]">
          <Link href="/admin" className={`font-serif text-xl text-[#D4AF37] tracking-wider transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
            ADMIN HUB
          </Link>
          <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="text-[#888] hover:text-[#D4AF37]">
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-grow py-6 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-4 p-3 rounded-lg transition-all ${
                  isActive 
                    ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-l-4 border-[#D4AF37]' 
                    : 'text-[#888] hover:bg-[#111] hover:text-white'
                }`}
              >
                <item.icon size={20} />
                <span className={`${isSidebarOpen ? 'block' : 'hidden'} font-medium`}>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-[#1a1a1a]">
          <button 
            onClick={() => {
              localStorage.removeItem('user');
              sessionStorage.removeItem('admin_access_granted');
              router.push('/');
            }}
            className="flex items-center space-x-4 p-3 w-full text-[#ff4d4d] hover:bg-[#ff4d4d]/10 rounded-lg transition-all"
          >
            <LogOut size={20} />
            <span className={`${isSidebarOpen ? 'block' : 'hidden'} font-medium`}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-grow overflow-y-auto">
        <header className="h-20 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#1a1a1a] px-8 flex items-center justify-between sticky top-0 z-40">
          <h1 className="text-xl font-serif text-[#D4AF37] uppercase tracking-widest">{navItems.find(i => i.href === pathname)?.name || 'Dashboard'}</h1>
          <div className="flex items-center space-x-4">
             <div className="text-right">
                <p className="text-sm font-medium">Administrator</p>
                <p className="text-xs text-[#888]">doonperfumehub.com</p>
             </div>
             <div className="w-10 h-10 bg-[#D4AF37]/20 border border-[#D4AF37]/50 rounded-full flex items-center justify-center text-[#D4AF37] font-bold">
               A
             </div>
          </div>
        </header>

        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
