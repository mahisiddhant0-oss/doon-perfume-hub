"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { API_ROUTES } from '@/lib/api';
import { Search } from 'lucide-react';

type AdminEnquiry = {
  _id: string;
  name: string;
  phone: string;
  product?: {
    name?: string;
    sku?: string;
  };
  createdAt?: string;
};

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<AdminEnquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  const getToken = () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return '';
    return JSON.parse(userStr).token || '';
  };

  const fetchEnquiries = async () => {
    setIsLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');

      const res = await fetch(API_ROUTES.ENQUIRIES, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = await res.json().catch(() => []);
      if (!res.ok) {
        throw new Error(payload?.message || 'Failed to fetch enquiries');
      }

      setEnquiries(Array.isArray(payload) ? payload : []);
    } catch (fetchError: any) {
      setError(fetchError?.message || 'Unable to fetch enquiries');
      setEnquiries([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEnquiries();
  }, []);

  const filteredEnquiries = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return enquiries;

    return enquiries.filter((enquiry) =>
      String(enquiry.name || '').toLowerCase().includes(term) ||
      String(enquiry.phone || '').toLowerCase().includes(term) ||
      String(enquiry.product?.name || '').toLowerCase().includes(term)
    );
  }, [enquiries, query]);

  const formatDate = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-lg">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#666]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, phone or product..."
            className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl h-12 pl-12 pr-4 text-sm text-white placeholder:text-[#666] outline-none focus:border-[#D4AF37]"
          />
        </div>
        <button
          onClick={fetchEnquiries}
          className="h-12 px-5 rounded-xl bg-[#D4AF37] text-black text-xs font-bold tracking-[0.16em] uppercase hover:bg-[#c7a63a] transition-colors"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-300 px-4 py-3 text-sm">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-[#1a1a1a] bg-[#070707] overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-[#1a1a1a] text-[11px] tracking-[0.22em] uppercase text-[#7f8ea3] font-bold">
          <div className="col-span-3">Name</div>
          <div className="col-span-3">Phone Number</div>
          <div className="col-span-4">Product Enquired</div>
          <div className="col-span-2">Submitted</div>
        </div>

        {isLoading ? (
          <div className="px-6 py-10 text-[#888] text-sm">Loading enquiries...</div>
        ) : filteredEnquiries.length === 0 ? (
          <div className="px-6 py-10 text-[#888] text-sm">No enquiries found.</div>
        ) : (
          filteredEnquiries.map((enquiry) => (
            <div key={enquiry._id} className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-[#121212] text-sm">
              <div className="col-span-3 text-white font-semibold break-words">{enquiry.name || '-'}</div>
              <div className="col-span-3 text-[#d6d6d6] break-words">{enquiry.phone || '-'}</div>
              <div className="col-span-4 text-[#d6d6d6] break-words">{enquiry.product?.name || '-'}</div>
              <div className="col-span-2 text-[#9aa4b6] text-xs">{formatDate(enquiry.createdAt)}</div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
