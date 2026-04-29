"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { API_ROUTES } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";

type Category = {
  _id?: string;
  value: string;
  name: string;
  description: string;
  image: string;
};

const slugify = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function CategoryEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const isCreateMode = id === "new";

  const [form, setForm] = useState<Category>({
    value: "",
    name: "",
    description: "",
    image: "",
  });
  const [loading, setLoading] = useState(!isCreateMode);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isCreateMode || !id) return;

    const fetchCategory = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(API_ROUTES.PRODUCT_CATEGORY_BY_ID(id), { cache: "no-store" });
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.message || "Failed to fetch category");
        setForm({
          _id: payload._id,
          value: payload.value || "",
          name: payload.name || "",
          description: payload.description || "",
          image: payload.image || "",
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to fetch category");
      } finally {
        setLoading(false);
      }
    };

    fetchCategory();
  }, [id, isCreateMode]);

  const suggestedValue = useMemo(() => slugify(form.name), [form.name]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const userStr = localStorage.getItem("user");
      const token = userStr ? JSON.parse(userStr)?.token : "";
      if (!token) throw new Error("Not authenticated");

      const payload = {
        value: isCreateMode ? suggestedValue : String(form.value || '').trim().toLowerCase(),
        name: form.name.trim(),
        description: form.description.trim(),
        image: form.image.trim(),
      };

      if (!payload.value || !payload.name) {
        throw new Error("Category name is required");
      }

      const url = isCreateMode ? API_ROUTES.PRODUCT_CATEGORIES : API_ROUTES.PRODUCT_CATEGORY_BY_ID(id || "");
      const method = isCreateMode ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.message || "Failed to save category");

      router.push("/admin/categories");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const onDeleteCategory = async () => {
    if (isCreateMode || !id) return;
    const confirmed = window.confirm(
      "Delete this category? This cannot be undone. If products are still using this category, deletion will be blocked."
    );
    if (!confirmed) return;

    setDeleting(true);
    setError("");
    try {
      const userStr = localStorage.getItem("user");
      const token = userStr ? JSON.parse(userStr)?.token : "";
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(API_ROUTES.PRODUCT_CATEGORY_BY_ID(id), {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.message || "Failed to delete category");

      router.push("/admin/categories");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to delete category");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif text-[#D4AF37]">{isCreateMode ? "Add Category" : "Edit Category"}</h1>
        <Link href="/admin/categories" className="text-sm text-[#D4AF37] underline underline-offset-2 hover:text-white">
          Back
        </Link>
      </div>

      {loading ? <p className="text-[#888]">Loading...</p> : null}
      {error ? <p className="text-red-400">{error}</p> : null}

      {!loading ? (
        <form onSubmit={onSubmit} className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-[#888] font-bold">1. Category Name</label>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              className="w-full bg-black border border-[#1a1a1a] p-3 rounded-lg text-sm focus:border-[#D4AF37] outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-[#888] font-bold">2. Category Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="w-full bg-black border border-[#1a1a1a] p-3 rounded-lg text-sm focus:border-[#D4AF37] outline-none"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest text-[#888] font-bold">3. Category Image SRC URL</label>
            <input
              type="url"
              value={form.image}
              onChange={(e) => setForm((prev) => ({ ...prev, image: e.target.value }))}
              placeholder="https://example.com/category-icon.png"
              className="w-full bg-black border border-[#1a1a1a] p-3 rounded-lg text-sm focus:border-[#D4AF37] outline-none"
            />
            <p className="text-[11px] text-[#888]">Use image URL only. File upload/drop is disabled.</p>
            <div className="w-20 h-20 rounded-lg bg-black border border-[#1a1a1a] overflow-hidden flex items-center justify-center">
              {form.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.image} alt={form.name || "Category"} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[#666] text-[10px]">Preview</span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-[#D4AF37] text-black py-3 rounded-xl text-xs tracking-[0.16em] uppercase font-bold hover:bg-[#c6a43a] transition-colors disabled:opacity-70"
            >
              {saving ? "Saving..." : isCreateMode ? "Create Category" : "Update Category"}
            </button>
            {!isCreateMode ? (
              <button
                type="button"
                onClick={onDeleteCategory}
                disabled={deleting}
                className="w-full bg-red-500/10 border border-red-500/40 text-red-400 py-3 rounded-xl text-xs tracking-[0.16em] uppercase font-bold hover:bg-red-500/20 transition-colors disabled:opacity-70"
              >
                {deleting ? "Deleting..." : "Delete Category"}
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
