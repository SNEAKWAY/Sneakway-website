const formatPrice = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const ProductCard = ({ product, onClick, sale }) => {
  const isSaleActive = Boolean(sale?.isActive && sale?.price);
  const originalBase = Number(product.price || product.offerPrice || 0);
  const discount = isSaleActive ? Number(sale.price) : 0;
  const effectivePrice = isSaleActive
    ? Math.max(0, originalBase - discount)
    : Number(product.offerPrice || 0);
  const showSaleStrike = isSaleActive && discount > 0 && originalBase > 0;
  return (
    <button
      type="button"
      className="card card--tile"
      onClick={() => onClick(product)}
    >
      <div className="card__shell">
        <div className="card__media">
          {product.isBestSeller && (
            <span className="card__badge" aria-label="Featured">
              Pick
            </span>
          )}
          <img
            src={product.images?.[0]}
            alt={product.name}
            loading="lazy"
          />
        </div>
        <div className="card__panel">
          <div className="card__lockup">
            <span className="card__kicker">Sneakway</span>
            <h3 className="card__title">{product.name}</h3>
          </div>
          <div className="card__rule" aria-hidden="true" />
          <div className="card__price">
            <span className="card__price-value">{formatPrice(effectivePrice)}</span>
            {showSaleStrike ? (
              <span className="price--strike price--strike--tile">
                {formatPrice(originalBase)}
              </span>
            ) : (
              product.price &&
              product.price !== product.offerPrice && (
                <span className="price--strike price--strike--tile">
                  {formatPrice(product.price)}
                </span>
              )
            )}
          </div>
        </div>
      </div>
    </button>
  );
};

export default ProductCard;
