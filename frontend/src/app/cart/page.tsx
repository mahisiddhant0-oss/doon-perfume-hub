"use client";

import Image from 'next/image';
import Link from 'next/link';
import { Trash2, ArrowRight, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useState, useEffect } from 'react';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&q=80';
const GST_RATE = 0.18;

const roundToTwo = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export default function CartPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('cart');
    if (saved) {
      setItems(JSON.parse(saved));
    }
    setLoading(false);
  }, []);

  const updateQuantity = (id: string, size: string, delta: number) => {
    const newItems = items.map(item => {
      if (item.id === id && item.size === size) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    });
    setItems(newItems);
    localStorage.setItem('cart', JSON.stringify(newItems));
  };

  const removeItem = (id: string, size: string) => {
    const newItems = items.filter(item => !(item.id === id && item.size === size));
    setItems(newItems);
    localStorage.setItem('cart', JSON.stringify(newItems));
  };

  const subtotal = roundToTwo(items.reduce((acc, item) => acc + (Number(item.price) * Number(item.quantity)), 0));
  const gstAmount = roundToTwo(subtotal * GST_RATE);
  const grandTotal = roundToTwo(subtotal + gstAmount);

  if (loading) return null;

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-8">
            <ShoppingBag size={40} className="text-gray-300" />
        </div>
        <h1 className="text-4xl font-serif text-gray-900 mb-6 italic">Your Scent Bag is Empty</h1>
        <p className="text-gray-500 mb-10 max-w-md mx-auto leading-relaxed">
            Discovery awaits. Explore our collection of premium artisanal fragrances and find your signature scent.
        </p>
        <Link href="/products">
          <button className="bg-black text-white px-12 py-4 text-xs tracking-[0.2em] font-bold hover:bg-[var(--color-brand-primary)] transition-all duration-500 shadow-xl">
            START DISCOVERY
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-brand-bg)] min-h-screen pt-8 pb-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-12">
            <h1 className="text-4xl font-serif text-gray-900">Your Bag</h1>
            <span className="h-6 w-[1px] bg-gray-300"></span>
            <span className="text-xs font-bold tracking-[0.2em] text-gray-400 uppercase">{items.length} Elements</span>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-16">
          <div className="w-full lg:w-2/3 flex flex-col gap-8">
            {items.map((item, idx) => (
              <div key={`${item.id}-${item.size}-${idx}`} className="group flex gap-8 bg-white p-6 border border-gray-100 hover:shadow-md transition-all duration-500 relative">
                <Link href={`/products/${item.id}`} className="block relative w-32 h-44 md:w-40 md:h-52 flex-shrink-0 bg-gray-50 overflow-hidden">
                  <Image 
                    src={item.img || DEFAULT_IMAGE} 
                    alt={item.name} 
                    fill 
                    className="object-cover group-hover:scale-110 transition-transform duration-1000" 
                    unoptimized
                  />
                </Link>
                <div className="flex-1 flex flex-col justify-between py-2">
                  <div>
                    <div className="flex justify-between items-start mb-2">
                        <div className="space-y-1">
                            <p className="text-[10px] tracking-[0.2em] font-bold text-[var(--color-brand-primary)] uppercase">{item.category?.replace('-', ' ') || 'Fragrance'}</p>
                            <Link href={`/products/${item.id}`}>
                                <h3 className="font-serif text-2xl text-gray-900 group-hover:text-[var(--color-brand-primary)] transition-colors">{item.name}</h3>
                            </Link>
                        </div>
                        <button 
                          onClick={() => removeItem(item.id, item.size)} 
                          className="w-10 h-10 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all"
                        >
                           <Trash2 size={18} />
                        </button>
                    </div>
                    <p className="inline-block bg-gray-50 border border-gray-100 px-3 py-1 text-[10px] font-bold tracking-widest text-gray-400 uppercase mt-2">
                        SIZE: {item.size || 'Standard'}
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-end">
                    <div className="flex items-center border border-gray-200 h-10 w-28 bg-white">
                      <button 
                        className="w-8 h-full flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-50 transition-colors"
                        onClick={() => updateQuantity(item.id, item.size, -1)}
                      >-</button>
                      <input type="text" value={item.quantity} readOnly className="w-full text-center text-xs font-bold focus:outline-none bg-transparent" />
                      <button 
                        className="w-8 h-full flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-50 transition-colors"
                        onClick={() => updateQuantity(item.id, item.size, 1)}
                      >+</button>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-gray-400 mb-1">Unit: Rs. {Number(item.price).toLocaleString('en-IN')}</p>
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">GST: Rs. {roundToTwo(Number(item.price) * Number(item.quantity) * GST_RATE).toLocaleString('en-IN')}</p>
                        <span className="text-xl font-medium text-gray-900">Rs. {roundToTwo(Number(item.price) * Number(item.quantity) * (1 + GST_RATE)).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="mt-8">
                <Link href="/products" className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.2em] text-gray-400 hover:text-black transition-colors uppercase">
                    <ArrowRight size={14} className="rotate-180" /> Continue Exploring
                </Link>
            </div>
          </div>

          <div className="w-full lg:w-1/3">
            <div className="bg-white border border-gray-100 p-8 md:p-10 sticky top-28 shadow-sm">
              <h3 className="font-serif text-2xl mb-8 italic">Summary</h3>
              
              <div className="space-y-4 mb-8">
                <div className="flex justify-between text-sm text-gray-500">
                    <span className="tracking-widest uppercase text-[10px] font-bold">Subtotal</span>
                    <span className="font-medium">Rs. {subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                    <span className="tracking-widest uppercase text-[10px] font-bold">GST (18%)</span>
                    <span className="font-medium">Rs. {gstAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                    <span className="tracking-widest uppercase text-[10px] font-bold">Shipping (Delhivery)</span>
                    <span className="text-green-600 font-bold tracking-widest uppercase text-[10px]">FREE</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                    <span className="tracking-widest uppercase text-[10px] font-bold">Packaging</span>
                    <span className="text-green-600 font-bold tracking-widest uppercase text-[10px]">PREMIUM</span>
                </div>
              </div>
              
              <div className="border-t border-gray-100 pt-6 mb-8">
                <div className="flex justify-between items-baseline">
                    <span className="font-serif text-xl">Grand Total</span>
                    <span className="text-3xl font-medium text-[var(--color-brand-primary)]">Rs. {grandTotal.toLocaleString('en-IN')}</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 tracking-widest uppercase font-bold text-right">Taxes included at checkout</p>
              </div>
              
              <Link href="/checkout">
                <button className="w-full bg-black text-white h-16 flex items-center justify-center gap-4 text-xs font-bold tracking-[0.2em] hover:bg-[var(--color-brand-primary)] transition-all duration-500 shadow-2xl">
                    PROCEED TO CHECKOUT <ArrowRight size={18} />
                </button>
              </Link>

              <div className="mt-10 space-y-6">
                <div className="flex items-start gap-4 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                    <ShieldCheck size={18} className="text-[var(--color-brand-primary)] flex-shrink-0" />
                    <span>Secure multi-layer encryption</span>
                </div>
                <div className="bg-[var(--color-brand-soft)] p-4 rounded border border-[var(--color-brand-border)] text-[10px] text-[var(--color-brand-primary)] leading-relaxed uppercase tracking-wider font-bold">
                    Note: Complimentary sample included with orders above Rs. 5,000
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
