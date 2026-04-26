"use client";

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, Package, Truck, Calendar, ArrowRight, ExternalLink } from 'lucide-react';
import { API_ROUTES } from '@/lib/api';

interface Order {
  _id: string;
  orderNumber: string;
  totalPrice: number;
  orderStatus: string;
  paymentStatus: string;
  awb?: string;
  createdAt: string;
}

export default function OrderSuccessPage() {
  const { id } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`${API_ROUTES.ORDERS}/${id}`);
        if (!res.ok) throw new Error('Order not found');
        const data = await res.json();
        setOrder(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchOrder();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-brand-bg)]">
        <div className="animate-pulse text-[var(--color-brand-primary)] font-serif text-2xl">Confirming your fragrance...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-brand-bg)] py-12 md:py-24 px-4">
      <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-2xl overflow-hidden">
        
        {/* Success Header */}
        <div className="bg-[var(--color-brand-primary)] py-12 text-center text-white px-6">
            <CheckCircle2 size={64} className="mx-auto mb-6 opacity-90" />
            <h1 className="text-3xl md:text-5xl font-serif mb-3 italic">Scents on the Way!</h1>
            <p className="text-white/80 max-w-md mx-auto text-sm md:text-base">
                Thank you for your order. We are preparing your artisanal fragrances with the utmost care.
            </p>
        </div>

        <div className="p-8 md:p-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12 border-b border-gray-100 pb-12">
                <div>
                    <h3 className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase mb-4">Order Details</h3>
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Order ID:</span>
                            <span className="font-bold text-gray-900">#{order?._id.slice(-8).toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Date:</span>
                            <span className="font-bold text-gray-900">{order ? new Date(order.createdAt).toLocaleDateString() : '-'}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Total Amount:</span>
                            <span className="font-bold text-[var(--color-brand-primary)]">₹{order?.totalPrice.toLocaleString('en-IN')}</span>
                        </div>
                    </div>
                </div>
                <div>
                    <h3 className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase mb-4">Shipping Status</h3>
                    {order?.awb ? (
                        <div className="bg-green-50 p-4 rounded-lg flex items-start gap-4">
                            <Truck className="text-green-600 mt-1" size={20} />
                            <div>
                                <p className="text-sm font-bold text-green-900">Waybill Generated</p>
                                <p className="text-xs text-green-700 mt-1">Delhivery ID: {order.awb}</p>
                                <Link 
                                    href={`https://www.delhivery.com/track/package/${order.awb}`} 
                                    target="_blank"
                                    className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-green-600 mt-3 hover:underline"
                                >
                                    Track Live <ExternalLink size={12} />
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-blue-50 p-4 rounded-lg flex items-start gap-4">
                            <Calendar className="text-blue-600 mt-1" size={20} />
                            <div>
                                <p className="text-sm font-bold text-blue-900">Processing</p>
                                <p className="text-xs text-blue-700 mt-1">We're verifying your payment and preparing your package.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Timeline/Steps */}
            <div className="space-y-8 mb-12">
                <div className="flex gap-6 items-start relative pb-8 border-l-2 border-green-500 ml-3 pl-8">
                    <div className="absolute -left-[11px] top-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <CheckCircle2 size={12} className="text-white" />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-900">Order Confirmed</h4>
                        <p className="text-xs text-gray-500 mt-1">We've received your order and payment.</p>
                    </div>
                </div>
                <div className="flex gap-6 items-start relative pb-8 border-l-2 border-gray-200 ml-3 pl-8">
                    <div className="absolute -left-[11px] top-0 w-5 h-5 bg-gray-200 rounded-full"></div>
                    <div>
                        <h4 className="font-bold text-gray-400">Shipped</h4>
                        <p className="text-xs text-gray-400 mt-1">Your package is on its way to the Delhivery hub.</p>
                    </div>
                </div>
                <div className="flex gap-6 items-start relative ml-3 pl-8">
                    <div className="absolute -left-[11px] top-0 w-5 h-5 bg-gray-200 rounded-full"></div>
                    <div>
                        <h4 className="font-bold text-gray-400">Delivered</h4>
                        <p className="text-xs text-gray-400 mt-1">Fragrance delivered to your doorstep.</p>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/products" className="flex-1">
                    <button className="w-full bg-black text-white h-14 font-bold tracking-widest text-xs hover:bg-gray-900 transition-all flex items-center justify-center gap-3">
                        CONTINUE SHOPPING <ArrowRight size={16} />
                    </button>
                </Link>
                <Link href="/" className="sm:w-1/3">
                    <button className="w-full border border-gray-200 h-14 font-bold tracking-widest text-xs hover:bg-gray-50 transition-all">
                        BACK TO HOME
                    </button>
                </Link>
            </div>
        </div>

        <div className="p-8 bg-gray-50 border-t border-gray-100 text-center">
             <p className="text-xs text-gray-400 font-medium">Need help? WhatsApp us at +91 94563 21021</p>
        </div>
      </div>
    </div>
  );
}
