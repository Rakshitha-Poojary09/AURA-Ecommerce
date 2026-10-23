import React, { useState, useEffect, useMemo } from 'react';
import './ShopPage.css';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';

// Express / MongoDB backend API endpoint for products
const API_URL = 'http://localhost:5000/api/products';

export default function ShopPage({ 
  onAddToCart, 
  onToggleWishlist, 
  wishlistItems = [], 
  onNavigateHome,
  category: propCategory,
  initialCategory = 'All',
  searchQuery: propSearch,
  initialSearch = '',
  sortBy: propSort,
  initialSort = 'featured',
  onFilterChange,
  onProductClick,
  products: propProducts,
  loading: propLoading,
  error: propError,
  onRetry
}) {
  // Read any parameters directly present in URL if available
  const getInitialParam = (param, fallback) => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get(param) || fallback;
    } catch (e) {
      return fallback;
    }
  };

  const [internalCategory, setInternalCategory] = useState(() => {
    const urlCat = getInitialParam('category', null);
    return propCategory || urlCat || initialCategory || 'All';
  });

  const [internalSearch, setInternalSearch] = useState(() => {
    const urlSearch = getInitialParam('search', null) || getInitialParam('q', null);
    return propSearch !== undefined ? propSearch : (urlSearch || initialSearch || '');
  });

  const [internalSort, setInternalSort] = useState(() => {
    const urlSort = getInitialParam('sort', null);
    return propSort || urlSort || initialSort || 'featured';
  });

  // Effective values: use prop if provided, else internal state
  const selectedCategory = propCategory !== undefined ? propCategory : internalCategory;
  const searchQuery = propSearch !== undefined ? propSearch : internalSearch;
  const sortBy = propSort !== undefined ? propSort : internalSort;

  // Keep internal state in sync if parent props change (e.g. Navbar navigation)
  useEffect(() => {
    if (propCategory !== undefined && propCategory !== internalCategory) {
      setInternalCategory(propCategory);
    } else if (initialCategory && initialCategory !== internalCategory) {
      setInternalCategory(initialCategory);
    }
  }, [propCategory, initialCategory]);

  useEffect(() => {
    if (propSearch !== undefined && propSearch !== internalSearch) {
      setInternalSearch(propSearch);
    } else if (typeof initialSearch === 'string' && initialSearch !== internalSearch) {
      setInternalSearch(initialSearch);
    }
  }, [propSearch, initialSearch]);

  useEffect(() => {
    if (propSort !== undefined && propSort !== internalSort) {
      setInternalSort(propSort);
    } else if (initialSort && initialSort !== internalSort) {
      setInternalSort(initialSort);
    }
  }, [propSort, initialSort]);

  // Explicit user interaction handlers that notify parent without circular effect loops
  const handleCategorySelect = (newCat) => {
    setInternalCategory(newCat);
    if (onFilterChange) {
      onFilterChange({
        category: newCat,
        search: searchQuery,
        sort: sortBy
      });
    }
  };

  const handleSearchChange = (newSearch) => {
    setInternalSearch(newSearch);
    if (onFilterChange) {
      onFilterChange({
        category: selectedCategory,
        search: newSearch,
        sort: sortBy
      });
    }
  };

  const handleSortChange = (newSort) => {
    setInternalSort(newSort);
    if (onFilterChange) {
      onFilterChange({
        category: selectedCategory,
        search: searchQuery,
        sort: newSort
      });
    }
  };

  // Internal products state for standalone usage if propProducts is not supplied
  const [internalProducts, setInternalProducts] = useState([]);
  const [internalLoading, setInternalLoading] = useState(true);
  const [internalError, setInternalError] = useState(null);
  const [selectedCardColors, setSelectedCardColors] = useState({});

  const isControlled = propProducts !== undefined;
  const products = isControlled ? propProducts : internalProducts;
  const loading = isControlled ? Boolean(propLoading) : internalLoading;
  const error = isControlled ? propError : internalError;

  // Helper to ensure local paths (like /products/shirt.jpg) have proper leading slash
  const normalizeImageUrl = (imageUrl) => {
    return normalizeProductImageUrl(imageUrl);
  };

  // Fetch products from Express / MongoDB backend API when run standalone
  const fetchShopProducts = async () => {
    setInternalLoading(true);
    setInternalError(null);
    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error(`Failed to load products (HTTP ${response.status})`);
      }

      const data = await response.json();

      // Display products directly from MongoDB
      if (Array.isArray(data) && data.length > 0) {
        const formattedProducts = data.map((item, index) => {
          const isAccessory = (item.category || '').trim().toLowerCase() === 'accessories';
          const validColors = isAccessory
            ? ((Array.isArray(item.colorVariants) && item.colorVariants.length > 0)
                ? item.colorVariants.map(v => v.colorCode || v.colorName).filter(Boolean)
                : (Array.isArray(item.colors) ? item.colors.filter(Boolean) : []))
            : [];
          return {
            ...item,
            id: item._id || item.id || `mongo-${index}`,
            _id: item._id || item.id,
            subCategory: item.subCategory || item.category,
            image: normalizeImageUrl(item.image),
            images: Array.isArray(item.images) ? item.images : [],
            price: Number(item.price) || 0,
            mrp: item.mrp !== undefined && item.mrp !== null ? Number(item.mrp) : (item.originalPrice ? Number(item.originalPrice) : null),
            originalPrice: item.mrp !== undefined && item.mrp !== null ? Number(item.mrp) : (item.originalPrice ? Number(item.originalPrice) : null),
            stock: typeof item.stock === 'number' ? item.stock : 0,
            rating: typeof item.rating === 'number' ? item.rating : 0,
            reviewsCount: typeof item.reviewsCount === 'number' ? item.reviewsCount : 0,
            isNew: item.isNew !== undefined ? item.isNew : false,
            colors: validColors,
          };
        });

        setInternalProducts(formattedProducts);
      } else {
        setInternalProducts([]);
      }
    } catch (err) {
      console.warn('Backend unavailable to fetch shop products:', err);
      setInternalError('Could not connect to the product catalog. Please make sure the backend server is running.');
    } finally {
      setInternalLoading(false);
    }
  };

  useEffect(() => {
    if (!isControlled) {
      fetchShopProducts();
    }
  }, [isControlled]);

  // Primary categories defined by customer catalog requirements
  const categories = ['All', 'Women', 'Men', 'Kids', 'Accessories'];

  // Filter and sort products (uses live products from MongoDB)
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const selCat = (selectedCategory || 'All').trim().toLowerCase();

    return products.filter((product) => {
      // 1. Category filter check (case-insensitive)
      const prodCat = (product.category || '').trim().toLowerCase();
      const prodSub = (product.subCategory || '').trim().toLowerCase();
      const numPrice = Number(product.price) || 0;
      const effectiveMrp = product.mrp !== undefined && product.mrp !== null ? Number(product.mrp) : (product.originalPrice ? Number(product.originalPrice) : null);
      const isSale = effectiveMrp !== null && effectiveMrp > numPrice;

      let matchesCategory = false;
      if (selCat === 'all' || selCat === 'new arrivals' || selCat === 'new-arrivals') {
        matchesCategory = true;
      } else if (selCat === 'sale' || selCat === 'seasonal sale') {
        matchesCategory = isSale;
      } else if (prodCat === selCat || prodSub === selCat) {
        matchesCategory = true;
      } else if (selCat === 'dresses' && (prodSub === 'dresses' || (product.name && product.name.toLowerCase().includes('dress')))) {
        matchesCategory = true;
      }

      // 2. Search query check against product name and description
      let matchesSearch = true;
      if (query) {
        const prodName = (product.name || '').toLowerCase();
        const prodDesc = (product.description || '').toLowerCase();
        matchesSearch = 
          prodName.includes(query) ||
          prodDesc.includes(query) ||
          prodCat.includes(query) ||
          prodSub.includes(query);
      }

      return matchesCategory && matchesSearch;
    }).sort((a, b) => {
      // Price: Low to High
      if (sortBy === 'price-low') {
        return (Number(a.price) || 0) - (Number(b.price) || 0);
      }

      // Price: High to Low
      if (sortBy === 'price-high') {
        return (Number(b.price) || 0) - (Number(a.price) || 0);
      }

      // Highest Rated
      if (sortBy === 'rating') {
        return (Number(b.rating) || 0) - (Number(a.rating) || 0);
      }

      // New Arrivals / Newest (using real MongoDB createdAt timestamps)
      if (sortBy === 'newest' || selCat === 'new arrivals' || selCat === 'new-arrivals') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (timeB !== timeA) {
          return timeB - timeA;
        }
        return (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0);
      }

      // Search Relevance sorting (when query exists or explicitly selected)
      if (sortBy === 'relevant' || (query && (sortBy === 'featured' || !sortBy))) {
        const getScore = (item) => {
          if (!query) return 0;
          const name = (item.name || '').toLowerCase();
          const desc = (item.description || '').toLowerCase();
          if (name === query) return 100;
          if (name.startsWith(query)) return 70;
          if (name.includes(query)) return 40;
          if (desc.includes(query)) return 20;
          return 5;
        };
        const scoreDiff = getScore(b) - getScore(a);
        if (scoreDiff !== 0) return scoreDiff;
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }

      // Default 'featured' sort: newest created date, then rating
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeB !== timeA) {
        return timeB - timeA;
      }
      return (Number(b.rating) || 0) - (Number(a.rating) || 0);
    });
  }, [products, selectedCategory, searchQuery, sortBy]);

  const handleResetFilters = () => {
    setInternalCategory('All');
    setInternalSearch('');
    setInternalSort('featured');
    if (onFilterChange) {
      onFilterChange({
        category: 'All',
        search: '',
        sort: 'featured'
      });
    }
  };

  const hasActiveFilters = selectedCategory !== 'All' || searchQuery.trim() !== '' || sortBy !== 'featured';

  return (
    <div className="aura-shop-page">
      <div className="aura-container">
        
        {/* Breadcrumb Navigation */}
        <nav className="shop-breadcrumb" aria-label="Breadcrumb">
          <button className="breadcrumb-link" onClick={onNavigateHome}>
            Home
          </button>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Shop</span>
          {selectedCategory !== 'All' && (
            <>
              <span className="breadcrumb-separator">/</span>
              <span className="breadcrumb-current">{selectedCategory}</span>
            </>
          )}
        </nav>

        {/* Page Header */}
        <header className="shop-header">
          <span className="shop-eyebrow">AURA CURATED CATALOG</span>
          <h1 className="shop-title">Shop AURA</h1>
          <p className="shop-intro">
            Discover timeless silhouettes, conscious fabrics, and effortless everyday luxury 
            curated for modern living. Designed for style that feels like you.
          </p>
        </header>

        {/* Filter and Control Bar */}
        <div className="shop-controls-bar">
          
          {/* Search Box */}
          <div className="shop-search-wrapper">
            <svg className="shop-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text"
              placeholder="Search by name, description, or style..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="shop-search-input"
              aria-label="Search products"
            />
            {searchQuery && (
              <button 
                className="shop-search-clear" 
                onClick={() => handleSearchChange('')}
                aria-label="Clear search"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Sort Dropdown */}
          <div className="shop-sort-wrapper">
            <label htmlFor="shop-sort" className="sort-label">Sort by:</label>
            <select 
              id="shop-sort" 
              value={sortBy} 
              onChange={(e) => handleSortChange(e.target.value)}
              className="shop-sort-select"
            >
              <option value="featured">{searchQuery.trim() ? 'Relevance' : 'Featured'}</option>
              <option value="newest">New Arrivals</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>

        </div>

        {/* Category Filter Pills */}
        <div className="shop-category-pills">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`category-pill ${selectedCategory.toLowerCase() === cat.toLowerCase() ? 'active' : ''}`}
              onClick={() => handleCategorySelect(cat)}
            >
              {cat}
            </button>
          ))}
          {/* Support active sub-categories or external links like Dresses */}
          {!categories.some((c) => c.toLowerCase() === selectedCategory.toLowerCase()) && selectedCategory !== 'All' && (
            <button
              className="category-pill active"
              onClick={() => handleCategorySelect(selectedCategory)}
            >
              {selectedCategory}
            </button>
          )}
        </div>

        {/* Results Counter and Active Filter tags */}
        <div className="shop-results-status">
          <span className="results-count">
            Showing <strong>{filteredProducts.length}</strong> {filteredProducts.length === 1 ? 'product' : 'products'}
            {selectedCategory !== 'All' && <span> in <em>{selectedCategory}</em></span>}
            {searchQuery.trim() && <span> matching "<strong>{searchQuery.trim()}</strong>"</span>}
          </span>
          
          {hasActiveFilters && (
            <button className="reset-filter-link" onClick={handleResetFilters}>
              Reset filters ✕
            </button>
          )}
        </div>

        {/* Backend Error Banner */}
        {error ? (
          <div className="shop-error-state" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: '2.2rem', marginBottom: '14px' }}>⚠️</div>
            <h3 style={{ fontFamily: 'var(--font-family-base)', fontSize: '1.35rem', marginBottom: '8px', color: 'var(--color-text-main)' }}>
              Catalog Offline
            </h3>
            <p style={{ color: 'var(--color-text-muted)', maxWidth: '440px', margin: '0 auto 20px', fontSize: '0.92rem' }}>
              {error}
            </p>
            <button className="btn-primary" onClick={onRetry || fetchShopProducts || (() => window.location.reload())}>
              Retry Connection
            </button>
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--color-text-muted)', fontSize: '0.95rem' }}>
            <p>Loading products from AURA catalog...</p>
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="shop-products-grid">
            {filteredProducts.map((product) => {
              const isWishlisted = wishlistItems.some(
                (id) => String(id) === String(product._id) || String(id) === String(product.id)
              );

              const numPrice = Number(product.price) || 0;
              const effectiveMrp = product.mrp !== undefined && product.mrp !== null && !isNaN(Number(product.mrp))
                ? Number(product.mrp)
                : (product.originalPrice && !isNaN(Number(product.originalPrice)) ? Number(product.originalPrice) : null);
              const isMrpValid = effectiveMrp !== null && effectiveMrp > numPrice;
              const discountPercent = isMrpValid ? Math.round(((effectiveMrp - numPrice) / effectiveMrp) * 100) : 0;

              const isAccessory = (product.category || '').trim().toLowerCase() === 'accessories';
              const hasColorVariants = isAccessory && Array.isArray(product.colorVariants) && product.colorVariants.length > 0;
              const prodKey = product.id || product._id;
              const selectedColor = hasColorVariants
                ? (selectedCardColors[prodKey] || product.colorVariants[0].colorName)
                : null;
              const activeVariant = hasColorVariants
                ? (product.colorVariants.find(
                    (v) => (v.colorName && v.colorName.toLowerCase() === (selectedColor || '').toLowerCase()) ||
                           (v.colorCode && v.colorCode.toLowerCase() === (selectedColor || '').toLowerCase())
                  ) || product.colorVariants[0])
                : null;

              const primaryImage = (hasColorVariants && activeVariant?.image)
                ? normalizeProductImageUrl(activeVariant.image)
                : normalizeProductImageUrl(product.image);

              const alternateImage = (() => {
                if (hasColorVariants && Array.isArray(activeVariant?.images) && activeVariant.images.length > 1) {
                  const candidate = normalizeProductImageUrl(activeVariant.images[1]);
                  if (candidate && candidate !== primaryImage) return candidate;
                }
                if (Array.isArray(product.images) && product.images.length > 0) {
                  const candidate = product.images
                    .map(normalizeProductImageUrl)
                    .find((url) => url && url !== primaryImage);
                  if (candidate) return candidate;
                }
                if (product.secondaryImage) {
                  const norm = normalizeProductImageUrl(product.secondaryImage);
                  if (norm && norm !== primaryImage) return norm;
                }
                if (product.hoverImage) {
                  const norm = normalizeProductImageUrl(product.hoverImage);
                  if (norm && norm !== primaryImage) return norm;
                }
                return null;
              })();

              const productWithVariant = hasColorVariants
                ? {
                    ...product,
                    selectedColor: activeVariant?.colorName || selectedColor,
                    colorName: activeVariant?.colorName || selectedColor,
                    colorCode: activeVariant?.colorCode,
                    image: activeVariant?.image || product.image,
                  }
                : product;

              const isOutOfStock = product.stock === 0;
              const isLowStock = product.stock > 0 && product.stock <= 5;

              return (
                <article 
                  key={product.id || product._id} 
                  className="product-card"
                  onClick={() => onProductClick && onProductClick(productWithVariant)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onProductClick && onProductClick(productWithVariant);
                    }
                  }}
                  aria-label={`${product.name}, Price ₹${numPrice.toLocaleString('en-IN')}`}
                >
                  
                  {/* Image Container with Badges, Hover Reveal & Actions */}
                  <div className="product-image-container">
                    <img 
                      src={primaryImage} 
                      alt={product.name} 
                      className={`product-image primary-image ${alternateImage ? 'has-alternate' : ''}`}
                      loading="lazy" 
                      onError={handleImageError}
                    />

                    {alternateImage && (
                      <img 
                        src={alternateImage} 
                        alt={`${product.name} alternate angle`} 
                        className="product-image secondary-image"
                        loading="lazy" 
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}

                    {/* Stock, Discount or New Badge */}
                    {isOutOfStock ? (
                      <span className="product-discount-badge out-of-stock-badge">OUT OF STOCK</span>
                    ) : isMrpValid && discountPercent > 0 ? (
                      <span className="product-discount-badge">{discountPercent}% OFF</span>
                    ) : product.isNew ? (
                      <span className="product-discount-badge new-badge">NEW</span>
                    ) : null}

                    {/* Wishlist Button */}
                    <button 
                      type="button"
                      className={`product-wishlist-btn ${isWishlisted ? 'wishlisted' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onToggleWishlist) onToggleWishlist(product);
                      }}
                      aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
                      title={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                    >
                      <svg 
                        width="18" 
                        height="18" 
                        viewBox="0 0 24 24" 
                        fill={isWishlisted ? 'var(--color-primary)' : 'none'} 
                        stroke={isWishlisted ? 'var(--color-primary)' : 'currentColor'} 
                        strokeWidth="1.8"
                      >
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                      </svg>
                    </button>

                    {/* Hover Quick Add to Bag Button */}
                    <button 
                      type="button"
                      className={`product-quick-add-btn ${isOutOfStock ? 'is-out-of-stock' : ''}`}
                      disabled={isOutOfStock}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (isOutOfStock) return;
                        if (onAddToCart) onAddToCart(productWithVariant);
                      }}
                      title={isOutOfStock ? 'Item is out of stock' : 'Add to Bag'}
                    >
                      {isOutOfStock ? (
                        <>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line>
                          </svg>
                          Out of Stock
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                            <line x1="3" y1="6" x2="21" y2="6"></line>
                            <path d="M16 10a4 4 0 0 1-8 0"></path>
                          </svg>
                          Add to Bag
                        </>
                      )}
                    </button>
                  </div>

                  {/* Product Meta */}
                  <div className="product-details">
                    <div className="product-meta-header-row">
                      <span className="product-category-sub">
                        {product.category}{product.subCategory && product.subCategory !== product.category ? ` • ${product.subCategory}` : ''}
                      </span>
                      {isOutOfStock ? (
                        <span className="product-stock-tag out">Out of Stock</span>
                      ) : isLowStock ? (
                        <span className="product-stock-tag low">Only {product.stock} left</span>
                      ) : (
                        <span className="product-stock-tag in-stock">In Stock</span>
                      )}
                    </div>
                    <h3 className="product-name" title={product.name}>{product.name}</h3>

                    <div className="product-pricing">
                      <span className="current-price">₹{numPrice.toLocaleString('en-IN')}</span>
                      {isMrpValid && (
                        <>
                          <span className="original-price">₹{effectiveMrp.toLocaleString('en-IN')}</span>
                          {discountPercent > 0 && (
                            <span className="product-discount-percent">({discountPercent}% OFF)</span>
                          )}
                        </>
                      )}
                    </div>

                    {/* Star Ratings (Only display when genuine reviews exist) */}
                    {product.reviewsCount > 0 ? (
                      <div className="product-rating">
                        <span className="stars" aria-label={`${product.rating} stars`}>
                          {'★'.repeat(Math.min(5, Math.max(1, Math.round(product.rating || 5))))}
                          {'☆'.repeat(Math.max(0, 5 - Math.min(5, Math.max(1, Math.round(product.rating || 5)))))}
                        </span>
                        <span className="reviews">({product.reviewsCount})</span>
                      </div>
                    ) : null}

                    {/* Color Swatches - Accessories Only with functional switching */}
                    {hasColorVariants && product.colorVariants.length > 1 && (
                      <div 
                        className="color-swatches" 
                        aria-label={`Available colors: ${product.colorVariants.map(v => v.colorName).join(', ')}. Selected: ${activeVariant?.colorName || ''}`}
                      >
                        {product.colorVariants.map((variant, idx) => {
                          const isSelected = (activeVariant?.colorName || '').toLowerCase() === (variant.colorName || '').toLowerCase();
                          return (
                            <button 
                              key={variant._id || variant.colorName || idx} 
                              type="button"
                              className={`color-dot ${isSelected ? 'selected' : ''}`} 
                              style={{ backgroundColor: variant.colorCode || variant.colorName }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (variant.image) {
                                  setSelectedCardColors((prev) => ({
                                    ...prev,
                                    [prodKey]: variant.colorName,
                                  }));
                                } else {
                                  console.warn(`Variant ${variant.colorName} on ${product.name} has no existing image.`);
                                }
                              }}
                              aria-label={`${variant.colorName}${isSelected ? ' (Selected)' : ''}`}
                              title={`${variant.colorName}${isSelected ? ' (Selected)' : ''}`}
                            />
                          );
                        })}
                        {activeVariant?.colorName && (
                          <span className="selected-color-name-label">{activeVariant.colorName}</span>
                        )}
                      </div>
                    )}
                  </div>

                </article>
              );
            })}
          </div>
        ) : (
          /* Empty State */
          <div className="shop-empty-state">
            <div className="empty-icon-box">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                <line x1="8" y1="11" x2="14" y2="11"></line>
              </svg>
            </div>
            <h3>No products found</h3>
            <p>
              {searchQuery.trim() && selectedCategory !== 'All'
                ? `We couldn't find any items matching "${searchQuery.trim()}" in the ${selectedCategory} category.`
                : searchQuery.trim()
                ? `We couldn't find any products matching "${searchQuery.trim()}". Try searching with different keywords.`
                : selectedCategory.toLowerCase() === 'sale'
                ? "No products are currently on seasonal sale. All items are offered at their standard transparent pricing."
                : selectedCategory !== 'All'
                ? `No products currently available in the ${selectedCategory} collection.`
                : "We couldn't find any clothing items matching your current filters."}
            </p>
            <button className="btn-primary" onClick={handleResetFilters}>
              Reset All Filters
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
