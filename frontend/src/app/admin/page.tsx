"use client";

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Users, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  CheckCircle2,
  PackageCheck
} from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalRevenue: 245000,
    totalOrders: 156,
    totalUsers: 842,
    conversionRate: 3.2
  });

  const recentOrders = [
    { id: '#8492', user: 'Mahish S.', amount: '₹1,240', status: 'processing', date: '2 mins ago' },
    { id: '#8491', user: 'Ananya R.', amount: '₹850', status: 'shipped', date: '15 mins ago' },
    { id: '#8490', user: 'Rahul V.', amount: '₹2,100', status: 'paid', date: '1 hr ago' },
    { id: '#8489', user: 'Priya K.', amount: '₹3,400', status: 'delivered', date: '3 hrs ago' },
  ];

  const StatCard = ({ title, value, icon: Icon, change, trend }: any) => (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-6 rounded-2xl hover:border-[#D4AF37]/30 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-[#D4AF37]/5 rounded-xl text-[#D4AF37] group-hover:bg-[#D4AF37]/10 transition-colors">
          <Icon size={24} />
        </div>
        <div className={`flex items-center text-xs font-medium ${trend === 'up' ? 'text-green-500' : 'text-red-500'} bg-black px-2 py-1 rounded-full border border-current/20`}>
          {trend === 'up' ? <ArrowUpRight size={14} className="mr-1" /> : <ArrowDownRight size={14} className="mr-1" />}
          {change}%
        </div>
      </div>
      <h3 className="text-[#888] text-sm font-medium mb-1">{title}</h3>
      <p className="text-2xl font-serif font-bold text-white tracking-tight">{value}</p>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={DollarSign} change="12.5" trend="up" />
        <StatCard title="Total Orders" value={stats.totalOrders} icon={ShoppingBag} change="8.2" trend="up" />
        <StatCard title="Total Customers" value={stats.totalUsers} icon={Users} change="5.4" trend="up" />
        <StatCard title="Conversion Rate" value={`${stats.conversionRate}%`} icon={TrendingUp} change="1.1" trend="down" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-[#1a1a1a] flex justify-between items-center">
            <h2 className="text-lg font-serif font-bold text-[#D4AF37]">Recent Sales Activity</h2>
            <button className="text-xs text-[#888] hover:text-[#D4AF37] transition-colors">View All Orders</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-black/50 text-[#888] text-xs uppercase tracking-widest">
                  <th className="px-6 py-4 font-medium">Order ID</th>
                  <th className="px-6 py-4 font-medium">Customer</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1a1a]">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-6 py-4 text-sm font-medium text-[#D4AF37]">{order.id}</td>
                    <td className="px-6 py-4 text-sm text-white">{order.user}</td>
                    <td className="px-6 py-4 text-sm font-bold text-white">{order.amount}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md border ${
                        order.status === 'delivered' ? 'bg-green-500/10 text-green-500 border-green-500/20' :
                        order.status === 'processing' ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20' :
                        'bg-blue-500/10 text-blue-500 border-blue-500/20'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-[#888] text-right">{order.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions / Inventory Health */}
        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-serif font-bold text-[#D4AF37] mb-4">Inventory & Health</h2>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
              <Clock className="text-red-500" size={20} />
              <div>
                <p className="text-sm font-bold text-white">4 Items Low Stock</p>
                <p className="text-xs text-[#888]">Restock Signature Scent (SKU: Perf-001)</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-green-500/5 border border-green-500/10 rounded-xl">
              <CheckCircle2 className="text-green-500" size={20} />
              <div>
                <p className="text-sm font-bold text-white">Logistics Online</p>
                <p className="text-xs text-[#888]">Delhivery API connected & healthy.</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-[#D4AF37]/5 border border-[#D4AF37]/10 rounded-xl">
              <PackageCheck className="text-[#D4AF37]" size={20} />
              <div>
                <p className="text-sm font-bold text-white">12 Pending Pickups</p>
                <p className="text-xs text-[#888]">Scheduled for today at 2:00 PM.</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#1a1a1a]">
            <button className="w-full py-3 bg-[#D4AF37] text-black font-bold rounded-xl hover:bg-[#bda871] transition-colors text-sm uppercase tracking-widest">
              Add New Product
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
