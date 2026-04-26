import { Search, ShoppingBag, User, Heart } from "lucide-react";
import Image from "next/image";
import Link from 'next/link';

const Navbar = () => (
  <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-[var(--color-brand-border)]">
    {/* Top notification bar */}
    <div className="bg-[var(--color-brand-primary)] text-white text-xs text-center py-2 font-medium tracking-wide">
      EXTRA 5% OFF | USE CODE: SCENTOFDOON | STORE LOCATOR
    </div>
    
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center h-20">
        
        {/* Logo */}
        <div className="flex-shrink-0 flex items-center">
          <Link href="/" className="flex items-center">
            <Image
              src="/DPH_LOGO.avif"
              alt="Doon Perfume Hub"
              width={140}
              height={56}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>
        </div>

        {/* Center Nav Links */}
        <nav className="hidden md:flex space-x-8 text-sm font-medium tracking-wider text-gray-700">
          <Link href="/products?category=new" className="hover:text-[var(--color-brand-primary)] transition-colors">NEW IN</Link>
          <Link href="/products?category=perfumes" className="hover:text-[var(--color-brand-primary)] transition-colors">PERFUMES</Link>
          <Link href="/products?category=attars" className="hover:text-[var(--color-brand-primary)] transition-colors">ATTARS</Link>
          <Link href="/products?category=gifting" className="hover:text-[var(--color-brand-primary)] transition-colors">GIFTING</Link>
          <Link href="/products?category=luxe" className="text-[var(--color-brand-primary)]">LUXE</Link>
        </nav>

        {/* Right Icons */}
        <div className="flex items-center space-x-6 text-gray-600">
          <button className="hover:text-[var(--color-brand-primary)]"><Search size={22} strokeWidth={1.5} /></button>
          <button className="hover:text-[var(--color-brand-primary)]"><Heart size={22} strokeWidth={1.5} /></button>
          <button className="hover:text-[var(--color-brand-primary)]"><User size={22} strokeWidth={1.5} /></button>
          <Link href="/cart" className="hover:text-[var(--color-brand-primary)] relative">
            <ShoppingBag size={22} strokeWidth={1.5} />
            <span className="absolute -top-1 -right-1 bg-[var(--color-brand-primary)] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
              0
            </span>
          </Link>
        </div>

      </div>
    </div>
  </header>
);

const Footer = () => (
  <footer className="bg-white border-t border-[var(--color-brand-border)] pt-16 pb-8 mt-24">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-12">
      <div>
        <Link href="/" className="inline-flex items-center mb-6">
          <Image
            src="/DPH_LOGO.avif"
            alt="Doon Perfume Hub"
            width={150}
            height={60}
            className="h-10 w-auto object-contain"
          />
        </Link>
        <p className="text-gray-500 text-sm leading-relaxed mb-6">
          Crafting memories through exquisite scents. Doon Perfume Hub curates the finest luxury fragrances and artisan attars.
        </p>
      </div>
      <div>
        <h4 className="font-serif text-lg mb-4">Shop</h4>
        <ul className="space-y-3 text-sm text-gray-500">
          <li><Link href="#" className="hover:text-[var(--color-brand-primary)]">New Arrivals</Link></li>
          <li><Link href="#" className="hover:text-[var(--color-brand-primary)]">Signature Colognes</Link></li>
          <li><Link href="#" className="hover:text-[var(--color-brand-primary)]">Pure Attars</Link></li>
          <li><Link href="#" className="hover:text-[var(--color-brand-primary)]">Home Fragrance</Link></li>
        </ul>
      </div>
      <div>
         <h4 className="font-serif text-lg mb-4">Customer Care</h4>
        <ul className="space-y-3 text-sm text-gray-500">
          <li><Link href="#" className="hover:text-[var(--color-brand-primary)]">Track Order</Link></li>
          <li><Link href="#" className="hover:text-[var(--color-brand-primary)]">Returns & FAQs</Link></li>
          <li><Link href="#" className="hover:text-[var(--color-brand-primary)]">Contact Us</Link></li>
        </ul>
      </div>
      <div>
        <h4 className="font-serif text-lg mb-4">Newsletter</h4>
        <p className="text-sm text-gray-500 mb-4">Subscribe for exclusive offers and updates.</p>
        <div className="flex">
          <input type="email" placeholder="Email Address" className="border border-gray-300 px-4 py-2 text-sm w-full focus:outline-none focus:border-[var(--color-brand-primary)]" />
          <button className="bg-[var(--color-brand-text)] text-white px-4 py-2 text-sm hover:bg-[var(--color-brand-primary)] transition-colors">
            SUBSCRIBE
          </button>
        </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-gray-100 text-center text-sm text-gray-400">
      © {new Date().getFullYear()} Doon Perfume Hub. All Rights Reserved.
    </div>
  </footer>
);

export default function ShopLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="shop-wrapper min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-grow">
        {children}
      </main>
      <Footer />
      
      {/* Floating WhatsApp */}
      <a href="https://wa.me/something" target="_blank" rel="noreferrer" className="fixed bottom-6 right-6 z-50 bg-green-500 text-white p-4 rounded-full shadow-lg hover:scale-110 transition-transform">
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.347-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.876 1.213 3.074.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
      </a>
    </div>
  );
}
