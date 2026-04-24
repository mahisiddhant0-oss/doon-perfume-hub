"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API_ROUTES, getAuthToken } from '@/lib/api';

interface OrderItem {
  name: string;
  quantity: number;
  totalAmount?: number;
  price?: number;
  gstAmount?: number;
}

interface Order {
  _id: string;
  createdAt: string;
  orderStatus: string;
  paymentStatus: string;
  totalAmount: number;
  subtotal?: number;
  gstAmount?: number;
  items: OrderItem[];
}

export default function MyOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadOrders = async () => {
      const token = getAuthToken();
      if (!token) {
        setError('Please login with OTP to view your orders.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_ROUTES.ORDERS}/my-orders`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.message || 'Failed to load orders');
        }

        const data = await res.json();
        setOrders(Array.isArray(data) ? data : []);
      } catch (requestError: any) {
        setError(requestError.message || 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-end justify-between gap-4 mb-10">
        <div>
          <p className="text-xs tracking-[0.25em] text-gray-400 uppercase">Account</p>
          <h1 className="font-serif text-4xl text-gray-900 mt-2">My Orders</h1>
        </div>
        <Link href="/products" className="text-xs tracking-[0.2em] uppercase border-b border-black pb-1 hover:text-[var(--color-brand-primary)] hover:border-[var(--color-brand-primary)] transition-colors">
          Continue Shopping
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-500">Loading your orders...</p>}

      {error && !loading && (
        <div className="bg-white border border-red-100 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}

      {!loading && !error && orders.length === 0 && (
        <div className="bg-white border border-gray-100 p-8 text-center text-gray-500">
          You have no orders yet.
        </div>
      )}

      {!loading && !error && orders.length > 0 && (
        <div className="space-y-6">
          {orders.map((order) => (
            <div key={order._id} className="bg-white border border-gray-100 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest">Order ID</p>
                  <p className="text-sm font-medium text-gray-900">{order._id}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest">Date</p>
                  <p className="text-sm text-gray-700">{new Date(order.createdAt).toLocaleString('en-IN')}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest">Status</p>
                  <p className="text-sm text-gray-700 capitalize">{order.orderStatus} / {order.paymentStatus}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-widest">Total</p>
                  <p className="text-lg font-semibold text-[var(--color-brand-primary)]">Rs. {Number(order.totalAmount || 0).toLocaleString('en-IN')}</p>
                </div>
              </div>

              <div className="space-y-2">
                {order.items?.map((item, idx) => (
                  <div key={`${order._id}-item-${idx}`} className="flex items-center justify-between text-sm text-gray-700">
                    <span>{item.name} x {item.quantity}</span>
                    <span>
                      Rs. {Number(item.totalAmount ?? ((item.price || 0) * item.quantity + (item.gstAmount || 0))).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
