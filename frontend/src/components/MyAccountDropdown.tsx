"use client";

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, LogOut, Package, Phone, Settings, User } from 'lucide-react';
import { API_ROUTES, clearStoredUser, getAuthToken, getStoredUser, setStoredUser } from '@/lib/api';

const panelVariants = {
  hidden: { opacity: 0, y: -6, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.98 },
};

const normalizePhoneInput = (phone: string) => phone.replace(/[^\d+]/g, '');

const toApiPhone = (phone: string) => {
  const cleaned = normalizePhoneInput(phone);
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^91\d{10}$/.test(cleaned)) return `+${cleaned}`;
  return cleaned;
};

const readErrorMessage = async (res: Response, fallback: string) => {
  const payload = await res.json().catch(() => null);
  return payload?.message || fallback;
};

export default function MyAccountDropdown() {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [devOtp, setDevOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    return () => document.removeEventListener('mousedown', closeOnOutsideClick);
  }, []);

  const sendOtp = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const apiPhone = toApiPhone(phone);
      const res = await fetch(`${API_ROUTES.AUTH}/otp/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: apiPhone }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Failed to send OTP'));
      }

      const data = await res.json();
      setOtpSent(true);
      setMessage(`OTP sent to ${data.phone}`);
      if (typeof data.devOtp === 'string') {
        setDevOtp(data.devOtp);
      }
    } catch (requestError: any) {
      setError(requestError.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const apiPhone = toApiPhone(phone);
      const res = await fetch(`${API_ROUTES.AUTH}/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: apiPhone, otp }),
      });

      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Failed to verify OTP'));
      }

      const loggedInUser = await res.json();
      setStoredUser(loggedInUser);
      setUser(loggedInUser);
      setMessage('Login successful');
      setOtp('');
      setOtpSent(false);
      setDevOtp('');
    } catch (verifyError: any) {
      setError(verifyError.message || 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    clearStoredUser();
    setUser(null);
    setOtp('');
    setOtpSent(false);
    setMessage('Logged out');
    setError('');
  };

  const authToken = getAuthToken();

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 hover:text-[var(--color-brand-primary)] transition-colors"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <User size={16} />
        <span>My Account</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.18 }}
            className="absolute right-0 mt-3 w-[320px] bg-white border border-[#e6e4dc] shadow-xl p-4 z-[60]"
          >
            {user ? (
              <>
                <div className="border-b border-gray-100 pb-3 mb-3">
                  <p className="text-sm font-medium text-gray-900">{user.name || 'Customer'}</p>
                  <p className="text-xs text-gray-500">{user.phone || user.email}</p>
                </div>
                <div className="flex flex-col text-sm">
                  <Link href="/my-orders" className="flex items-center gap-2 px-2 py-2 hover:bg-[#f8f6f1] transition-colors">
                    <Package size={15} /> My Orders
                  </Link>
                  <a href="mailto:admin@doonperfumehub.com" className="flex items-center gap-2 px-2 py-2 hover:bg-[#f8f6f1] transition-colors">
                    <Phone size={15} /> Contact Us
                  </a>
                  <Link href="/settings" className="flex items-center gap-2 px-2 py-2 hover:bg-[#f8f6f1] transition-colors">
                    <Settings size={15} /> Settings
                  </Link>
                  <button
                    onClick={logout}
                    className="flex items-center gap-2 px-2 py-2 hover:bg-[#f8f6f1] transition-colors text-left"
                  >
                    <LogOut size={15} /> Logout
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-900">Login with mobile OTP</p>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(normalizePhoneInput(e.target.value))}
                  placeholder="Enter mobile number"
                  className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-brand-primary)]"
                />
                {otpSent && (
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-brand-primary)]"
                  />
                )}
                {message && <p className="text-xs text-green-600">{message}</p>}
                {error && <p className="text-xs text-red-600">{error}</p>}
                {devOtp && (
                  <p className="text-[11px] text-[#bda871]">
                    Dev OTP: <span className="font-semibold">{devOtp}</span>
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={sendOtp}
                    disabled={loading || !phone}
                    className="flex-1 bg-black text-white py-2 text-xs tracking-widest font-semibold disabled:opacity-50"
                  >
                    SEND OTP
                  </button>
                  <button
                    onClick={verifyOtp}
                    disabled={loading || !otpSent || otp.length !== 6}
                    className="flex-1 border border-black text-black py-2 text-xs tracking-widest font-semibold disabled:opacity-50"
                  >
                    VERIFY
                  </button>
                </div>
              </div>
            )}

            {authToken && (
              <p className="mt-3 text-[10px] text-gray-400 uppercase tracking-wider">Secure session active</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
