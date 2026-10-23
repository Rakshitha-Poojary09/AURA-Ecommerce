import React from 'react';
import './WishlistPage.css';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';

export default function WishlistPage({
  wishlistProducts = [],
  allProducts = [],
  onAddToCart,
  onRemoveFromWishlist,
  onSelectProduct,
  onNavigate,
  currentUser = null
}) {
  // Synchronize with latest stock and details from allProducts
  const resolvedItems = wishlistProducts
    .map((item) => {
      if (!item) return null;
      const itemId = item._id || item.id;
      // Find live version from allProducts if available for real-time stock
      const live = allProducts.find(
        (p) => String(p._id || p.id) === String(itemId) || (item.name && p.name === item.name)
      );

      // If neither exists, product was deleted from MongoDB catalog
      if (!live && !item.name) return null;

      const product = live || item;
      const stock = typeof live?.stock === 'number' ? live.stock : (typeof item.stock === 'number' ? item.stock : 0);
      const isOutOfStock = stock <= 0;
      const isLowStock = stock > 0 && stock <= 5;

      return {
        ...product,
        liveStock: stock,
        isOutOfStock,
        isLowStock,
        originalItem: item
      };
    })
    .filter(Boolean);

  const handleCardClick = (product) => {
    if (onSelectProduct) {
      onSelectProduct(product);
    }
  };

  const handleMoveToBag = (e, product) => {
    e.stopPropagation();
    if (product.isOutOfStock) return;

    if (onAddToCart) {
      onAddToCart(product, 1);
    }
    if (onRemoveFromWishlist) {
      onRemoveFromWishlist(product);
    }
  };

  const handleAddOnly = (e, product) => {
    e.stopPropagation();
    if (product.isOutOfStock) return;

    if (onAddToCart) {
      onAddToCart(product, 1);
    }
  };

  const handleRemove = (e, product) => {
    e.stopPropagation();
    if (onRemoveFromWishlist) {
      onRemoveFromWishlist(product);
    }
  };

  return (
    <div className="aura-wishlist-page">
      <div className="aura-container">
        
        {/* Breadcrumb Navigation */}
        <nav className="wishlist-breadcrumb" aria-label="Breadcrumb">
          <button 
            type="button" 
            className="breadcrumb-link" 
            onClick={() => onNavigate && onNavigate('home')}
          >
            Home
          </button>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">My Wishlist</span>
        </nav>

        {/* Page Header */}
        <header className="wishlist-header">
          <div className="wishlist-header-content">
            <span className="wishlist-eyebrow">YOUR CURATED SELECTION</span>
            <div className="wishlist-title-wrap">
              <h1 className="wishlist-title">My Wishlist</h1>
              <span className="wishlist-counter-pill">
                {resolvedItems.length} {resolvedItems.length === 1 ? 'item' : 'items'}
              </span>
            </div>
            <p className="wishlist-subtitle">
              Cherish your favorite luxury pieces. Move them to your shopping bag whenever you are ready to indulge.
            </p>
          </div>

          {resolvedItems.length > 0 && (
            <div className="wishlist-header-actions">
              <button 
                type="button" 
                className="btn-secondary continue-shopping-btn"
                onClick={() => onNavigate && onNavigate('shop', 'All')}
              >
                Continue Shopping
              </button>
            </div>
          )}
        </header>

        {/* Guest Notification Banner */}
        {!currentUser && (
          <aside className="wishlist-guest-banner" aria-label="Guest wishlist notice">
            <div className="guest-banner-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            </div>
            <div className="guest-banner-text">
              <strong>Shopping as a Guest</strong>
              <span>
                Your wishlist is saved on this browser. <button type="button" className="guest-banner-link" onClick={() => onNavigate && onNavigate('login')}>Sign in</button> or <button type="button" className="guest-banner-link" onClick={() => onNavigate && onNavigate('register')}>Create an account</button> to save your wishlist securely in the cloud across all your devices.
              </span>
            </div>
          </aside>
        )}

        {/* Wishlist Items Grid or Empty State */}
        {resolvedItems.length === 0 ? (
          <div className="wishlist-empty-state">
            <div className="wishlist-empty-icon-wrap">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </div>
            <h2 className="wishlist-empty-title">Your Wishlist is Empty</h2>
            <p className="wishlist-empty-desc">
              You haven't saved any items yet. Explore our handcrafted seasonal collections and tap the heart icon on any piece you love.
            </p>
            <button 
              type="button" 
              className="btn-primary wishlist-empty-btn"
              onClick={() => onNavigate && onNavigate('shop', 'All')}
            >
              Explore Collection
            </button>
          </div>
        ) : (
          <div className="wishlist-grid">
            {resolvedItems.map((product) => {
              const prodId = product._id || product.id;
              const effectiveMrp = product.mrp !== undefined && product.mrp !== null ? Number(product.mrp) : (product.originalPrice ? Number(product.originalPrice) : null);
              const numPrice = Number(product.price) || 0;
              const hasDiscount = effectiveMrp !== null && effectiveMrp > numPrice;
              const discountPercent = hasDiscount ? Math.round(((effectiveMrp - numPrice) / effectiveMrp) * 100) : 0;
              const formattedPrice = numPrice.toLocaleString('en-IN');
              const formattedOriginalPrice = hasDiscount ? effectiveMrp.toLocaleString('en-IN') : null;

              return (
                <article 
                  key={prodId}
                  className={`wishlist-card ${product.isOutOfStock ? 'is-out-of-stock' : ''}`}
                  onClick={() => handleCardClick(product)}
                >
                  {/* Card Media Container */}
                  <div className="wishlist-card-media">
                    <img 
                      src={normalizeProductImageUrl(product.image)} 
                      alt={product.name} 
                      className="wishlist-card-img"
                      loading="lazy"
                      onError={handleImageError}
                    />

                    {/* Stock & Discount Badges */}
                    <div className="wishlist-badges-row">
                      {product.isOutOfStock ? (
                        <span className="wishlist-badge badge-out-of-stock">Out of Stock</span>
                      ) : product.isLowStock ? (
                        <span className="wishlist-badge badge-low-stock">Only {product.liveStock} Left</span>
                      ) : hasDiscount && discountPercent > 0 ? (
                        <span className="wishlist-badge badge-discount">{discountPercent}% OFF</span>
                      ) : null}
                    </div>

                    {/* Quick Remove Button */}
                    <button 
                      type="button"
                      className="wishlist-remove-btn"
                      onClick={(e) => handleRemove(e, product)}
                      title="Remove from wishlist"
                      aria-label={`Remove ${product.name} from wishlist`}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                      </svg>
                    </button>
                  </div>

                  {/* Card Info Content */}
                  <div className="wishlist-card-body">
                    <span className="wishlist-card-category">{product.category || 'Collection'}</span>
                    <h3 className="wishlist-card-name" title={product.name}>
                      {product.name}
                    </h3>

                    {/* Price Row */}
                    <div className="wishlist-price-row">
                      <span className="wishlist-current-price">₹{formattedPrice}</span>
                      {formattedOriginalPrice && (
                        <span className="wishlist-original-price">₹{formattedOriginalPrice}</span>
                      )}
                    </div>

                    {/* Availability Note */}
                    <div className="wishlist-stock-status">
                      {product.isOutOfStock ? (
                        <span className="stock-label out-stock">Currently unavailable</span>
                      ) : product.isLowStock ? (
                        <span className="stock-label low-stock">Hurry, only {product.liveStock} in stock</span>
                      ) : (
                        <span className="stock-label in-stock">In stock & ready to ship</span>
                      )}
                    </div>

                    {/* Card Actions */}
                    <div className="wishlist-card-actions">
                      {product.isOutOfStock ? (
                        <button 
                          type="button" 
                          className="btn-wishlist-action btn-disabled"
                          disabled
                          title="Item is out of stock"
                        >
                          Out of Stock
                        </button>
                      ) : (
                        <div className="wishlist-action-group">
                          <button 
                            type="button" 
                            className="btn-wishlist-action btn-move-to-bag"
                            onClick={(e) => handleMoveToBag(e, product)}
                            title="Add item to your bag and remove from wishlist"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                              <line x1="3" y1="6" x2="21" y2="6"></line>
                              <path d="M16 10a4 4 0 0 1-8 0"></path>
                            </svg>
                            Move to Bag
                          </button>
                          <button 
                            type="button" 
                            className="btn-wishlist-action btn-add-only"
                            onClick={(e) => handleAddOnly(e, product)}
                            title="Add item to bag while keeping it in your wishlist"
                            aria-label={`Add ${product.name} to bag`}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
