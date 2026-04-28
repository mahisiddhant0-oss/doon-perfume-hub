"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { API_ROUTES } from '@/lib/api';
import {
  ShoppingBag,
  Search,
  RefreshCw,
  Plane,
  CheckCircle,
  Truck,
  CreditCard,
  AlertTriangle,
  Plus,
  XCircle,
} from 'lucide-react';

type AdminOrder = {
  _id: string;
  user: {
    name: string;
    email: string;
    phone?: string;
  };
  totalAmount: number;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod?: string;
  awbNumber?: string;
  logisticsStatus?: string;
  isFulfilled?: boolean;
  deliveredAt?: string;
  createdAt: string;
};

type CustomItem = {
  name: string;
  price: string;
  weightKg: string;
  quantity: string;
};

const emptyCustomItem = (): CustomItem => ({
  name: '',
  price: '',
  weightKg: '',
  quantity: '',
});

const normalizePaymentMethod = (value = '') => {
  if (!value) return 'RAZORPAY';
  return value.replace(/_/g, ' ').toUpperCase();
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSavingCustom, setIsSavingCustom] = useState(false);
  const [retryingAwbOrderId, setRetryingAwbOrderId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customItems, setCustomItems] = useState<CustomItem[]>([emptyCustomItem()]);
  const [customCustomer, setCustomCustomer] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    state: '',
    pincode: '',
    street: '',
  });
  const [customPaymentMethod, setCustomPaymentMethod] = useState('manual');

  const getToken = () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return '';
    return JSON.parse(userStr).token || '';
  };

  const fetchOrders = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(API_ROUTES.ORDERS, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message || 'Failed to fetch orders');
      }

      const data: AdminOrder[] = await res.json();
      setOrders(data.filter((order) => order.paymentStatus === 'paid'));
    } catch (fetchError: any) {
      setError(fetchError?.message || 'Unable to fetch orders');
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return orders;

    return orders.filter((order) =>
      order._id.toLowerCase().includes(query) ||
      order.user.name.toLowerCase().includes(query) ||
      order.user.email.toLowerCase().includes(query)
    );
  }, [orders, searchTerm]);

  const StatusBadge = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      processing: 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20',
      shipped: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      delivered: 'bg-green-500/10 text-green-500 border-green-500/20',
      paid: 'bg-green-500/10 text-green-500 border-green-500/20',
      cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
      failed: 'bg-red-500/10 text-red-500 border-red-500/20',
      in_transit: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    };

    return (
      <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md border ${colors[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
        {status.replace(/_/g, ' ')}
      </span>
    );
  };

  const syncDeliveredOrders = async () => {
    try {
      setIsSyncing(true);
      const token = getToken();
      const res = await fetch(`${API_ROUTES.LOGISTICS}/sync-delivered`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message || 'Failed to sync logistics');
      await fetchOrders();
      alert(`Sync complete. Scanned: ${payload?.scanned || 0}, Delivered: ${payload?.delivered || 0}`);
    } catch (syncError: any) {
      alert(syncError.message || 'Unable to sync logistics');
    } finally {
      setIsSyncing(false);
    }
  };

  const markAsDelivered = async (orderId: string) => {
    try {
      const token = getToken();
      const res = await fetch(`${API_ROUTES.ORDERS}/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orderStatus: 'delivered' }),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message || 'Failed to update order');
      await fetchOrders();
    } catch (updateError: any) {
      alert(updateError.message || 'Unable to mark delivered');
    }
  };

  const trackOrder = async (orderId: string) => {
    try {
      const res = await fetch(`${API_ROUTES.LOGISTICS}/track/${orderId}`);
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message || 'Tracking unavailable');
      const awbFromPayload = payload?.awbNumber;
      if (!awbFromPayload) {
        throw new Error('AWB not available for this order yet');
      }

      // Open Delhivery tracking page directly with AWB prefilled in URL
      const trackingUrl = `https://www.delhivery.com/track/package/${encodeURIComponent(awbFromPayload)}`;
      window.open(trackingUrl, '_blank', 'noopener,noreferrer');
    } catch (trackError: any) {
      alert(trackError.message || 'Unable to track order');
    }
  };

  const retryAwb = async (orderId: string) => {
    try {
      setRetryingAwbOrderId(orderId);
      const token = getToken();
      const res = await fetch(`${API_ROUTES.LOGISTICS}/retry-awb/${orderId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.message || 'Failed to retry AWB generation');
      }
      await fetchOrders();
      alert(`AWB generated: ${payload?.awbNumber || 'N/A'}`);
    } catch (retryError: any) {
      alert(retryError.message || 'Unable to retry AWB');
    } finally {
      setRetryingAwbOrderId('');
    }
  };

  const addCustomItem = () => {
    setCustomItems((prev) => [...prev, emptyCustomItem()]);
  };

  const updateCustomItem = (index: number, key: keyof CustomItem, value: string) => {
    setCustomItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item))
    );
  };

  const removeCustomItem = (index: number) => {
    setCustomItems((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const createCustomOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setIsSavingCustom(true);
      const token = getToken();
      const payload = {
        customer: {
          name: customCustomer.name,
          email: customCustomer.email,
          phone: customCustomer.phone,
        },
        shippingAddress: {
          firstName: customCustomer.name,
          lastName: '',
          street: customCustomer.street || 'Custom Order',
          city: customCustomer.city || 'Custom',
          state: customCustomer.state || 'Custom',
          pincode: customCustomer.pincode || '000000',
          phone: customCustomer.phone,
          country: 'India',
        },
        items: customItems.map((item) => ({
          name: item.name,
          price: Number(item.price || 0),
          weightKg: Number(item.weightKg || 0),
          quantity: Number(item.quantity || 0),
        })),
        paymentMethod: customPaymentMethod || 'manual',
      };

      const res = await fetch(`${API_ROUTES.ORDERS}/custom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const responsePayload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(responsePayload?.message || 'Failed to create custom order');
      }

      setIsCustomModalOpen(false);
      setCustomItems([emptyCustomItem()]);
      setCustomCustomer({
        name: '',
        email: '',
        phone: '',
        city: '',
        state: '',
        pincode: '',
        street: '',
      });
      await fetchOrders();
    } catch (customError: any) {
      alert(customError.message || 'Unable to create custom order');
    } finally {
      setIsSavingCustom(false);
    }
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
          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="flex items-center space-x-2 bg-[#0a0a0a] border border-[#1a1a1a] px-4 py-3 rounded-xl text-sm text-[#D4AF37] hover:text-white hover:border-[#D4AF37] transition-all"
          >
            <Plus size={16} />
            <span>Custom Order</span>
          </button>
          <button
            onClick={syncDeliveredOrders}
            disabled={isSyncing}
            className="flex items-center space-x-2 bg-[#D4AF37] text-black px-4 py-3 rounded-xl text-sm font-bold hover:bg-[#bda871] transition-all disabled:opacity-70"
          >
            <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Logistics'}</span>
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
                    Loading successful paid orders...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-red-400 font-serif tracking-wide">
                    {error}
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-8 py-20 text-center text-[#888] font-serif tracking-widest uppercase">
                    No paid orders found
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
                      <span className="text-[#888] text-[10px] mt-1">
                        Payment Mode: <span className="text-white">{normalizePaymentMethod(order.paymentMethod)}</span>
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-6">
                    <div className="flex flex-col">
                      <span className="text-white text-sm font-medium">{order.user?.name || 'Customer'}</span>
                      <span className="text-[#888] text-[10px] font-mono">{order.user?.email}</span>
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
                    {order.isFulfilled ? (
                      <span className="text-[10px] uppercase font-bold px-2 py-1 rounded-md border bg-green-500/10 text-green-500 border-green-500/20">
                        fulfilled
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-6">
                    {order.awbNumber ? (
                      <div className="flex flex-col gap-1">
                        <span className="text-[#888] text-[10px] flex items-center">
                          <Truck size={12} className="text-blue-500 mr-2" />
                          AWB: <span className="text-white ml-1 font-mono">{order.awbNumber}</span>
                        </span>
                        <StatusBadge status={order.logisticsStatus || 'pending'} />
                        {order.deliveredAt ? (
                          <span className="text-[10px] text-green-500">
                            Delivered: {new Date(order.deliveredAt).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-[#ed4337] text-[10px] items-center flex">
                        <AlertTriangle size={12} className="mr-2" />
                        Pending AWB Generation
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-6">
                    <span className={`font-bold font-serif italic text-lg ${order.isFulfilled ? 'text-green-400' : 'text-white'}`}>Rs. {order.totalAmount}</span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end space-x-2">
                      {!order.awbNumber ? (
                        <button
                          onClick={() => retryAwb(order._id)}
                          disabled={retryingAwbOrderId === order._id}
                          className="px-2 py-1 text-[10px] uppercase tracking-widest font-bold rounded-md border border-[#D4AF37]/40 text-[#D4AF37] hover:bg-[#D4AF37]/10 disabled:opacity-60 transition-all"
                          title="Generate AWB"
                        >
                          {retryingAwbOrderId === order._id ? 'Generating...' : 'Generate AWB'}
                        </button>
                      ) : null}
                      <button
                        onClick={() => trackOrder(order._id)}
                        disabled={!order.awbNumber}
                        className="p-2 text-[#888] hover:text-[#D4AF37] hover:bg-[#D4AF37]/5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Open Delhivery Tracking"
                      >
                        <Plane size={18} />
                      </button>
                      <button
                        onClick={() => markAsDelivered(order._id)}
                        className="p-2 text-[#888] hover:text-green-500 hover:bg-green-500/5 rounded-lg transition-all"
                        title="Mark as Delivered"
                      >
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
        <p>Showing {filteredOrders.length} paid orders</p>
        <p>DOON PERFUME HUB - Admin Terminal Access v1.1.0</p>
      </div>

      {isCustomModalOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#1a1a1a] flex justify-between items-center">
              <h2 className="text-xl font-serif text-[#D4AF37]">Create Custom Paid Order</h2>
              <button onClick={() => setIsCustomModalOpen(false)} className="text-[#888] hover:text-white transition-colors">
                <XCircle size={24} />
              </button>
            </div>

            <form onSubmit={createCustomOrder} className="p-6 space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <input required placeholder="Customer Name" value={customCustomer.name} onChange={(e) => setCustomCustomer((prev) => ({ ...prev, name: e.target.value }))} className="bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none" />
                <input required placeholder="Customer Email" type="email" value={customCustomer.email} onChange={(e) => setCustomCustomer((prev) => ({ ...prev, email: e.target.value }))} className="bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none" />
                <input required placeholder="Customer Phone" value={customCustomer.phone} onChange={(e) => setCustomCustomer((prev) => ({ ...prev, phone: e.target.value }))} className="bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none" />
                <input required placeholder="Payment Mode (e.g. cash/upi)" value={customPaymentMethod} onChange={(e) => setCustomPaymentMethod(e.target.value)} className="bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <input required placeholder="Street Address" value={customCustomer.street} onChange={(e) => setCustomCustomer((prev) => ({ ...prev, street: e.target.value }))} className="bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none" />
                <input required placeholder="City" value={customCustomer.city} onChange={(e) => setCustomCustomer((prev) => ({ ...prev, city: e.target.value }))} className="bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none" />
                <input required placeholder="State" value={customCustomer.state} onChange={(e) => setCustomCustomer((prev) => ({ ...prev, state: e.target.value }))} className="bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none" />
                <input required placeholder="Pincode" value={customCustomer.pincode} onChange={(e) => setCustomCustomer((prev) => ({ ...prev, pincode: e.target.value }))} className="bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none" />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm uppercase tracking-widest text-[#888] font-bold">Custom Items</h3>
                  <button type="button" onClick={addCustomItem} className="text-[#D4AF37] text-xs font-bold uppercase tracking-widest">+ Add Item</button>
                </div>
                {customItems.map((item, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input required placeholder="Item Name" value={item.name} onChange={(e) => updateCustomItem(index, 'name', e.target.value)} className="bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none" />
                    <input required min={0} step="0.01" type="number" placeholder="Price (Rs.)" value={item.price} onChange={(e) => updateCustomItem(index, 'price', e.target.value)} className="bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none" />
                    <input required min={0} step="0.01" type="number" placeholder="Weight (Kg)" value={item.weightKg} onChange={(e) => updateCustomItem(index, 'weightKg', e.target.value)} className="bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none" />
                    <input required min={1} type="number" placeholder="Quantity" value={item.quantity} onChange={(e) => updateCustomItem(index, 'quantity', e.target.value)} className="bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none" />
                    <button type="button" onClick={() => removeCustomItem(index)} className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-xs uppercase tracking-widest font-bold">Remove</button>
                  </div>
                ))}
              </div>

              <button type="submit" disabled={isSavingCustom} className="w-full bg-[#D4AF37] text-black py-4 rounded-xl font-bold tracking-widest text-xs uppercase hover:bg-white transition-all shadow-xl disabled:opacity-70">
                {isSavingCustom ? 'Creating Custom Order...' : 'Create Custom Paid Order'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
