"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { API_ROUTES } from "@/lib/api";
import { useParams } from "next/navigation";
import MyAccountDropdown from "@/components/MyAccountDropdown";
import {
  Heart,
  Share2,
  ShieldCheck,
  ShoppingCart,
  CheckCircle2,
  Search,
  ShoppingBag,
  X,
} from "lucide-react";

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
  weightKg?: number;
  images: string[];
  category: string;
  categories?: string[];
  variants: Variant[];
  stock: number;
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

const DEFAULT_IMAGE =
  "https://images.unsplash.com/photo-1541643600914-78b084683601?w=800&q=80";

const getPrimaryCategory = (product: Product) => {
  if (Array.isArray(product.categories) && product.categories.length > 0) {
    const first = String(product.categories[0] || "").trim();
    if (first) return first;
  }
  return String(product.category || "general");
};

export default function ProductDetails() {
  const { id } = useParams();
  const productId = Array.isArray(id) ? id[0] : id;

  const [product, setProduct] = useState<Product | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState("description");
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [mainImage, setMainImage] = useState(DEFAULT_IMAGE);
  const [addedToCart, setAddedToCart] = useState(false);

  useEffect(() => {
    const loadCart = () => {
      try {
        const rawCart = localStorage.getItem("cart");
        const parsed = rawCart ? JSON.parse(rawCart) : [];
        setCartItems(Array.isArray(parsed) ? parsed : []);
      } catch {
        setCartItems([]);
      }
    };

    loadCart();
    window.addEventListener("storage", loadCart);

    return () => window.removeEventListener("storage", loadCart);
  }, []);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_ROUTES.PRODUCTS}/${productId}`);
        if (!res.ok) throw new Error("Product not found");
        const data: Product = await res.json();
        setProduct(data);
        if (data.images?.length > 0) setMainImage(data.images[0]);
        if (data.variants?.length > 0) setSelectedVariant(data.variants[0]);
      } catch (err: any) {
        setError(err?.message || "Failed to load product");
      } finally {
        setLoading(false);
      }
    };

    if (productId) fetchProduct();
  }, [productId]);

  const handleAddToCart = () => {
    if (!product) return;

    const existing = localStorage.getItem("cart");
    const cart: CartItem[] = existing ? JSON.parse(existing) : [];

    const cartItem: CartItem = {
      id: product._id,
      name: product.name,
      price: selectedVariant ? selectedVariant.price : product.price,
      weightKg: selectedVariant ? selectedVariant.weight : Number(product.weightKg || 0),
      quantity,
      img: mainImage,
      size: selectedVariant?.label,
      category: getPrimaryCategory(product),
    };

    const existingIndex = cart.findIndex(
      (item) => item.id === cartItem.id && item.size === cartItem.size
    );

    if (existingIndex > -1) {
      cart[existingIndex].quantity += quantity;
    } else {
      cart.push(cartItem);
    }

    localStorage.setItem("cart", JSON.stringify(cart));
    setCartItems(cart);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  const removeFromMiniCart = (target: CartItem) => {
    const updated = cartItems.filter(
      (item) => !(item.id === target.id && item.size === target.size)
    );
    setCartItems(updated);
    localStorage.setItem("cart", JSON.stringify(updated));
  };

  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cartItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-brand-primary)] mx-auto" />
        <p className="mt-4 text-gray-500 font-serif">Unveiling the essence...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-serif text-red-500 mb-2">Oops!</h2>
        <p className="text-gray-500">{error || "Product not found"}</p>
        <button
          className="mt-6 text-[var(--color-brand-primary)] underline"
          onClick={() => window.history.back()}
        >
          Go Back
        </button>
      </div>
    );
  }

  const displayPrice = selectedVariant ? selectedVariant.price : product.price;

  return (
    <div className="bg-[var(--color-brand-bg)] min-h-screen pb-24">
      <header className="sticky top-0 z-50 bg-white border-b border-[var(--color-brand-border)]">
        <div className="bg-[var(--color-brand-primary)] text-white text-xs text-center py-2 font-medium tracking-wide">
          EXTRA 5% OFF | USE CODE: MAKEHOMESPECIAL
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
              <Link
                href="/products"
                className="hover:text-[var(--color-brand-primary)] transition-colors"
              >
                COLLECTIONS
              </Link>
              <Link
                href="/products?category=perfumes"
                className="hover:text-[var(--color-brand-primary)] transition-colors"
              >
                PERFUMES
              </Link>
              <Link
                href="/products?category=essential-oils"
                className="hover:text-[var(--color-brand-primary)] transition-colors"
              >
                ESSENTIAL OILS
              </Link>
              <Link
                href="/products?category=bottles"
                className="hover:text-[var(--color-brand-primary)] transition-colors"
              >
                BOTTLES
              </Link>
            </nav>

            <div className="flex items-center gap-5 text-gray-700">
              <Search
                size={20}
                strokeWidth={1.7}
                className="cursor-pointer hover:text-[var(--color-brand-primary)]"
              />
              <div className="hidden sm:block">
                <MyAccountDropdown />
              </div>
              <div className="sm:hidden">
                <MyAccountDropdown compact />
              </div>

              <div className="relative group">
                <Link
                  href="/cart"
                  className="hover:text-[var(--color-brand-primary)] relative"
                >
                  <ShoppingBag size={20} strokeWidth={1.7} />
                  <span className="absolute -top-2 -right-2 bg-[var(--color-brand-primary)] text-white text-[10px] min-w-5 h-5 px-1 rounded-full flex items-center justify-center font-bold">
                    {cartCount}
                  </span>
                </Link>

                <div className="invisible opacity-0 group-hover:visible group-hover:opacity-100 transition-all duration-200 absolute right-0 mt-3 w-96 max-h-[420px] overflow-y-auto bg-white border border-[var(--color-brand-border)] shadow-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif text-xl text-gray-900">Your Cart</h3>
                    <span className="text-xs tracking-widest uppercase text-gray-400">
                      {cartCount} Items
                    </span>
                  </div>

                  {cartItems.length === 0 ? (
                    <p className="text-sm text-gray-500 py-6 text-center">
                      Your cart is empty.
                    </p>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {cartItems.map((item, index) => (
                          <div
                            key={`${item.id}-${item.size || "default"}-${index}`}
                            className="flex gap-3 pb-4 border-b border-gray-100"
                          >
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
                              <p className="text-[10px] uppercase tracking-widest text-gray-400">
                                {item.category?.replace("-", " ") || "fragrance"}
                              </p>
                              <h4 className="font-serif text-base text-gray-900 truncate">
                                {item.name}
                              </h4>
                              <p className="text-xs text-gray-500 mt-1">
                                Qty: {item.quantity}{" "}
                                {item.size ? `• ${item.size}` : ""}
                              </p>
                              <p className="text-sm font-semibold text-gray-800 mt-1">
                                Rs. {(item.price * item.quantity).toLocaleString("en-IN")}
                              </p>
                            </div>
                            <button
                              onClick={() => removeFromMiniCart(item)}
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
                          <span className="text-xs uppercase tracking-widest text-gray-500">
                            Subtotal
                          </span>
                          <span className="font-semibold text-gray-900">
                            Rs. {cartSubtotal.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <Link
                          href="/cart"
                          className="block w-full text-center border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] py-2 text-xs tracking-widest font-semibold hover:bg-[var(--color-brand-primary)] hover:text-white transition-colors"
                        >
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <div className="flex flex-col md:flex-row gap-12">
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
            {product.images?.length > 1 && (
              <div className="grid grid-cols-5 gap-3">
                {product.images.map((img, idx) => (
                  <div
                    key={idx}
                    className={`aspect-square relative cursor-pointer border-2 transition-all ${
                      mainImage === img
                        ? "border-[var(--color-brand-primary)]"
                        : "border-transparent hover:border-gray-200"
                    }`}
                    onClick={() => setMainImage(img)}
                  >
                    <Image
                      src={img}
                      alt={`${product.name} ${idx}`}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="w-full md:w-1/2 flex flex-col">
            <nav className="flex text-xs uppercase tracking-widest text-gray-400 mb-4 gap-2">
              <Link href="/" className="hover:text-black">
                Home
              </Link>
              <span>/</span>
              <Link href="/products" className="hover:text-black">
                Collection
              </Link>
              <span>/</span>
              <span className="text-gray-600">{product.name}</span>
            </nav>

            <h1 className="text-3xl md:text-5xl font-serif text-gray-900 mb-2 leading-tight">
              {product.name}
            </h1>
            <p className="text-xs uppercase tracking-widest text-[var(--color-brand-primary)] font-bold mb-4">
              {getPrimaryCategory(product).replace("-", " ")}
            </p>

            <div className="flex items-center gap-4 mb-6">
              <span className="text-3xl font-medium text-gray-900">
                Rs. {displayPrice.toLocaleString("en-IN")}
              </span>
              <span className="bg-green-50 text-green-700 text-[10px] font-bold px-2 py-1 uppercase tracking-wider">
                In Stock
              </span>
            </div>

            <div className="text-gray-600 text-sm leading-relaxed mb-8">
              {product.description}
            </div>

            {product.variants?.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xs font-bold text-gray-900 mb-3 uppercase tracking-widest">
                  Select Size
                </h3>
                <div className="flex flex-wrap gap-3">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.label}
                      onClick={() => setSelectedVariant(variant)}
                      className={`px-6 py-2 border text-sm transition-all ${
                        selectedVariant?.label === variant.label
                          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-soft)] text-[var(--color-brand-primary)] font-semibold shadow-sm"
                          : "border-gray-200 text-gray-500 hover:border-gray-400"
                      }`}
                    >
                      {variant.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <div className="flex items-center border border-gray-200 h-14 w-full sm:w-36 bg-white">
                <button
                  className="w-12 h-full flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-50 transition-colors"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  -
                </button>
                <input
                  type="text"
                  value={quantity}
                  readOnly
                  className="w-full text-center text-sm font-medium focus:outline-none bg-transparent"
                />
                <button
                  className="w-12 h-full flex items-center justify-center text-gray-400 hover:text-black hover:bg-gray-50 transition-colors"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  +
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={addedToCart}
                className={`flex-1 h-14 flex items-center justify-center gap-3 font-bold tracking-widest text-sm transition-all duration-300 ${
                  addedToCart
                    ? "bg-green-600 text-white"
                    : "bg-black text-white hover:bg-gray-900 active:scale-[0.98]"
                }`}
              >
                {addedToCart ? (
                  <>
                    <CheckCircle2 size={20} /> ADDED TO CART
                  </>
                ) : (
                  <>
                    <ShoppingCart size={18} strokeWidth={2} /> ADD TO CART
                  </>
                )}
              </button>

              <button className="w-14 h-14 flex items-center justify-center border border-gray-200 hover:border-red-200 hover:text-red-500 transition-all bg-white group">
                <Heart
                  size={20}
                  strokeWidth={1.5}
                  className="group-hover:fill-red-500 group-hover:text-red-500 transition-colors"
                />
              </button>
            </div>

            <div className="flex items-center gap-6 mb-8 text-[11px] uppercase tracking-widest text-gray-400 font-bold">
              <button className="flex items-center gap-2 hover:text-black transition-colors">
                <Share2 size={14} /> Share
              </button>
              <button className="flex items-center gap-2 hover:text-black transition-colors">
                <Heart size={14} /> Add to Wishlist
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-[var(--color-brand-border)] py-6 mb-8 text-[11px] uppercase tracking-widest font-bold text-gray-500">
              <div className="flex items-center gap-3">
                <ShieldCheck size={20} className="text-[var(--color-brand-primary)]" />
                100% Authentic Scents
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 size={20} className="text-[var(--color-brand-primary)]" />
                Quality Guaranteed
              </div>
            </div>

            <div className="border border-[var(--color-brand-border)] bg-white overflow-hidden">
              <div className="flex border-b border-[var(--color-brand-border)]">
                {["description", "shipping", "reviews"].map((tab) => (
                  <button
                    key={tab}
                    className={`flex-1 py-4 px-2 text-[10px] md:text-xs uppercase tracking-widest font-bold transition-colors ${
                      activeTab === tab
                        ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-primary)]"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div className="p-6 text-sm text-gray-600 leading-relaxed min-h-[150px]">
                {activeTab === "description" && (
                  <div className="whitespace-pre-line font-serif text-lg leading-loose italic text-gray-800">
                    {product.description ||
                      "A crafted fragrance that blends rich notes with modern elegance."}
                  </div>
                )}
                {activeTab === "shipping" && (
                  <div className="space-y-4">
                    <p>
                      <strong>Fast Delivery:</strong> Dispatch within 24-48 hours.
                    </p>
                    <p>
                      <strong>Logistics Partner:</strong> Shipped through Delhivery.
                    </p>
                    <p>
                      <strong>Safety:</strong> Tamper-proof luxury packaging included.
                    </p>
                  </div>
                )}
                {activeTab === "reviews" && (
                  <div className="text-center py-4 italic text-gray-400">
                    Customer reviews will appear here soon.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[var(--color-brand-border)] shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <button
            onClick={handleAddToCart}
            disabled={addedToCart}
            className={`flex-1 h-14 font-bold tracking-widest text-sm transition-all ${
              addedToCart
                ? "bg-green-600 text-white"
                : "bg-[var(--color-brand-primary)] text-white hover:brightness-95"
            }`}
          >
            {addedToCart ? "ADDED TO CART" : "ADD TO CART"}
          </button>
          <Link
            href="/cart"
            className="flex-1 h-14 border border-[var(--color-brand-primary)] text-[var(--color-brand-primary)] text-sm tracking-widest font-bold flex items-center justify-center hover:bg-[var(--color-brand-primary)] hover:text-white transition-colors"
          >
            VIEW CART ({cartCount})
          </Link>
        </div>
      </div>
    </div>
  );
}
