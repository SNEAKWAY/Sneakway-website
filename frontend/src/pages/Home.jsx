import { useEffect, useMemo, useState } from "react";
import ProductCard from "../components/ProductCard.jsx";
import { useNavigate, useSearchParams } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL;
const SCROLL_KEY = "sneakway_homeScrollPosition";

const isShoeProduct = (product) => {
  const c = product.category?.trim().toLowerCase() || "";
  return !["bags", "bag", "watches", "watch"].includes(c);
};

const Home = () => {
  const parseSortOption = (value) => {
    const allowed = new Set([
      "best",
      "newest",
      "oldest",
      "price-low",
      "price-high",
      "random",
    ]);
    return allowed.has(value) ? value : "best";
  };

  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [brandFilter, setBrandFilter] = useState(
    searchParams.get("brand") || "All",
  );
  const [sortOption, setSortOption] = useState(
    parseSortOption(searchParams.get("sort") || "best"),
  );
  const navigate = useNavigate();
  const [saleConfig, setSaleConfig] = useState(null);

  const shoeProducts = useMemo(
    () => products.filter(isShoeProduct),
    [products],
  );

  const brandOptions = useMemo(() => {
    const available = new Set(
      shoeProducts
        .map((product) => product.brand)
        .filter((brand) => typeof brand === "string" && brand.trim())
        .map((brand) => brand.trim()),
    );

    return [
      { value: "All", label: "All makers" },
      ...Array.from(available)
        .sort()
        .map((brand) => ({ value: brand, label: brand })),
    ];
  }, [shoeProducts]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("sort", sortOption);
    if (brandFilter && brandFilter !== "All") {
      params.set("brand", brandFilter);
    }
    if (searchTerm.trim()) {
      params.set("q", searchTerm.trim());
    }
    setSearchParams(params, { replace: true });
  }, [brandFilter, searchTerm, setSearchParams, sortOption]);

  const currentSale = saleConfig?.current || saleConfig || null;
  const isSaleActive = useMemo(() => {
    if (
      !currentSale?.enabled ||
      !currentSale?.price ||
      !currentSale?.startDate ||
      !currentSale?.endDate
    ) {
      return false;
    }
    const start = new Date(`${currentSale.startDate}T00:00:00`);
    const end = new Date(`${currentSale.endDate}T23:59:59`);
    const now = new Date();
    return now >= start && now <= end;
  }, [currentSale]);

  const getEffectivePrice = (product) => {
    const originalBase = Number(product.price || product.offerPrice || 0);
    if (!isSaleActive) return Number(product.offerPrice || 0);
    return Math.max(0, originalBase - Number(currentSale.price || 0));
  };

  const filteredProducts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const filteredByBrand =
      brandFilter === "All"
        ? shoeProducts
        : shoeProducts.filter(
            (product) =>
              product.brand?.trim().toLowerCase() === brandFilter.toLowerCase(),
          );

    const filteredBySearch = !query
      ? filteredByBrand
      : filteredByBrand.filter((product) =>
          product.name?.toLowerCase().includes(query),
        );

    if (sortOption === "random") {
      return [...filteredBySearch].sort(() => Math.random() - 0.5);
    }

    const compareNewest = (a, b) => Number(b.id || 0) - Number(a.id || 0);
    const compareOldest = (a, b) => Number(a.id || 0) - Number(b.id || 0);
    const compareBest = (a, b) => {
      const bestDiff =
        Number(Boolean(b.isBestSeller)) - Number(Boolean(a.isBestSeller));
      if (bestDiff !== 0) return bestDiff;
      return compareNewest(a, b);
    };

    if (sortOption === "oldest") {
      return [...filteredBySearch].sort(compareOldest);
    }
    if (sortOption === "newest") {
      return [...filteredBySearch].sort(compareNewest);
    }
    if (sortOption === "price-low") {
      return [...filteredBySearch].sort(
        (a, b) => getEffectivePrice(a) - getEffectivePrice(b),
      );
    }
    if (sortOption === "price-high") {
      return [...filteredBySearch].sort(
        (a, b) => getEffectivePrice(b) - getEffectivePrice(a),
      );
    }

    return [...filteredBySearch].sort(compareBest);
  }, [
    shoeProducts,
    searchTerm,
    brandFilter,
    sortOption,
    isSaleActive,
    currentSale,
  ]);

  useEffect(() => {
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

    loadProducts();
  }, []);

  useEffect(() => {
    if (isLoading || brandFilter === "All") {
      return;
    }

    const isStillAvailable = brandOptions.some(
      (option) => option.value === brandFilter,
    );
    if (!isStillAvailable) {
      setBrandFilter("All");
    }
  }, [brandOptions, brandFilter, isLoading]);

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
    if (!isLoading) {
      const savedPosition = sessionStorage.getItem(SCROLL_KEY);

      if (savedPosition) {
        window.scrollTo(0, Number(savedPosition));
        sessionStorage.removeItem(SCROLL_KEY);
      }
    }
  }, [isLoading]);

  const handleProductClick = (product) => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    navigate(`/products/${product.id}`);
  };

  return (
    <section className="section">
      {isSaleActive && (
        <div className="sale-banner">
          <div>
            <p className="sale-banner__eyebrow">Seasonal note</p>
            <h2 className="sale-banner__title">
              {currentSale?.name || "Sale"} is live
            </h2>
            {currentSale?.description && (
              <p className="sale-banner__quote">“{currentSale.description}”</p>
            )}
            <p className="sale-banner__subtitle">
              Flat ₹{Number(currentSale?.price || 0).toLocaleString("en-IN")}{" "}
              off on all products
            </p>
          </div>
          <div className="sale-banner__chip">
            Save ₹{Number(currentSale?.price || 0).toLocaleString("en-IN")}
          </div>
        </div>
      )}

      <div className="filter-media filter-media--solo">
        <select
          value={brandFilter}
          onChange={(event) => setBrandFilter(event.target.value)}
          className="form__input"
          aria-label="Filter products by brand"
        >
          {brandOptions.map((brand) => (
            <option key={brand.value} value={brand.value}>
              {brand.label}
            </option>
          ))}
        </select>

        <select
          value={sortOption}
          onChange={(event) => setSortOption(event.target.value)}
          className="form__input"
          aria-label="Sort products"
        >
          <option value="best">Featured first</option>
          <option value="newest">Recently added</option>
          <option value="oldest">Older first</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
          <option value="random">Shuffle</option>
        </select>
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          className="form__input"
          placeholder="Search by name..."
          aria-label="Search products by name"
        />
        <button
          type="button"
          onClick={() => {
            setBrandFilter("All");
            setSortOption("best");
            setSearchTerm("");
          }}
          className="button button--outline button--ink"
        >
          Reset
        </button>
      </div>

      {isLoading ? (
        <div className="loading">Loading products...</div>
      ) : filteredProducts.length ? (
        <div className="grid grid-3">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onClick={handleProductClick}
              sale={
                isSaleActive
                  ? {
                      name: currentSale?.name || "",
                      price: currentSale?.price,
                      isActive: true,
                    }
                  : { isActive: false }
              }
            />
          ))}
        </div>
      ) : (
        <p className="helper">No products match your search.</p>
      )}
    </section>
  );
};

export default Home;
