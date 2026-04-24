"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Star, Search, Phone, ShoppingBag } from 'lucide-react';
import { API_ROUTES } from '@/lib/api';
import MyAccountDropdown from '@/components/MyAccountDropdown';

interface Product {
  _id: string;
  name: string;
  images: string[];
  price: number;
  category: string;
}

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80';

export default function Home() {
  const [viralLaunches, setViralLaunches] = useState<Product[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const categories = [
    { name: 'New In', icon: 'https://cdn-icons-png.flaticon.com/512/3753/3753123.png', slug: '' },
    { name: 'Perfumes', icon: 'https://cdn-icons-png.flaticon.com/512/1005/1005141.png', slug: 'perfumes' },
    { name: 'Essential Oils', icon: 'https://cdn-icons-png.flaticon.com/512/2169/2169864.png', slug: 'essential-oils' },
    { name: 'Bottles', icon: 'https://cdn-icons-png.flaticon.com/512/3062/3062294.png', slug: 'bottles' },
    { name: 'General', icon: 'https://cdn-icons-png.flaticon.com/512/3753/3753123.png', slug: 'general' },
  ];

  useEffect(() => {
    const loadCartCount = () => {
      try {
        const rawCart = localStorage.getItem('cart');
        const parsed = rawCart ? JSON.parse(rawCart) : [];
        const count = Array.isArray(parsed)
          ? parsed.reduce((sum, item) => sum + (item.quantity || 0), 0)
          : 0;
        setCartCount(count);
      } catch {
        setCartCount(0);
      }
    };

    loadCartCount();
    window.addEventListener('storage', loadCartCount);

    return () => window.removeEventListener('storage', loadCartCount);
  }, []);

  useEffect(() => {
    const fetchViralProducts = async () => {
      try {
        const res = await fetch(API_ROUTES.PRODUCTS);
        if (!res.ok) throw new Error('API failed');
        const data = await res.json();
        const products = Array.isArray(data) ? data : [];
        setViralLaunches(products.slice(0, 4));
      } catch (err) {
        console.error('Failed to fetch viral products:', err);
        setViralLaunches([]);
      } finally {
        setLoading(false);
      }
    };
    fetchViralProducts();
  }, []);

  return (
    <div className="bg-[var(--color-brand-bg)]">
      <header className="sticky top-0 z-50 bg-[#fdfbf6]/95 backdrop-blur-md border-b border-[#e6e4dc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-20 flex items-center justify-between">
            <Link href="/" className="flex items-center">
              {!logoLoadError ? (
                <Image
                  src="/logo.png"
                  alt="Doon Perfume Hub"
                  width={220}
                  height={60}
                  className="h-12 w-auto object-contain"
                  priority
                  onError={() => setLogoLoadError(true)}
                />
              ) : (
                <span className="font-serif text-3xl text-[var(--color-brand-primary)] tracking-tight">
                  doonperfume
                </span>
              )}
            </Link>

            <nav className="flex items-center gap-6 text-sm font-medium tracking-wide text-gray-700">
              <Link href="/products" className="inline-flex items-center gap-2 hover:text-[var(--color-brand-primary)] transition-colors">
                <Search size={16} />
                <span>Search</span>
              </Link>
              <MyAccountDropdown />
              <a href="mailto:admin@doonperfumehub.com" className="inline-flex items-center gap-2 hover:text-[var(--color-brand-primary)] transition-colors">
                <Phone size={16} />
                <span>Contact Us</span>
              </a>
              <Link href="/cart" className="inline-flex items-center gap-2 hover:text-[var(--color-brand-primary)] transition-colors relative pr-2">
                <ShoppingBag size={16} />
                <span>Cart</span>
                <span className="absolute -top-2 -right-2 bg-[var(--color-brand-primary)] text-white text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section className="relative w-full h-[70vh] md:h-[90vh] bg-black flex items-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1615397587889-cbcedb5679ac?w=2000&q=80"
          alt="Hero Banner"
          fill
          className="object-cover object-center opacity-70 scale-105"
          priority
          unoptimized
        />
        <div className="absolute inset-0 bg-gradient-to-l from-black/60 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center items-end text-right px-8 md:px-24 z-10 max-w-7xl mx-auto">
          <p className="text-[#bda871] font-bold tracking-[0.3em] text-xs md:text-sm mb-4 animate-fade-in">PREMIUM FRAGRANCES</p>
          <h1 className="text-white font-serif text-5xl md:text-8xl mb-6 leading-tight drop-shadow-2xl">
            A Scent Full Of <br /><span className="italic text-[#f4ebd0]">Elegance</span>
          </h1>
          <p className="text-gray-300 max-w-md text-sm md:text-lg mb-10 leading-relaxed font-light">
            Indulge in artisanal scents crafted with heritage and purity. Our fragrances are designed to linger in memories.
          </p>
          <Link href="/products">
            <button className="group flex items-center gap-4 bg-[#bda871] text-white px-10 md:px-16 py-4 md:py-5 text-sm tracking-[0.2em] font-bold hover:bg-white hover:text-black transition-all duration-500 shadow-2xl">
              EXPLORE COLLECTION <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
            </button>
          </Link>
        </div>
      </section>

      {/* Category Nav Row - Jewelry Style */}
      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl md:text-3xl font-serif text-gray-800 mb-2">Shop By Category</h2>
            <p className="text-[10px] md:text-xs font-bold tracking-[0.3em] text-gray-400 uppercase">Premium Selection</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-5 gap-x-4 gap-y-10 md:gap-x-6 md:gap-y-12">
            {categories.map((cat, i) => (
              <Link href={`/products?category=${cat.slug}`} key={i} className="flex flex-col items-center group">
                <div className="w-full aspect-square rounded-2xl md:rounded-[40px] bg-[#fdf8f4] flex items-center justify-center mb-4 transition-all duration-500 group-hover:bg-[#f9eee4] group-hover:shadow-md group-hover:-translate-y-1">
                  <div className="w-10 h-10 md:w-16 md:h-16 relative opacity-70 group-hover:opacity-100 transition-opacity duration-500 transform group-hover:scale-110">
                    <Image 
                      src={cat.icon} 
                      alt={cat.name} 
                      fill 
                      className="object-contain p-2" 
                      unoptimized 
                    />
                  </div>
                </div>
                <span className="text-[10px] md:text-[12px] font-medium text-gray-400 text-center leading-tight group-hover:text-black transition-colors px-1">{cat.name}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Products Section */}
      <section className="py-20 md:py-32 max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-4">
            <div className="max-w-xl text-left">
                <h2 className="text-4xl md:text-6xl font-serif text-[#2c2c2c] mb-4">Latest Viral <br /><span className="italic text-[var(--color-brand-primary)]">Launches</span></h2>
                <p className="text-gray-500 text-sm md:text-base leading-relaxed font-light">The most loved scents of the season, now restocked and ready for you.</p>
            </div>
            <Link href="/products" className="text-xs font-bold tracking-widest text-black border-b-2 border-black pb-1 hover:text-[var(--color-brand-primary)] hover:border-[var(--color-brand-primary)] transition-all">
                VIEW ALL FRAGRANCES
            </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {loading ? (
            [...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse bg-gray-50 aspect-square rounded-lg" />
            ))
          ) : viralLaunches.map((item) => (
            <Link href={`/products/${item._id}`} key={item._id} className="group flex flex-col items-center">
              <div className="bg-white overflow-hidden mb-6 shadow-sm group-hover:shadow-xl transition-all duration-700 relative aspect-[4/5] w-full">
                 <Image 
                    src={item.images?.[0] || DEFAULT_IMAGE} 
                    alt={item.name} 
                    fill 
                    className="object-cover group-hover:scale-110 transition-transform duration-1000" 
                    unoptimized
                 />
                 <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/60 to-transparent translate-y-full group-hover:translate-y-0 transition-transform duration-500">
                    <button className="w-full bg-white text-black py-3 text-[10px] font-bold tracking-widest uppercase">Quick View</button>
                 </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-[10px] tracking-[0.3em] font-bold text-[var(--color-brand-primary)] uppercase">{item.category.replace('-', ' ')}</p>
                <h3 className="font-serif text-2xl text-gray-800">{item.name}</h3>
                <div className="flex items-center justify-center gap-1 text-gray-400">
                    <Star size={10} fill="currentColor" />
                    <Star size={10} fill="currentColor" />
                    <Star size={10} fill="currentColor" />
                    <Star size={10} fill="currentColor" />
                    <Star size={10} fill="currentColor" />
                    <span className="text-[10px] ml-1 tracking-widest font-bold">5.0</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Signature Banner Strip */}
      <section className="w-full bg-black py-24 relative overflow-hidden my-12 group">
         <Image 
            src="https://images.unsplash.com/photo-1547887537-6158d64c35e3?w=2000&q=80" 
            fill 
            className="object-cover opacity-50 grayscale group-hover:grayscale-0 group-hover:scale-105 transition-all duration-[2s]" 
            alt="Banner strip" 
            unoptimized
         />
         <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
            <h2 className="text-4xl md:text-7xl text-white font-serif italic mb-6 tracking-wide drop-shadow-2xl">The Simple Formula</h2>
            <p className="text-gray-300 max-w-lg text-sm md:text-base font-light italic leading-loose">
                "Fragrance is the first layer of personality. It's the invisible accessory that announces your arrival and delays your departure."
            </p>
            <div className="mt-8 h-12 w-[1px] bg-[#bda871]"></div>
         </div>
      </section>

      {/* Featured Collections */}
      <section className="py-20 md:py-32 max-w-7xl mx-auto px-4 md:px-8 bg-white">
         <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-serif mb-4">Artisanal Collections</h2>
            <p className="text-gray-400 text-sm font-light tracking-widest uppercase">The Essence of Tradition</p>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4">
            {[
              { name: 'Perfumes', img: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=800&q=80', slug: 'perfumes' },
              { name: 'Essential Oils', img: 'https://images.unsplash.com/photo-1627448839180-2647895400d3?w=800&q=80', slug: 'essential-oils' },
              { name: 'Glass Bottles', img: 'https://images.unsplash.com/photo-1547887537-6158d64c35e3?w=800&q=80', slug: 'bottles' },
            ].map((cat, i) => (
              <Link href={`/products?category=${cat.slug}`} key={i} className="group relative h-[500px] overflow-hidden flex items-end justify-center pb-12">
                 <Image src={cat.img} alt={cat.name} fill className="object-cover transition-transform duration-[3s] group-hover:scale-110" unoptimized />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-80" />
                 <div className="relative z-10 text-center px-4 transform group-hover:-translate-y-4 transition-transform duration-700">
                    <h3 className="font-serif text-4xl text-white mb-4 italic tracking-wide">{cat.name}</h3>
                    <span className="inline-block border border-white/40 text-white px-6 py-2 text-[10px] font-bold tracking-widest uppercase group-hover:bg-white group-hover:text-black transition-all">VIEW COLLECTION</span>
                 </div>
              </Link>
            ))}
         </div>
      </section>

    </div>
  );
}
