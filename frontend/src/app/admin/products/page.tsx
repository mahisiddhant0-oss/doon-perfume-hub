"use client";

import React, { useEffect, useRef, useState } from 'react';
import { useMemo } from 'react';
import { API_ROUTES } from '@/lib/api';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
  XCircle,
  Layers,
  ChevronDown
} from 'lucide-react';

type AdminProduct = {
  _id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  weightKg?: number;
  variants?: {
    label: string;
    price: number;
    stock: number;
    weight: number;
    image?: string;
  }[];
  category: string;
  categories?: string[];
  description?: string;
  images?: string[];
  isActive?: boolean;
};

type VariantForm = {
  label: string;
  price: number;
  stock: number;
  weight: number;
  image: string;
};

type ProductForm = {
  name: string;
  sku: string;
  price: number;
  stock: number;
  weightKg: number;
  variants: VariantForm[];
  category: string;
  categories: string[];
  description: string;
  images: string[];
};
type CategoryPayload = string | { value?: string };
type CategoryObjectPayload = { value?: string; name?: string };

const CATEGORY_OPTIONS = [
  { value: 'perfumes', label: 'Perfumes' },
  { value: 'essential-oils', label: 'Essential Oils' },
  { value: 'bottles', label: 'Glass Bottles' },
];
const EXCLUDED_CATEGORY_VALUES = new Set(['attars', 'ouds']);
const LOCAL_CUSTOM_CATEGORIES_KEY = 'dph_custom_categories';

const emptyForm: ProductForm = {
  name: '',
  sku: '',
  price: 0,
  stock: 0,
  weightKg: 0,
  variants: [],
  category: 'perfumes',
  categories: ['perfumes'],
  description: '',
  images: []
};

const normalizeCategoryValuesFromPayload = (payload: unknown): string[] => {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((entry) =>
      typeof entry === 'string'
        ? entry
        : typeof entry === 'object' && entry && 'value' in entry
          ? String((entry as { value?: string }).value || '')
          : ''
    )
    .map((entry) => String(entry || '').trim().toLowerCase())
    .filter((entry) => entry.length > 0 && !EXCLUDED_CATEGORY_VALUES.has(entry));
};
const normalizeCategoryLabel = (value = '') =>
  String(value || '')
    .trim()
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

export default function AdminProducts() {
  const categoryDropdownRef = useRef<HTMLDivElement | null>(null);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [isDeletingFromModal, setIsDeletingFromModal] = useState(false);
  const [formData, setFormData] = useState<ProductForm>(emptyForm);
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const [isCreatingCustomCategory, setIsCreatingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [customCategoryPool, setCustomCategoryPool] = useState<string[]>([]);
  const [categoryNamesByValue, setCategoryNamesByValue] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'priceAsc' | 'priceDesc'>('default');

  const readStoredCustomCategories = () => {
    if (typeof window === 'undefined') return [] as string[];
    try {
      const raw = window.localStorage.getItem(LOCAL_CUSTOM_CATEGORIES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed)
        ? parsed
            .map((entry) => String(entry || '').trim())
            .filter((entry) => entry.length > 0 && !EXCLUDED_CATEGORY_VALUES.has(entry.toLowerCase()))
        : [];
    } catch {
      return [] as string[];
    }
  };

  const persistCustomCategories = (values: string[]) => {
    if (typeof window === 'undefined') return;
    const sanitized = values
      .map((entry) => String(entry || '').trim())
      .filter((entry) => entry.length > 0 && !EXCLUDED_CATEGORY_VALUES.has(entry.toLowerCase()));
    window.localStorage.setItem(LOCAL_CUSTOM_CATEGORIES_KEY, JSON.stringify(sanitized));
  };

  const mergeCategoryValues = (...inputs: Array<string[] | undefined>) => {
    const seen = new Set<string>();
    const merged: string[] = [];

    for (const source of inputs) {
      if (!Array.isArray(source)) continue;
      for (const rawEntry of source) {
        const entry = String(rawEntry || '').trim();
        const normalized = entry.toLowerCase();
        if (!entry || EXCLUDED_CATEGORY_VALUES.has(normalized) || seen.has(normalized)) continue;
        seen.add(normalized);
        merged.push(entry);
      }
    }

    return merged;
  };

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const separator = API_ROUTES.PRODUCTS.includes('?') ? '&' : '?';
      const res = await fetch(`${API_ROUTES.PRODUCTS}${separator}_ts=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data: AdminProduct[] = await res.json();
      setProducts(data);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const separator = API_ROUTES.PRODUCT_CATEGORIES.includes('?') ? '&' : '?';
      const res = await fetch(`${API_ROUTES.PRODUCT_CATEGORIES}${separator}_ts=${Date.now()}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const payload = await res.json();
      const normalized = normalizeCategoryValuesFromPayload(payload);
      const nameMap: Record<string, string> = {};
      if (Array.isArray(payload)) {
        payload.forEach((entry) => {
          if (typeof entry === 'object' && entry) {
            const value = String((entry as CategoryObjectPayload).value || '').trim().toLowerCase();
            const name = String((entry as CategoryObjectPayload).name || '').trim();
            if (value) {
              nameMap[value] = name || normalizeCategoryLabel(value);
            }
          }
        });
      }
      setCategoryNamesByValue((prev) => ({ ...prev, ...nameMap }));
      setCustomCategoryPool((prev) => {
        const nextPool = mergeCategoryValues(prev, normalized);
        persistCustomCategories(nextPool);
        return nextPool;
      });
    } catch {
      // fallback to product-derived categories
    }
  };

  useEffect(() => {
    const storedCategories = readStoredCustomCategories();
    if (storedCategories.length > 0) {
      setCustomCategoryPool((prevPool) => mergeCategoryValues(prevPool, storedCategories));
    }
    fetchProducts();
    fetchCategories();
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!categoryDropdownRef.current) return;
      if (!categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    const categoriesFromProducts = products
      .flatMap((product) => {
        if (Array.isArray(product.categories) && product.categories.length > 0) {
          return product.categories.map((entry) => String(entry || '').trim()).filter(Boolean);
        }
        return [String(product.category || '').trim()].filter(Boolean);
      })
      .filter((entry) => !EXCLUDED_CATEGORY_VALUES.has(entry.toLowerCase()));

    setCustomCategoryPool((prevPool) => {
      const nextPool = mergeCategoryValues(prevPool, categoriesFromProducts);
      persistCustomCategories(nextPool);
      return nextPool;
    });
  }, [products]);

  const handleOpenModal = (product: AdminProduct | null = null) => {
    if (product) {
      const normalizedCategories = Array.isArray(product.categories) && product.categories.length > 0
        ? product.categories.map((entry) => String(entry || '').trim()).filter(Boolean)
        : [String(product.category || '').trim()].filter(Boolean);
      const sanitizedCategories = normalizedCategories.filter(
        (entry) => !EXCLUDED_CATEGORY_VALUES.has(entry.toLowerCase())
      );

      setEditingProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku,
        price: product.price,
        stock: product.stock,
        weightKg: Number(product.weightKg || 0),
        variants: Array.isArray(product.variants)
          ? product.variants.map((variant) => ({
              label: String(variant.label || ''),
              price: Number(variant.price || 0),
              stock: Number(variant.stock || 0),
              weight: Number(variant.weight || 0),
              image: String(variant.image || ''),
            }))
          : [],
        category: sanitizedCategories[0] || 'perfumes',
        categories: sanitizedCategories.length > 0 ? sanitizedCategories : ['perfumes'],
        description: product.description || '',
        images: product.images || []
      });
      setIsCategoryDropdownOpen(false);
      setIsCreatingCustomCategory(false);
      setCustomCategoryInput('');
    } else {
      setEditingProduct(null);
      setFormData(emptyForm);
      setIsCategoryDropdownOpen(false);
      setIsCreatingCustomCategory(false);
      setCustomCategoryInput('');
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const url = editingProduct ? `${API_ROUTES.PRODUCTS}/${editingProduct._id}` : API_ROUTES.PRODUCTS;
      const method = editingProduct ? 'PUT' : 'POST';
      const normalizedCategoriesForSave = mergeCategoryValues(
        formData.categories,
        customCategoryInput ? [customCategoryInput] : []
      );
      const finalCategories = normalizedCategoriesForSave.length > 0 ? normalizedCategoriesForSave : ['general'];
      setCustomCategoryPool((prevPool) => {
        const nextPool = mergeCategoryValues(prevPool, finalCategories);
        persistCustomCategories(nextPool);
        return nextPool;
      });

      const userStr = localStorage.getItem('user');
      const token = userStr ? JSON.parse(userStr).token : '';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          category: finalCategories[0] || formData.category || 'perfumes',
          categories: finalCategories,
          variants: formData.variants.filter((variant) => variant.label.trim().length > 0),
        })
      });

        if (res.ok) {
          const savedProduct = await res.json().catch(() => null);
        const categoriesFromSavedProduct = mergeCategoryValues(
          Array.isArray(savedProduct?.categories) ? savedProduct.categories : [],
          savedProduct?.category ? [savedProduct.category] : [],
          finalCategories
        );
        const nextPool = mergeCategoryValues(customCategoryPool, categoriesFromSavedProduct);
        setCustomCategoryPool(nextPool);
        persistCustomCategories(nextPool);

        // Keep UI in sync instantly for both Create and Edit flows.
        if (savedProduct?._id) {
          setProducts((prev) => {
            const exists = prev.some((item) => item._id === savedProduct._id);
            if (exists) {
              return prev.map((item) => (item._id === savedProduct._id ? savedProduct : item));
            }
            return [savedProduct, ...prev];
          });
        }

        setIsModalOpen(false);
        setIsCreatingCustomCategory(false);
        setCustomCategoryInput('');
        fetchProducts();
        fetchCategories();
      } else {
        const errData = await res.json();
        const detailedMessage = [errData?.message, errData?.error].filter(Boolean).join(': ');
        alert(detailedMessage || 'Error saving product');
      }
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const handleDeleteProduct = async (product: AdminProduct) => {
    const isConfirmed = window.confirm(
      `Are you sure you want to permanently delete "${product.name}"?\n\nThis cannot be undone.`
    );
    if (!isConfirmed) {
      return;
    }

    try {
      const userStr = localStorage.getItem('user');
      const token = userStr ? JSON.parse(userStr).token : '';
      if (!token) {
        alert('Please login as admin to delete products.');
        return;
      }

      const res = await fetch(`${API_ROUTES.PRODUCTS}/${product._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message || 'Failed to delete product');
      }

      await fetchProducts();
      alert('Product deleted permanently.');
    } catch (error: any) {
      alert(error?.message || 'Failed to delete product');
    }
  };

  const handleDeleteFromModal = async () => {
    if (!editingProduct) return;
    try {
      setIsDeletingFromModal(true);
      await handleDeleteProduct(editingProduct);
      setIsModalOpen(false);
    } finally {
      setIsDeletingFromModal(false);
    }
  };

  const addVariant = () => {
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, { label: '', price: 0, stock: 0, weight: 0, image: '' }],
    }));
  };

  const updateVariant = (index: number, field: keyof VariantForm, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, idx) =>
        idx === index ? { ...variant, [field]: value } : variant
      ),
    }));
  };

  const removeVariant = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, idx) => idx !== index),
    }));
  };

  const visibleProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const categoryTagQuery = query.startsWith('#') ? query.slice(1).trim() : '';
    let result = [...products];

    if (categoryTagQuery) {
      result = result.filter((product) => {
        const categoryValues = Array.isArray(product.categories) && product.categories.length > 0
          ? product.categories
          : [product.category];
        const normalizedCategories = categoryValues
          .map((entry) => String(entry || '').trim().toLowerCase())
          .filter(Boolean);
        return normalizedCategories.some((entry) => entry.includes(categoryTagQuery));
      });
    } else if (query) {
      result = result.filter((product) => {
        const name = product.name?.toLowerCase() || '';
        const sku = product.sku?.toLowerCase() || '';
        const categories = Array.isArray(product.categories) && product.categories.length > 0
          ? product.categories.join(' ').toLowerCase()
          : (product.category?.toLowerCase() || '');
        return name.includes(query) || sku.includes(query) || categories.includes(query);
      });
    }

    if (sortBy === 'priceAsc') {
      result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy === 'priceDesc') {
      result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    }

    return result;
  }, [products, searchTerm, sortBy]);

  const customCategoryOptions = useMemo(() => {
    const defaultValues = new Set(CATEGORY_OPTIONS.map((option) => option.value.toLowerCase()));
    const categories = products
      .flatMap((product) => {
        if (Array.isArray(product.categories) && product.categories.length > 0) {
          return product.categories.map((entry) => String(entry || '').trim()).filter(Boolean);
        }
        return [String(product.category || '').trim()].filter(Boolean);
      })
      .filter((category) => !EXCLUDED_CATEGORY_VALUES.has(category.toLowerCase()))
      .filter((category) => !defaultValues.has(category.toLowerCase()));

    return mergeCategoryValues(categories, customCategoryPool)
      .filter((category) => !defaultValues.has(category.toLowerCase()))
      .sort((a, b) => a.localeCompare(b));
  }, [products, customCategoryPool]);

  const allCategoryOptions = useMemo(
    () =>
      mergeCategoryValues(
        CATEGORY_OPTIONS.map((option) => option.value),
        customCategoryOptions,
        customCategoryPool,
        formData.categories
      ),
    [customCategoryOptions, customCategoryPool, formData.categories]
  );

  const addCustomCategoryToForm = async () => {
    const typedCategory = customCategoryInput.trim();
    if (!typedCategory) {
      return;
    }
    const normalizedCategory = typedCategory.toLowerCase();
    try {
      const userStr = localStorage.getItem('user');
      const token = userStr ? JSON.parse(userStr).token : '';
      if (token) {
        await fetch(API_ROUTES.PRODUCT_CATEGORIES, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ value: normalizedCategory, name: typedCategory }),
        });
      }
    } catch {
      // If this fails, keep it in current form as fallback.
    }

    const nextPool = mergeCategoryValues(customCategoryPool, [normalizedCategory]);
    setCategoryNamesByValue((prev) => ({
      ...prev,
      [normalizedCategory]: typedCategory,
    }));
    setCustomCategoryPool(nextPool);
    persistCustomCategories(nextPool);

    setFormData((prev) => {
      const nextCategories = mergeCategoryValues(prev.categories, [normalizedCategory]);
      if (nextCategories.length === prev.categories.length) {
        return prev;
      }
      return {
        ...prev,
        category: nextCategories[0] || normalizedCategory,
        categories: nextCategories,
      };
    });
    setCustomCategoryInput('');
    setIsCreatingCustomCategory(false);
    fetchCategories();
  };

  const toggleCategorySelection = (categoryValue: string) => {
    setFormData((prev) => {
      const exists = prev.categories.some((entry) => entry.toLowerCase() === categoryValue.toLowerCase());
      if (exists) {
        if (prev.categories.length === 1) {
          return prev;
        }
        const nextCategories = prev.categories.filter(
          (entry) => entry.toLowerCase() !== categoryValue.toLowerCase()
        );
        return {
          ...prev,
          categories: nextCategories,
          category: nextCategories[0] || 'perfumes',
        };
      }

      const nextCategories = [...prev.categories, categoryValue];
      return {
        ...prev,
        categories: nextCategories,
        category: nextCategories[0] || prev.category || 'perfumes',
      };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col md:flex-row gap-3 flex-grow max-w-2xl">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#888]" size={18} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by product name, SKU, category, or #Category..."
              className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl pl-12 pr-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37] transition-all"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'default' | 'priceAsc' | 'priceDesc')}
            className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-3 text-sm text-[#ccc] focus:outline-none focus:border-[#D4AF37] transition-all min-w-[210px]"
          >
            <option value="default">Sort: Default</option>
            <option value="priceAsc">Sort: Price Low to High</option>
            <option value="priceDesc">Sort: Price High to Low</option>
          </select>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 bg-[#D4AF37] text-black px-6 py-3 rounded-xl text-sm font-bold hover:bg-[#bda871] transition-all whitespace-nowrap shadow-xl"
        >
          <Plus size={18} />
          <span>Add New Fragrance</span>
        </button>
      </div>

      <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-black/50 text-[#888] text-[10px] uppercase tracking-[0.2em] font-bold">
              <th className="px-8 py-6">Product Information</th>
              <th className="px-6 py-6">Category</th>
              <th className="px-6 py-6">Stock Status</th>
              <th className="px-6 py-6">Pricing</th>
              <th className="px-6 py-6">Visibility</th>
              <th className="px-8 py-6 text-right">Settings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1a1a1a]">
            {isLoading ? (
              <tr><td colSpan={6} className="py-20 text-center text-[#888] font-serif uppercase tracking-widest">Inventory Manifest Loading...</td></tr>
            ) : visibleProducts.length === 0 ? (
              <tr><td colSpan={6} className="py-20 text-center text-[#888] font-serif uppercase tracking-widest">No products match your search/filter</td></tr>
            ) : visibleProducts.map((product) => (
              <tr key={product._id} className="hover:bg-white/[0.01] transition-colors group">
                <td className="px-8 py-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 rounded-lg bg-[#111] overflow-hidden border border-[#1a1a1a] group-hover:border-[#D4AF37]/30 transition-colors">
                      {product.images?.[0] ? (
                        <img src={product.images[0]} alt={product.name} className="w-full h-full object-cover opacity-80" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#333]"><ImageIcon size={20} /></div>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white text-sm font-bold tracking-wide group-hover:text-[#D4AF37] transition-colors">{product.name}</span>
                      <span className="text-[#888] text-[10px] uppercase font-mono tracking-tighter mt-1">SKU: {product.sku}</span>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="flex items-center space-x-2 text-[#888] text-xs uppercase font-medium">
                    <Layers size={14} className="text-[#444]" />
                    <span>
                      {(Array.isArray(product.categories) && product.categories.length > 0
                        ? product.categories
                        : [product.category]
                      ).join(', ')}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="flex flex-col">
                    <span className={`text-xs font-bold ${product.stock <= 10 ? 'text-orange-500' : 'text-white'}`}>
                      {product.stock} in Stock
                    </span>
                    <div className="w-24 h-1 bg-[#111] rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${product.stock === 0 ? 'bg-red-500' : product.stock <= 10 ? 'bg-orange-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(product.stock, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-6">
                  <div className="flex flex-col">
                    <span className="text-[#D4AF37] font-serif font-bold italic text-lg">Rs. {product.price}</span>
                    <span className="text-[#888] text-[10px] uppercase tracking-widest mt-1">Wt: {Number(product.weightKg || 0)} Kg</span>
                    {product.variants?.length ? (
                      <span className="text-[#888] text-[10px] uppercase tracking-widest mt-1">
                        {product.variants.length} Variant{product.variants.length > 1 ? 's' : ''}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-6 py-6">
                  {product.isActive ? (
                    <span className="flex items-center space-x-2 text-green-500 text-[10px] font-bold uppercase tracking-widest">
                      <CheckCircle2 size={14} />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-2 text-red-500 text-[10px] font-bold uppercase tracking-widest">
                      <XCircle size={14} />
                      <span>Hidden</span>
                    </span>
                  )}
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end space-x-3">
                    <button onClick={() => handleOpenModal(product)} className="p-2 text-[#888] hover:text-[#D4AF37] hover:bg-[#D4AF37]/5 rounded-lg transition-all" title="Edit Listing">
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteProduct(product)}
                      className="p-2 text-[#888] hover:text-red-500 hover:bg-red-500/5 rounded-lg transition-all"
                      title="Delete Permanently"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-[#888] text-[10px] uppercase font-bold tracking-[0.2em] px-4">
        <p>DOON PERFUME HUB - Product Management Terminal</p>
        <div className="flex items-center space-x-4">
          <span>Showing: {visibleProducts.length}</span>
          <span>Total Listings: {products.length}</span>
          <span>Out of Stock: {products.filter((p) => p.stock === 0).length}</span>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center p-3 md:p-6 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] w-full max-w-5xl rounded-2xl shadow-2xl animate-in fade-in zoom-in duration-300 my-2 md:my-6 max-h-[95dvh] overflow-y-auto">
            <div className="p-6 border-b border-[#1a1a1a] flex justify-between items-center">
              <h2 className="text-xl font-serif text-[#D4AF37]">{editingProduct ? 'Edit Fragrance' : 'Add New Fragrance'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-[#888] hover:text-white transition-colors"><XCircle size={24} /></button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#888] font-bold">Product Name</label>
                  <input
                    required
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#888] font-bold">SKU (Unique ID)</label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. LUX-OUD-001"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#888] font-bold">Price (Rs.)</label>
                  <input
                    required
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="w-full bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#888] font-bold">Initial Stock</label>
                  <input
                    required
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: Number(e.target.value) })}
                    className="w-full bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#888] font-bold">Weight (Kg)</label>
                  <input
                    required
                    min={0}
                    step="0.01"
                    type="number"
                    value={formData.weightKg}
                    onChange={(e) => setFormData({ ...formData, weightKg: Number(e.target.value) })}
                    className="w-full bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-[#888] font-bold">Category</label>
                  <div className="relative" ref={categoryDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsCategoryDropdownOpen((prev) => !prev)}
                      className="w-full bg-black border border-[#1a1a1a] px-3 py-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none flex items-center justify-between text-left"
                    >
                      <span className="truncate">
                        {formData.categories.length > 0
                          ? formData.categories
                              .map((value) => categoryNamesByValue[value.toLowerCase()] || normalizeCategoryLabel(value))
                              .join(', ')
                          : 'Select category'}
                      </span>
                      <ChevronDown
                        size={16}
                        className={`text-[#888] transition-transform ${isCategoryDropdownOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isCategoryDropdownOpen ? (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-black border border-[#1a1a1a] rounded-lg z-30 overflow-hidden shadow-2xl">
                        <div className="max-h-52 overflow-y-auto">
                          {allCategoryOptions.map((categoryValue) => {
                            const isSelected = formData.categories.some(
                              (entry) => entry.toLowerCase() === categoryValue.toLowerCase()
                            );
                            return (
                              <button
                                type="button"
                                key={categoryValue}
                                onClick={() => toggleCategorySelection(categoryValue)}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-[#111] flex items-center justify-between"
                              >
                                <span>{categoryNamesByValue[categoryValue.toLowerCase()] || normalizeCategoryLabel(categoryValue)}</span>
                                <span
                                  className={`w-4 h-4 rounded border ${
                                    isSelected ? 'bg-[#D4AF37] border-[#D4AF37]' : 'border-[#444]'
                                  }`}
                                />
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingCustomCategory(true);
                            setIsCategoryDropdownOpen(false);
                          }}
                          className="w-full px-3 py-2 text-left text-sm border-t border-[#1a1a1a] text-[#D4AF37] hover:bg-[#111]"
                        >
                          Create Custom Category
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {isCreatingCustomCategory ? (
                    <div className="grid grid-cols-[84px_minmax(0,1fr)] gap-2">
                      <button
                        type="button"
                        onClick={addCustomCategoryToForm}
                        className="h-full px-3 py-3 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#D4AF37] text-black hover:bg-[#bda871] whitespace-nowrap"
                      >
                        Add
                      </button>
                      <input
                        required
                        type="text"
                        placeholder="Type custom category"
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        className="flex-1 bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none"
                      />
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#888] font-bold">Description</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest text-[#888] font-bold">Image URL</label>
                <input
                  type="url"
                  placeholder="https://example.com/product-image.jpg"
                  value={formData.images[0] || ''}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    setFormData({
                      ...formData,
                      images: value ? [value] : [],
                    });
                  }}
                  className="w-full bg-black border border-[#1a1a1a] p-3 text-sm rounded-lg focus:border-[#D4AF37] outline-none"
                />
              </div>

              <div className="space-y-3 border border-[#1a1a1a] rounded-xl p-4 bg-black/30">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] uppercase tracking-widest text-[#888] font-bold">Variants (Size/Price/Stock/Weight/Image)</label>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="text-[10px] uppercase tracking-widest font-bold text-[#D4AF37] hover:text-white transition-colors"
                  >
                    + Add Variant
                  </button>
                </div>

                {formData.variants.length === 0 ? (
                  <p className="text-[11px] text-[#666]">No variants added. Use base price/stock/weight for single-size product.</p>
                ) : (
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {formData.variants.map((variant, index) => (
                      <div key={`variant-${index}`} className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          placeholder="Size Label (e.g. 10ml)"
                          value={variant.label}
                          onChange={(e) => updateVariant(index, 'label', e.target.value)}
                          className="col-span-3 bg-black border border-[#1a1a1a] p-2 text-xs rounded-lg focus:border-[#D4AF37] outline-none"
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Price"
                          value={variant.price}
                          onChange={(e) => updateVariant(index, 'price', Number(e.target.value))}
                          className="col-span-2 bg-black border border-[#1a1a1a] p-2 text-xs rounded-lg focus:border-[#D4AF37] outline-none"
                        />
                        <input
                          type="number"
                          min={0}
                          placeholder="Stock"
                          value={variant.stock}
                          onChange={(e) => updateVariant(index, 'stock', Number(e.target.value))}
                          className="col-span-2 bg-black border border-[#1a1a1a] p-2 text-xs rounded-lg focus:border-[#D4AF37] outline-none"
                        />
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Weight Kg"
                          value={variant.weight}
                          onChange={(e) => updateVariant(index, 'weight', Number(e.target.value))}
                          className="col-span-2 bg-black border border-[#1a1a1a] p-2 text-xs rounded-lg focus:border-[#D4AF37] outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Image URL"
                          value={variant.image}
                          onChange={(e) => updateVariant(index, 'image', e.target.value)}
                          className="col-span-2 bg-black border border-[#1a1a1a] p-2 text-xs rounded-lg focus:border-[#D4AF37] outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => removeVariant(index)}
                          className="col-span-1 text-red-400 hover:text-red-300 transition-colors"
                          title="Remove Variant"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                <button type="submit" className="w-full bg-[#D4AF37] text-black py-4 rounded-xl font-bold tracking-widest text-xs uppercase hover:bg-white transition-all shadow-xl">
                  {editingProduct ? 'Update Listing' : 'Authenticate & Save Listing'}
                </button>
                {editingProduct ? (
                  <button
                    type="button"
                    onClick={handleDeleteFromModal}
                    disabled={isDeletingFromModal}
                    className="w-full bg-red-500/10 border border-red-500/40 text-red-400 py-4 rounded-xl font-bold tracking-widest text-xs uppercase hover:bg-red-500/20 transition-all disabled:opacity-70"
                  >
                    {isDeletingFromModal ? 'Deleting...' : 'Delete Listing'}
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
