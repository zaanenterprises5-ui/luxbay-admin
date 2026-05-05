"use client";
import { useState, useEffect, useCallback, ReactNode } from "react";
import Image from "next/image";

type Category = { _id: string; name: string; image?: string };

const CSS = `
  .card { background: #13131a; border: 1px solid #1e1e2e; border-radius: 12px; transition: border-color 0.18s; }
  .card:hover { border-color: #2a2a40; }
  .active-card { border-color: var(--brand) !important; box-shadow: 0 0 15px rgba(219, 39, 119, 0.1); }
  .btn-primary { background: var(--brand); color: #fff; border: none; border-radius: 8px; padding: 10px 20px; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
  .btn-primary:hover:not(:disabled) { background: var(--brand-dark); }
  .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
  .btn-ghost { background: transparent; color: #555570; border: 1px solid #1e1e2e; border-radius: 8px; padding: 6px 12px; font-size: 12px; cursor: pointer; transition: all 0.15s; }
  .btn-ghost:hover { color: #ef4444; border-color: #ef444440; }
  .btn-edit { background: transparent; color: var(--brand); border: 1px solid var(--brand-dark); border-radius: 6px; padding: 5px 12px; font-size: 12px; cursor: pointer; }
  .btn-edit:hover { background: var(--brand-light); }
  .input { background: #0f0f13; border: 1px solid #1e1e2e; border-radius: 8px; color: #e8e8f0; font-size: 13px; padding: 10px 14px; width: 100%; outline: none; transition: border-color 0.15s; box-sizing: border-box; }
  .input:focus { border-color: var(--brand); }
  .overlay { position: fixed; inset: 0; background: #000000aa; display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px; }
  .upload-area { border: 2px dashed #1e1e2e; border-radius: 8px; padding: 20px; text-align: center; cursor: pointer; transition: border-color 0.15s; }
  .upload-area:hover { border-color: var(--brand); }
`;

const toBase64 = (file: File): Promise<string> =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onloadend = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  const token = () => localStorage.getItem("token") || "";

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Record<string, any[]>>({});

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${api}/category`);
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch (e) { console.error(e); }
  }, [api]);

  const fetchRelatedProducts = async (catId: string) => {
    if (relatedProducts[catId]) return;
    try {
      const res = await fetch(`${api}/product?category=${catId}`);
      const data = await res.json();
      if (data.products) {
        setRelatedProducts(prev => ({ ...prev, [catId]: data.products.slice(0, 2) }));
      }
    } catch (e) { console.error(e); }
  };

  const handleCategoryClick = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchRelatedProducts(id);
    }
  };

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const openAdd = () => {
    setEditId(null);
    setName("");
    setImagePreview(null);
    setShowModal(true);
  };

  const openEdit = (c: Category) => {
    setEditId(c._id);
    setName(c.name);
    setImagePreview(c.image || null);
    setShowModal(true);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const b64 = await toBase64(file);
    setImagePreview(b64);
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editId) {
        const updatePayload: Record<string, unknown> = { name, description: "Updated from Admin" };
        if (imagePreview && imagePreview.startsWith("data:image")) {
          updatePayload.image = imagePreview;
        }
        const authToken = token();
        const res = await fetch(`${api}/category/${editId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: authToken },
          body: JSON.stringify({ category: updatePayload }),
        });
        const data = await res.json();
        if (data.success) {
          setCategories(prev => prev.map(c =>
            c._id === editId
              ? { ...c, name, image: imagePreview && !imagePreview.startsWith("data:") ? imagePreview : c.image }
              : c
          ));
          // refetch to get the new cloudinary URL
          fetchCategories();
          setShowModal(false);
        } else {
          alert((data.error || "Failed to save.") + (data.message ? "\n\n" + data.message : ""));
        }
      } else {
        const authToken = token();
        const res = await fetch(`${api}/category/add`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: authToken },
          body: JSON.stringify({
            name,
            description: "Added from Admin",
            isActive: true,
            image: imagePreview || undefined,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setCategories(prev => [...prev, data.category]);
          setShowModal(false);
        } else {
          alert((data.error || "Failed to save.") + (data.message ? "\n\n" + data.message : ""));
        }
      }
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this category?")) return;
    try {
      const authToken = token();
      const res = await fetch(`${api}/category/delete/${id}`, {
        method: "DELETE",
        headers: { Authorization: authToken },
      });
      const data = await res.json();
      if (data.success) setCategories(prev => prev.filter(c => c._id !== id));
      else alert(data.error || "Failed to delete.");
    } catch (e) { console.error(e); }
  };

  return (
    <div style={{ width: "100%" }}>
      <style>{CSS}</style>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: "clamp(20px,5vw,26px)", fontWeight: 800, color: "#e8e8f0", margin: 0 }}>
            Categories
          </h1>
          <p style={{ fontSize: 13, color: "#44445a", margin: "4px 0 0 0" }}>{categories.length} total</p>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add New</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
        {categories.length === 0 && (
          <p style={{ color: "#44445a", fontSize: 13 }}>No categories yet.</p>
        )}
        {categories.map(cat => (
          <div 
            key={cat._id} 
            className={`card${expandedId === cat._id ? " active-card" : ""}`} 
            style={{ padding: 20, cursor: "pointer", position: "relative" }}
            onClick={() => handleCategoryClick(cat._id)}
          >
            {cat.image && (
              <div style={{ marginBottom: 12, borderRadius: 8, overflow: "hidden", height: 100, position: "relative", background: "#0f0f13" }}>
                <Image src={cat.image} alt={cat.name} fill style={{ objectFit: "cover" }} unoptimized />
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#e8e8f0", wordBreak: "break-word" }}>{cat.name}</div>
              <button 
                className="btn-ghost" 
                onClick={(e) => { e.stopPropagation(); remove(cat._id); }}
                style={{ padding: "2px 8px" }}
              >x</button>
            </div>

            {expandedId === cat._id && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #1e1e2e" }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Related Products
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {relatedProducts[cat._id]?.length > 0 ? (
                    relatedProducts[cat._id].map((p, idx) => {
                      const img = p.variants?.find((v: any) => v.isDefault)?.images?.[0] || p.variants?.[0]?.images?.[0];
                      return (
                        <div key={idx} style={{ flex: 1, position: "relative", aspectRatio: "1/1", borderRadius: 6, overflow: "hidden", background: "#0a0a0f", border: "1px solid #1e1e2e" }}>
                          {img ? (
                            <Image src={img} alt={p.name} fill style={{ objectFit: "cover" }} />
                          ) : (
                            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>📦</div>
                          )}
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 8, padding: "2px 4px", textAlign: "center" }}>
                            {p.name.slice(0, 10)}...
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ fontSize: 11, color: "#44445a" }}>No products found</div>
                  )}
                </div>
              </div>
            )}

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1e1e2e", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button className="btn-edit" onClick={(e) => { e.stopPropagation(); openEdit(cat); }}>Edit</button>
              <div style={{ fontSize: 10, color: "#44445a" }}>{expandedId === cat._id ? "Collapse" : "Click to view products"}</div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="card" style={{ width: "clamp(300px,90vw,440px)", padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: "#e8e8f0", marginBottom: 20 }}>
              {editId ? "Edit Category" : "New Category"}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <FieldLabel label="Category Name">
                <input
                  className="input"
                  value={name}
                  placeholder="e.g. Clothing"
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && save()}
                  autoFocus
                />
              </FieldLabel>

              <FieldLabel label="Category Image">
                <label className="upload-area" style={{ display: "block" }}>
                  {imagePreview ? (
                    <div style={{ position: "relative", height: 120, borderRadius: 6, overflow: "hidden" }}>
                      <Image src={imagePreview} alt="preview" fill style={{ objectFit: "cover" }} unoptimized />
                      <div style={{ position: "absolute", inset: 0, background: "#00000060", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ color: "#fff", fontSize: 12 }}>Click to change</span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: "#555570", fontSize: 13 }}>
                      <div style={{ fontSize: 24, marginBottom: 6 }}>📷</div>
                      Click to upload image
                    </div>
                  )}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageChange} />
                </label>
                {imagePreview && (
                  <button
                    onClick={() => setImagePreview(null)}
                    style={{ marginTop: 6, background: "transparent", border: "none", color: "#ef4444", fontSize: 12, cursor: "pointer" }}
                  >
                    Remove image
                  </button>
                )}
              </FieldLabel>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary" onClick={save} disabled={saving}>
                {saving ? "Saving..." : editId ? "Save Changes" : "Add Category"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#555570", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}