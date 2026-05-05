"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

/* ─── Types ─────────────────────────────────────────── */
type SizeEntry = { size: string; stock: string; price: string };

type Variant = {
  _id?: string;
  color: string;
  price: string;
  stock: string;
  sizes: SizeEntry[];
  images: string[];       // base64 previews / stored URLs
  isDefault: boolean;
};

type Product = {
  _id: string;
  name: string;
  description: string;
  category?: { _id: string; name: string } | null;
  subcategory?: { _id: string; name: string } | null;
  variants: Variant[];
  isActive: boolean;
};

type Category = { _id: string; name: string };
type Subcategory = { _id: string; name: string };

const BLANK_VARIANT = (): Variant => ({
  color: "", price: "", stock: "0", sizes: [], images: [], isDefault: false,
});

/* ─── Helpers ────────────────────────────────────────── */
const toBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onloadend = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

const token = () => localStorage.getItem("token") || "";

/* ─── Main Component ─────────────────────────────────── */
export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [filteredSubs, setFilteredSubs] = useState<Subcategory[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [variants, setVariants] = useState<Variant[]>([{ ...BLANK_VARIANT(), isDefault: true }]);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

  const fetchProducts = useCallback(async () => {
    try {
      const authToken = token();
      const res = await fetch(`${api}/product`, { headers: { Authorization: authToken } });
      const data = await res.json();
      if (data.products) setProducts(data.products);
    } catch (e) { console.error(e); }
  }, [api]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${api}/category`);
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch (e) { console.error(e); }
  }, [api]);

  const fetchSubcategories = useCallback(async () => {
    try {
      const res = await fetch(`${api}/subcategory`);
      const data = await res.json();
      if (data.subcategories) setSubcategories(data.subcategories);
    } catch (e) { console.error(e); }
  }, [api]);

  useEffect(() => { fetchProducts(); fetchCategories(); fetchSubcategories(); }, [fetchProducts, fetchCategories, fetchSubcategories]);

  // Show all subcategories regardless of category selection
  useEffect(() => {
    setFilteredSubs(subcategories);
    setSubcategoryId("");
  }, [categoryId, subcategories]);

  /* ── Variant helpers ── */
  const addVariant = () => setVariants(v => [...v, BLANK_VARIANT()]);

  const removeVariant = (i: number) => {
    setVariants(prev => {
      const next = prev.filter((_, idx) => idx !== i);
      if (next.length && !next.some(v => v.isDefault)) next[0].isDefault = true;
      return next;
    });
  };

  const updateVariant = (i: number, field: keyof Variant, value: unknown) => {
    setVariants(prev => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v));
  };

  const setDefault = (i: number) => {
    setVariants(prev => prev.map((v, idx) => ({ ...v, isDefault: idx === i })));
  };

  const addImages = async (i: number, files: FileList) => {
    const b64s = await Promise.all(Array.from(files).map(toBase64));
    setVariants(prev => prev.map((v, idx) =>
      idx === i ? { ...v, images: [...v.images, ...b64s] } : v
    ));
  };

  const removeImage = (vi: number, ii: number) => {
    setVariants(prev => prev.map((v, idx) =>
      idx === vi ? { ...v, images: v.images.filter((_, i) => i !== ii) } : v
    ));
  };

  const addSize = (vi: number) => {
    setVariants(prev => prev.map((v, idx) =>
      idx === vi ? { ...v, sizes: [...v.sizes, { size: "", stock: "0", price: "" }] } : v
    ));
  };

  const updateSize = (vi: number, si: number, field: keyof SizeEntry, value: string) => {
    setVariants(prev => prev.map((v, idx) =>
      idx === vi ? { ...v, sizes: v.sizes.map((s, i) => i === si ? { ...s, [field]: value } : s) } : v
    ));
  };

  const removeSize = (vi: number, si: number) => {
    setVariants(prev => prev.map((v, idx) =>
      idx === vi ? { ...v, sizes: v.sizes.filter((_, i) => i !== si) } : v
    ));
  };

  /* ── Reset ── */
  const resetForm = () => {
    setName(""); setDescription(""); setCategoryId(""); setSubcategoryId("");
    setVariants([{ ...BLANK_VARIANT(), isDefault: true }]);
    setEditId(null); setError("");
  };

  /* ── Validate ── */
  const validate = (): string | null => {
    if (!name.trim()) return "Product name is required.";
    if (!description.trim()) return "Description is required.";
    if (variants.length === 0) return "At least one variant is required.";
    const colors = variants.map(v => v.color.trim().toLowerCase());
    if (colors.some(c => !c)) return "Every variant must have a color.";
    if (new Set(colors).size !== colors.length) return "Each variant flavour must be unique.";
    for (const v of variants) {
      const vPrice = Number(v.price) || (v.sizes.length > 0 ? Number(v.sizes[0].price) : 0);
      if (vPrice <= 0) return "Every variant must have a valid price (check your quantities).";
    }
    return null;
  };

  /* ── Save ── */
  const saveProduct = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError("");

    const payload = {
      name, description,
      category: categoryId || undefined,
      subcategory: subcategoryId || undefined,
      variants: variants.map(v => {
        const vPrice = Number(v.price) || (v.sizes.length > 0 ? Number(v.sizes[0].price) : 0);
        return {
          ...v,
          price: vPrice,
          stock: Number(v.stock),
          sizes: v.sizes.map(s => ({
            ...s,
            price: Number(s.price) || vPrice,
            stock: Number(s.stock)
          }))
        };
      }),
    };

    try {
      const url = editId
        ? `${api}/product/update/${editId}`
        : `${api}/product/add`;
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: token() },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed"); return; }

      // update local state directly — no extra fetch needed
      if (editId) {
        setProducts(prev => prev.map(p => p._id === editId ? data.product : p));
      } else {
        setProducts(prev => [...prev, data.product]);
      }
      resetForm();
      setShowModal(false);
    } catch {
      setError("Network error. Is the server running?");
    } finally {
      setSaving(false);
    }
  };

  /* ── Edit ── */
  const handleEdit = (p: Product) => {
    setEditId(p._id);
    setName(p.name);
    setDescription(p.description);
    setCategoryId(p.category?._id || "");
    setSubcategoryId(p.subcategory?._id || "");
    setVariants(p.variants.map(v => ({
      ...v,
      price: String(v.price),
      stock: String(v.stock),
      sizes: v.sizes.map(s => ({ ...s, price: String(s.price), stock: String(s.stock) }))
    })));
    setError("");
    setShowModal(true);
  };

  /* ── Delete ── */
  const remove = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    const res = await fetch(`${api}/product/delete/${id}`, {
      method: "DELETE", headers: { Authorization: token() },
    });
    if (res.ok) setProducts(prev => prev.filter(p => p._id !== id));
  };

  const filtered = products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  /* ─── Render ─────────────────────────────────────────── */
  return (
    <div style={{ width: "100%", maxWidth: "100%" }}>
      <style>{`
        .card{background:#13131a;border:1px solid #1e1e2e;border-radius:12px;}
        .btn-primary{background:var(--brand);color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:13px;font-weight:600;cursor:pointer;}
        .btn-primary:hover{background:var(--brand-dark);}
        .btn-primary:disabled{opacity:.5;cursor:not-allowed;}
        .btn-ghost{background:transparent;color:#555570;border:1px solid #1e1e2e;border-radius:8px;padding:6px 12px;font-size:12px;cursor:pointer;}
        .btn-ghost:hover{color:#ef4444;border-color:#ef444440;}
        .btn-sm{background:#1e1e2e;color:var(--brand);border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer;}
        .btn-sm:hover{background:#2a2a40;}
        .input{background:#0f0f13;border:1px solid #1e1e2e;border-radius:8px;color:#e8e8f0;padding:10px;width:100%;box-sizing:border-box;font-size:13px;outline:none;}
        .input:focus{border-color:var(--brand);}
        .overlay{position:fixed;inset:0;background:#000000bb;display:flex;align-items:center;justify-content:center;z-index:100;}
        .variant-card{background:#0f0f13;border:1px solid #1e1e2e;border-radius:10px;padding:16px;position:relative;}
        .variant-card.default{border-color:var(--brand);}
        .err{color:#ef4444;font-size:12px;margin-bottom:12px;background:#ef444415;padding:8px 12px;border-radius:6px;}
        .trow td{padding:14px 20px;border-bottom:1px solid #1a1a26;color:#e8e8f0;font-size:13px;}
        .color-dot{width:12px;height:12px;border-radius:50%;display:inline-block;margin-right:6px;border:1px solid #ffffff30;}
        .img-thumb{width:40px;height:40px;object-fit:cover;border-radius:6px;border:1px solid #1e1e2e;}
        .img-remove{position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;}
        .modal-card{scrollbar-width:none;-ms-overflow-style:none;}
        .modal-card::-webkit-scrollbar{display:none;}
        
        @media (max-width: 1024px) {
          .btn-primary { padding: 8px 16px; font-size: 12px; }
          .btn-ghost { padding: 5px 10px; font-size: 11px; }
          .trow td { padding: 10px 12px; font-size: 12px; }
        }
        @media (max-width: 768px) {
          .trow { display: block; margin-bottom: 16px; border: 1px solid #1e1e2e; border-radius: 8px; padding: 12px; }
          .trow td { display: block; padding: 8px 0; border: none; margin-bottom: 8px; }
          .trow td:before { content: attr(data-label); font-weight: 600; color: #d4af37; display: block; margin-bottom: 4px; }
          .overlay { padding: 16px; }
          .modal-card { width: calc(100% - 32px) !important; max-height: 90vh !important; }
        }
        @media (max-width: 640px) {
          .modal-card { width: calc(100% - 24px) !important; padding: 16px !important; }
          .input { font-size: 14px; }
          .btn-primary { padding: 8px 12px; font-size: 12px; width: 100%; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 12, width: "100%" }}>
        <div>
          <h1 style={{ color: "#e8e8f0", fontFamily: "'Syne',sans-serif", fontSize: "clamp(20px, 5vw, 26px)", fontWeight: 800, margin: 0 }}>Products</h1>
          <p style={{ color: "#44445a", fontSize: 13, margin: "4px 0 0 0" }}>{products.length} total</p>
        </div>
        <button className="btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>+ Add Product</button>
      </div>

      {/* Search */}
      <input className="input" style={{ marginBottom: 20, width: "100%" }} placeholder="Search products…" value={search} onChange={e => setSearch(e.target.value)} />

      {/* Table */}
      <div className="card" style={{ overflowX: "auto", overflowY: "hidden", width: "100%" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #1e1e2e" }}>
              {["Product", "Category", "Variants", "Actions"].map(h => (
                <td key={h} style={{ padding: "12px 20px", fontSize: 11, color: "#555570", fontWeight: 600, textTransform: "uppercase" }}>{h}</td>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#44445a", fontSize: 13 }}>No products yet</td></tr>
            )}
            {filtered.map(p => {
              const def = p.variants?.find(v => v.isDefault) || p.variants?.[0];
              return (
                <tr key={p._id} className="trow">
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {def?.images?.[0]
                        ? <Image src={def.images[0]} className="img-thumb" alt={p.name} width={40} height={40} style={{ objectFit: "cover" }} />
                        : <div style={{ width: 40, height: 40, borderRadius: 6, background: "#1e1e2e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📦</div>
                      }
                      <div>
                        <div style={{ fontWeight: 600 }}>{p.name}</div>
                        {def && <div style={{ fontSize: 11, color: "#555570" }}>${Number(def.price).toFixed(2)}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ color: "var(--brand)", fontSize: 12 }}>{p.category?.name || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {p.variants?.map(v => (
                        <span key={v._id} title={v.color} style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          background: "#1e1e2e", borderRadius: 20, padding: "2px 8px", fontSize: 11, color: "#e8e8f0",
                           border: v.isDefault ? "1px solid var(--brand)" : "1px solid transparent"
                        }}>
                          <span className="color-dot" style={{ background: v.color }} />
                          {v.color}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn-ghost" onClick={() => handleEdit(p)}>Edit</button>
                      <button className="btn-ghost" onClick={() => remove(p._id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="overlay" onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="card modal-card" style={{ width: "clamp(300px, 90vw, 620px)", padding: "clamp(16px, 4vw, 28px)", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: "#e8e8f0", marginBottom: 20 }}>
              {editId ? "Edit Product" : "New Product"}
            </div>

            {error && <div className="err">{error}</div>}

            {/* Base fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 24 }}>
              <Field label="Product Name">
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Floral Dress" />
              </Field>
              <Field label="Description">
                <textarea className="input" value={description} rows={3} onChange={e => setDescription(e.target.value)} placeholder="Product description" style={{ resize: "vertical" }} />
              </Field>
              <Field label="Category">
                <select className="input" value={categoryId} onChange={e => setCategoryId(e.target.value)}>
                  <option value="">— Select category —</option>
                  {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Brands">
                <select className="input" value={subcategoryId} onChange={e => setSubcategoryId(e.target.value)}>
                  <option value="">— Select Brands (optional) —</option>
                  {filteredSubs.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                </select>
              </Field>
            </div>

            {/* Variants */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#e8e8f0" }}>
                Variants <span style={{ color: "#555570", fontWeight: 400 }}>({variants.length})</span>
              </div>
              <button className="btn-sm" onClick={addVariant}>+ Add Variant</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {variants.map((v, i) => (
                <VariantCard
                  key={i}
                  variant={v}
                  index={i}
                  total={variants.length}
                  onUpdate={updateVariant}
                  onRemove={removeVariant}
                  onSetDefault={setDefault}
                  onAddImages={addImages}
                  onRemoveImage={removeImage}
                  onAddSize={addSize}
                  onUpdateSize={updateSize}
                  onRemoveSize={removeSize}
                />
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
              <button className="btn-primary" onClick={saveProduct} disabled={saving}>
                {saving ? "Saving…" : editId ? "Save Changes" : "Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Field ─────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)" }}>{label}</label>
      {children}
    </div>
  );
}

/* ─── VariantCard ────────────────────────────────────── */
function VariantCard({
  variant, index, total, onUpdate, onRemove, onSetDefault, onAddImages, onRemoveImage,
  onAddSize, onUpdateSize, onRemoveSize,
}: {
  variant: Variant;
  index: number;
  total: number;
  onUpdate: (i: number, field: keyof Variant, value: unknown) => void;
  onRemove: (i: number) => void;
  onSetDefault: (i: number) => void;
  onAddImages: (i: number, files: FileList) => void;
  onRemoveImage: (vi: number, ii: number) => void;
  onAddSize: (vi: number) => void;
  onUpdateSize: (vi: number, si: number, field: keyof SizeEntry, value: string) => void;
  onRemoveSize: (vi: number, si: number) => void;
}) {
  return (
    <div className={`variant-card${variant.isDefault ? " default" : ""}`}>
      {total > 1 && (
        <button
          onClick={() => onRemove(index)}
          style={{ position: "absolute", top: 10, right: 10, background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16 }}
        >×</button>
      )}

      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <Field label="Flavour">
          <input className="input" value={variant.color} onChange={e => onUpdate(index, "color", e.target.value)} placeholder="e.g. Red" style={{ width: "200px" }} />
        </Field>
        {/* Price ($) box removed as requested */}
        <Field label="Total Stock">
          <input className="input" type="number" min="0" value={variant.stock} onChange={e => onUpdate(index, "stock", e.target.value)} placeholder="0" style={{ width: "120px" }} />
        </Field>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <label style={{ fontSize: 12, color: "var(--brand)", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={variant.isDefault} onChange={() => onSetDefault(index)} />
          Default variant
        </label>
      </div>

      {/* Images - Total 5 (1 Main + 4 Sub) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 15 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)" }}>
            Product Images <span style={{ color: "#555570", fontWeight: 400 }}>({variant.images.length}/5)</span>
          </span>
          {variant.images.length < 5 && (
            <label style={{ cursor: "pointer", background: "#1e1e2e", borderRadius: 6, padding: "6px 12px", fontSize: 11, color: "var(--brand)", border: "1px solid var(--brand-dark)" }}>
              + Add {variant.images.length === 0 ? "Main" : "Sub"} Image
              <input 
                type="file" 
                accept="image/*" 
                multiple={5 - variant.images.length > 1} 
                style={{ display: "none" }} 
                onChange={e => {
                  if (e.target.files) {
                    const remaining = 5 - variant.images.length;
                    const filesToLoad = Array.from(e.target.files).slice(0, remaining);
                    const dt = new DataTransfer();
                    filesToLoad.forEach(f => dt.items.add(f));
                    onAddImages(index, dt.files);
                  }
                }} 
              />
            </label>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
          {[0, 1, 2, 3, 4].map((i) => {
            const src = variant.images[i];
            const isMain = i === 0;
            
            return (
              <div key={i} style={{ 
                position: "relative", 
                aspectRatio: "1/1", 
                background: "#0a0a0f", 
                borderRadius: 8, 
                border: src ? "1px solid #1e1e2e" : "1px dashed #1e1e2e",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden"
              }}>
                {src ? (
                  <>
                    <Image src={src} alt={`img-${i}`} fill style={{ objectFit: "cover" }} />
                    <button className="img-remove" onClick={() => onRemoveImage(index, i)} style={{ zIndex: 2 }}>×</button>
                    <div style={{ 
                      position: "absolute", 
                      bottom: 0, 
                      left: 0, 
                      right: 0, 
                      background: isMain ? "var(--brand)" : "rgba(0,0,0,0.7)", 
                      color: "#fff", 
                      fontSize: "9px", 
                      textAlign: "center", 
                      padding: "2px 0",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em"
                    }}>
                      {isMain ? "MAIN" : `SUB ${i}`}
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#2a2a38", fontSize: 10, fontWeight: 600 }}>
                    {isMain ? "MAIN" : `SUB ${i}`}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sizes */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)" }}>Quantity</span>
          <button className="btn-sm" onClick={() => onAddSize(index)}>+ Add Quantity</button>
        </div>
        {variant.sizes.length === 0 && (
          <p style={{ fontSize: 11, color: "#44445a", margin: 0 }}>No sizes added</p>
        )}
        {variant.sizes.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 4, paddingLeft: 4 }}>
            <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: "#44445a", textTransform: "uppercase" }}>Label</span>
            <span style={{ width: 80, fontSize: 10, fontWeight: 700, color: "#44445a", textTransform: "uppercase" }}>Price ₹</span>
            <span style={{ width: 80, fontSize: 10, fontWeight: 700, color: "#44445a", textTransform: "uppercase" }}>Stock</span>
            <span style={{ width: 24 }}></span>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {variant.sizes.map((s, si) => (
            <div key={si} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="input"
                value={s.size}
                onChange={e => onUpdateSize(index, si, "size", e.target.value)}
                placeholder="e.g. 100g, 250g"
                style={{ flex: 1 }}
              />
              <input
                className="input"
                type="number"
                min="0"
                value={s.price}
                onChange={e => onUpdateSize(index, si, "price", e.target.value)}
                placeholder="42"
                style={{ width: 80 }}
              />
              <input
                className="input"
                type="number"
                min="0"
                value={s.stock}
                onChange={e => onUpdateSize(index, si, "stock", e.target.value)}
                placeholder="0"
                style={{ width: 80 }}
              />
              <button
                onClick={() => onRemoveSize(index, si)}
                style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, lineHeight: 1, width: 24 }}
              >×</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
