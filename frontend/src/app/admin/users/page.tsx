"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { API_ROUTES } from '@/lib/api';
import {
  Search,
  Mail,
  Phone,
  ShieldCheck,
  User as UserIcon,
  Calendar,
  Activity,
  Award,
  ShoppingBag,
  Ban,
  Trash2
} from 'lucide-react';

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  createdAt: string;
  isBlocked?: boolean;
  ordersCount?: number;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionLoadingUserId, setActionLoadingUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const getToken = () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      throw new Error('Not authenticated');
    }

    const token = JSON.parse(userStr)?.token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    return token;
  };

  const fetchUsers = useCallback(async () => {
    const token = getToken();
    const res = await fetch(API_ROUTES.AUTH, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      throw new Error('Failed to fetch users');
    }

    const data: AdminUser[] = await res.json();
    setUsers(data);
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        await fetchUsers();
      } catch (err) {
        console.error('Error fetching admin users:', err);
        setError('Unable to fetch users. Please sign in with an admin account.');
        setUsers([]);
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, []);

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return users;
    }

    return users.filter((user) => {
      const haystack = [user.name, user.email, user.phone].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [users, searchQuery]);

  const setBlockStatus = async (user: AdminUser, isBlocked: boolean) => {
    const actionLabel = isBlocked ? 'block' : 'unblock';
    if (!window.confirm(`Are you sure you want to ${actionLabel} ${user.name}?`)) {
      return;
    }

    try {
      setActionLoadingUserId(user._id);
      const token = getToken();
      const res = await fetch(`${API_ROUTES.AUTH}/${user._id}/block`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ isBlocked })
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.message || `Failed to ${actionLabel} user`);
      }

      await fetchUsers();
    } catch (err) {
      console.error(`Failed to ${actionLabel} user:`, err);
      window.alert(err instanceof Error ? err.message : `Failed to ${actionLabel} user`);
    } finally {
      setActionLoadingUserId(null);
    }
  };

  const deleteUser = async (user: AdminUser) => {
    if (!window.confirm(`Delete ${user.name} permanently? This cannot be undone.`)) {
      return;
    }

    try {
      setActionLoadingUserId(user._id);
      const token = getToken();
      const res = await fetch(`${API_ROUTES.AUTH}/${user._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(payload?.message || 'Failed to delete user');
      }

      await fetchUsers();
    } catch (err) {
      console.error('Failed to delete user:', err);
      window.alert(err instanceof Error ? err.message : 'Failed to delete user');
    } finally {
      setActionLoadingUserId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#888]" size={18} />
        <input
          type="text"
          placeholder="Search by name, email, or phone number..."
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37] transition-all font-sans"
        />
      </div>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-black/50 text-[#888] text-[10px] uppercase tracking-[0.2em] font-bold">
              <th className="px-8 py-6">User Profile</th>
              <th className="px-6 py-6">Role</th>
              <th className="px-6 py-6">Engagement</th>
              <th className="px-6 py-6">Member Since</th>
              <th className="px-8 py-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            {isLoading ? (
              <tr><td colSpan={5} className="py-20 text-center text-[#888] font-serif uppercase tracking-widest">Accessing secure personnel database...</td></tr>
            ) : error ? (
              <tr><td colSpan={5} className="py-20 text-center text-red-400 font-serif tracking-wide">{error}</td></tr>
            ) : filteredUsers.map((user) => (
              <tr key={user._id} className="hover:bg-white/[0.01] transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-[#111] border border-[#1a1a1a] flex items-center justify-center text-[#D4AF37] font-bold group-hover:bg-[#D4AF37]/10 transition-colors">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white text-sm font-bold tracking-wide group-hover:text-[#D4AF37] transition-colors">{user.name}</span>
                      <span className="text-[#888] text-[10px] mb-1 flex items-center">
                        <Mail size={10} className="mr-1" />
                        {user.email}
                      </span>
                      <span className="text-[#888] text-[10px] flex items-center">
                        <Phone size={10} className="mr-1" />
                        {user.phone}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border ${
                    user.role === 'admin' ? 'bg-[#D4AF37]/10 text-[#D4AF37] border-[#D4AF37]/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                  }`}>
                    {user.role === 'admin' && <ShieldCheck size={12} className="mr-1 text-[#D4AF37]" />}
                    {user.role}
                  </span>
                  {user.isBlocked ? (
                    <div className="mt-2 inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border bg-red-500/10 text-red-400 border-red-500/20">
                      <Ban size={12} className="mr-1" />
                      Blocked
                    </div>
                  ) : null}
                </td>
                <td className="px-6 py-6">
                  <div className="flex flex-col">
                    <div className="flex items-center space-x-2 text-white text-xs font-bold mb-1">
                      <ShoppingBag size={14} className="text-[#D4AF37]" />
                      <span>{user.ordersCount ?? 0} Orders</span>
                    </div>
                    <span className="text-[#888] text-[10px] uppercase font-bold tracking-tighter">
                      Lifetime Activity Rank
                    </span>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="flex items-center space-x-2 text-[#888] text-xs font-medium">
                    <Calendar size={14} className="text-[#444]" />
                    <span>{new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  </div>
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={actionLoadingUserId === user._id || user.role === 'admin'}
                      onClick={() => setBlockStatus(user, !Boolean(user.isBlocked))}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-[#2a2a2a] text-[#e5e5e5] hover:bg-[#141414] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Ban size={14} />
                      {user.isBlocked ? 'Unblock' : 'Block'}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoadingUserId === user._id || user.role === 'admin'}
                      onClick={() => deleteUser(user)}
                      className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 size={14} />
                      Delete User
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && !error && filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-20 text-center text-[#888] font-serif tracking-wide">
                  No users found for this search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-[#0a0a0a] border-l-4 border-[#D4AF37] p-6 rounded-2xl shadow-xl flex items-center space-x-6 group">
          <div className="p-4 bg-[#D4AF37]/10 rounded-full text-[#D4AF37] group-hover:animate-pulse">
            <Activity size={24} />
          </div>
          <div>
            <h4 className="text-white text-sm font-bold uppercase tracking-wider mb-1">Active User Analytics</h4>
            <p className="text-[#888] text-xs leading-relaxed">
              Real-time monitoring of customer registration and engagement. Total count: <span className="text-[#D4AF37] font-bold">{users.length}</span> verified personnel.
            </p>
          </div>
        </div>
        <div className="bg-[#0a0a0a] border-l-4 border-blue-500 p-6 rounded-2xl shadow-xl flex items-center space-x-6 group text-[#888] hover:text-white transition-colors duration-500 overflow-hidden relative">
          <Award size={100} strokeWidth={0.5} className="absolute -right-4 -bottom-4 text-[#111] opacity-50 group-hover:rotate-12 transition-transform duration-700" />
          <div className="relative z-10 w-full flex items-center space-x-6">
            <div className="p-4 bg-blue-500/10 rounded-full text-blue-500">
              <UserIcon size={24} />
            </div>
            <div>
              <h4 className="text-white text-sm font-bold uppercase tracking-wider mb-1">Administrative Privileges</h4>
              <p className="text-[#888] text-xs leading-relaxed group-hover:text-[#ccc]">
                Granting specific roles should only be performed by the Master Admin. Security protocols are currently <span className="text-blue-500 font-bold tracking-widest">ACTIVE</span>.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center py-10">
        <p className="text-[#333] text-[10px] uppercase font-bold tracking-[0.4em]">DOON PERFUME HUB - Secure Admin Clearance 4.1</p>
      </div>
    </div>
  );
}
