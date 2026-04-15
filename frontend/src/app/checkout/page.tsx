"use client";

import Image from 'next/image';
import Link from 'next/link';
import { ShieldCheck, ChevronLeft, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { API_ROUTES } from '@/lib/api';
import Script from 'next/script';

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setAddress({ ...address, [e.target.name]: e.target.value });
  };

  const handlePaymentSuccess = async (response: any) => {
    try {
      const verifyRes = await fetch(`${API_ROUTES.ORDERS}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer MOCK_JWT_TOKEN` 
        },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature
        })
      });

      const data = await verifyRes.json();
      if (verifyRes.ok) {
        // Clear cart local storage
        localStorage.removeItem('cart');
        window.location.href = `/order-success/${data.orderId}`;
      } else {
        alert("Payment Verification Failed: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Something went wrong during payment verification.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // 1. Create order on our backend
      const res = await fetch(API_ROUTES.ORDERS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer MOCK_JWT_TOKEN`
        },
        body: JSON.stringify({ 
          shippingAddress: address,
          items: cartItems 
        })
      });

      if (!res.ok) {
        throw new Error('Failed to create order. Please check if your cart is empty.');
      }

      const { order, razorpayOrderId, amount, currency, key } = await res.json();

      // 2. Open Razorpay Widget
      const options = {
        key: key || "rzp_test_placeholder",
        amount: amount,
        currency: currency,
        name: "Doon Perfume Hub",
        description: "Luxury Fragrance Purchase",
        image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=100&q=80",
        order_id: razorpayOrderId,
        handler: function (response: any) {
          handlePaymentSuccess(response);
        },
        prefill: {
          name: `${address.firstName} ${address.lastName}`,
          contact: address.phone
        },
        theme: {
          color: "#bda871"
        }
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();

    } catch (error: any) {
      alert(error.message);
    }
  };

  const [cartItems, setCartItems] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      setCartItems(JSON.parse(saved));
    }
  }, []);

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <div className="bg-[#fcfcfc] min-h-screen">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      
      {/* Minimal Header just for Checkout */}
      <header className="border-b bg-white py-6">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
          <Link href="/cart" className="flex items-center text-sm font-medium text-gray-500 hover:text-[var(--color-brand-primary)]">
            <ChevronLeft size={16} className="mr-1" /> RETURN TO CART
          </Link>
          <div className="font-serif text-2xl text-[var(--color-brand-primary)]">doonperfume</div>
          <div className="flex items-center text-sm font-medium text-gray-500">
             <Lock size={16} className="mr-2" /> SECURE CHECKOUT
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex flex-col-reverse lg:flex-row min-h-[calc(100vh-80px)]">
        
        {/* Left: Address Selection & Details */}
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
              PAY ₹{(subtotal).toLocaleString('en-IN')}
            </button>
          </form>
        </div>

        {/* Right: Order Summary */}
        <div className="w-full lg:w-2/5 p-6 md:p-12 bg-gray-50 relative">
          <div className="lg:sticky lg:top-12">
            <h2 className="text-xl font-serif text-gray-900 mb-6">Order Summary</h2>
            
            <div className="flex flex-col gap-4 mb-6">
              {cartItems.map((item) => (
                <div key={item.id} className="flex gap-4 items-center">
                  <div className="relative w-16 h-20 flex-shrink-0 bg-white border border-gray-200">
                    <Image src={item.img} alt={item.name} fill className="object-cover" />
                    <span className="absolute -top-2 -right-2 bg-gray-500 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center">{item.quantity}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">{item.name}</h4>
                    <p className="text-xs text-gray-500">{item.size}</p>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    ₹{(item.price * item.quantity).toLocaleString('en-IN')}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-gray-200 pt-6 space-y-3">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Shipping</span>
                <span>Free</span>
              </div>
              <div className="flex justify-between text-lg font-medium text-gray-900 pt-4 border-t border-gray-200">
                <span>Total</span>
                <span>₹{subtotal.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-xs text-gray-500">Including ₹{(subtotal * 0.18).toLocaleString('en-IN', {maximumFractionDigits:0})} in taxes</p>
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
