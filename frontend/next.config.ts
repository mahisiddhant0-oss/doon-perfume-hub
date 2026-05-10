import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const isDev = process.env.NODE_ENV !== 'production';
const productionApiFallback = 'https://api.doonperfumehub.com';
const connectSources = [
  "'self'",
  apiUrl,
  !isDev ? productionApiFallback : '',
  isDev ? 'http://localhost:5000' : '',
  isDev ? 'http://127.0.0.1:5000' : '',
  'https://www.google-analytics.com',
  'https://region1.google-analytics.com',
  'https://www.googletagmanager.com',
  'https://api.razorpay.com',
  'https://checkout.razorpay.com',
  'https://cdn.razorpay.com',
  'https://*.razorpay.com',
].filter(Boolean).join(' ');

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${isDev ? "'unsafe-eval' " : ''}https://checkout.razorpay.com https://cdn.razorpay.com https://www.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com https://static.wixstatic.com https://www.google-analytics.com https://cdn-icons-png.flaticon.com https://cdn.razorpay.com https://*.razorpay.com https://doon-perfume-hub.onrender.com https://api.doonperfumehub.com",
  `connect-src ${connectSources}`,
  "font-src 'self' data:",
  "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://cdn.razorpay.com https://*.razorpay.com",
  "form-action 'self' https://api.razorpay.com https://checkout.razorpay.com https://cdn.razorpay.com https://*.razorpay.com",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
]
  .filter(Boolean)
  .join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'static.wixstatic.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn-icons-png.flaticon.com',
      },
      {
        protocol: 'https',
        hostname: 'doon-perfume-hub.onrender.com',
      },
      {
        protocol: 'https',
        hostname: 'api.doonperfumehub.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy,
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  async rewrites() {
    if (isDev) {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:5000/api/:path*',
        },
      ];
    }

    return [];
  },
};

export default nextConfig;
