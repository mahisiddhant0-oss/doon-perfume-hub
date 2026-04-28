"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { API_ROUTES } from "@/lib/api";

type OrderItem = {
  _id?: string;
  name: string;
  quantity: number;
  price: number;
  size?: string;
  weightKg?: number;
  baseAmount?: number;
  gstAmount?: number;
  totalAmount?: number;
};

type AdminOrderDetail = {
  _id: string;
  orderCode?: string;
  user?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  items: OrderItem[];
  shippingAddress?: {
    firstName?: string;
    lastName?: string;
    street?: string;
    apartment?: string;
    city?: string;
    state?: string;
    pincode?: string;
    phone?: string;
    country?: string;
  };
  totalAmount: number;
  subtotal?: number;
  gstAmount?: number;
  shippingAmount?: number;
  totalWeightKg?: number;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod?: string;
  awbNumber?: string;
  logisticsStatus?: string;
  isFulfilled?: boolean;
  fulfilledAt?: string;
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
};

const toCurrency = (value = 0) => `Rs. ${Number(value || 0).toFixed(2)}`;
const toText = (value?: string | number | null) => (value === undefined || value === null || value === "" ? "N/A" : String(value));
const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : "Unable to load order details");

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;

  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrder = async () => {
      setLoading(true);
      setError("");

      try {
        const userStr = localStorage.getItem("user");
        const token = userStr ? JSON.parse(userStr)?.token : "";
        if (!token) throw new Error("Not authenticated");

        const res = await fetch(`${API_ROUTES.ORDERS}/${orderId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.message || "Failed to fetch order details");
        setOrder(payload);
      } catch (e: unknown) {
        setError(getErrorMessage(e));
      } finally {
        setLoading(false);
      }
    };

    if (orderId) fetchOrder();
  }, [orderId]);

  const fullName = useMemo(() => {
    if (!order?.shippingAddress) return "N/A";
    return `${order.shippingAddress.firstName || ""} ${order.shippingAddress.lastName || ""}`.trim() || "N/A";
  }, [order?.shippingAddress]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#888]">Order Details</p>
          <h1 className="text-2xl font-serif text-[#D4AF37] mt-2">{order?.orderCode || `#${orderId}`}</h1>
        </div>
        <Link href="/admin/orders" className="text-sm text-[#D4AF37] underline underline-offset-2 hover:text-white transition-colors">
          Back to Orders
        </Link>
      </div>

      {loading ? <p className="text-[#888]">Loading order details...</p> : null}
      {error ? <p className="text-red-400">{error}</p> : null}

      {!loading && !error && order ? (
        <div className="grid gap-6 md:grid-cols-2">
          <section className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 space-y-2">
            <h2 className="text-[#D4AF37] font-serif text-lg">Order Summary</h2>
            <p className="text-sm text-white">Order ID: <span className="font-mono">{order.orderCode || order._id}</span></p>
            <p className="text-sm text-white">Created: {new Date(order.createdAt).toLocaleString()}</p>
            <p className="text-sm text-white">Updated: {new Date(order.updatedAt).toLocaleString()}</p>
            <p className="text-sm text-white capitalize">Order Status: {toText(order.orderStatus)}</p>
            <p className="text-sm text-white capitalize">Payment Status: {toText(order.paymentStatus)}</p>
            <p className="text-sm text-white">Payment Mode: {toText(order.paymentMethod)}</p>
            <p className="text-sm text-white">Tracking/AWB: {toText(order.awbNumber)}</p>
            <p className="text-sm text-white capitalize">Tracking Status: {toText(order.logisticsStatus)}</p>
            <p className="text-sm text-white">Fulfilled: {order.isFulfilled ? "Yes" : "No"}</p>
            <p className="text-sm text-white">Delivered At: {order.deliveredAt ? new Date(order.deliveredAt).toLocaleString() : "N/A"}</p>
          </section>

          <section className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 space-y-2">
            <h2 className="text-[#D4AF37] font-serif text-lg">User Details</h2>
            <p className="text-sm text-white">Username: {toText(order.user?.name)}</p>
            <p className="text-sm text-white">Email: {toText(order.user?.email)}</p>
            <p className="text-sm text-white">Phone: {toText(order.user?.phone || order.shippingAddress?.phone)}</p>
            <p className="text-sm text-white">User ID: <span className="font-mono">{toText(order.user?._id)}</span></p>
          </section>

          <section className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 space-y-2 md:col-span-2">
            <h2 className="text-[#D4AF37] font-serif text-lg">Shipping Address</h2>
            <p className="text-sm text-white">Name: {fullName}</p>
            <p className="text-sm text-white">Street: {toText(order.shippingAddress?.street)}</p>
            <p className="text-sm text-white">Apartment: {toText(order.shippingAddress?.apartment)}</p>
            <p className="text-sm text-white">
              City/State/Pincode: {toText(order.shippingAddress?.city)} / {toText(order.shippingAddress?.state)} / {toText(order.shippingAddress?.pincode)}
            </p>
            <p className="text-sm text-white">Country: {toText(order.shippingAddress?.country)}</p>
            <p className="text-sm text-white">Address Phone: {toText(order.shippingAddress?.phone)}</p>
          </section>

          <section className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 space-y-3 md:col-span-2">
            <h2 className="text-[#D4AF37] font-serif text-lg">Items Ordered</h2>
            <div className="space-y-3">
              {order.items?.map((item, idx) => (
                <div key={`${item._id || item.name}-${idx}`} className="border border-[#1a1a1a] rounded-xl p-4">
                  <p className="text-sm text-white font-medium">{item.name}</p>
                  <p className="text-xs text-[#ccc]">Qty: {item.quantity} | Size: {toText(item.size)} | Weight: {toText(item.weightKg)} kg</p>
                  <p className="text-xs text-[#ccc]">Unit Price: {toCurrency(item.price)} | Base: {toCurrency(item.baseAmount)} | GST: {toCurrency(item.gstAmount)} | Total: {toCurrency(item.totalAmount)}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5 space-y-2 md:col-span-2">
            <h2 className="text-[#D4AF37] font-serif text-lg">Billing</h2>
            <p className="text-sm text-white">Subtotal: {toCurrency(order.subtotal)}</p>
            <p className="text-sm text-white">GST: {toCurrency(order.gstAmount)}</p>
            <p className="text-sm text-white">Shipping: {toCurrency(order.shippingAmount)}</p>
            <p className="text-sm text-white">Total Weight: {toText(order.totalWeightKg)} kg</p>
            <p className="text-base text-green-400 font-bold">Grand Total: {toCurrency(order.totalAmount)}</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
