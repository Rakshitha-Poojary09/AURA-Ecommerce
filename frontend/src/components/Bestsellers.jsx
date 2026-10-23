import React, { useState } from 'react';
import './Bestsellers.css';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';

export default function Bestsellers({ 
  products = [],
  loading = false,
  onAddToCart, 
  onToggleWishlist, 
  wishlistItems = [], 
  onViewProductsClick,
  onProductClick 
}) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [selectedCardColors, setSelectedCardColors] = useState({});

  const filterTabs = ['All', 'Women', 'Men'];

  const filteredProducts = (activeFilter === 'All' 
    ? products 
    : products.filter(item => item.category === activeFilter)
  ).slice(0, 4);

  return (
    <section className="aura-bestsellers-section" id="bestsellers">
      <div className="aura-container">
        
        {/* Section Header */}
        <div className="section-header">
          <div>
            <span className="section-eyebrow">TRENDING NOW</span>
            <h2 className="section-title">Our Bestsellers</h2>
          </div>
          
          <div className="bestseller-filters">
            {filterTabs.map((tab) => (
              <button
                key={tab}
                className={`filter-btn ${activeFilter === tab ? 'active' : ''}`}
                onClick={() => setActiveFilter(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <button 
            className="view-all-link"
            onClick={onViewProductsClick}
            style={{ background: 'none', border: 'none', cursor: 'pointer' }}
          >
            View All
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Product Grid */}
        <div className="products-grid">
          {loading && products.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
              Loading bestsellers...
            </div>
          ) : filteredProducts.map((product) => {
            const prodKey = product._id || product.id;
            const isWishlisted = wishlistItems.some(
              (id) => String(id) === String(product._id) || String(id) === String(product.id)
            );

            const isAccessory = (product.category || '').trim().toLowerCase() === 'accessories';
            const hasColorVariants = isAccessory && Array.isArray(product.colorVariants) && product.colorVariants.length > 0;
            const selectedColor = hasColorVariants
              ? (selectedCardColors[prodKey] || product.colorVariants[0].colorName)
              : null;
            const activeVariant = hasColorVariants
              ? (product.colorVariants.find(
                  (v) => (v.colorName && v.colorName.toLowerCase() === (selectedColor || '').toLowerCase()) ||
                         (v.colorCode && v.colorCode.toLowerCase() === (selectedColor || '').toLowerCase())
                ) || product.colorVariants[0])
              : null;

            const displayImage = (hasColorVariants && activeVariant?.image)
              ? normalizeProductImageUrl(activeVariant.image)
              : normalizeProductImageUrl(product.image);

            const productWithVariant = hasColorVariants
              ? {
                  ...product,
                  selectedColor: activeVariant?.colorName || selectedColor,
                  colorName: activeVariant?.colorName || selectedColor,
                  colorCode: activeVariant?.colorCode,
                  image: activeVariant?.image || product.image,
                }
              : product;

            return (
              <div 
                key={prodKey} 
                className="product-card"
                onClick={() => onProductClick && onProductClick(productWithVariant)}
                style={{ cursor: 'pointer' }}
              >
                
                {/* Image Container with Badges & Actions */}
                <div className="product-image-container">
                  <img 
                    src={displayImage} 
                    alt={product.name} 
                    className="product-image"
                    loading="lazy" 
                    onError={handleImageError}
                  />

                  {/* Stock, Discount or New Badge */}
                  {(() => {
                    const effectiveMrp = product.mrp !== undefined && product.mrp !== null ? Number(product.mrp) : (product.originalPrice ? Number(product.originalPrice) : null);
                    const numPrice = Number(product.price) || 0;
                    const hasDiscount = effectiveMrp !== null && effectiveMrp > numPrice;
                    const discountPercent = hasDiscount ? Math.round(((effectiveMrp - numPrice) / effectiveMrp) * 100) : 0;

                    if (product.stock === 0) {
                      return <span className="product-discount-badge out-of-stock-badge">OUT OF STOCK</span>;
                    }
                    if (product.stock > 0 && product.stock <= 5) {
                      return <span className="product-discount-badge low-stock-badge">ONLY {product.stock} LEFT</span>;
                    }
                    if (hasDiscount && discountPercent > 0) {
                      return <span className="product-discount-badge">{discountPercent}% OFF</span>;
                    }
                    if (product.isNew) {
                      return <span className="product-discount-badge" style={{ backgroundColor: '#2b2d2f' }}>NEW</span>;
                    }
                    return null;
                  })()}

                  {/* Wishlist Button */}
                  <button 
                    className={`product-wishlist-btn ${isWishlisted ? 'wishlisted' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWishlist(product);
                    }}
                    aria-label={`Save ${product.name} to wishlist`}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill={isWishlisted ? 'var(--color-primary)' : 'none'} stroke={isWishlisted ? 'var(--color-primary)' : 'currentColor'} strokeWidth="1.8">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                  </button>

                  {/* Hover Quick Add Button */}
                  <button 
                    className={`product-quick-add-btn ${product.stock === 0 ? 'is-out-of-stock' : ''}`}
                    disabled={product.stock === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (product.stock === 0) return;
                      onAddToCart(productWithVariant);
                    }}
                    title={product.stock === 0 ? 'Item is out of stock' : 'Add to Bag'}
                  >
                    {product.stock === 0 ? (
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
                    {product.stock === 0 ? (
                      <span className="product-stock-tag out">Out of Stock</span>
                    ) : product.stock > 0 && product.stock <= 5 ? (
                      <span className="product-stock-tag low">Only {product.stock} left</span>
                    ) : null}
                  </div>
                  <h3 className="product-name">{product.name}</h3>

                  <div className="product-pricing">
                    {(() => {
                      const effectiveMrp = product.mrp !== undefined && product.mrp !== null ? Number(product.mrp) : (product.originalPrice ? Number(product.originalPrice) : null);
                      const numPrice = Number(product.price || 0);
                      const hasDiscount = effectiveMrp !== null && effectiveMrp > numPrice;

                      return (
                        <>
                          <span className="current-price">₹{numPrice.toLocaleString('en-IN')}</span>
                          {hasDiscount && (
                            <span className="original-price">₹{effectiveMrp.toLocaleString('en-IN')}</span>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Star Ratings (Only display when genuine reviews exist) */}
                  {product.reviewsCount > 0 ? (
                    <div className="product-rating">
                      <span className="stars">
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

              </div>
            );
          })}
        </div>

        {/* View Products CTA button as specified in requirements */}
        <div className="view-more-container">
          <button 
            className="btn-secondary view-products-btn"
            onClick={onViewProductsClick}
          >
            View Products
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>

      </div>
    </section>
  );
}
