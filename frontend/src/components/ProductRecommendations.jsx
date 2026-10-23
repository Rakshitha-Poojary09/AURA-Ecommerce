import React, { useState, useEffect, useRef, useMemo } from 'react';
import './ProductRecommendations.css';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';

// Garment categorization patterns for similarity matching
const GARMENT_PATTERNS = [
  { type: 'dress', regex: /\b(dress|gown|maxi|midi|frock|wrap)\b/i },
  { type: 'shirt', regex: /\b(shirt|blouse|oxford|button-down)\b/i },
  { type: 'top', regex: /\b(top|tee|t-shirt|tank|knit|crop)\b/i },
  { type: 'pants', regex: /\b(pants|pant|trouser|trousers|jeans|bottom)\b/i },
  { type: 'jacket', regex: /\b(jacket|blazer|coat|hoodie|outerwear)\b/i },
  { type: 'skirt', regex: /\b(skirt|pleated)\b/i },
  { type: 'bag', regex: /\b(bag|tote|handbag|clutch)\b/i },
  { type: 'set', regex: /\b(set|co-ord|suit|romper)\b/i }
];

function getGarmentType(text = '') {
  for (const item of GARMENT_PATTERNS) {
    if (item.regex.test(text)) return item.type;
  }
  return null;
}

/**
 * Pure recommendation scoring function
 * Prioritizes:
 * 1. Strictly matches audience/category (e.g. women with women, men with men)
 * 2. Same garment type / silhouette (+100) (shirts with shirts, dresses with dresses)
 * 3. Style / fabric keyword matches (+10 per word)
 * 4. Price proximity (+10 for <= 30% difference)
 * 5. In-stock and active products only (excludes stock <= 0)
 * 6. Deduplicates candidates so identical product names do not repeat
 */
function computeRecommendations(currentProduct, catalog = []) {
  if (!currentProduct || !Array.isArray(catalog) || catalog.length === 0) {
    return [];
  }

  const currentId = String(currentProduct._id || currentProduct.id || '');
  const curNameNorm = (currentProduct.name || '').trim().toLowerCase();
  const curAudience = (currentProduct.category || '').trim().toLowerCase();

  const currentGarment = getGarmentType(`${currentProduct.name} ${currentProduct.description || ''}`);
  const currentWords = (`${currentProduct.name} ${currentProduct.description || ''}`)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);

  // Filter candidates: same audience, in-stock, and exclude current product
  const candidates = catalog.filter((prod) => {
    const prodId = String(prod._id || prod.id || '');
    if (!prodId || prodId === currentId) return false;
    if ((prod.name || '').trim().toLowerCase() === curNameNorm) return false;
    // Exclude unavailable products (stock <= 0)
    if (typeof prod.stock === 'number' && prod.stock <= 0) return false;

    // Strict audience matching: never recommend cross-audience clothing items
    const candAudience = (prod.category || '').trim().toLowerCase();
    if (curAudience && candAudience !== curAudience) return false;

    return true;
  });

  const scored = candidates.map((prod) => {
    let score = 0;
    const text = `${prod.name} ${prod.description || ''}`;
    const candGarment = getGarmentType(text);

    // 1. Same garment type (shirts with shirts, dresses with dresses): highest priority (+100)
    if (currentGarment && candGarment && currentGarment === candGarment) {
      score += 100;
    }

    // 2. Keyword / fabric matching (linen, floral, summer, etc.) (+10)
    const candWords = text.toLowerCase().split(/[^a-z0-9]+/);
    for (const w of currentWords) {
      if (candWords.includes(w)) {
        score += 10;
      }
    }

    // 3. Price bracket proximity
    if (currentProduct.price && prod.price) {
      const diffRatio = Math.abs(currentProduct.price - prod.price) / currentProduct.price;
      if (diffRatio <= 0.3) score += 10;
      else if (diffRatio <= 0.6) score += 5;
    }

    return { ...prod, score };
  });

  // Sort descending by score, then newest
  scored.sort((a, b) => b.score - a.score || new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  // Deduplicate by normalized name
  const seenNames = new Set();
  const uniqueRecs = [];
  for (const item of scored) {
    const norm = (item.name || '').trim().toLowerCase();
    if (!seenNames.has(norm)) {
      seenNames.add(norm);
      uniqueRecs.push(item);
    }
    if (uniqueRecs.length >= 8) break;
  }

  return uniqueRecs;
}

export default function ProductRecommendations({
  currentProduct,
  allProducts = [],
  wishlistItems = [],
  onToggleWishlist,
  onSelectProduct,
  onNavigate
}) {
  const [recommendations, setRecommendations] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [selectedCardColors, setSelectedCardColors] = useState({});

  const carouselRef = useRef(null);
  const cacheRef = useRef({});

  const productId = currentProduct ? String(currentProduct._id || currentProduct.id || '') : '';

  // Initial client-side computation from allProducts for instant rendering (zero layout shift)
  const fallbackRecommendations = useMemo(() => {
    return computeRecommendations(currentProduct, allProducts);
  }, [currentProduct, allProducts]);

  // Fetch real recommendations from backend API with fallback & cache
  useEffect(() => {
    if (!productId) {
      setRecommendations([]);
      return;
    }

    // If cached, use cached immediately
    if (cacheRef.current[productId]) {
      setRecommendations(cacheRef.current[productId]);
      return;
    }

    // Set immediate client-computed items while remote API resolves
    if (fallbackRecommendations && fallbackRecommendations.length > 0) {
      setRecommendations(fallbackRecommendations);
    }

    let isMounted = true;
    const controller = new AbortController();

    const fetchBackendRecommendations = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`http://localhost:5000/api/products/${productId}/recommendations`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && isMounted) {
            // Filter out any 0 stock product and deduplicate by name
            const seen = new Set();
            const valid = [];
            for (const p of data) {
              if (typeof p.stock === 'number' && p.stock <= 0) continue;
              const norm = (p.name || '').trim().toLowerCase();
              if (!seen.has(norm)) {
                seen.add(norm);
                valid.push(p);
              }
            }
            cacheRef.current[productId] = valid;
            setRecommendations(valid);
            return;
          }
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          // Gracefully fallback to client computed list
          if (isMounted && fallbackRecommendations.length > 0) {
            setRecommendations(fallbackRecommendations);
          }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchBackendRecommendations();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [productId, fallbackRecommendations]);

  // Update carousel scroll button states
  const updateScrollButtons = () => {
    const el = carouselRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 6);
  };

  useEffect(() => {
    updateScrollButtons();
    const handleResize = () => updateScrollButtons();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [recommendations]);

  const handleScroll = (direction) => {
    const el = carouselRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('.pdp-rec-card')?.clientWidth || 140;
    const gap = 12;
    const scrollAmount = (cardWidth + gap) * 2; // Scroll 2 cards at a time
    el.scrollBy({
      left: direction * scrollAmount,
      behavior: 'smooth'
    });
  };

  // If no recommendations available, hide the section gracefully
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  const categoryName = currentProduct?.category || 'Collection';

  return (
    <section className="pdp-recommendations-section" aria-label="You May Also Like">
      {/* Section Header */}
      <div className="pdp-rec-header">
        <div className="pdp-rec-title-wrap">
          <span className="pdp-rec-eyebrow">SIMILAR STYLES</span>
          <h3 className="pdp-rec-title">You May Also Like</h3>
        </div>

        <div className="pdp-rec-actions">
          {recommendations.length > 4 && (
            <div className="pdp-rec-arrows" aria-label="Carousel navigation">
              <button
                type="button"
                className="pdp-rec-arrow-btn"
                onClick={() => handleScroll(-1)}
                disabled={!canScrollLeft}
                aria-label="Previous recommendations"
                title="Scroll previous"
              >
                ‹
              </button>
              <button
                type="button"
                className="pdp-rec-arrow-btn"
                onClick={() => handleScroll(1)}
                disabled={!canScrollRight}
                aria-label="Next recommendations"
                title="Scroll next"
              >
                ›
              </button>
            </div>
          )}

          <button
            type="button"
            className="pdp-rec-view-all"
            onClick={() => onNavigate && onNavigate('shop', categoryName)}
            aria-label={`View all ${categoryName} styles`}
          >
            View All →
          </button>
        </div>
      </div>

      {/* Product Cards Carousel */}
      <div
        className="pdp-rec-carousel"
        ref={carouselRef}
        onScroll={updateScrollButtons}
        role="region"
        aria-label="Product recommendations carousel"
      >
        {recommendations.map((prod) => {
          const prodId = String(prod._id || prod.id || '');
          const isWishlisted = wishlistItems.some((id) => String(id) === prodId);

          const numPrice = Number(prod.price) || 0;
          const numMrp =
            prod.mrp !== undefined && prod.mrp !== null
              ? Number(prod.mrp)
              : prod.originalPrice
              ? Number(prod.originalPrice)
              : null;

          const hasDiscount = numMrp !== null && numMrp > numPrice;
          const discountPercent = hasDiscount
            ? Math.round(((numMrp - numPrice) / numMrp) * 100)
            : 0;

          const isAccessory = (prod.category || '').trim().toLowerCase() === 'accessories';
          const hasColorVariants = isAccessory && Array.isArray(prod.colorVariants) && prod.colorVariants.length > 0;
          const selectedColor = hasColorVariants
            ? (selectedCardColors[prodId] || prod.colorVariants[0].colorName)
            : null;
          const activeVariant = hasColorVariants
            ? (prod.colorVariants.find(
                (v) => (v.colorName && v.colorName.toLowerCase() === (selectedColor || '').toLowerCase()) ||
                       (v.colorCode && v.colorCode.toLowerCase() === (selectedColor || '').toLowerCase())
              ) || prod.colorVariants[0])
            : null;

          const displayImage = (hasColorVariants && activeVariant?.image)
            ? normalizeProductImageUrl(activeVariant.image)
            : normalizeProductImageUrl(prod.image);

          const prodWithVariant = hasColorVariants
            ? {
                ...prod,
                selectedColor: activeVariant?.colorName || selectedColor,
                colorName: activeVariant?.colorName || selectedColor,
                colorCode: activeVariant?.colorCode,
                image: activeVariant?.image || prod.image,
              }
            : prod;

          return (
            <article
              key={prodId}
              className="pdp-rec-card"
              onClick={() => {
                if (onSelectProduct) {
                  onSelectProduct(prodWithVariant);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`View ${prod.name}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (onSelectProduct) {
                    onSelectProduct(prodWithVariant);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }
              }}
            >
              {/* Product Image & Badges */}
              <div className="pdp-rec-image-wrapper">
                <img
                  src={displayImage}
                  alt={prod.name}
                  className="pdp-rec-image"
                  loading="lazy"
                  onError={handleImageError}
                />

                {/* Discount Percentage Badge */}
                {hasDiscount && discountPercent > 0 && (
                  <span className="pdp-rec-discount-badge">{discountPercent}% OFF</span>
                )}

                {/* Wishlist Heart Button */}
                <button
                  type="button"
                  className={`pdp-rec-wishlist-btn ${isWishlisted ? 'is-wishlisted' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleWishlist) onToggleWishlist(prod);
                  }}
                  aria-label={isWishlisted ? `Remove ${prod.name} from wishlist` : `Add ${prod.name} to wishlist`}
                  title={isWishlisted ? 'Saved in wishlist' : 'Save to wishlist'}
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill={isWishlisted ? 'var(--color-primary)' : 'none'}
                    stroke={isWishlisted ? 'var(--color-primary)' : 'currentColor'}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                  </svg>
                </button>
              </div>

              {/* Product Info */}
              <div className="pdp-rec-info">
                <span className="pdp-rec-category">{prod.category || 'Clothing'}</span>
                <h4 className="pdp-rec-name" title={prod.name}>
                  {prod.name}
                </h4>

                <div className="pdp-rec-price-row">
                  <span className="pdp-rec-price">₹{numPrice.toLocaleString('en-IN')}</span>
                  {hasDiscount && (
                    <span className="pdp-rec-mrp">₹{numMrp.toLocaleString('en-IN')}</span>
                  )}
                  {hasDiscount && discountPercent > 0 && (
                    <span className="pdp-rec-discount-tag">{discountPercent}% OFF</span>
                  )}
                </div>

                {/* Optional Colour Swatches - Accessories Only with functional switching */}
                {hasColorVariants && prod.colorVariants.length > 1 && (
                  <div 
                    className="pdp-rec-swatches" 
                    aria-label={`Available colors: ${prod.colorVariants.map(v => v.colorName).join(', ')}. Selected: ${activeVariant?.colorName || ''}`}
                  >
                    {prod.colorVariants.slice(0, 4).map((variant, idx) => {
                      const isSelected = (activeVariant?.colorName || '').toLowerCase() === (variant.colorName || '').toLowerCase();
                      return (
                        <button
                          key={variant._id || variant.colorName || idx}
                          type="button"
                          className={`pdp-rec-color-dot ${isSelected ? 'selected' : ''}`}
                          style={{ backgroundColor: variant.colorCode || variant.colorName }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (variant.image) {
                              setSelectedCardColors((prev) => ({
                                ...prev,
                                [prodId]: variant.colorName,
                              }));
                            } else {
                              console.warn(`Variant ${variant.colorName} on ${prod.name} has no existing image.`);
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
    </section>
  );
}
