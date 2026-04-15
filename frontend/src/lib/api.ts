/**
 * @desc    Centralized API Configuration
 * @purpose Ensures all frontend modules use the same backend base URL.
 *          Defaults to localhost in dev, and environment variable in production.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const API_ROUTES = {
  AUTH: `${API_BASE}/api/auth`,
  PRODUCTS: `${API_BASE}/api/products`,
  CART: `${API_BASE}/api/cart`,
  ORDERS: `${API_BASE}/api/orders`,
  LOGISTICS: `${API_BASE}/api/logistics`,
  WEBHOOKS: `${API_BASE}/api/webhooks`,
};

/**
 * Standard fetch wrapper for future standardization (headers etc.)
 */
export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  return fetch(url, options);
};
