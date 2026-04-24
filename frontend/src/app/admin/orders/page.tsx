"use client";

import React, { useState, useEffect } from 'react';
import { API_ROUTES } from '@/lib/api';
import {
  ShoppingBag,
  Search,
  Filter,
  ExternalLink,
  RefreshCw,
  MoreVertical,
  CheckCircle,
  Truck,
  CreditCard,
  AlertTriangle
} from 'lucide-react';

type AdminOrder = {
  _id: string;
  user: {
    name: string;
    email: string;
  };
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
  awbNumber?: string;
  createdAt: string;
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const userStr = localStorage.getItem('user');
        if (!userStr) throw new Error('Not authenticated');
        const token = JSON.parse(userStr).token;

        const res = await fetch(API_ROUTES.ORDERS, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!res.ok) throw new Error('Failed to fetch orders');
        const data: AdminOrder[] = await res.json();
        setOrders(data);
      } catch (err) {
        console.error('Error fetching admin orders:', err);
        setError('Unable to fetch orders. Please sign in with an admin account.');
        setOrders([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const filteredOrders = orders.filter((order) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;

    return (
      order._id.toLowerCase().includes(query) ||
      order.user.name.toLowerCase().includes(query) ||
      order.user.email.toLowerCase().includes(query)
    );
  });

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      processing: 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20',
      shipped: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      delivered: 'bg-green-500/10 text-green-500 border-green-500/20',
      paid: 'bg-green-500/10 text-green-500 border-green-500/20',
      cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
      failed: 'bg-red-500/10 text-red-500 border-red-500/20',
    };

    return (
      <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md border ${colors[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-grow max-w-md group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#888] group-focus-within:text-[#D4AF37] transition-colors" size={18} />
          <input
            type="text"
            placeholder="Search by Order ID, Name or Email..."
            className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37] transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center space-x-3">
          <button className="flex items-center space-x-2 bg-[#0a0a0a] border border-[#1a1a1a] px-4 py-3 rounded-xl text-sm text-[#888] hover:text-white hover:border-[#D4AF37] transition-all">
            <Filter size={16} />
            <span>Filter</span>
          </button>
          <button className="flex items-center space-x-2 bg-[#D4AF37] text-black px-4 py-3 rounded-xl text-sm font-bold hover:bg-[#bda871] transition-all">
            <RefreshCw size={16} />
            <span>Sync Logistics</span>
          </button>
        </div>
      </div>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-black/50 text-[#888] text-[10px] uppercase tracking-[0.2em] font-bold">
                <th className="px-8 py-6">Order Details</th>
                <th className="px-6 py-6">Customer</th>
                <th className="px-6 py-6">Status</th>
                <th className="px-6 py-6">Logistics</th>
                <th className="px-6 py-6">Total</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1a1a]">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-[#888] font-serif tracking-widest uppercase">
                    Loading securely processed orders...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-red-400 font-serif tracking-wide">
                    {error}
                  </td>
                </tr>
              ) : filteredOrders.map((order) => (
                <tr key={order._id} className="hover:bg-white/[0.01] transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-[#D4AF37] text-xs font-bold mb-1 font-mono tracking-tighter">#{order._id.toUpperCase()}</span>
                      <span className="text-[#888] text-[10px] flex items-center">
                        <CreditCard size={10} className="mr-1" />
                        {new Date(order.createdAt).toLocaleDateString()} at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col">
                      <span className="text-white text-sm font-medium">{order.user.name}</span>
                      <span className="text-[#888] text-[10px] font-mono">{order.user.email}</span>
                    </div>
                  </td>
                  <td className="px-6 py-6 space-y-2 flex flex-col items-start pt-5">
                    <div className="flex items-center space-x-2">
                      <ShoppingBag size={12} className="text-[#888]" />
                      <StatusBadge status={order.orderStatus} />
                    </div>
                    <div className="flex items-center space-x-2">
                      <CreditCard size={12} className="text-[#888]" />
                      <StatusBadge status={order.paymentStatus} />
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    {order.awbNumber ? (
                      <div className="flex flex-col">
                        <span className="text-[#888] text-[10px] mb-1 flex items-center">
                          <Truck size={12} className="text-blue-500 mr-2" />
                          DELHIVERY (AWB)
                        </span>
                        <div className="flex items-center space-x-2 group/awb">
                          <span className="text-white text-xs font-mono">{order.awbNumber}</span>
                          <ExternalLink size={12} className="text-[#888] cursor-pointer hover:text-[#D4AF37] transition-colors" />
                        </div>
                      </div>
                    ) : (
                      <span className="text-[#ed4337] text-[10px] items-center flex">
                        <AlertTriangle size={12} className="mr-2" />
                        Pending AWB Generation
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-6">
                    <span className="text-white font-bold font-serif italic text-lg">Rs. {order.totalAmount}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end space-x-2">
                      <button className="p-2 text-[#888] hover:text-[#D4AF37] hover:bg-[#D4AF37]/5 rounded-lg transition-all" title="View Details">
                        <MoreVertical size={18} />
                      </button>
                      <button className="p-2 text-[#888] hover:text-green-500 hover:bg-green-500/5 rounded-lg transition-all" title="Mark as Delivered">
                        <CheckCircle size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-between items-center text-[#888] text-[10px] uppercase font-bold tracking-[0.2em] px-4">
        <p>Showing {filteredOrders.length} orders of last 30 days</p>
        <p>DOON PERFUME HUB - Admin Terminal Access v1.0.4</p>
      </div>
    </div>
  );
}
