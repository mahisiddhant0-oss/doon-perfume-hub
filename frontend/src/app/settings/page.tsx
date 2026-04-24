"use client";

import { FormEvent, useEffect, useState } from 'react';
import { API_ROUTES, getAuthToken } from '@/lib/api';

interface Profile {
  name: string;
  email: string;
  phone: string;
  address: {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
}

const emptyProfile: Profile = {
  name: '',
  email: '',
  phone: '',
  address: {
    street: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
  },
};

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      const token = getAuthToken();
      if (!token) {
        setError('Please login with OTP to access account settings.');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_ROUTES.AUTH}/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.message || 'Failed to load profile');
        }

        const data = await res.json();
        setProfile({
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          address: {
            street: data.address?.street || '',
            city: data.address?.city || '',
            state: data.address?.state || '',
            postalCode: data.address?.postalCode || '',
            country: data.address?.country || 'India',
          },
        });
      } catch (requestError: any) {
        setError(requestError.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const updateField = (key: keyof Profile, value: string) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const updateAddress = (key: keyof Profile['address'], value: string) => {
    setProfile((prev) => ({
      ...prev,
      address: { ...prev.address, [key]: value },
    }));
  };

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const token = getAuthToken();
    if (!token) {
      setError('Please login with OTP first.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch(`${API_ROUTES.AUTH}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: profile.name,
          email: profile.email,
          address: profile.address,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message || 'Failed to save profile');
      }

      const updated = await res.json();
      setProfile((prev) => ({
        ...prev,
        name: updated.name || prev.name,
        email: updated.email || prev.email,
        phone: updated.phone || prev.phone,
        address: {
          street: updated.address?.street || prev.address.street,
          city: updated.address?.city || prev.address.city,
          state: updated.address?.state || prev.address.state,
          postalCode: updated.address?.postalCode || prev.address.postalCode,
          country: updated.address?.country || prev.address.country,
        },
      }));

      setMessage('Profile updated successfully.');
    } catch (saveError: any) {
      setError(saveError.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <p className="text-xs tracking-[0.25em] text-gray-400 uppercase">Account</p>
      <h1 className="font-serif text-4xl text-gray-900 mt-2 mb-8">Settings</h1>

      {loading && <p className="text-sm text-gray-500">Loading account settings...</p>}

      {!loading && error && <div className="bg-white border border-red-100 text-red-700 px-4 py-3 text-sm mb-4">{error}</div>}
      {!loading && message && <div className="bg-white border border-green-100 text-green-700 px-4 py-3 text-sm mb-4">{message}</div>}

      {!loading && !error && (
        <form onSubmit={saveProfile} className="bg-white border border-gray-100 p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs tracking-wider font-semibold text-gray-600 mb-2">NAME</label>
            <input value={profile.name} onChange={(e) => updateField('name', e.target.value)} className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-brand-primary)]" />
          </div>
          <div>
            <label className="block text-xs tracking-wider font-semibold text-gray-600 mb-2">PHONE</label>
            <input value={profile.phone} disabled className="w-full border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs tracking-wider font-semibold text-gray-600 mb-2">EMAIL</label>
            <input value={profile.email} onChange={(e) => updateField('email', e.target.value)} className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-brand-primary)]" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs tracking-wider font-semibold text-gray-600 mb-2">STREET</label>
            <input value={profile.address.street} onChange={(e) => updateAddress('street', e.target.value)} className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-brand-primary)]" />
          </div>
          <div>
            <label className="block text-xs tracking-wider font-semibold text-gray-600 mb-2">CITY</label>
            <input value={profile.address.city} onChange={(e) => updateAddress('city', e.target.value)} className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-brand-primary)]" />
          </div>
          <div>
            <label className="block text-xs tracking-wider font-semibold text-gray-600 mb-2">STATE</label>
            <input value={profile.address.state} onChange={(e) => updateAddress('state', e.target.value)} className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-brand-primary)]" />
          </div>
          <div>
            <label className="block text-xs tracking-wider font-semibold text-gray-600 mb-2">POSTAL CODE</label>
            <input value={profile.address.postalCode} onChange={(e) => updateAddress('postalCode', e.target.value)} className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-brand-primary)]" />
          </div>
          <div>
            <label className="block text-xs tracking-wider font-semibold text-gray-600 mb-2">COUNTRY</label>
            <input value={profile.address.country} onChange={(e) => updateAddress('country', e.target.value)} className="w-full border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-[var(--color-brand-primary)]" />
          </div>
          <div className="md:col-span-2 pt-2">
            <button type="submit" disabled={saving} className="bg-black text-white px-8 py-3 text-xs tracking-[0.18em] font-semibold hover:bg-[var(--color-brand-primary)] transition-colors disabled:opacity-60">
              {saving ? 'SAVING...' : 'SAVE SETTINGS'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
