"use client";

import Image from 'next/image';
import Link from 'next/link';
import { Suspense, useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { SlidersHorizontal, Search, ShoppingBag, X } from 'lucide-react';
import { API_ROUTES } from '@/lib/api';
import MyAccountDropdown from '@/components/MyAccountDropdown';

interface Variant {
  label: string;
  price: number;
  stock?: number;
}

interface Product {
  _id: string;
  name: string;
  price: number;
  stock?: number;
  images: string[];
  category: string;
  categories?: string[];
  description: string;
  variants: Variant[];
  isActive: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  weightKg?: number;
  quantity: number;
  img?: string;
  size?: string;
  category?: string;
}
type CategoryPayload = string | { value?: string };

const DEFAULT_CATEGORY_OPTIONS = [
  { label: 'Perfumes', value: 'perfumes' },
  { label: 'Essential Oils', value: 'essential-oils' },
  { label: 'Bottles', value: 'bottles' },
];
const EXCLUDED_CATEGORY_VALUES = new Set(['attars', 'ouds', 'general']);
const HIDDEN_FILTER_CATEGORY_VALUES = new Set(['all']);

const MAX_SEARCH_INPUT_LENGTH = 2000;
const MAX_SEARCH_QUERY_LENGTH = 120;

const normalizeSearchKeyword = (value = '') => value.trim().slice(0, MAX_SEARCH_QUERY_LENGTH);

// Placeholder image if product has no image or Wix CDN URL
const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=400&q=80';

const normalizeCategoryValuesFromPayload = (payload: unknown): string[] => {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((entry) =>
      typeof entry === 'string'
        ? entry
        : typeof entry === 'object' && entry && 'value' in entry
          ? String((entry as { value?: string }).value || '')
          : ''
    )
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter((entry) => entry.length > 0 && !EXCLUDED_CATEGORY_VALUES.has(entry));
};

function getProductImage(product: Product): string {
  if (product.images && product.images.length > 0) {
    // Wix CDN images won't load directly, use a fallback
    const img = product.images[0];
    if (img.startsWith('http')) return img;
  }
  return DEFAULT_IMAGE;
}

function getPrimaryCategory(product: Product): string {
  if (Array.isArray(product.categories) && product.categories.length > 0) {
    const firstCategory = String(product.categories[0] || '').trim();
    if (firstCategory) return firstCategory;
  }
  return String(product.category || 'perfumes');
}

function getProductCategories(product: Product): string[] {
  const rawCategories =
    Array.isArray(product.categories) && product.categories.length > 0
      ? product.categories
      : [product.category];

  return rawCategories
    .map((entry) => String(entry || '').trim())
    .filter((entry) => entry.length > 0);
}
function getIsProductOutOfStock(product: Product): boolean {
  const variantHasStock = Array.isArray(product.variants)
    ? product.variants.some((variant) => Number(variant.stock || 0) > 0)
    : false;
  const baseHasStock = Number(product.stock || 0) > 0;
  return !(variantHasStock || baseHasStock);
}

function formatCategoryLabel(value: string) {
  const knownLabels: Record<string, string> = {
    perfumes: 'Perfumes',
    'essential-oils': 'Essential Oils',
    bottles: 'Bottles',
  };

  const normalized = String(value || '').trim();
  if (!normalized) return 'Perfumes';
  if (knownLabels[normalized.toLowerCase()]) {
    return knownLabels[normalized.toLowerCase()];
  }

  return normalized
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ProductsPageContent() {
  const searchParams = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categorySourceProducts, setCategorySourceProducts] = useState<Product[]>([]);
  const [backendCategories, setBackendCategories] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [priceFilter, setPriceFilter] = useState('');
  const safeSearchKeyword = normalizeSearchKeyword(search);
  const categoryOptions = useMemo(() => {
    const map = new Map<string, { label: string; value: string }>();

    for (const entry of DEFAULT_CATEGORY_OPTIONS) {
      map.set(entry.value.toLowerCase(), entry);
    }

    for (const product of categorySourceProducts) {
      for (const value of getProductCategories(product)) {
        if (!value) continue;
        const key = value.toLowerCase();
        if (EXCLUDED_CATEGORY_VALUES.has(key) || HIDDEN_FILTER_CATEGORY_VALUES.has(key)) continue;
        if (!map.has(key)) {
          map.set(key, {
            value,
            label: formatCategoryLabel(value),
          });
        }
      }
    }

    for (const value of backendCategories) {
      if (!value) continue;
      const key = value.toLowerCase();
      if (EXCLUDED_CATEGORY_VALUES.has(key) || HIDDEN_FILTER_CATEGORY_VALUES.has(key)) continue;
      if (!map.has(key)) {
        map.set(key, {
          value,
          label: formatCategoryLabel(value),
        });
      }
    }

    return [{ label: 'All', value: '' }, ...Array.from(map.values())];
  }, [categorySourceProducts, backendCategories]);

  useEffect(() => {
    const categoryFromUrl = searchParams.get('category') || '';
    const keywordFromUrl = searchParams.get('keyword') || '';

    setSelectedCategory(EXCLUDED_CATEGORY_VALUES.has(categoryFromUrl.toLowerCase()) ? '' : categoryFromUrl);
    setSearch(keywordFromUrl.slice(0, MAX_SEARCH_INPUT_LENGTH));
  }, [searchParams]);

  useEffect(() => {
    const loadCart = () => {
      try {
        const rawCart = localStorage.getItem('cart');
        const parsed = rawCart ? JSON.parse(rawCart) : [];
        setCartItems(Array.isArray(parsed) ? parsed : []);
      } catch {
        setCartItems([]);
      }
    };

    loadCart();
    window.addEventListener('storage', loadCart);

    return () => {
      window.removeEventListener('storage', loadCart);
    };
  }, []);

  useEffect(() => {
    const fetchBackendCategories = async () => {
      try {
        const separator = API_ROUTES.PRODUCT_CATEGORIES.includes('?') ? '&' : '?';
        const res = await fetch(`${API_ROUTES.PRODUCT_CATEGORIES}${separator}_ts=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const payload = await res.json();
        const normalized = normalizeCategoryValuesFromPayload(payload);
        setBackendCategories(Array.from(new Set(normalized)));
      } catch {
        // Use product-derived category fallback.
      }
    };
    fetchBackendCategories();
  }, []);

  useEffect(() => {
    const fetchCategorySourceProducts = async () => {
      try {
        const separator = API_ROUTES.PRODUCTS.includes('?') ? '&' : '?';
        const res = await fetch(`${API_ROUTES.PRODUCTS}${separator}_ts=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const payload = await res.json();
        const data: Product[] = Array.isArray(payload) ? payload : [];
        setCategorySourceProducts(data);
      } catch {
        // Keep default categories only if this fails.
      }
    };

    fetchCategorySourceProducts();
  }, []);

  useEffect(() => {
    const fetchProducts = async () => {
      setLoading(true);
      setError('');
      try {
        let url = API_ROUTES.PRODUCTS;
        const params = new URLSearchParams();
        if (selectedCategory) params.append('category', selectedCategory);
        if (safeSearchKeyword) params.append('keyword', safeSearchKeyword);
        if (params.toString()) url += `?${params.toString()}`;

        // Retry transient fetch failures a few times to improve reliability in local dev.
        let lastError: Error | null = null;
        let payload: unknown = [];

        for (let attempt = 1; attempt <= 3; attempt += 1) {
          try {
            const res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) throw new Error(`Failed to fetch products (${res.status})`);
            payload = await res.json();
            lastError = null;
            break;
          } catch (attemptError: any) {
            lastError = attemptError instanceof Error ? attemptError : new Error('Failed to fetch products');
            if (attempt < 3) {
              await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
            }
          }
        }

        if (lastError) {
          throw lastError;
        }

        const data: Product[] = Array.isArray(payload) ? payload : [];

        // Apply price filter client-side
        let filtered = data;
        if (priceFilter === 'under2000') filtered = data.filter(p => p.price < 2000);
        else if (priceFilter === '2000-5000') filtered = data.filter(p => p.price >= 2000 && p.price <= 5000);
        else if (priceFilter === 'above5000') filtered = data.filter(p => p.price > 5000);

        setProducts(filtered);
        if (categorySourceProducts.length === 0) {
          setCategorySourceProducts(data);
        }
      } catch (err: any) {
        setError(err?.message || 'Something went wrong');
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategory, safeSearchKeyword, priceFilter, categorySourceProducts.length]);

  const cartCount = cartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const cartSubtotal = cartItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);

  const handleRemoveCartItem = (item: CartItem) => {
    const updatedCart = cartItems.filter((existing) => !(existing.id === item.id && existing.size === item.size));
    setCartItems(updatedCart);
    localStorage.setItem('cart', JSON.stringify(updatedCart));
  };

  return (
    <div>
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[var(--color-brand-border)]">
        <div className="bg-[var(--color-brand-primary)] text-white text-xs text-center py-2 font-medium tracking-wide">
          EXTRA 5% OFF | USE CODE: SCENTOFDOON | STORE LOCATOR
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <Link href="/" className="flex items-center">
              <Image
                src="/DPH_LOGO.avif"
                alt="Doon Perfume Hub"
                width={160}
                height={60}
                className="h-10 w-auto object-contain"
                priority
              />
            </Link>

            <nav className="hidden md:flex space-x-8 text-sm font-medium tracking-wider text-gray-700">
              <Link href="/products" className="hover:text-[var(--color-brand-primary)] transition-colors">ALL</Link>
              <Link href="/products?category=perfumes" className="hover:text-[var(--color-brand-primary)] transition-colors">PERFUMES</Link>
              <Link href="/products?category=essential-oils" className="hover:text-[var(--color-brand-primary)] transition-colors">ESSENTIAL OILS</Link>
              <Link href="/products?category=bottles" className="hover:text-[var(--color-brand-primary)] transition-colors">BOTTLES</Link>
            </nav>

            <div className="flex items-center gap-6">
              <div className="hidden sm:block">
                <MyAccountDropdown />
              </div>
              <div className="sm:hidden">
                <MyAccountDropdown compact />
              </div>
              <div className="relative group">
              <Link href="/cart" className="hover:text-[var(--color-brand-primary)] relative text-gray-700">
                <ShoppingBag size={22} strokeWidth={1.5} />
                <span className="absolute -top-2 -right-2 bg-[var(--color-brand-primary)] text-white text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              </Link>

              <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 absolute right-0 mt-3 w-96 max-h-[420px] overflow-y-auto bg-white border border-[var(--color-brand-border)] shadow-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-serif text-xl text-gray-900">Your Cart</h3>
                  <span className="text-xs tracking-widest uppercase text-gray-400">{cartCount} Items</span>
                </div>

                {cartItems.length === 0 ? (
                  <p className="text-sm text-gray-500 py-6 text-center">Your cart is empty.</p>
                ) : (
                  <>
                    <div className="space-y-4">
                      {cartItems.map((item, index) => (
                        <div key={`${item.id}-${item.size || 'default'}-${index}`} className="flex gap-3 pb-4 border-b border-gray-100">
                          <div className="relative w-16 h-20 bg-gray-50 border border-gray-100 flex-shrink-0">
                            <Image
                              src={item.img || DEFAULT_IMAGE}
                              alt={item.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] uppercase tracking-widest text-gray-400">{item.category?.replace('-', ' ') || 'fragrance'}</p>
                            <h4 className="font-serif text-base text-gray-900 truncate">{item.name}</h4>
                            <p className="text-xs text-gray-500 mt-1">
                              Qty: {item.quantity} {item.size ? `• ${item.size}` : ''}
                            </p>
                            <p className="text-sm font-semibold text-gray-800 mt-1">Rs. {(item.price * item.quantity).toLocaleString('en-IN')}</p>
                          </div>
                          <button
                            onClick={() => handleRemoveCartItem(item)}
                            className="text-gray-300 hover:text-red-500 transition-colors self-start"
                            aria-label={`Remove ${item.name}`}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="pt-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-xs uppercase tracking-widest text-gray-500">Subtotal</span>
                        <span className="font-semibold text-gray-900">Rs. {cartSubtotal.toLocaleString('en-IN')}</span>
                      </div>
                      <Link href="/cart" className="block w-full text-center border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] py-2 text-xs tracking-widest font-semibold hover:bg-[var(--color-brand-primary)] hover:text-white transition-colors">
                        VIEW CART
                      </Link>
                    </div>
                  </>
                )}
              </div>
              </div>
            </div>
          </div>
        </div>
      </header>

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
          onChange={(e) => setSearch(e.target.value.slice(0, MAX_SEARCH_INPUT_LENGTH))}
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
              {categoryOptions.map(cat => (
                <li key={cat.value}>
                  <button
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`w-full text-left px-2 py-1 rounded transition-colors ${
                      selectedCategory === cat.value
                        ? 'text-[var(--color-brand-primary)] font-semibold bg-[var(--color-brand-soft)]'
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
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {products.map((product) => {
                  const isOutOfStock = getIsProductOutOfStock(product);
                  const cardClassName = `group flex flex-col bg-white overflow-hidden shadow-sm transition-shadow ${
                    isOutOfStock ? "opacity-95 cursor-not-allowed" : "hover:shadow-md"
                  }`;
                  const cardContent = (
                    <>
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
                      {isOutOfStock && (
                        <div className="absolute top-3 right-3 z-10 bg-red-600 text-white text-[10px] uppercase font-bold tracking-wider px-2 py-1">
                          Out of Stock
                        </div>
                      )}
                    </div>
                    <div className="p-3 sm:p-5 text-center flex flex-col flex-grow">
                      <span className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">
                        {getPrimaryCategory(product).replace('-', ' ')}
                      </span>
                      <h3 className="font-serif text-sm sm:text-base text-gray-900 mb-2 leading-snug">{product.name}</h3>
                      <p className="text-gray-700 font-medium mb-4">
                        {product.variants.length > 0
                          ? `From ₹${Math.min(...product.variants.map(v => v.price)).toLocaleString('en-IN')}`
                          : `₹${product.price.toLocaleString('en-IN')}`}
                      </p>
                      <div className="mt-auto">
                        {isOutOfStock ? (
                          <span className="block w-full border border-gray-300 bg-gray-200 text-gray-600 py-2 text-xs tracking-widest font-semibold cursor-not-allowed">
                            OUT OF STOCK
                          </span>
                        ) : (
                          <span className="block w-full border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] py-2 text-xs tracking-widest font-semibold group-hover:bg-[var(--color-brand-primary)] group-hover:text-white transition-colors duration-300">
                            VIEW PRODUCT
                          </span>
                        )}
                      </div>
                    </div>
                    </>
                  );

                  if (isOutOfStock) {
                    return (
                      <div key={product._id} className={cardClassName}>
                        {cardContent}
                      </div>
                    );
                  }

                  return (
                    <Link key={product._id} href={`/products/${product._id}`} className={cardClassName}>
                      {cardContent}
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--color-brand-bg)]" />}>
      <ProductsPageContent />
    </Suspense>
  );
}
