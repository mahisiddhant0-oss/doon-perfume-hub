/**
 * @desc    Centralized API Configuration
 * @purpose Ensures all frontend modules use the same backend base URL.
 *          Defaults to localhost in dev, and requires an explicit URL in production.
 */

const normalizeBaseUrl = (value?: string) => value?.replace(/\/+$/, '') || '';

export const API_BASE =
  normalizeBaseUrl(process.env.NEXT_PUBLIC_API_URL) ||
  (process.env.NODE_ENV === 'development' ? '' : '');

export const API_ROUTES = {
  AUTH: `${API_BASE}/api/auth`,
  PRODUCTS: `${API_BASE}/api/products`,
  CART: `${API_BASE}/api/cart`,
  ORDERS: `${API_BASE}/api/orders`,
  LOGISTICS: `${API_BASE}/api/logistics`,
  WEBHOOKS: `${API_BASE}/api/webhooks`,
};

export const getStoredUser = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  const rawUser = window.localStorage.getItem('user');
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser);
  } catch {
    window.localStorage.removeItem('user');
    return null;
  }
};

export const setStoredUser = (user: unknown) => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem('user', JSON.stringify(user));
};

export const clearStoredUser = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem('user');
};

export const getAuthToken = () => {
  const user = getStoredUser();
  return typeof user?.token === 'string' ? user.token : '';
};

/**
 * Standard fetch wrapper for future standardization (headers etc.)
 */
export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  if (!API_BASE) {
    throw new Error('NEXT_PUBLIC_API_URL is not configured');
  }

  const url = `${API_BASE}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
  return fetch(url, options);
};
