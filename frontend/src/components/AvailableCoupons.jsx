import React, { useState, useEffect } from 'react';
import './AvailableCoupons.css';
import { API_BASE } from '../utils/apiConfig';

const API_COUPONS_URL = `${API_BASE}/api/coupons`;

/**
 * Format date nicely for customer readability (e.g., 08 Nov 2026)
 */
const formatExpiryDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  } catch (e) {
    return null;
  }
};

export default function AvailableCoupons({
  variant = 'shop', // 'shop' | 'checkout'
  subtotal = 0,
  appliedCoupon = null,
  onApplyCouponCode = null,
  onCouponSelect = null,
  isApplying = false
}) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Fetch only real active coupons from MongoDB backend
  useEffect(() => {
    let isMounted = true;
    const fetchCoupons = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(API_COUPONS_URL);
        if (!res.ok) {
          throw new Error(`Failed to load offers (HTTP ${res.status})`);
        }
        const data = await res.json();
        if (isMounted) {
          if (data && Array.isArray(data.coupons)) {
            setCoupons(data.coupons);
          } else {
            setCoupons([]);
          }
        }
      } catch (err) {
        if (isMounted) {
          console.warn('Could not load available coupons:', err);
          setError('Unable to load current offers.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCoupons();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopy = (code, e) => {
    if (e && e.stopPropagation) e.stopPropagation();
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2500);
    } catch (err) {
      console.warn('Failed to copy code:', err);
    }
  };

  if (loading) {
    return (
      <div className={`aura-available-coupons-container variant-${variant} is-loading`}>
        <div className="offers-skeleton-strip">
          <span className="offers-spinner" aria-hidden="true"></span>
          <span>Checking available offers...</span>
        </div>
      </div>
    );
  }

  if (error || coupons.length === 0) {
    // If no active coupons exist in DB, quietly don't show or show friendly empty notice
    if (variant === 'checkout') {
      return (
        <div className="checkout-no-coupons-notice">
          <p>No active promotional coupons available at the moment.</p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className={`aura-available-coupons-container variant-${variant}`}>
      {/* Header */}
      <div className="offers-header-row">
        <div className="offers-header-left">
          <span className="offers-sparkle-icon" aria-hidden="true">🏷️</span>
          <div>
            <h4 className="offers-title">
              {variant === 'checkout' ? 'Available Coupons' : 'Exclusive Offers & Coupons'}
            </h4>
            <p className="offers-subtitle">
              {variant === 'checkout'
                ? 'Select an eligible coupon below to apply it to your order'
                : 'Use these official coupon codes at checkout to save on your order'}
            </p>
          </div>
        </div>
        <span className="offers-count-badge">
          {coupons.length} {coupons.length === 1 ? 'Offer' : 'Offers'}
        </span>
      </div>

      {/* Coupons List / Grid */}
      <div className="offers-grid">
        {coupons.map((coupon) => {
          const isApplied = appliedCoupon && (appliedCoupon.code || '').toUpperCase() === coupon.code.toUpperCase();
          const minReq = Number(coupon.minOrderAmount) || 0;
          const numSubtotal = Number(subtotal) || 0;
          const isEligible = variant !== 'checkout' || minReq === 0 || numSubtotal >= minReq;
          const amountShort = Math.max(0, minReq - numSubtotal);
          const expiryFormatted = formatExpiryDate(coupon.expiryDate);

          const discountLabel = coupon.discountType === 'percentage'
            ? `${coupon.discountValue}% OFF`
            : `₹${Number(coupon.discountValue).toLocaleString('en-IN')} FLAT OFF`;

          return (
            <div
              key={coupon._id || coupon.code}
              className={`offer-card ${isApplied ? 'is-applied' : ''} ${!isEligible && variant === 'checkout' ? 'is-ineligible' : ''}`}
            >
              {/* Discount Tag */}
              <div className="offer-badge-row">
                <span className="offer-discount-tag">{discountLabel}</span>
                {isApplied ? (
                  <span className="offer-status-applied">✓ Applied</span>
                ) : variant === 'checkout' && !isEligible ? (
                  <span className="offer-status-ineligible">
                    Add ₹{amountShort.toLocaleString('en-IN')} more
                  </span>
                ) : null}
              </div>

              {/* Coupon Code Block */}
              <div className="offer-code-container">
                <div className="offer-code-dashed-box" title="Coupon Code">
                  <span className="offer-code-text">{coupon.code}</span>
                </div>
                <div className="offer-actions-group">
                  <button
                    type="button"
                    className={`offer-action-btn copy-btn ${copiedCode === coupon.code ? 'copied' : ''}`}
                    onClick={(e) => handleCopy(coupon.code, e)}
                    aria-label={`Copy coupon code ${coupon.code}`}
                    title="Copy code to clipboard"
                  >
                    {copiedCode === coupon.code ? '✓ Copied' : 'Copy'}
                  </button>

                  {variant === 'checkout' && onApplyCouponCode && (
                    <button
                      type="button"
                      className="offer-action-btn apply-btn"
                      disabled={isApplied || !isEligible || isApplying}
                      onClick={() => onApplyCouponCode(coupon.code)}
                      title={
                        isApplied
                          ? 'Coupon already applied'
                          : !isEligible
                          ? `Order subtotal must be at least ₹${minReq.toLocaleString('en-IN')}`
                          : `Apply coupon ${coupon.code}`
                      }
                    >
                      {isApplied ? 'Applied' : 'Apply'}
                    </button>
                  )}
                </div>
              </div>

              {/* Offer Details / Terms */}
              <div className="offer-details-list">
                {minReq > 0 ? (
                  <span className="offer-detail-item">
                    • Minimum purchase of <strong>₹{minReq.toLocaleString('en-IN')}</strong>
                  </span>
                ) : (
                  <span className="offer-detail-item">• No minimum spend required</span>
                )}

                {coupon.discountType === 'percentage' && coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0 && (
                  <span className="offer-detail-item">
                    • Max discount up to <strong>₹{Number(coupon.maxDiscountAmount).toLocaleString('en-IN')}</strong>
                  </span>
                )}

                {expiryFormatted && (
                  <span className="offer-detail-item offer-expiry">
                    • Valid until <strong>{expiryFormatted}</strong>
                  </span>
                )}
              </div>

              {/* Ineligible Explanation */}
              {variant === 'checkout' && !isEligible && (
                <div className="offer-ineligible-msg" role="alert">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>Add ₹{amountShort.toLocaleString('en-IN')} more to your bag to apply this coupon.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
