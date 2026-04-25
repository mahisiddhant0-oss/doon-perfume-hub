"use client";

import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import { ShieldCheck, ChevronLeft, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { API_ROUTES, getAuthToken } from '@/lib/api';

const GST_RATE = 0.18;

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export default function CheckoutPage() {
  const [address, setAddress] = useState({
    firstName: '',
    lastName: '',
    street: '',
    apartment: '',
    city: '',
    state: '',
    pincode: '',
    phone: '',
  });
  const [cartItems, setCartItems] = useState<any[]>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAddress({ ...address, [e.target.name]: e.target.value });
  };

  const handlePaymentSuccess = async (response: any) => {
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Please sign in before verifying your payment.');
      }

      const verifyRes = await fetch(`${API_ROUTES.ORDERS}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
        }),
      });

      const data = await verifyRes.json();
      if (verifyRes.ok) {
        localStorage.removeItem('cart');
        window.location.href = `/order-success/${data.orderId}`;
      } else {
        alert(`Payment Verification Failed: ${data.message}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Something went wrong during payment verification.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Please sign in before checkout.');
      }

      if (!(window as any).Razorpay) {
        throw new Error('Payment gateway failed to load. Please refresh and try again.');
      }

      const res = await fetch(API_ROUTES.ORDERS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          shippingAddress: address,
          items: cartItems,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to create order. Please review your checkout details.');
      }

      const { razorpayOrderId, amount, currency, key } = await res.json();

      if (!key) {
        throw new Error('Payment key is missing. Please contact support.');
      }

      const options = {
        key,
        amount,
        currency,
        name: 'Doon Perfume Hub',
        description: 'Luxury Fragrance Purchase',
        image: 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=100&q=80',
        order_id: razorpayOrderId,
        handler: (response: any) => {
          handlePaymentSuccess(response);
        },
        prefill: {
          name: `${address.firstName} ${address.lastName}`.trim(),
          contact: address.phone,
        },
        theme: {
          color: '#bda871',
        },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      alert(error.message);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      setCartItems(JSON.parse(saved));
    }
  }, []);

  const subtotal = roundToTwo(cartItems.reduce((acc, item) => acc + Number(item.price) * Number(item.quantity), 0));
  const gstAmount = roundToTwo(subtotal * GST_RATE);
  const grandTotal = roundToTwo(subtotal + gstAmount);

  return (
    <div className="bg-[#fcfcfc] min-h-screen">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      <header className="border-b bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <Link href="/cart" className="flex items-center text-sm font-medium text-gray-500 hover:text-[var(--color-brand-primary)]">
            <ChevronLeft size={16} className="mr-1" /> RETURN TO CART
          </Link>
          <Link href="/" className="flex items-center">
            <Image
              src="/DPH_LOGO.avif"
              alt="Doon Perfume Hub"
              width={150}
              height={56}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>
          <div className="flex items-center text-sm font-medium text-gray-500">
            <Lock size={16} className="mr-2" /> SECURE CHECKOUT
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex flex-col-reverse lg:flex-row min-h-[calc(100vh-80px)]">
        <div className="w-full lg:w-3/5 p-6 md:p-12 lg:pr-24 lg:border-r border-gray-200 bg-white">
          <h2 className="text-2xl font-serif text-gray-900 mb-8">Shipping Address</h2>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 tracking-wider mb-2">FIRST NAME</label>
                <input required type="text" name="firstName" value={address.firstName} onChange={handleChange} className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 tracking-wider mb-2">LAST NAME</label>
                <input required type="text" name="lastName" value={address.lastName} onChange={handleChange} className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-700 tracking-wider mb-2">ADDRESS</label>
              <input required type="text" name="street" placeholder="Street Address or P.O Box" value={address.street} onChange={handleChange} className="w-full border border-gray-300 p-3 text-sm mb-3 focus:outline-none focus:border-[var(--color-brand-primary)]" />
              <input type="text" name="apartment" placeholder="Apartment, suite, unit, etc. (optional)" value={address.apartment} onChange={handleChange} className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-[var(--color-brand-primary)]" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 tracking-wider mb-2">CITY</label>
                <input required type="text" name="city" value={address.city} onChange={handleChange} className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 tracking-wider mb-2">STATE</label>
                <select required name="state" value={address.state} onChange={handleChange} className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-[var(--color-brand-primary)] transition-colors bg-white">
                  <option value="">Select State</option>
                  <option value="Uttarakhand">Uttarakhand</option>
                  <option value="Delhi">Delhi</option>
                  <option value="Maharashtra">Maharashtra</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
              <div>
                <label className="block text-xs font-semibold text-gray-700 tracking-wider mb-2">PINCODE</label>
                <input required type="text" name="pincode" value={address.pincode} onChange={handleChange} className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 tracking-wider mb-2">PHONE</label>
                <input required type="tel" name="phone" value={address.phone} onChange={handleChange} className="w-full border border-gray-300 p-3 text-sm focus:outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
                <p className="text-[10px] text-gray-500 mt-1">For delivery and OTP verification.</p>
              </div>
            </div>

            <button type="submit" className="w-full bg-[#111111] text-white py-4 text-sm font-semibold tracking-widest hover:bg-[var(--color-brand-primary)] transition-colors">
              PAY Rs. {grandTotal.toLocaleString('en-IN')}
            </button>
          </form>
        </div>

        <div className="w-full lg:w-2/5 p-6 md:p-12 bg-gray-50 relative">
          <div className="lg:sticky lg:top-12">
            <h2 className="text-xl font-serif text-gray-900 mb-6">Order Summary</h2>

            <div className="flex flex-col gap-4 mb-6">
              {cartItems.map((item) => {
                const lineBase = Number(item.price) * Number(item.quantity);
                const lineGst = roundToTwo(lineBase * GST_RATE);
                const lineTotal = roundToTwo(lineBase + lineGst);

                return (
                  <div key={item.id} className="flex gap-4 items-center">
                    <div className="relative w-16 h-20 flex-shrink-0 bg-white border border-gray-200">
                      <Image src={item.img} alt={item.name} fill className="object-cover" />
                      <span className="absolute -top-2 -right-2 bg-gray-500 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center">{item.quantity}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-gray-900">{item.name}</h4>
                      <p className="text-xs text-gray-500">{item.size}</p>
                    </div>
                    <div className="text-sm font-medium text-gray-900">Rs. {lineTotal.toLocaleString('en-IN')}</div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-200 pt-6 space-y-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>Rs. {subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>GST (18%)</span>
                <span>Rs. {gstAmount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between text-lg font-medium text-gray-900 pt-4 border-t border-gray-200">
                <span>Total</span>
                <span>Rs. {grandTotal.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-xs text-gray-500">Including Rs. {gstAmount.toLocaleString('en-IN')} in taxes</p>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200 border-dashed">
              <div className="flex items-start gap-4 text-sm text-gray-500">
                <ShieldCheck className="text-green-600 flex-shrink-0" />
                <p>Your payment is processed by Razorpay. All transaction details are encrypted and secure.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
