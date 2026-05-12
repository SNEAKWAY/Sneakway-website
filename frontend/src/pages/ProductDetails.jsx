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

const ProductDetails = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saleConfig, setSaleConfig] = useState(null);
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

  const whatsappLink = `${WHATSAPP_BASE}?text=${encodeURIComponent(
    `Hi! I'm interested in this product: ${window.location.href}`,
  )}`;

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

        <a
          href={whatsappLink}
          target="_blank"
          rel="noreferrer"
          className="button button--primary whatsapp detail-cta"
        >
          Chat on WhatsApp
        </a>
      </div>
    </section>
  );
};

export default ProductDetails;
