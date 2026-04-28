"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Users,
  Clock,
  CheckCircle2,
  PackageCheck,
  ArrowUpRight,
} from "lucide-react";
import { API_ROUTES } from "@/lib/api";

type AdminOrder = {
  _id: string;
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
  awbNumber?: string;
  user?: {
    name?: string;
    email?: string;
  };
  createdAt: string;
};

type AdminProduct = {
  stock?: number;
  name?: string;
  sku?: string;
};

const formatRelativeTime = (dateString: string) => {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = Math.max(0, now - then);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const statusClass = (status: string) => {
  if (status === "delivered") return "bg-green-500/10 text-green-500 border-green-500/20";
  if (status === "processing") return "bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20";
  if (status === "paid" || status === "shipped") return "bg-blue-500/10 text-blue-500 border-blue-500/20";
  return "bg-gray-500/10 text-gray-400 border-gray-500/20";
};

export default function AdminDashboard() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const userRaw = localStorage.getItem("user");
        const token = userRaw ? JSON.parse(userRaw)?.token : "";
        if (!token) throw new Error("Not authenticated");

        const [ordersRes, productsRes] = await Promise.all([
          fetch(API_ROUTES.ORDERS, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(API_ROUTES.PRODUCTS, { headers: { Authorization: `Bearer ${token}` } }),
        ]);

        if (!ordersRes.ok) {
          const payload = await ordersRes.json().catch(() => null);
          throw new Error(payload?.message || "Failed to fetch orders");
        }
        if (!productsRes.ok) {
          const payload = await productsRes.json().catch(() => null);
          throw new Error(payload?.message || "Failed to fetch products");
        }

        const ordersPayload = await ordersRes.json();
        const productsPayload = await productsRes.json();
        setOrders(Array.isArray(ordersPayload) ? ordersPayload : []);
        setProducts(Array.isArray(productsPayload) ? productsPayload : []);
      } catch (e: any) {
        setError(e?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const dashboard = useMemo(() => {
    const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
    const totalRevenue = paidOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const uniqueCustomers = new Set(
      paidOrders.map((o) => o.user?.email || o.user?.name || "").filter(Boolean)
    ).size;
    const deliveredCount = paidOrders.filter((o) => o.orderStatus === "delivered").length;
    const conversionRate = paidOrders.length > 0 ? (deliveredCount / paidOrders.length) * 100 : 0;

    const recentOrders = [...paidOrders]
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      .slice(0, 8);

    const lowStock = products.filter((p) => Number(p.stock || 0) > 0 && Number(p.stock || 0) <= 5).length;
    const pendingAwb = paidOrders.filter((o) => !o.awbNumber).length;

    return {
      totalRevenue,
      totalOrders: paidOrders.length,
      totalCustomers: uniqueCustomers,
      conversionRate,
      recentOrders,
      lowStock,
      pendingAwb,
    };
  }, [orders, products]);

  const StatCard = ({ title, value, icon: Icon }: { title: string; value: string; icon: any }) => (
    <div className="bg-[#0a0a0a] border border-[#1a1a1a] p-6 rounded-2xl hover:border-[#D4AF37]/30 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-3 bg-[#D4AF37]/5 rounded-xl text-[#D4AF37] group-hover:bg-[#D4AF37]/10 transition-colors">
          <Icon size={24} />
        </div>
        <div className="flex items-center text-xs font-medium text-green-500 bg-black px-2 py-1 rounded-full border border-current/20">
          <ArrowUpRight size={14} className="mr-1" />
          Live
        </div>
      </div>
      <h3 className="text-[#888] text-sm font-medium mb-1">{title}</h3>
      <p className="text-2xl font-serif font-bold text-white tracking-tight">{value}</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Revenue" value={`₹${dashboard.totalRevenue.toLocaleString("en-IN")}`} icon={DollarSign} />
        <StatCard title="Total Orders" value={`${dashboard.totalOrders}`} icon={ShoppingBag} />
        <StatCard title="Total Customers" value={`${dashboard.totalCustomers}`} icon={Users} />
        <StatCard title="Conversion Rate" value={`${dashboard.conversionRate.toFixed(1)}%`} icon={TrendingUp} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-[#1a1a1a] flex justify-between items-center">
            <h2 className="text-lg font-serif font-bold text-[#D4AF37]">Recent Sales Activity</h2>
            <Link href="/admin/orders" className="text-xs text-[#888] hover:text-[#D4AF37] transition-colors">
              View All Orders
            </Link>
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
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[#888] text-sm">Loading real orders...</td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-red-400 text-sm">{error}</td>
                  </tr>
                ) : dashboard.recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[#888] text-sm">No paid orders yet.</td>
                  </tr>
                ) : (
                  dashboard.recentOrders.map((order) => (
                    <tr key={order._id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4 text-sm font-medium text-[#D4AF37]">#{order._id.slice(-12).toUpperCase()}</td>
                      <td className="px-6 py-4 text-sm text-white">{order.user?.name || order.user?.email || "Customer"}</td>
                      <td className="px-6 py-4 text-sm font-bold text-white">₹{Number(order.totalAmount || 0).toLocaleString("en-IN")}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md border ${statusClass(order.orderStatus)}`}>
                          {order.orderStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#888] text-right">{formatRelativeTime(order.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-serif font-bold text-[#D4AF37] mb-4">Inventory & Health</h2>

          <div className="space-y-4">
            <div className="flex items-center space-x-4 p-4 bg-red-500/5 border border-red-500/10 rounded-xl">
              <Clock className="text-red-500" size={20} />
              <div>
                <p className="text-sm font-bold text-white">{dashboard.lowStock} Items Low Stock</p>
                <p className="text-xs text-[#888]">Based on current live inventory.</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-green-500/5 border border-green-500/10 rounded-xl">
              <CheckCircle2 className="text-green-500" size={20} />
              <div>
                <p className="text-sm font-bold text-white">Logistics Online</p>
                <p className="text-xs text-[#888]">Using live paid-order and AWB data.</p>
              </div>
            </div>

            <div className="flex items-center space-x-4 p-4 bg-[#D4AF37]/5 border border-[#D4AF37]/10 rounded-xl">
              <PackageCheck className="text-[#D4AF37]" size={20} />
              <div>
                <p className="text-sm font-bold text-white">{dashboard.pendingAwb} Pending AWBs</p>
                <p className="text-xs text-[#888]">Paid orders still awaiting AWB generation.</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-[#1a1a1a]">
            <Link
              href="/admin/products"
              className="block w-full py-3 bg-[#D4AF37] text-black font-bold rounded-xl hover:bg-[#bda871] transition-colors text-sm uppercase tracking-widest text-center"
            >
              Add New Product
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
