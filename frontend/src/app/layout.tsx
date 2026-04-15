import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Doon Perfume Hub | Luxury Fragrances, Essential Oils & Bottles",
  description: "Doon Perfume Hub — Luxury perfumes, pure essential oils, and premium glass bottles (Indian & Chinese variants). Specialized in private label and white labeling services for fragrance brands.",
  keywords: ["luxury perfumes", "essential oils", "perfume bottles", "glass bottles", "perfume white labeling", "private label perfumes", "Dehradun perfumes"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="antialiased min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
