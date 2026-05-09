"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { API_ROUTES } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import { UploadCloud, Trash2, CheckCircle2 } from "lucide-react";

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
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [uploadedImageOptions, setUploadedImageOptions] = useState<string[]>([]);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isImageDropActive, setIsImageDropActive] = useState(false);

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
        const existingImage = String(payload.image || "").trim();
        setUploadedImageOptions(existingImage ? [existingImage] : []);
        setImageUrlInput(existingImage);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to fetch category");
      } finally {
        setLoading(false);
      }
    };

    fetchCategory();
  }, [id, isCreateMode]);

  const suggestedValue = useMemo(() => slugify(form.name), [form.name]);

  const addImageUrlToOptions = () => {
    const url = imageUrlInput.trim();
    if (!url) return;
    setUploadedImageOptions((prev) => [...new Set([...prev, url])]);
    setForm((prev) => ({ ...prev, image: url }));
    setImageUrlInput("");
  };

  const removeImageOption = (targetUrl: string) => {
    setUploadedImageOptions((prev) => {
      const next = prev.filter((entry) => entry !== targetUrl);
      if (form.image === targetUrl) {
        setForm((current) => ({ ...current, image: next[0] || "" }));
      }
      return next;
    });
  };

  const uploadImagesToServer = async (files: File[]) => {
    if (!files.length) return;
    setIsUploadingImages(true);
    setUploadError("");
    try {
      const userStr = localStorage.getItem("user");
      const token = userStr ? JSON.parse(userStr)?.token : "";
      if (!token) throw new Error("Not authenticated");

      const payload = new FormData();
      files.forEach((file) => payload.append("images", file));

      const res = await fetch(`${API_ROUTES.PRODUCTS}/admin/upload-images`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: payload,
      });
      const result = await res.json().catch(() => null);
      if (!res.ok) throw new Error(result?.message || "Image upload failed");

      const urls = Array.isArray(result?.urls)
        ? result.urls.map((entry: unknown) => String(entry || "").trim()).filter(Boolean)
        : [];
      if (urls.length === 0) throw new Error("Upload succeeded but no image URL returned");

      setUploadedImageOptions((prev) => [...new Set([...prev, ...urls])]);
      if (!form.image) {
        setForm((prev) => ({ ...prev, image: urls[0] }));
      }
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : "Image upload failed");
    } finally {
      setIsUploadingImages(false);
    }
  };

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
      if (!res.ok) {
        const productNames = Array.isArray(payload?.products)
          ? payload.products
              .map((product: { name?: string; sku?: string }) => `${product?.name || "Unknown"}${product?.sku ? ` (${product.sku})` : ""}`)
              .join(", ")
          : "";
        const detail = productNames ? ` In use by: ${productNames}` : "";
        throw new Error((payload?.message || "Failed to delete category") + detail);
      }

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
            <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
              <input
                type="url"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://example.com/category-icon.png"
                className="w-full bg-black border border-[#1a1a1a] p-3 rounded-lg text-sm focus:border-[#D4AF37] outline-none"
              />
              <button
                type="button"
                onClick={addImageUrlToOptions}
                className="px-3 py-3 text-xs font-bold uppercase tracking-widest rounded-lg bg-[#D4AF37] text-black hover:bg-[#bda871] whitespace-nowrap"
              >
                Add URL
              </button>
            </div>
            <div
              className={`mt-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
                isImageDropActive ? "border-[#D4AF37] bg-[#D4AF37]/5" : "border-[#2a2a2a] bg-black/30"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsImageDropActive(true);
              }}
              onDragLeave={() => setIsImageDropActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setIsImageDropActive(false);
                const files = Array.from(event.dataTransfer.files || []).filter((file) =>
                  String(file.type || "").toLowerCase().startsWith("image/")
                );
                uploadImagesToServer(files);
              }}
            >
              <p className="text-xs text-[#888] mb-3">Drag & drop category images here or choose files</p>
              <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-lg border border-[#D4AF37]/60 text-[#D4AF37] hover:bg-[#D4AF37]/10">
                <UploadCloud size={14} />
                {isUploadingImages ? "Uploading..." : "Choose Files"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    uploadImagesToServer(files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              {uploadError ? <p className="text-[11px] text-red-400 mt-3">{uploadError}</p> : null}
            </div>
            <p className="text-[11px] text-[#888]">You can upload files or add image URLs. Click one image below to set it as active.</p>

            {uploadedImageOptions.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {uploadedImageOptions.map((url, idx) => {
                  const isActive = form.image === url;
                  return (
                    <div
                      key={`${url}-${idx}`}
                      onClick={() => setForm((prev) => ({ ...prev, image: url }))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setForm((prev) => ({ ...prev, image: url }));
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      className={`relative rounded-lg overflow-hidden border text-left ${
                        isActive ? "border-[#D4AF37]" : "border-[#1a1a1a]"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Category option ${idx + 1}`} className="w-full h-24 object-cover opacity-90" />
                      {isActive ? (
                        <span className="absolute left-1 top-1 bg-black/70 text-[#D4AF37] rounded px-1.5 py-0.5 text-[10px] inline-flex items-center gap-1">
                          <CheckCircle2 size={11} /> Active
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          removeImageOption(url);
                        }}
                        className="absolute top-1 right-1 p-1 rounded bg-black/70 text-red-300 hover:text-red-200"
                        title="Remove image"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}

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
