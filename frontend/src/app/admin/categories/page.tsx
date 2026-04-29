"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_ROUTES } from "@/lib/api";

type Category = {
  _id: string;
  value: string;
  name: string;
  description?: string;
  image?: string;
};

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_ROUTES.PRODUCT_CATEGORIES}?_ts=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load categories");
        const payload = await res.json();
        setCategories(Array.isArray(payload) ? payload : []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load categories");
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-[#888] text-xs uppercase tracking-[0.2em]">Manage Categories</p>
        <Link
          href="/admin/categories/new"
          className="bg-[#D4AF37] text-black px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold hover:bg-[#c6a43a] transition-colors"
        >
          + Add Category
        </Link>
      </div>

      {loading ? <p className="text-[#888]">Loading categories...</p> : null}
      {error ? <p className="text-red-400">{error}</p> : null}

      {!loading && !error ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {categories.map((category) => (
            <Link
              key={category._id}
              href={`/admin/categories/${category._id}`}
              className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-4 min-h-[140px] hover:border-[#D4AF37]/50 transition-colors"
            >
              <div className="w-12 h-12 rounded-lg bg-black border border-[#1a1a1a] mb-3 overflow-hidden flex items-center justify-center">
                {category.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={category.image} alt={category.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-[#888] text-[10px]">No Img</span>
                )}
              </div>
              <p className="text-[#D4AF37] font-semibold text-sm">{category.name || category.value}</p>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
