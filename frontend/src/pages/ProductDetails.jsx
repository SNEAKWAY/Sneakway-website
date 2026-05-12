import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ImageCarousel from "../components/ImageCarousel.jsx";

const API_URL = import.meta.env.VITE_API_URL;
const WHATSAPP_BASE = "https://wa.me/916282365256";

const formatPrice = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const SIZE_OPTIONS = Array.from({ length: 10 }, (_, idx) => 36 + idx);

const emptyBuyForm = () => ({
  name: "",
  address: "",
  city: "",
  district: "",
  state: "",
  pincode: "",
  mob1: "",
  mob2: "",
  size: "",
});

const buildBuyNowWhatsappText = (productUrl, productName, fields) => {
  const lines = [
    "I want to buy this product:",
    "",
    `Product: ${productName}`,
    `Link: ${productUrl}`,
    "",
    "Delivery details:",
    `Name: ${fields.name}`,
    `Address: ${fields.address}`,
    `City: ${fields.city}`,
    `District: ${fields.district}`,
    `State: ${fields.state}`,
    `Pincode: ${fields.pincode}`,
    `Mobile 1: ${fields.mob1}`,
    `Mobile 2: ${fields.mob2 || "—"}`,
    `Size: ${fields.size}`,
  ];
  return lines.join("\n");
};

const ProductDetails = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saleConfig, setSaleConfig] = useState(null);
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [buyForm, setBuyForm] = useState(() => emptyBuyForm());

  useEffect(() => {
    const loadProduct = async () => {
      try {
        const response = await fetch(`${API_URL}/products/${id}`);
        const data = await response.json();
        setProduct(data);
      } catch (error) {
        console.error("Failed to load product", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  useEffect(() => {
    const loadSale = async () => {
      try {
        const response = await fetch(`${API_URL}/sale`);
        const data = await response.json();
        setSaleConfig(data);
      } catch (error) {
        console.error("Failed to load sale config", error);
      }
    };

    loadSale();
  }, []);

  useEffect(() => {
    if (!buyModalOpen) return;
    const onKey = (event) => {
      if (event.key === "Escape") setBuyModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [buyModalOpen]);

  if (isLoading) {
    return <div className="loading">Loading product...</div>;
  }

  if (!product?.id) {
    return (
      <div className="section">
        <p className="helper">Product not found.</p>
        <Link to="/" className="button button--outline">
          Back to catalog
        </Link>
      </div>
    );
  }

  const enquiryWhatsappLink = `${WHATSAPP_BASE}?text=${encodeURIComponent(
    `Hi! I'm interested in this product: ${window.location.href}`,
  )}`;

  const sizeChoices =
    product.sizes?.length > 0
      ? [...product.sizes].sort((a, b) => a - b)
      : [...SIZE_OPTIONS];

  const openBuyModal = () => {
    setBuyForm(emptyBuyForm());
    setBuyModalOpen(true);
  };

  const closeBuyModal = () => setBuyModalOpen(false);

  const handleBuyFormChange = (field, value) => {
    setBuyForm((prev) => ({ ...prev, [field]: value }));
  };

  const submitBuyToWhatsapp = (event) => {
    event.preventDefault();
    const text = buildBuyNowWhatsappText(
      window.location.href,
      product.name,
      buyForm,
    );
    const url = `${WHATSAPP_BASE}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    closeBuyModal();
  };

  const currentSale = saleConfig?.current || saleConfig || null;
  const isSaleActive =
    Boolean(
      currentSale?.enabled &&
      currentSale?.price &&
      currentSale?.startDate &&
      currentSale?.endDate,
    ) &&
    new Date() >= new Date(`${currentSale.startDate}T00:00:00`) &&
    new Date() <= new Date(`${currentSale.endDate}T23:59:59`);

  const originalBase = Number(product.price || product.offerPrice || 0);
  const discount = isSaleActive ? Number(currentSale.price || 0) : 0;
  const effectivePrice = isSaleActive
    ? Math.max(0, originalBase - discount)
    : Number(product.offerPrice || 0);
  const showSaleStrike = isSaleActive && discount > 0 && originalBase > 0;

  return (
    <>
    <section className="layout-split product-detail">
      <div className="product-detail__gallery">
        <ImageCarousel images={product.images} />
      </div>

      <div className="detail-panel detail-panel--product">
        <Link to="/" className="detail-back">
          ← Back to store
        </Link>

        <header className="detail-header">
          <p className="eyebrow eyebrow--detail">Piece</p>
          <h1 className="detail-title">{product.name}</h1>
          {isSaleActive && (
            <p className="sale-live sale-live--detail">
              {currentSale?.name || "Sale"} is live
            </p>
          )}
          {product.description ? (
            <p className="detail-lede">{product.description}</p>
          ) : null}
        </header>

        <div className="detail-price-rail">
          <div className="detail-price-rail__label">Offer</div>
          <div className="detail-price-rail__values">
            <span className="detail-price-rail__current">
              {formatPrice(effectivePrice)}
            </span>
            {showSaleStrike ? (
              <span className="price--strike detail-price-rail__strike">
                {formatPrice(originalBase)}
              </span>
            ) : (
              product.price &&
              product.price !== product.offerPrice && (
                <span className="price--strike detail-price-rail__strike">
                  {formatPrice(product.price)}
                </span>
              )
            )}
          </div>
        </div>

        {product.brand && (
          <div className="detail-meta-block">
            <p className="eyebrow eyebrow--detail">Maker</p>
            <p className="detail-meta-value">{product.brand}</p>
          </div>
        )}

        <div className="detail-meta-block">
          <p className="eyebrow eyebrow--detail">Sizes in stock</p>
          <div className="size-pills size-pills--detail">
            {SIZE_OPTIONS.map((size) => {
              const isAvailable = product.sizes?.includes(size);
              return (
                <span
                  key={size}
                  className={`size-pill${isAvailable ? " is-available" : " is-unavailable"}`}
                >
                  {size}
                </span>
              );
            })}
          </div>
        </div>

        <div className="detail-cta-row">
          <button
            type="button"
            className="button button--primary whatsapp detail-cta"
            onClick={openBuyModal}
          >
            Buy Now
          </button>
          <a
            href={enquiryWhatsappLink}
            target="_blank"
            rel="noreferrer"
            className="button button--outline detail-cta"
          >
            Send Enquiry
          </a>
        </div>
      </div>
    </section>

      {buyModalOpen ? (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeBuyModal();
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="buy-modal-title"
          >
            <div className="modal__header">
              <h2 id="buy-modal-title" className="modal__title">
                Delivery details
              </h2>
              <button
                type="button"
                className="modal__close"
                onClick={closeBuyModal}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form className="buy-form" onSubmit={submitBuyToWhatsapp}>
              <label className="form__label">
                Name
                <input
                  className="form__input form__input--full"
                  value={buyForm.name}
                  onChange={(e) => handleBuyFormChange("name", e.target.value)}
                  required
                  autoComplete="name"
                />
              </label>
              <label className="form__label">
                Address
                <textarea
                  className="form__textarea form__input--full"
                  rows={3}
                  value={buyForm.address}
                  onChange={(e) =>
                    handleBuyFormChange("address", e.target.value)
                  }
                  required
                  autoComplete="street-address"
                />
              </label>
              <div className="form__row">
                <label className="form__label">
                  City
                  <input
                    className="form__input form__input--full"
                    value={buyForm.city}
                    onChange={(e) =>
                      handleBuyFormChange("city", e.target.value)
                    }
                    required
                    autoComplete="address-level2"
                  />
                </label>
                <label className="form__label">
                  District
                  <input
                    className="form__input form__input--full"
                    value={buyForm.district}
                    onChange={(e) =>
                      handleBuyFormChange("district", e.target.value)
                    }
                    required
                  />
                </label>
              </div>
              <div className="form__row">
                <label className="form__label">
                  State
                  <input
                    className="form__input form__input--full"
                    value={buyForm.state}
                    onChange={(e) =>
                      handleBuyFormChange("state", e.target.value)
                    }
                    required
                    autoComplete="address-level1"
                  />
                </label>
                <label className="form__label">
                  Pincode
                  <input
                    className="form__input form__input--full"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={buyForm.pincode}
                    onChange={(e) =>
                      handleBuyFormChange("pincode", e.target.value)
                    }
                    required
                    autoComplete="postal-code"
                  />
                </label>
              </div>
              <div className="form__row">
                <label className="form__label">
                  Mobile 1
                  <input
                    className="form__input form__input--full"
                    type="tel"
                    value={buyForm.mob1}
                    onChange={(e) =>
                      handleBuyFormChange("mob1", e.target.value)
                    }
                    required
                    autoComplete="tel"
                  />
                </label>
                <label className="form__label">
                  Mobile 2 (optional)
                  <input
                    className="form__input form__input--full"
                    type="tel"
                    value={buyForm.mob2}
                    onChange={(e) =>
                      handleBuyFormChange("mob2", e.target.value)
                    }
                    autoComplete="tel"
                  />
                </label>
              </div>
              <label className="form__label">
                Size
                <select
                  className="form__input form__select form__input--full"
                  value={buyForm.size}
                  onChange={(e) =>
                    handleBuyFormChange("size", e.target.value)
                  }
                  required
                >
                  <option value="" disabled>
                    Select size
                  </option>
                  {sizeChoices.map((size) => {
                    const inStock =
                      !product.sizes?.length || product.sizes.includes(size);
                    return (
                      <option key={size} value={String(size)} disabled={!inStock}>
                        {size}
                        {!inStock ? " (out of stock)" : ""}
                      </option>
                    );
                  })}
                </select>
              </label>
              <div className="modal__actions">
                <button
                  type="button"
                  className="button button--outline"
                  onClick={closeBuyModal}
                >
                  Cancel
                </button>
                <button type="submit" className="button button--primary">
                  OK
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default ProductDetails;
