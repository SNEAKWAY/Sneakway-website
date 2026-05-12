import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthToken, getAuthHeader } from "../utils/auth.js";

const API_URL = import.meta.env.VITE_API_URL;
const emptyForm = {
  id: null,
  name: "",
  description: "",
  price: "",
  offerPrice: "",
  brand: "",
  category: "Shoes",
  sizes: [],
  isBestSeller: false,
  images: [],
};

const extractDriveId = (url) => {
  if (!url) return null;
  const match =
    url.match(/\/file\/d\/([^/]+)/) ||
    url.match(/\/thumbnail\/([^/]+)/) ||
    url.match(/[?&]id=([^&]+)/);
  return match ? match[1] : null;
};

const normalizeImageUrl = (url) => {
  const trimmed = url?.trim();
  if (!trimmed) return "";
  const driveId = extractDriveId(trimmed);
  // googleusercontent.com works reliably for public Drive images
  return driveId
    ? `https://drive.google.com/thumbnail?id=${driveId}&sz=w1000`
    : trimmed;
};

const fileToDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

const MAX_IMAGES = 2;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const BASE_BRAND_OPTIONS = [
  "Nike",
  "New Balance",
  "Vans",
  "Converse",
  "Zara",
  "Birkenstock",
  "Puma",
  "Adidas",
  "Diesel",
];
const SIZE_OPTIONS = Array.from({ length: 10 }, (_, idx) => 36 + idx);
const LADIES_SIZES = [36, 37, 38, 39, 40];
const MENS_SIZES = [40, 41, 42, 43, 44, 45];

const isShoeProduct = (product) => {
  const c = product.category?.trim().toLowerCase() || "";
  return !["bags", "bag", "watches", "watch"].includes(c);
};

const Admin = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [brandOptions, setBrandOptions] = useState(BASE_BRAND_OPTIONS);
  const [customBrand, setCustomBrand] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sale, setSale] = useState({
    name: "",
    description: "",
    price: "",
    startDate: "",
    endDate: "",
    enabled: false,
  });
  const [saleHistory, setSaleHistory] = useState([]);
  const [isSavingSale, setIsSavingSale] = useState(false);

  const isEditing = useMemo(() => Boolean(form.id), [form.id]);

  const shoeProducts = useMemo(
    () => products.filter(isShoeProduct),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filtered = !query
      ? shoeProducts
      : shoeProducts.filter((product) => {
          const name = product.name?.toLowerCase() || "";
          const brand = product.brand?.toLowerCase() || "";
          return name.includes(query) || brand.includes(query);
        });

    return [...filtered].sort(
      (a, b) => Number(b.id || 0) - Number(a.id || 0),
    );
  }, [shoeProducts, searchTerm]);

  const loadProducts = async () => {
    try {
      const response = await fetch(`${API_URL}/products`);
      const data = await response.json();
      setProducts(data);
    } catch (error) {
      console.error("Failed to load products", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSale = async () => {
    try {
      const response = await fetch(`${API_URL}/sale`);
      const data = await response.json();
      const current = data?.current || data || null;
      if (current) {
        setSale({
          name: current.name || "",
          description: current.description || "",
          price: current.price ?? "",
          startDate: current.startDate || "",
          endDate: current.endDate || "",
          enabled: Boolean(current.enabled),
        });
      }
      setSaleHistory(Array.isArray(data?.history) ? data.history : []);
    } catch (error) {
      console.error("Failed to load sale config", error);
    }
  };

  useEffect(() => {
    loadProducts();
    loadSale();
  }, []);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addBrandOption = (value) => {
    const trimmed = value?.trim();
    if (!trimmed) return;

    setBrandOptions((prev) => {
      if (prev.includes(trimmed)) {
        return prev;
      }
      return [...prev, trimmed].sort((a, b) => a.localeCompare(b));
    });
  };

  const handleImageFiles = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      return;
    }

    const remaining = MAX_IMAGES - form.images.length;
    if (remaining <= 0) {
      event.target.value = "";
      return;
    }

    const validFiles = files.filter((file) => file.size <= MAX_IMAGE_BYTES);
    if (validFiles.length < files.length) {
      window.alert("Each image must be 2MB or smaller.");
    }

    const uploadImageToGithub = async (file) => {
      const dataUrl = await fileToDataUrl(file);
      const safeName = form.name?.trim() ? form.name.trim() : "product";
      const filename = `${safeName}-${Date.now()}-${file.name}`;

      const response = await fetch(`${API_URL}/uploads/github`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify({ dataUrl, filename }),
      });

      if (!response.ok) {
        throw new Error("Failed to upload image to GitHub.");
      }

      const payload = await response.json();
      if (!payload?.url) {
        throw new Error("Missing uploaded image URL.");
      }

      return payload.url;
    };

    try {
      setIsUploading(true);
      const uploads = [];
      for (const file of validFiles.slice(0, remaining)) {
        // Upload sequentially to keep ordering stable
        const url = await uploadImageToGithub(file);
        uploads.push(url);
      }
      setForm((prev) => ({
        ...prev,
        images: [...prev.images, ...uploads].slice(0, MAX_IMAGES),
      }));
    } catch (error) {
      console.error("Failed to upload image files", error);
      window.alert("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const removeImageField = (index) => {
    setForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, idx) => idx !== index),
    }));
  };

  const resetForm = () => {
    setForm(emptyForm);
  };

  const handleEdit = (product) => {
    if (product.brand) {
      addBrandOption(product.brand);
    }
    setForm({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      offerPrice: product.offerPrice,
      brand: product.brand || "",
      category: "Shoes",
      sizes: Array.isArray(product.sizes) ? product.sizes : [],
      isBestSeller: Boolean(product.isBestSeller),
      images: product.images?.length ? product.images : [],
    });
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) {
      return;
    }

    try {
      await fetch(`${API_URL}/products/${id}`, {
        method: "DELETE",
        headers: {
          ...getAuthHeader(),
        },
      });
      await loadProducts();
    } catch (error) {
      console.error("Failed to delete product", error);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSaving(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      offerPrice: Number(form.offerPrice),
      brand: form.brand.trim(),
      category: "Shoes",
      sizes: form.sizes,
      isBestSeller: form.isBestSeller,
      images: form.images
        .map((img) => normalizeImageUrl(img))
        .filter(Boolean),
    };

    try {
      if (isEditing) {
        await fetch(`${API_URL}/products/${form.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify(payload),
        });
      } else {
        await fetch(`${API_URL}/products`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify(payload),
        });
      }

      await loadProducts();
      resetForm();
    } catch (error) {
      console.error("Failed to save product", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaleUpdate = async (event) => {
    event.preventDefault();
    setIsSavingSale(true);
    try {
      const payload = {
        current: {
          name: sale.name.trim(),
          description: sale.description.trim(),
          price: sale.price === "" ? "" : Number(sale.price),
          startDate: sale.startDate,
          endDate: sale.endDate,
          enabled: Boolean(sale.enabled),
        },
      };
      const response = await fetch(`${API_URL}/sale`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      const updated = await response.json().catch(() => null);
      if (updated?.current) {
        setSale({
          name: updated.current.name || "",
          description: updated.current.description || "",
          price: updated.current.price ?? "",
          startDate: updated.current.startDate || "",
          endDate: updated.current.endDate || "",
          enabled: Boolean(updated.current.enabled),
        });
      }
      if (Array.isArray(updated?.history)) {
        setSaleHistory(updated.history);
      }
    } catch (error) {
      console.error("Failed to update sale config", error);
    } finally {
      setIsSavingSale(false);
    }
  };

  const deactivateSale = async () => {
    setIsSavingSale(true);
    try {
      const payload = {
        current: {
          ...sale,
          enabled: false,
        },
      };
      const response = await fetch(`${API_URL}/sale`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      const updated = await response.json().catch(() => null);
      if (updated?.current) {
        setSale({
          name: updated.current.name || "",
          description: updated.current.description || "",
          price: updated.current.price ?? "",
          startDate: updated.current.startDate || "",
          endDate: updated.current.endDate || "",
          enabled: Boolean(updated.current.enabled),
        });
      }
      if (Array.isArray(updated?.history)) {
        setSaleHistory(updated.history);
      }
    } catch (error) {
      console.error("Failed to deactivate sale", error);
    } finally {
      setIsSavingSale(false);
    }
  };

  return (
    <section className="section">
      <div>
        <p className="eyebrow">Studio</p>
        <h1 className="section-title">Catalog management</h1>
        <p className="section-subtitle">
          Add, edit, and compose the inventory — same tools as the reference
          site, styled for Sneakway.
        </p>
      </div>

      <div className="layout-split">
        <form onSubmit={handleSubmit} className="form">
          <div className="form__title">
            <h2>{isEditing ? "Edit product" : "Add new product"}</h2>
            {isEditing && (
              <button
                type="button"
                onClick={resetForm}
                className="button button--outline"
              >
                Cancel edit
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              clearAuthToken();
              navigate("/admin/login", { replace: true });
            }}
            className="button button--outline"
            style={{ justifySelf: "flex-start" }}
          >
            Logout
          </button>
          <label className="form__label">
            Name
            <input
              type="text"
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              className="form__input form__input--full"
              placeholder="Product name"
              required
            />
          </label>

          <div className="form__label">
            <span>Brand</span>
            <div className="brand-control">
              <select
                value={form.brand}
                onChange={(event) => updateField("brand", event.target.value)}
                className="form__input form__input--full form__select"
                required
              >
                <option value="">Select a brand</option>
                {brandOptions.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
              <div className="brand-add">
                <input
                  type="text"
                  value={customBrand}
                  onChange={(event) => setCustomBrand(event.target.value)}
                  placeholder="Add a new brand"
                  className="form__input form__input--full"
                />
                <button
                  type="button"
                  className="button button--outline"
                  onClick={() => {
                    const trimmed = customBrand.trim();
                    if (!trimmed) return;
                    addBrandOption(trimmed);
                    updateField("brand", trimmed);
                    setCustomBrand("");
                  }}
                >
                  Add brand
                </button>
              </div>
            </div>
          </div>

         

          <label className="form__label">
            Description
            <textarea
              rows="3"
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              className="form__textarea form__input--full"
              placeholder="Short product description"
            />
          </label>

          <div className="form__row">
            <label className="form__label">
              Original price
              <input
                type="number"
                value={form.price}
                onChange={(event) => updateField("price", event.target.value)}
                className="form__input form__input--full"
                placeholder="12999"
              />
            </label>
            <label className="form__label">
              Offer price
              <input
                type="number"
                value={form.offerPrice}
                onChange={(event) => updateField("offerPrice", event.target.value)}
                className="form__input form__input--full"
                placeholder="9999"
                required
              />
            </label>
          </div>

          <div className="form__label">
            <p className="eyebrow">Sizes</p>
            <div className="size-presets">
              <button
                type="button"
                className="button button--outline size-preset-btn"
                onClick={() => updateField("sizes", [...LADIES_SIZES])}
              >
                Ladies (36–40)
              </button>
              <button
                type="button"
                className="button button--outline size-preset-btn"
                onClick={() => updateField("sizes", [...MENS_SIZES])}
              >
                Mens (40–45)
              </button>
              <button
                type="button"
                className="button button--outline size-preset-btn"
                onClick={() => updateField("sizes", [...SIZE_OPTIONS])}
              >
                All sizes (36–45)
              </button>
            </div>
            <div className="size-grid">
              {SIZE_OPTIONS.map((size) => {
                const isSelected = form.sizes.includes(size);
                return (
                  <label
                    key={size}
                    className={`size-chip${isSelected ? " is-selected" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      className="size-chip__input"
                      onChange={(event) => {
                        const next = event.target.checked
                          ? [...new Set([...form.sizes, size])].sort(
                              (a, b) => a - b,
                            )
                          : form.sizes.filter((value) => value !== size);
                        updateField("sizes", next);
                      }}
                    />
                    <span>{size}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <label className="form__label best-seller-toggle">
            <span>Best seller</span>
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                checked={form.isBestSeller}
                onChange={(event) =>
                  updateField("isBestSeller", event.target.checked)
                }
              />
              Mark this product as a best seller
            </span>
          </label>

          <div className="image-list">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p className="eyebrow">Images</p>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageFiles}
              className="form__input form__input--full"
              required={form.images.length === 0}
              disabled={form.images.length >= MAX_IMAGES || isUploading}
            />
            {form.images.length > 0 && (
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                  marginTop: "12px",
                }}
              >
                {form.images.map((image, index) => (
                  <div
                    key={`image-${index}`}
                    className="image-item"
                    style={{
                      position: "relative",
                      width: "88px",
                      height: "88px",
                      borderRadius: "10px",
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.22)",
                      background: "rgba(255,255,255,0.06)",
                    }}
                  >
                    <img
                      src={image}
                      alt={`Upload ${index + 1}`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <button
                      type="button"
                      onClick={() => removeImageField(index)}
                      className="button button--outline"
                      aria-label="Remove image"
                      style={{
                        position: "absolute",
                        top: "6px",
                        right: "6px",
                        width: "22px",
                        height: "22px",
                        padding: 0,
                        borderRadius: "999px",
                        lineHeight: 1,
                      }}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving || isUploading || form.images.length === 0}
            className="button button--primary"
          >
            {isUploading
              ? "Uploading..."
              : isSaving
                ? "Saving..."
                : isEditing
                  ? "Update product"
                  : "Add product"}
          </button>
        </form>

        <form onSubmit={handleSaleUpdate} className="form">
          <div className="form__title">
            <h2>Sale offer</h2>
          </div>
          <label className="form__label">
            Sale name
            <input
              type="text"
              value={sale.name}
              onChange={(event) =>
                setSale((prev) => ({ ...prev, name: event.target.value }))
              }
              className="form__input form__input--full"
              placeholder="Valentine's offer"
            />
          </label>
          <label className="form__label">
            Sale description
            <input
              type="text"
              value={sale.description}
              onChange={(event) =>
                setSale((prev) => ({ ...prev, description: event.target.value }))
              }
              className="form__input form__input--full"
              placeholder="Love at first step."
            />
          </label>
          <label className="form__label">
            Discount amount
            <input
              type="number"
              value={sale.price}
              onChange={(event) =>
                setSale((prev) => ({ ...prev, price: event.target.value }))
              }
              className="form__input form__input--full"
              placeholder="1000"
            />
          </label>
          <div className="form__row">
            <label className="form__label">
              Start date
              <input
                type="date"
                value={sale.startDate}
                onChange={(event) =>
                  setSale((prev) => ({ ...prev, startDate: event.target.value }))
                }
                className="form__input form__input--full"
              />
            </label>
            <label className="form__label">
              End date
              <input
                type="date"
                value={sale.endDate}
                onChange={(event) =>
                  setSale((prev) => ({ ...prev, endDate: event.target.value }))
                }
                className="form__input form__input--full"
              />
            </label>
          </div>
          <label className="form__label best-seller-toggle">
            <span>Sale active</span>
            <span style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <input
                type="checkbox"
                checked={sale.enabled}
                onChange={(event) =>
                  setSale((prev) => ({ ...prev, enabled: event.target.checked }))
                }
              />
              Apply discount to all products
            </span>
          </label>
          <button
            type="submit"
            disabled={isSavingSale}
            className="button button--primary"
          >
            {isSavingSale ? "Saving..." : "Save sale"}
          </button>
          {sale.enabled && (
            <button
              type="button"
              className="button button--outline button--danger"
              onClick={deactivateSale}
              disabled={isSavingSale}
            >
              Deactivate sale
            </button>
          )}
        </form>

      </div>

        {/* <div className="list">
          <h2>Sale history</h2>
          {saleHistory.length ? (
            saleHistory
              .slice()
              .reverse()
              .map((entry) => (
                <div key={entry.id || entry.name} className="list-item">
                  <div className="list-item__meta">
                    <p style={{ fontWeight: 600 }}>
                      {entry.name || "Sale"}
                    </p>
                    <p className="helper">
                      Discount {entry.price} · {entry.startDate} →{" "}
                      {entry.endDate}
                    </p>
                  </div>
                </div>
              ))
          ) : (
            <p className="helper">No sales created yet.</p>
          )}
        </div> */}

        <div className="list">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
              flexWrap: "wrap",
              marginTop:'20px'
            }}
          >
            <h2>Current products</h2>
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="form__input"
              placeholder="Search products..."
              aria-label="Search products"
              style={{ minWidth: "220px" }}
            />
          </div>
          {isLoading ? (
            <div className="loading">Loading products...</div>
          ) : filteredProducts.length ? (
            filteredProducts.map((product) => {
              const coverImage = normalizeImageUrl(product.images?.[0] || "");
              return (
                <div key={product.id} className="list-item">
                  <img src={coverImage} alt={product.name} />
                  <div className="list-item__meta">
                    <p style={{ fontWeight: 600 }}>{product.name}</p>
                    <p className="helper">Offer {product.offerPrice}</p>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={() => handleEdit(product)}
                      className="button button--outline"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(product.id)}
                      className="button button--outline button--danger"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="helper">No products match your search.</p>
          )}
        </div>
    </section>
  );
};

export default Admin;
