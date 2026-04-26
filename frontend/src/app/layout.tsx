import type { Metadata } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import GoogleAnalytics from "@/components/GoogleAnalytics";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const metadataBase = (() => {
  if (!siteUrl) return undefined;

  try {
    return new URL(siteUrl);
  } catch {
    return undefined;
  }
})();

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
  metadataBase,
  referrer: "strict-origin-when-cross-origin",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/DPH_LOGO.avif",
    shortcut: "/DPH_LOGO.avif",
    apple: "/DPH_LOGO.avif",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="antialiased min-h-screen flex flex-col">
        {gaMeasurementId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaMeasurementId}`}
              strategy="afterInteractive"
            />
            <Script id="ga-init" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${gaMeasurementId}', { send_page_view: false });
              `}
            </Script>
            <GoogleAnalytics measurementId={gaMeasurementId} />
          </>
        ) : null}
        {children}
      </body>
    </html>
  );
}
