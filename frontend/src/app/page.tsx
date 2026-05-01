"use client";

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ChevronLeft, ChevronRight, Star, Search, Phone, ShoppingBag } from 'lucide-react';
import { API_ROUTES } from '@/lib/api';
import MyAccountDropdown from '@/components/MyAccountDropdown';

interface Product {
  _id: string;
  name: string;
  images: string[];
  price: number;
  category: string;
  categories?: string[];
}
type CategoryMeta = {
  _id?: string;
  value: string;
  name?: string;
  description?: string;
  image?: string;
};

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80';
const EXCLUDED_CATEGORY_VALUES = new Set(['attars', 'ouds']);
const HIDDEN_FRONTEND_CATEGORY_VALUES = new Set(['general', 'all']);
const DEFAULT_CATEGORY_VALUES = ['perfumes', 'essential-oils', 'bottles'];
const LOCAL_CUSTOM_CATEGORIES_KEY = 'dph_custom_categories';
const CATEGORY_ICON_MAP: Record<string, string> = {
  all: 'https://cdn-icons-png.flaticon.com/512/3753/3753123.png',
  general: 'https://cdn-icons-png.flaticon.com/512/3753/3753123.png',
  perfumes: 'https://cdn-icons-png.flaticon.com/512/1005/1005141.png',
  'essential-oils': 'https://cdn-icons-png.flaticon.com/512/2169/2169864.png',
  bottles: 'https://cdn-icons-png.flaticon.com/512/3062/3062294.png',
};

const getPrimaryCategory = (product: Product) => {
  if (Array.isArray(product.categories) && product.categories.length > 0) {
    const first = String(product.categories[0] || '').trim();
    if (first) return first;
  }
  return String(product.category || 'general');
};

const getProductCategories = (product: Product) => {
  const raw =
    Array.isArray(product.categories) && product.categories.length > 0
      ? product.categories
      : [product.category];
  return raw.map((entry) => String(entry || '').trim()).filter(Boolean);
};

const formatCategoryLabel = (value: string) =>
  String(value || 'general')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
const normalizeDisplayLabel = (value: string) =>
  formatCategoryLabel(String(value || '').toLowerCase());

export default function Home() {
  const router = useRouter();
  const [viralLaunches, setViralLaunches] = useState<Product[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [backendCategories, setBackendCategories] = useState<string[]>([]);
  const [categoryMetaMap, setCategoryMetaMap] = useState<Record<string, CategoryMeta>>({});
  const [storedCustomCategories, setStoredCustomCategories] = useState<string[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [mobileSearchKeyword, setMobileSearchKeyword] = useState('');
  const [desktopSearchKeyword, setDesktopSearchKeyword] = useState('');
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const desktopCategorySliderRef = useRef<HTMLDivElement | null>(null);
  const mobileCategorySliderRef = useRef<HTMLDivElement | null>(null);
  const heroSlides = [
    {
      kicker: 'PREMIUM FRAGRANCES',
      titleTop: 'A Scent Full Of',
      titleAccent: 'Elegance',
      description:
        'Indulge in artisanal scents crafted with heritage and purity. Our fragrances are designed to linger in memories.',
      image: '/hero-slide-1.png',
      cta: 'EXPLORE COLLECTION',
      href: '/products',
    },
    {
      kicker: 'PERFUME COLLECTION',
      titleTop: 'Signature',
      titleAccent: 'Perfumes',
      description:
        'From fresh daytime notes to bold evening blends, discover perfumes made to match every mood and moment.',
      image: 'https://images.unsplash.com/photo-1594035910387-fea47794261f?w=2000&q=80',
      cta: 'SHOP PERFUMES',
      href: '/products?category=perfumes',
    },
    {
      kicker: 'ESSENTIAL OILS',
      titleTop: 'Pure Drops Of',
      titleAccent: 'Wellness',
      description:
        'Explore concentrated essential oils selected for aroma, quality, and consistency in every single drop.',
      image: 'https://images.unsplash.com/photo-1611078489935-0cb964de46d6?w=2000&q=80',
      cta: 'SHOP ESSENTIAL OILS',
      href: '/products?category=essential-oils',
    },
    {
      kicker: 'BOTTLE STUDIO',
      titleTop: 'Crafted Glass For',
      titleAccent: 'Luxury',
      description:
        'Find premium perfume bottles that elevate presentation with elegant shapes, sturdy build, and timeless style.',
      image: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=2000&q=80',
      cta: 'SHOP BOTTLES',
      href: '/products?category=bottles',
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveHeroSlide((prev) => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  const categories = useMemo(() => {
    const map = new Map<string, { name: string; icon: string; slug: string; hasCustomImage: boolean }>();

    for (const categoryValue of DEFAULT_CATEGORY_VALUES) {
      const meta = categoryMetaMap[categoryValue];
      map.set(categoryValue, {
        slug: categoryValue,
        name: normalizeDisplayLabel(meta?.name || categoryValue),
        icon: meta?.image || CATEGORY_ICON_MAP[categoryValue] || CATEGORY_ICON_MAP.general,
        hasCustomImage: Boolean(meta?.image),
      });
    }

    for (const product of allProducts) {
      for (const categoryValue of getProductCategories(product)) {
        const normalized = categoryValue.toLowerCase();
        if (!normalized || EXCLUDED_CATEGORY_VALUES.has(normalized) || HIDDEN_FRONTEND_CATEGORY_VALUES.has(normalized)) continue;
        if (!map.has(normalized)) {
          const meta = categoryMetaMap[normalized];
          map.set(normalized, {
            slug: categoryValue,
            name: normalizeDisplayLabel(meta?.name || categoryValue),
            icon: meta?.image || CATEGORY_ICON_MAP[normalized] || CATEGORY_ICON_MAP.general,
            hasCustomImage: Boolean(meta?.image),
          });
        }
      }
    }

    for (const categoryValue of [...backendCategories, ...storedCustomCategories]) {
      const normalized = String(categoryValue || '').trim().toLowerCase();
      if (!normalized || EXCLUDED_CATEGORY_VALUES.has(normalized) || HIDDEN_FRONTEND_CATEGORY_VALUES.has(normalized)) continue;
      if (!map.has(normalized)) {
        const meta = categoryMetaMap[normalized];
        map.set(normalized, {
          slug: categoryValue,
          name: normalizeDisplayLabel(meta?.name || categoryValue),
          icon: meta?.image || CATEGORY_ICON_MAP[normalized] || CATEGORY_ICON_MAP.general,
          hasCustomImage: Boolean(meta?.image),
        });
      }
    }

    return [
      { name: 'All', icon: CATEGORY_ICON_MAP.all, slug: '', hasCustomImage: false },
      ...Array.from(map.values()),
    ];
  }, [allProducts, backendCategories, storedCustomCategories, categoryMetaMap]);

  const categoryColumns = useMemo(() => {
    const columns: Array<Array<(typeof categories)[number] | null>> = [];
    for (let index = 0; index < categories.length; index += 2) {
      const top = categories[index] || null;
      const bottom = categories[index + 1] || null;
      columns.push([top, bottom]);
    }
    return columns;
  }, [categories]);

  const handleCategoryRailMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const rail = event.currentTarget;
    rail.dataset.dragging = 'true';
    rail.dataset.startX = String(event.pageX - rail.offsetLeft);
    rail.dataset.scrollLeft = String(rail.scrollLeft);
  };

  const handleCategoryRailMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rail = event.currentTarget;
    if (rail.dataset.dragging !== 'true') return;
    event.preventDefault();
    const startX = Number(rail.dataset.startX || 0);
    const initialScrollLeft = Number(rail.dataset.scrollLeft || 0);
    const currentX = event.pageX - rail.offsetLeft;
    const walk = currentX - startX;
    rail.scrollLeft = initialScrollLeft - walk;
  };

  const handleCategoryRailMouseUp = (event: React.MouseEvent<HTMLDivElement>) => {
    event.currentTarget.dataset.dragging = 'false';
  };

  const handleMobileSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const keyword = mobileSearchKeyword.trim();
    const target = keyword ? `/products?keyword=${encodeURIComponent(keyword)}` : '/products';
    router.push(target);
  };

  const handleDesktopSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const keyword = desktopSearchKeyword.trim();
    const target = keyword ? `/products?keyword=${encodeURIComponent(keyword)}` : '/products';
    router.push(target);
  };

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
    const loadStoredCustomCategories = () => {
      try {
        const raw = window.localStorage.getItem(LOCAL_CUSTOM_CATEGORIES_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        const normalized = Array.isArray(parsed)
          ? parsed
              .map((entry) => String(entry || '').trim().toLowerCase())
              .filter((entry) => entry.length > 0 && !EXCLUDED_CATEGORY_VALUES.has(entry))
          : [];
        setStoredCustomCategories(Array.from(new Set(normalized)));
      } catch {
        setStoredCustomCategories([]);
      }
    };

    loadStoredCustomCategories();
    window.addEventListener('storage', loadStoredCustomCategories);
    window.addEventListener('focus', loadStoredCustomCategories);

    return () => {
      window.removeEventListener('storage', loadStoredCustomCategories);
      window.removeEventListener('focus', loadStoredCustomCategories);
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
        const entries = Array.isArray(payload) ? payload : [];
        const normalized = entries
          .map((entry) => (typeof entry === 'string' ? entry : String(entry?.value || '')))
          .map((entry) => String(entry || '').trim().toLowerCase())
          .filter((entry) => entry.length > 0 && !EXCLUDED_CATEGORY_VALUES.has(entry) && !HIDDEN_FRONTEND_CATEGORY_VALUES.has(entry));
        setBackendCategories(Array.from(new Set(normalized)));
        const metaMap: Record<string, CategoryMeta> = {};
        entries.forEach((entry) => {
          if (!entry || typeof entry === 'string') return;
          const value = String(entry.value || '').trim().toLowerCase();
          if (!value || EXCLUDED_CATEGORY_VALUES.has(value) || HIDDEN_FRONTEND_CATEGORY_VALUES.has(value)) return;
          metaMap[value] = {
            _id: entry._id,
            value,
            name: entry.name || formatCategoryLabel(value),
            description: entry.description || '',
            image: entry.image || '',
          };
        });
        setCategoryMetaMap(metaMap);
      } catch {
        // Fallback to product-derived categories only.
      }
    };
    fetchBackendCategories();
  }, []);

  useEffect(() => {
    const fetchViralProducts = async () => {
      try {
        const separator = API_ROUTES.PRODUCTS.includes('?') ? '&' : '?';
        const res = await fetch(`${API_ROUTES.PRODUCTS}${separator}_ts=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('API failed');
        const data = await res.json();
        const products = Array.isArray(data) ? data : [];
        setAllProducts(products);
        setViralLaunches(products.slice(0, 4));
      } catch (err) {
        console.error('Failed to fetch viral products:', err);
        setAllProducts([]);
        setViralLaunches([]);
      } finally {
        setLoading(false);
      }
    };
    fetchViralProducts();
  }, []);

  return (
    <div className="bg-[var(--color-brand-bg)] overflow-x-hidden">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[var(--color-brand-border)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative h-16 md:h-20 flex items-center justify-between gap-2">
            <Link href="/" className="flex items-center">
              <Image
                src="/DPH_LOGO.avif"
                alt="Doon Perfume Hub"
                width={220}
                height={60}
                className="h-10 md:h-12 w-auto object-contain"
                priority
              />
            </Link>

            <div className="hidden md:block absolute left-1/2 -translate-x-1/2 w-[39%] min-w-[360px] max-w-[520px]">
              <form onSubmit={handleDesktopSearchSubmit} className="relative group">
                <input
                  type="text"
                  value={desktopSearchKeyword}
                  onChange={(event) => setDesktopSearchKeyword(event.target.value)}
                  placeholder="Search perfumes, oils, bottles..."
                  className="w-full h-12 rounded-xl border border-[#d6dbe5] bg-gradient-to-r from-white to-[#f7f9ff] pl-5 pr-16 text-[15px] text-[#334155] shadow-sm transition-all outline-none focus:border-[#1f5cb0] focus:shadow-[0_0_0_4px_rgba(31,92,176,0.12)]"
                />
                <button
                  type="submit"
                  aria-label="Search products"
                  className="absolute right-1.5 top-1.5 h-9 w-11 rounded-lg bg-[#ef5b49] text-white flex items-center justify-center transition-all hover:bg-[#e64835] group-focus-within:scale-105"
                >
                  <Search size={18} />
                </button>
              </form>
            </div>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium tracking-wide text-gray-700">
              <MyAccountDropdown />
              <a href="mailto:admin@doonperfumehub.com" className="inline-flex items-center gap-2 hover:text-[var(--color-brand-primary)] transition-colors whitespace-nowrap">
                <Phone size={16} />
                <span>Contact Us</span>
              </a>
              <Link href="/cart" className="inline-flex items-center gap-2 hover:text-[var(--color-brand-primary)] transition-colors relative pr-2 whitespace-nowrap">
                <ShoppingBag size={16} />
                <span>Cart</span>
                <span className="absolute -top-2 -right-2 bg-[var(--color-brand-primary)] text-white text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              </Link>
            </nav>

            <nav className="flex md:hidden items-center gap-3 text-gray-700">
              <MyAccountDropdown compact />
              <a href="mailto:admin@doonperfumehub.com" className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-[var(--color-brand-soft)] transition-colors" aria-label="Contact Us">
                <Phone size={18} />
              </a>
              <Link href="/cart" className="inline-flex items-center justify-center h-9 w-9 rounded-full hover:bg-[var(--color-brand-soft)] transition-colors relative" aria-label="Cart">
                <ShoppingBag size={18} />
                <span className="absolute -top-1 -right-1 bg-[var(--color-brand-primary)] text-white text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center font-bold">
                  {cartCount}
                </span>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Banner Slider */}
      <section className="relative w-full h-[14vh] min-h-[140px] md:h-[72vh] bg-black overflow-hidden">
        <div
          className="absolute inset-0 flex transition-transform duration-700 ease-out"
          style={{ transform: `translateX(-${activeHeroSlide * 100}%)` }}
        >
          {heroSlides.map((slide, idx) => (
            <div key={slide.kicker} className="relative min-w-full h-full">
              <Image
                src={slide.image}
                alt={slide.titleAccent}
                fill
                className={
                  idx === 0
                    ? 'object-cover object-center'
                    : 'object-cover object-center opacity-70 scale-105'
                }
                priority={idx === 0}
                unoptimized
              />
              {idx === 0 ? (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <Link
                    href={slide.href}
                    aria-label="Explore now"
                    className="pointer-events-auto absolute left-4 bottom-4 md:left-[14.5%] md:bottom-[14%]"
                  >
                    <button className="group flex items-center gap-3 border border-[#a97a3d] text-[#d2a767] bg-black/25 backdrop-blur-sm px-4 md:px-8 py-2 md:py-3 text-[10px] md:text-sm tracking-[0.16em] font-bold hover:bg-black/45 transition-all duration-300 shadow-xl">
                      EXPLORE NOW <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                    </button>
                  </Link>
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 bg-gradient-to-l from-black/60 to-transparent" />
                  <div className="absolute inset-0 w-full flex flex-col justify-center items-end text-right px-4 md:px-20 z-10 max-w-7xl mx-auto">
                    <p className="text-[var(--color-brand-primary)] font-bold tracking-[0.24em] text-[9px] md:text-sm mb-1 md:mb-3">
                      {slide.kicker}
                    </p>
                    <h1 className="text-white font-serif text-[28px] md:text-7xl mb-2 md:mb-4 leading-tight drop-shadow-2xl">
                      {slide.titleTop} <br />
                      <span className="italic text-[#d8e9ff]">{slide.titleAccent}</span>
                    </h1>
                    <p className="hidden md:block text-gray-300 max-w-md text-sm md:text-lg mb-6 leading-relaxed font-light">
                      {slide.description}
                    </p>
                    <Link href={slide.href}>
                      <button className="group flex items-center gap-3 bg-[var(--color-brand-primary)] text-white px-5 md:px-14 py-2 md:py-4 text-[10px] md:text-sm tracking-[0.16em] font-bold hover:bg-[var(--color-brand-primary-hover)] transition-all duration-500 shadow-2xl">
                        {slide.cta} <ArrowRight size={18} className="group-hover:translate-x-2 transition-transform" />
                      </button>
                    </Link>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setActiveHeroSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length)}
          className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/65 text-white items-center justify-center"
          aria-label="Previous slide"
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => setActiveHeroSlide((prev) => (prev + 1) % heroSlides.length)}
          className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 hover:bg-black/65 text-white items-center justify-center"
          aria-label="Next slide"
        >
          <ChevronRight size={20} />
        </button>
        <div className="absolute bottom-3 md:bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
          {heroSlides.map((slide, idx) => (
            <button
              key={`${slide.kicker}-dot`}
              type="button"
              onClick={() => setActiveHeroSlide(idx)}
              className={`h-2 rounded-full transition-all ${
                activeHeroSlide === idx ? 'w-8 bg-[var(--color-brand-primary)]' : 'w-2 bg-white/60'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </section>

      {/* Category Nav Row - Jewelry Style */}
      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 md:px-8">
          <div className="hidden md:block text-center mb-10 md:mb-14">
            <h2 className="text-2xl md:text-3xl font-serif text-gray-800 mb-2">Shop By Category</h2>
            <p className="text-[10px] md:text-xs font-bold tracking-[0.3em] text-gray-400 uppercase">Premium Selection</p>
          </div>

          <div className="md:hidden max-w-xl mx-auto">
            <form onSubmit={handleMobileSearchSubmit} className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={mobileSearchKeyword}
                onChange={(event) => setMobileSearchKeyword(event.target.value)}
                placeholder="Search by Category"
                className="w-full rounded-xl border border-gray-200 pl-11 pr-4 py-3 text-base focus:outline-none focus:border-[var(--color-brand-primary)]"
              />
            </form>
          </div>

          <div
            ref={mobileCategorySliderRef}
            className="md:hidden -mx-4 px-4 mt-6 overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth cursor-grab active:cursor-grabbing"
            onMouseDown={handleCategoryRailMouseDown}
            onMouseMove={handleCategoryRailMouseMove}
            onMouseUp={handleCategoryRailMouseUp}
            onMouseLeave={handleCategoryRailMouseUp}
          >
            <div className="flex gap-3 w-max pr-4">
              {categoryColumns.map((column, columnIndex) => (
                <div key={`mobile-column-${columnIndex}`} className="snap-start space-y-3 w-[140px]">
                  {column.map((cat, rowIndex) =>
                    cat ? (
                      <Link
                        href={cat.slug ? `/products?category=${cat.slug}` : '/products'}
                        key={`mobile-col-${columnIndex}-${cat.slug || 'all'}-${rowIndex}`}
                        className="flex flex-col items-center group"
                      >
                        <div className="relative w-full aspect-square rounded-2xl bg-[var(--color-brand-soft)] overflow-hidden flex items-center justify-center mb-2 transition-all duration-500 group-hover:bg-[#dcecff] group-hover:shadow-md group-hover:-translate-y-1">
                          {cat.hasCustomImage ? (
                            <Image
                              src={cat.icon}
                              alt={cat.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-9 h-9 relative opacity-70 group-hover:opacity-100 transition-opacity duration-500 transform group-hover:scale-110">
                              <Image
                                src={cat.icon}
                                alt={cat.name}
                                fill
                                className="object-contain p-2"
                                unoptimized
                              />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-medium text-gray-500 text-center leading-tight group-hover:text-black transition-colors px-1 line-clamp-2 min-h-[28px]">
                          {cat.name}
                        </span>
                      </Link>
                    ) : (
                      <div key={`mobile-col-empty-${columnIndex}-${rowIndex}`} className="invisible h-[170px]" aria-hidden="true" />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>

          <div
            ref={desktopCategorySliderRef}
            className="hidden md:block overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-smooth cursor-grab active:cursor-grabbing"
            onMouseDown={handleCategoryRailMouseDown}
            onMouseMove={handleCategoryRailMouseMove}
            onMouseUp={handleCategoryRailMouseUp}
            onMouseLeave={handleCategoryRailMouseUp}
          >
            <div className="flex gap-6 w-max pr-8">
              {categoryColumns.map((column, columnIndex) => (
                <div key={`desktop-column-${columnIndex}`} className="snap-start space-y-10 w-[220px]">
                  {column.map((cat, rowIndex) =>
                    cat ? (
                      <Link
                        href={cat.slug ? `/products?category=${cat.slug}` : '/products'}
                        key={`desktop-col-${columnIndex}-${cat.slug || 'all'}-${rowIndex}`}
                        className="flex flex-col items-center group"
                      >
                        <div className="relative w-full aspect-square rounded-2xl md:rounded-[40px] bg-[var(--color-brand-soft)] overflow-hidden flex items-center justify-center mb-4 transition-all duration-500 group-hover:bg-[#dcecff] group-hover:shadow-md group-hover:-translate-y-1">
                          {cat.hasCustomImage ? (
                            <Image
                              src={cat.icon}
                              alt={cat.name}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="w-10 h-10 md:w-16 md:h-16 relative opacity-70 group-hover:opacity-100 transition-opacity duration-500 transform group-hover:scale-110">
                              <Image
                                src={cat.icon}
                                alt={cat.name}
                                fill
                                className="object-contain p-2"
                                unoptimized
                              />
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] md:text-[12px] font-medium text-gray-400 text-center leading-tight group-hover:text-black transition-colors px-1">
                          {cat.name}
                        </span>
                      </Link>
                    ) : (
                      <div key={`desktop-col-empty-${columnIndex}-${rowIndex}`} className="invisible h-[300px]" aria-hidden="true" />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Latest Products Section */}
      <section className="py-20 md:py-32 max-w-7xl mx-auto px-4 md:px-8">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-4">
            <div className="max-w-xl text-left">
                <h2 className="text-4xl md:text-6xl font-serif text-[var(--color-brand-text)] mb-4">Latest Viral <br /><span className="italic text-[var(--color-brand-primary)]">Launches</span></h2>
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
                <p className="text-[10px] tracking-[0.3em] font-bold text-[var(--color-brand-primary)] uppercase">
                  {getPrimaryCategory(item).replace('-', ' ')}
                </p>
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
            <div className="mt-8 h-12 w-[1px] bg-[var(--color-brand-primary)]"></div>
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
