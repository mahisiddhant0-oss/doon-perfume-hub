"use client";

import React, { useState } from 'react';
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
} from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarOpen, setSidebarOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

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
