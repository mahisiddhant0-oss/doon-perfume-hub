import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

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
  description:
    "Doon Perfume Hub offers luxury perfumes, pure essential oils, and premium glass bottles with private-label fragrance services.",
  keywords: [
    "luxury perfumes",
    "essential oils",
    "perfume bottles",
    "glass bottles",
    "perfume white labeling",
    "private label perfumes",
    "Dehradun perfumes",
  ],
  metadataBase: siteUrl ? new URL(siteUrl) : undefined,
  referrer: "strict-origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="antialiased min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
