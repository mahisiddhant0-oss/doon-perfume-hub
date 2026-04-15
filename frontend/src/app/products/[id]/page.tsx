"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { API_ROUTES } from '@/lib/api';
import { useParams } from 'next/navigation';
import { Heart, Share2, Ruler, ShieldCheck, ShoppingCart, CheckCircle2 } from 'lucide-react';

interface Variant {
  label: string;
  price: number;
  stock: number;
  weight: number;
}

interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  images: string[];
  category: string;
  variants: Variant[];
  stock: number;
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80';

export default function ProductDetails() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [mainImage, setMainImage] = useState(DEFAULT_IMAGE);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_ROUTES.PRODUCTS}/${id}`);
        if (!res.ok) throw new Error('Product not found');
        const data: Product = await res.json();
        setProduct(data);
        if (data.images && data.images.length > 0) {
          setMainImage(data.images[0]);
        }
        if (data.variants && data.variants.length > 0) {
          setSelectedVariant(data.variants[0]);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchProduct();
  }, [id]);

  const handleAddToCart = () => {
    // 1. Get existing cart from localStorage or start fresh
    const existing = localStorage.getItem('cart');
    const cart = existing ? JSON.parse(existing) : [];
    
    // 2. Build current item
    const cartItem = {
      id: product?._id,
      name: product?.name,
      price: selectedVariant ? selectedVariant.price : product?.price,
      quantity,
      img: mainImage, // Changed 'image' to 'img' to match checkout expectations
      size: selectedVariant?.label, // Changed 'variant' to 'size'
      category: product?.category
    };

    // 3. Simple logic to prevent duplicates (or increment quantity)
    const existingIndex = cart.findIndex((item: any) => item.id === cartItem.id && item.size === cartItem.size);
    if (existingIndex > -1) {
      cart[existingIndex].quantity += quantity;
    } else {
      cart.push(cartItem);
    }

    // 4. Save back to localStorage
    localStorage.setItem('cart', JSON.stringify(cart));

    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 3000);
    
    console.log('Cart updated:', cart);
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-brand-primary)] mx-auto"></div>
      <p className="mt-4 text-gray-500 font-serif">Unveiling the essence...</p>
    </div>
  );

  if (error || !product) return (
    <div className="max-w-7xl mx-auto px-4 py-20 text-center">
      <h2 className="text-2xl font-serif text-red-500 mb-2">Oops!</h2>
      <p className="text-gray-500">{error || 'Product not found'}</p>
      <button className="mt-6 text-[var(--color-brand-primary)] underline" onClick={() => window.history.back()}>Go Back</button>
    </div>
  );

  const displayPrice = selectedVariant ? selectedVariant.price : product.price;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16">
      <div className="flex flex-col md:flex-row gap-12">
        
        {/* Left: Images */}
        <div className="w-full md:w-1/2 flex flex-col gap-4">
          <div className="aspect-[4/5] relative bg-gray-50 overflow-hidden w-full border border-gray-100">
            <Image 
              src={mainImage} 
              alt={product.name} 
              fill 
              className="object-cover" 
              priority 
              unoptimized
              onError={() => setMainImage(DEFAULT_IMAGE)}
            />
          </div>
          {product.images && product.images.length > 1 && (
            <div className="grid grid-cols-5 gap-3">
              {product.images.map((img, idx) => (
                <div 
                  key={idx} 
                  className={`aspect-square relative cursor-pointer border-2 transition-all ${mainImage === img ? 'border-[var(--color-brand-primary)]' : 'border-transparent hover:border-gray-200'}`}
                  onClick={() => setMainImage(img)}
                >
                   <Image src={img} alt={`${product.name} ${idx}`} fill className="object-cover" unoptimized />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Details */}
        <div className="w-full md:w-1/2 flex flex-col">
          <nav className="flex text-xs uppercase tracking-widest text-gray-400 mb-4 gap-2">
            <Link href="/" className="hover:text-black">Home</Link>
            <span>/</span>
            <Link href="/products" className="hover:text-black">Shop</Link>
            <span>/</span>
            <span className="text-gray-600">{product.name}</span>
          </nav>

          <h1 className="text-3xl md:text-5xl font-serif text-gray-900 mb-2 leading-tight">{product.name}</h1>
          <p className="text-xs uppercase tracking-widest text-[var(--color-brand-primary)] font-bold mb-4">{product.category.replace('-', ' ')}</p>
          
          <div className="flex items-center gap-4 mb-6">
            <span className="text-3xl font-medium text-gray-900">₹{displayPrice.toLocaleString('en-IN')}</span>
            {product.price > displayPrice && (
              <span className="text-gray-400 line-through">₹{product.price.toLocaleString('en-IN')}</span>
            )}
            <span className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-1 uppercase tracking-wider">In Stock</span>
          </div>

          <div className="text-gray-600 text-sm leading-relaxed mb-8 prose prose-slate max-w-none">
            {product.description}
          </div>

          {/* Variant Selection */}
          {product.variants && product.variants.length > 0 && (
            <div className="mb-8">
               <h3 className="text-xs font-bold text-gray-900 mb-3 uppercase tracking-widest">Select Size</h3>
               <div className="flex flex-wrap gap-3">
                  {product.variants.map((v) => (
                     <button 
                       key={v.label} 
                       onClick={() => setSelectedVariant(v)}
                       className={`px-6 py-2 border text-sm transition-all ${selectedVariant?.label === v.label 
                         ? 'border-[var(--color-brand-primary)] bg-[#fdfbf6] text-[var(--color-brand-primary)] font-semibold shadow-sm' 
                         : 'border-gray-200 text-gray-500 hover:border-gray-400'}`}
                     >
                        {v.label}
                     </button>
                  ))}
               </div>
            </div>
          )}

          {/* Quantity and Actions */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="flex items-center border border-gray-200 h-14 w-full sm:w-36 bg-white">
              <button 
                className="w-12 h-full flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-50 transition-colors"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
              >-</button>
              <input 
                type="text" 
                value={quantity} 
                readOnly 
                className="w-full text-center text-sm font-medium focus:outline-none bg-transparent" 
              />
              <button 
                className="w-12 h-full flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-50 transition-colors"
                onClick={() => setQuantity(quantity + 1)}
              >+</button>
            </div>
            
            <button 
              onClick={handleAddToCart}
              disabled={addedToCart}
              className={`flex-1 h-14 flex items-center justify-center gap-3 font-bold tracking-widest text-sm transition-all duration-300 ${
                addedToCart 
                ? 'bg-green-600 text-white' 
                : 'bg-black text-white hover:bg-gray-900 active:scale-[0.98]'
              }`}
            >
               {addedToCart ? <><CheckCircle2 size={20} /> ADDED TO CART</> : <><ShoppingCart size={18} strokeWidth={2} /> ADD TO CART</>}
            </button>
            
            <button className="w-14 h-14 flex items-center justify-center border border-gray-200 hover:border-red-200 hover:text-red-500 transition-all bg-white group">
               <Heart size={20} strokeWidth={1.5} className="group-hover:fill-red-500 group-hover:text-red-500 transition-colors" />
            </button>
          </div>

          <div className="flex items-center gap-6 mb-8 text-[11px] uppercase tracking-widest text-gray-400 font-bold">
            <button className="flex items-center gap-2 hover:text-black transition-colors"><Share2 size={14} /> Share</button>
            <button className="flex items-center gap-2 hover:text-black transition-colors"><Heart size={14} /> Add to Wishlist</button>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-[var(--color-brand-border)] py-6 mb-8 text-[11px] uppercase tracking-widest font-bold text-gray-500">
             <div className="flex items-center gap-3"><ShieldCheck size={20} className="text-[var(--color-brand-primary)]" /> 100% Authentic Scents</div>
             <div className="flex items-center gap-3"><CheckCircle2 size={20} className="text-[var(--color-brand-primary)]" /> Quality Guaranteed</div>
          </div>

          {/* Content Tabs */}
          <div className="border border-[var(--color-brand-border)] bg-white overflow-hidden">
            <div className="flex border-b border-[var(--color-brand-border)]">
              {['description', 'shipping', 'reviews'].map(tab => (
                <button 
                  key={tab}
                  className={`flex-1 py-4 px-2 text-[10px] md:text-xs uppercase tracking-widest font-bold transition-colors ${activeTab === tab ? 'bg-[#fdfbf6] text-[var(--color-brand-primary)]' : 'text-gray-400 hover:text-gray-600'}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
            <div className="p-6 text-sm text-gray-600 leading-relaxed min-h-[150px]">
              {activeTab === 'description' && (
                <div className="whitespace-pre-line font-serif text-lg leading-loose italic text-gray-800">
                  {product.description || "The exquisite heritage of Doon Perfume Hub is distilled into every drop of this fragrance. A story of elegance told through scent."}
                </div>
              )}
              {activeTab === 'shipping' && (
                <div className="space-y-4">
                  <p>📦 <strong>Fast Delivery:</strong> Dispatch within 24-48 hours. Delivered in 3-5 business days across India.</p>
                  <p>🚚 <strong>Logistics Partner:</strong> All shipments are handled by Delhivery for secure and reliable delivery.</p>
                  <p>🛡️ <strong>Safety:</strong> Tamper-proof luxury packaging to ensure your fragrance reaches you in perfect condition.</p>
                </div>
              )}
              {activeTab === 'reviews' && (
                <div className="text-center py-4 italic text-gray-400">
                  Select fragments of customer appreciation will appear here soon.
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
