import React, { useState, useEffect } from 'react';
import './CartPage.css';
import AvailableCoupons from './AvailableCoupons';

export default function CartPage({
  cartItems = [],
  products = [],
  appliedCoupon = null,
  onApplyCoupon,
  onRemoveCoupon,
  currentUser = null,
  onUpdateQuantity,
  onRemoveItem,
  onMoveToWishlist,
  onNavigate,
  onProductClick,
  onCheckout
}) {
  const [promoCode, setPromoCode] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [promoMessage, setPromoMessage] = useState(null);
  const [showAvailableCoupons, setShowAvailableCoupons] = useState(false);

  // Helper to get real live stock from MongoDB products based on PRODUCT + SELECTED SIZE
  const getAvailableStock = (item) => {
    const matched = products?.find(
      (p) =>
        (p._id && (p._id === item.productId || p._id === item._id || p._id === item.id)) ||
        (p.id && (p.id === item.productId || p.id === item._id || p.id === item.id)) ||
        p.name === item.name
    );
    const chosenSize = (item.selectedSize || item.size || 'One Size').toString().trim();
    const chosenColor = (item.colorName || item.selectedColor || item.color || '').toString().trim();

    if (matched) {
      if (Array.isArray(matched.colorVariants) && matched.colorVariants.length > 0 && chosenColor) {
        const variant = matched.colorVariants.find(
          (v) => (v.colorName && v.colorName.toLowerCase() === chosenColor.toLowerCase()) ||
                 (v.colorCode && v.colorCode.toLowerCase() === chosenColor.toLowerCase())
        );
        if (variant && typeof variant.stock === 'number') {
          return Math.max(0, variant.stock);
        }
      }
      if (matched.sizeStock && typeof matched.sizeStock === 'object' && typeof matched.sizeStock[chosenSize] === 'number') {
        return Math.max(0, matched.sizeStock[chosenSize]);
      }
      if (typeof matched.stock === 'number') {
        return Math.max(0, matched.stock);
      }
    }
    if (item.sizeStock && typeof item.sizeStock === 'object' && typeof item.sizeStock[chosenSize] === 'number') {
      return Math.max(0, item.sizeStock[chosenSize]);
    }
    return typeof item.stock === 'number' ? Math.max(0, item.stock) : 20;
  };

  // Check if any cart item exceeds available stock or is completely out of stock
  const hasStockIssues = cartItems.some((item) => {
    const stock = getAvailableStock(item);
    return item.quantity > stock || stock === 0;
  });

  // Financial calculations
  const subtotal = (cartItems || []).reduce(
    (acc, item) => acc + (Number(item?.price) || 0) * (Number(item?.quantity) || 1),
    0
  );
  
  // Free shipping threshold ₹999
  const shippingThreshold = 999;
  const isFreeShipping = subtotal >= shippingThreshold || subtotal === 0;
  const shippingFee = isFreeShipping ? 0 : 99;
  
  // Real dynamic coupon discount calculation
  let discountAmount = 0;
  if (appliedCoupon && subtotal > 0) {
    if (appliedCoupon.discountType === 'percentage') {
      discountAmount = Math.round((subtotal * (Number(appliedCoupon.discountValue) || 0)) / 100);
      if (appliedCoupon.maxDiscountAmount && Number(appliedCoupon.maxDiscountAmount) > 0) {
        discountAmount = Math.min(discountAmount, Number(appliedCoupon.maxDiscountAmount));
      }
    } else if (appliedCoupon.discountType === 'fixed') {
      discountAmount = Math.round(Number(appliedCoupon.discountValue) || 0);
    }
    discountAmount = Math.min(discountAmount, subtotal);
    discountAmount = Math.max(0, discountAmount);
  }

  // Authoritative payable final total
  const finalTotal = Math.max(0, subtotal - discountAmount + shippingFee);

  // Monitor if subtotal drops below minimum required order for applied coupon
  useEffect(() => {
    if (appliedCoupon && appliedCoupon.minOrderAmount && subtotal < appliedCoupon.minOrderAmount) {
      if (onRemoveCoupon) onRemoveCoupon();
      setPromoMessage({
        type: 'error',
        text: `Subtotal dropped below ₹${Number(appliedCoupon.minOrderAmount).toLocaleString('en-IN')}. Coupon "${appliedCoupon.code}" was removed.`
      });
    }
  }, [subtotal, appliedCoupon]);

  // Securely Validate & Apply Coupon via MERN API
  const applyPromoByCode = async (codeToApply) => {
    const code = (codeToApply || '').trim().toUpperCase();
    if (!code) {
      setPromoMessage({ type: 'error', text: 'Please enter a coupon code.' });
      return;
    }

    if (subtotal <= 0) {
      setPromoMessage({ type: 'error', text: 'Add items to your bag before applying a coupon.' });
      return;
    }

    setIsValidatingCoupon(true);
    setPromoMessage(null);

    try {
      const response = await fetch('http://localhost:5000/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code,
          subtotal,
          customerEmail: currentUser?.email,
          customerId: currentUser?._id
        })
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        throw new Error(data.message || 'Invalid coupon code.');
      }

      if (onApplyCoupon) {
        onApplyCoupon(data.coupon);
      }
      setPromoCode('');
      setPromoMessage({ type: 'success', text: data.message });
    } catch (err) {
      if (onRemoveCoupon) onRemoveCoupon();
      setPromoMessage({ type: 'error', text: err.message || 'Coupon could not be applied.' });
    } finally {
      setIsValidatingCoupon(false);
    }
  };

  const handleApplyPromo = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    applyPromoByCode(promoCode);
  };

  const handleRemovePromo = () => {
    if (onRemoveCoupon) onRemoveCoupon();
    setPromoMessage({ type: 'info', text: 'Coupon removed from order.' });
  };

  const totalItemCount = (cartItems || []).reduce((acc, item) => acc + (Number(item?.quantity) || 1), 0);

  return (
    <div className="aura-cart-page">
      <div className="aura-container">
        
        {/* Breadcrumb Navigation */}
        <nav className="cart-breadcrumb" aria-label="Breadcrumb">
          <button className="cart-breadcrumb-link" onClick={() => onNavigate('home')}>
            Home
          </button>
          <span className="cart-breadcrumb-sep">/</span>
          <button className="cart-breadcrumb-link" onClick={() => onNavigate('shop')}>
            Shop
          </button>
          <span className="cart-breadcrumb-sep">/</span>
          <span className="cart-breadcrumb-active">My Bag</span>
        </nav>

        {/* Page Heading */}
        <header className="cart-header">
          <h1 className="cart-title">My Bag</h1>
          <p className="cart-subtitle">
            {totalItemCount > 0 
              ? `You have ${totalItemCount} ${totalItemCount === 1 ? 'item' : 'items'} in your shopping bag`
              : 'Your shopping bag is currently empty'}
          </p>
        </header>

        {cartItems.length > 0 ? (
          <div className="cart-layout-grid">
            
            {/* Left Column: Cart Items List */}
            <div className="cart-items-column">
              
              {/* Shipping progress notification bar */}
              <div className="shipping-progress-card">
                {isFreeShipping ? (
                  <div className="shipping-unlocked">
                    <span className="shipping-icon">✨</span>
                    <span><strong>Free Standard Delivery unlocked!</strong> You qualify for complimentary shipping.</span>
                  </div>
                ) : (
                  <div className="shipping-needed">
                    <span className="shipping-icon">🚚</span>
                    <span>
                      Add <strong>₹{(shippingThreshold - subtotal).toLocaleString('en-IN')}</strong> more to unlock <strong>Free Shipping</strong>!
                    </span>
                  </div>
                )}
                <div className="progress-bar-track">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${Math.min(100, (subtotal / shippingThreshold) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Items Table/List */}
              <div className="cart-items-list">
                {cartItems.map((item) => {
                  const itemKey = item.cartItemId || `${item.productId || item._id || item.id || 'item'}-${item.selectedSize || item.size || 'M'}-${item.selectedColor || ''}`;
                  const availableStock = getAvailableStock(item);
                  const isOutOfStock = availableStock === 0;
                  const isInsufficientStock = (Number(item?.quantity) || 1) > availableStock || isOutOfStock;

                  return (
                    <div key={itemKey} className={`cart-item-card ${isInsufficientStock ? 'has-stock-error' : ''}`}>
                      
                      {/* Product Thumbnail */}
                      <div 
                        className="cart-item-image-box"
                        onClick={() => onProductClick && onProductClick(item)}
                        style={{ cursor: 'pointer' }}
                        title="View product details"
                      >
                        <img src={item.image} alt={item.name} className="cart-item-img" />
                      </div>

                      {/* Product Info & Options */}
                      <div className="cart-item-details">
                        <div className="cart-item-meta-top">
                          <span className="cart-item-category">{item.category}</span>
                          <h3 
                            className="cart-item-name"
                            onClick={() => onProductClick && onProductClick(item)}
                          >
                            {item.name}
                          </h3>
                        </div>

                        {/* Selected Attributes (Size & Color) + Live Stock Indicator */}
                        <div className="cart-item-options">
                          <span className="cart-attribute-badge">
                            Size: <strong>{item.selectedSize || 'Standard'}</strong>
                          </span>
                          {(item.colorName || item.selectedColor || item.color) && (
                            <span className="cart-attribute-badge color-badge">
                              Colour: <strong>{item.colorName || item.color || item.selectedColor}</strong>
                              <span 
                                className="cart-color-dot" 
                                style={{
                                  backgroundColor: item.colorCode || (
                                    (item.selectedColor && item.selectedColor.startsWith('#'))
                                      ? item.selectedColor
                                      : item.colorName === 'Red' ? '#b91c1c'
                                      : item.colorName === 'Black' ? '#1c1c1c'
                                      : item.colorName === 'Brown' ? '#6e473b'
                                      : '#798777'
                                  )
                                }}
                              />
                            </span>
                          )}

                          {/* Live Available Stock Badge */}
                          {isOutOfStock ? (
                            <span className="cart-stock-pill out-of-stock">
                              <span className="stock-dot-cart dot-out"></span> Out of Stock
                            </span>
                          ) : availableStock <= 5 ? (
                            <span className="cart-stock-pill low-stock">
                              <span className="stock-dot-cart dot-low"></span> Only {availableStock} left
                            </span>
                          ) : (
                            <span className="cart-stock-pill in-stock">
                              <span className="stock-dot-cart dot-in"></span> {availableStock} available
                            </span>
                          )}
                        </div>

                        {/* Pricing */}
                        <div className="cart-item-price-row">
                          <span className="cart-item-price">
                            ₹{(Number(item.price) || 0).toLocaleString('en-IN')}
                          </span>
                          {(() => {
                            const effectiveMrp = item.mrp !== undefined && item.mrp !== null ? Number(item.mrp) : (item.originalPrice ? Number(item.originalPrice) : null);
                            const numPrice = Number(item.price) || 0;
                            const hasDiscount = effectiveMrp !== null && effectiveMrp > numPrice;
                            const discountPercent = hasDiscount ? Math.round(((effectiveMrp - numPrice) / effectiveMrp) * 100) : 0;

                            return hasDiscount ? (
                              <>
                                <span className="cart-item-orig-price">
                                  ₹{effectiveMrp.toLocaleString('en-IN')}
                                </span>
                                {discountPercent > 0 && (
                                  <span className="cart-item-discount">
                                    {discountPercent}% OFF
                                  </span>
                                )}
                              </>
                            ) : null;
                          })()}
                        </div>

                        {/* Insufficient Stock Warning */}
                        {isInsufficientStock && (
                          <div className="cart-item-stock-warning" role="alert">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>
                              {isOutOfStock
                                ? `Size ${item.selectedSize || 'chosen'} is currently out of stock. Please remove it from your bag.`
                                : `Requested quantity (${item.quantity}) exceeds available stock (${availableStock}) for Size ${item.selectedSize || 'chosen'}. Please reduce quantity to continue.`}
                            </span>
                          </div>
                        )}

                        {/* Quantity Controls & Action Links */}
                        <div className="cart-item-actions-row">
                          <div className="cart-qty-stepper">
                            <button
                              className="cart-qty-btn"
                              onClick={() => onUpdateQuantity(itemKey, -1)}
                              aria-label="Decrease quantity"
                              disabled={item.quantity <= 1}
                            >
                              −
                            </button>
                            <span className="cart-qty-val">{item.quantity}</span>
                            <button
                              className="cart-qty-btn"
                              onClick={() => onUpdateQuantity(itemKey, 1)}
                              aria-label="Increase quantity"
                              disabled={item.quantity >= availableStock}
                              title={item.quantity >= availableStock ? `Maximum stock reached (${availableStock})` : 'Increase quantity'}
                            >
                              +
                            </button>
                          </div>

                          <span className="cart-line-total">
                            Total: <strong>₹{(item.price * item.quantity).toLocaleString('en-IN')}</strong>
                          </span>

                          <div className="cart-links-group">
                            <button
                              type="button"
                              className="cart-action-link"
                              onClick={() => onMoveToWishlist(item, itemKey)}
                              title="Move to saved wishlist"
                            >
                              Move to Wishlist
                            </button>
                            <span className="cart-action-divider">•</span>
                            <button
                              type="button"
                              className="cart-action-link remove-link"
                              onClick={() => onRemoveItem(itemKey)}
                              title="Remove item"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Bottom Buttons */}
              <div className="cart-back-actions">
                <button
                  className="btn-secondary continue-shopping-btn"
                  onClick={() => onNavigate('shop')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  Continue Shopping
                </button>
              </div>

            </div>

            {/* Right Column: Order Summary Sidebar */}
            <div className="cart-summary-column">
              <div className="order-summary-card">
                <h2 className="summary-title">Order Summary</h2>

                {/* Promo Code Input / Applied Coupon Pill */}
                <div className="cart-promo-header-row">
                  <span className="promo-label">Promo or Coupon Code</span>
                  <button
                    type="button"
                    className="cart-view-coupons-toggle-btn"
                    onClick={() => setShowAvailableCoupons(prev => !prev)}
                    id="cart-toggle-coupons-btn"
                    aria-expanded={showAvailableCoupons}
                  >
                    {showAvailableCoupons ? '✕ Hide Offers' : '🏷️ View Offers'}
                  </button>
                </div>

                {appliedCoupon ? (
                  <div className="cart-applied-coupon-pill">
                    <div className="applied-coupon-left">
                      <span className="applied-coupon-badge">🏷️ {appliedCoupon.code}</span>
                      <span className="applied-coupon-benefit">
                        {appliedCoupon.discountType === 'percentage'
                          ? `${appliedCoupon.discountValue}% OFF`
                          : `₹${appliedCoupon.discountValue} OFF`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="cart-remove-coupon-btn"
                      onClick={handleRemovePromo}
                      title="Remove applied coupon"
                      id="cart-remove-coupon-btn"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form className="promo-form" onSubmit={handleApplyPromo}>
                    <div className="promo-input-wrapper">
                      <input
                        id="promo-input"
                        type="text"
                        placeholder="Enter coupon code..."
                        value={promoCode}
                        onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                        className="promo-input"
                        disabled={isValidatingCoupon}
                      />
                      <button 
                        type="submit" 
                        className="promo-apply-btn"
                        disabled={isValidatingCoupon || !promoCode.trim()}
                        id="cart-apply-coupon-btn"
                      >
                        {isValidatingCoupon ? 'Verifying...' : 'Apply'}
                      </button>
                    </div>
                  </form>
                )}

                {promoMessage && (
                  <p className={`promo-feedback-msg ${promoMessage.type}`} role="status">
                    {promoMessage.text}
                  </p>
                )}

                {/* Available Offers Drawer in Cart */}
                {showAvailableCoupons && (
                  <div className="cart-available-coupons-drawer" id="cart-available-coupons-drawer">
                    <AvailableCoupons
                      variant="checkout"
                      subtotal={subtotal}
                      appliedCoupon={appliedCoupon}
                      onApplyCouponCode={(code) => applyPromoByCode(code)}
                      isApplying={isValidatingCoupon}
                    />
                  </div>
                )}

                <div className="summary-divider"></div>

                {/* Totals Breakdown */}
                <div className="summary-breakdown">
                  <div className="summary-row">
                    <span className="summary-label">Subtotal ({totalItemCount} items)</span>
                    <span className="summary-val">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="summary-row discount-row">
                      <span className="summary-label">Coupon Discount ({appliedCoupon?.code})</span>
                      <span className="summary-val">−₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="summary-row">
                    <span className="summary-label">Estimated Delivery</span>
                    <span className="summary-val">
                      {isFreeShipping ? <span className="free-badge">FREE</span> : `₹${shippingFee}`}
                    </span>
                  </div>

                  <div className="summary-row">
                    <span className="summary-label">Estimated Tax (GST incl.)</span>
                    <span className="summary-val">₹0</span>
                  </div>
                </div>

                <div className="summary-divider"></div>

                {/* Final Total */}
                <div className="summary-total-row">
                  <span className="total-title">Total</span>
                  <div className="total-amount-box">
                    <span className="total-amount">₹{finalTotal.toLocaleString('en-IN')}</span>
                    <span className="tax-inclusive-tag">All taxes included</span>
                  </div>
                </div>

                {/* Stock alert banner if checkout blocked */}
                {hasStockIssues && (
                  <div className="cart-checkout-stock-alert" role="alert">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>
                      Some items exceed available stock. Please reduce item quantities or remove out-of-stock items before proceeding to checkout.
                    </span>
                  </div>
                )}

                {/* Proceed to Checkout CTA */}
                <button
                  className={`btn-primary checkout-btn ${hasStockIssues ? 'checkout-btn-disabled' : ''}`}
                  onClick={() => {
                    if (hasStockIssues) return;
                    if (onCheckout) onCheckout(finalTotal);
                  }}
                  disabled={hasStockIssues}
                  title={hasStockIssues ? "Adjust item quantities to proceed to checkout" : "Proceed to Checkout"}
                >
                  Proceed to Checkout
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>

                {/* Trust and Payment Security Icons */}
                <div className="cart-security-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                    <path d="M9 12l2 2 4-4"></path>
                  </svg>
                  <span>100% Encrypted & Secure Checkout</span>
                </div>

              </div>
            </div>

          </div>
        ) : (
          /* Empty Bag State */
          <div className="empty-cart-container">
            <div className="empty-cart-icon-box">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
            </div>
            <h2 className="empty-cart-title">Your shopping bag is empty</h2>
            <p className="empty-cart-desc">
              Looks like you haven't added any conscious fashion pieces to your bag yet. 
              Explore our curated clothing collection to find styles that feel like you.
            </p>
            <div className="empty-cart-actions">
              <button
                className="btn-primary"
                onClick={() => onNavigate('shop')}
              >
                Explore Collection
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
              <button
                className="btn-secondary"
                onClick={() => onNavigate('home')}
              >
                Return to Home
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
