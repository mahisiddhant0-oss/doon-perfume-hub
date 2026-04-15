"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { SlidersHorizontal, Search } from 'lucide-react';
import { API_ROUTES } from '@/lib/api';

interface Variant {
  label: string;
  price: number;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  images: string[];
  category: string;
  description: string;
  variants: Variant[];
  isActive: boolean;
}

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'Perfumes', value: 'perfumes' },
  { label: 'Essential Oils', value: 'essential-oils' },
  { label: 'Bottles', value: 'bottles' },
  { label: 'Coloured Bottles', value: 'coloured-bottles' },
  { label: 'General', value: 'general' },
];

// Placeholder image if product has no image or Wix CDN URL
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&q=80';

function getProductImage(product: Product): string {
  if (product.images && product.images.length > 0) {
    // Wix CDN images won't load directly, use a fallback
    const img = product.images[0];
    if (img.startsWith('http')) return img;
  }
  return DEFAULT_IMAGE;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [priceFilter, setPriceFilter] = useState('');

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      try {
        let url = API_ROUTES.PRODUCTS;
        const params = new URLSearchParams();
        if (selectedCategory) params.append('category', selectedCategory);
        if (search) params.append('keyword', search);
        if (params.toString()) url += `?${params.toString()}`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to fetch products');
        const data: Product[] = await res.json();

        // Apply price filter client-side
        let filtered = data;
        if (priceFilter === 'under2000') filtered = data.filter(p => p.price < 2000);
        else if (priceFilter === '2000-5000') filtered = data.filter(p => p.price >= 2000 && p.price <= 5000);
        else if (priceFilter === 'above5000') filtered = data.filter(p => p.price > 5000);

        setProducts(filtered);
      } catch (err: any) {
        setError(err.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategory, search, priceFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">

      {/* Page Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-serif text-[var(--color-brand-text)] mb-3">All Fragrances</h1>
        <p className="text-gray-500 max-w-2xl mx-auto text-sm">
          Discover our curated collection of signature scents, crafted to evoke memories and leave a lasting impression.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-xl mx-auto mb-10">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          type="text"
          placeholder="Search fragrances..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full border border-gray-200 pl-11 pr-4 py-3 text-sm focus:outline-none focus:border-[var(--color-brand-primary)] bg-white"
        />
      </div>

      <div className="flex flex-col md:flex-row gap-8">

        {/* Sidebar Filters */}
        <div className="w-full md:w-56 flex-shrink-0">
          <div className="sticky top-28 border border-[var(--color-brand-border)] p-6 bg-white">
            <h3 className="font-serif text-lg mb-4 border-b pb-2 flex items-center gap-2">
              <SlidersHorizontal size={16} /> Filters
            </h3>

            <h4 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">Category</h4>
            <ul className="space-y-2 mb-6 text-sm text-gray-600">
              {CATEGORIES.map(cat => (
                <li key={cat.value}>
                  <button
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`w-full text-left px-2 py-1 rounded transition-colors ${
                      selectedCategory === cat.value
                        ? 'text-[var(--color-brand-primary)] font-semibold bg-[#faf6ef]'
                        : 'hover:text-[var(--color-brand-primary)]'
                    }`}
                  >
                    {cat.label}
                  </button>
                </li>
              ))}
            </ul>

            <h4 className="text-xs font-bold tracking-widest text-gray-500 uppercase mb-3">Price Range</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              {[
                { label: 'All Prices', value: '' },
                { label: 'Under ₹2,000', value: 'under2000' },
                { label: '₹2,000 – ₹5,000', value: '2000-5000' },
                { label: 'Above ₹5,000', value: 'above5000' },
              ].map(opt => (
                <li key={opt.value}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="price"
                      checked={priceFilter === opt.value}
                      onChange={() => setPriceFilter(opt.value)}
                      className="accent-[var(--color-brand-primary)]"
                    />
                    {opt.label}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1">
          {loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="bg-white animate-pulse">
                  <div className="aspect-[4/5] bg-gray-200" />
                  <div className="p-5 space-y-2">
                    <div className="h-5 bg-gray-200 rounded w-3/4 mx-auto" />
                    <div className="h-4 bg-gray-100 rounded w-1/2 mx-auto" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="text-center py-20">
              <p className="text-red-500 mb-2">{error}</p>
              <p className="text-sm text-gray-400">Make sure the backend server is running on port 5000</p>
            </div>
          )}

          {!loading && !error && products.length === 0 && (
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg">No products found.</p>
              <p className="text-sm mt-1">Try adjusting your filters.</p>
            </div>
          )}

          {!loading && !error && products.length > 0 && (
            <>
              <p className="text-sm text-gray-400 mb-6">{products.length} products found</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {products.map((product) => (
                  <Link
                    href={`/products/${product._id}`}
                    key={product._id}
                    className="group flex flex-col bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="relative aspect-[4/5] bg-gray-50 overflow-hidden">
                      <Image
                        src={getProductImage(product)}
                        alt={product.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_IMAGE;
                        }}
                        unoptimized
                      />
                      {product.variants.length > 0 && (
                        <div className="absolute top-3 left-3 z-10 bg-[var(--color-brand-primary)] text-white text-[10px] uppercase font-bold tracking-wider px-2 py-1">
                          {product.variants.length} sizes
                        </div>
                      )}
                    </div>
                    <div className="p-5 text-center flex flex-col flex-grow">
                      <span className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">{product.category.replace('-', ' ')}</span>
                      <h3 className="font-serif text-base text-gray-900 mb-2 leading-snug">{product.name}</h3>
                      <p className="text-gray-700 font-medium mb-4">
                        {product.variants.length > 0
                          ? `From ₹${Math.min(...product.variants.map(v => v.price)).toLocaleString('en-IN')}`
                          : `₹${product.price.toLocaleString('en-IN')}`}
                      </p>
                      <div className="mt-auto">
                        <span className="block w-full border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] py-2 text-xs tracking-widest font-semibold group-hover:bg-[var(--color-brand-primary)] group-hover:text-white transition-colors duration-300">
                          VIEW PRODUCT
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
