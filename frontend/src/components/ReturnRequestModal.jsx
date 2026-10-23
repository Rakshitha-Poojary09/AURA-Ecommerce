import React, { useState, useEffect, useCallback } from 'react';
import './ReturnRequestModal.css';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';
import { API_BASE } from '../utils/apiConfig';

const REASON_OPTIONS = [
  'Wrong item received',
  'Damaged or defective item',
  'Size or fit issue',
  'Product differs from description',
  'Received the wrong size or color',
  'Other'
];

export default function ReturnRequestModal({
  order,
  isGuest = false,
  guestEmail = '',
  onClose,
  onSuccess
}) {
  const [loadingEligibility, setLoadingEligibility] = useState(true);
  const [eligibilityData, setEligibilityData] = useState(null);
  const [loadError, setLoadError] = useState('');

  // Form states
  const [requestType, setRequestType] = useState('Return'); // 'Return' | 'Exchange'
  const [selectedItems, setSelectedItems] = useState({}); // { [key]: { quantity, reason, replacementSize, comments } }
  const [generalReason, setGeneralReason] = useState(REASON_OPTIONS[0]);
  const [generalComments, setGeneralComments] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedRequest, setSubmittedRequest] = useState(null);

  // In-modal cancellation state
  const [cancellingRequestId, setCancellingRequestId] = useState(null);
  const [cancelFeedback, setCancelFeedback] = useState({ text: '', type: '' });

  // Fetch live eligibility from backend
  const fetchEligibility = useCallback(async () => {
    if (!order) return;
    setLoadingEligibility(true);
    setLoadError('');
    try {
      let res;
      if (isGuest) {
        res = await fetch(`${API_BASE}/api/returns/guest/eligibility`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.orderId,
            email: guestEmail || order.customer?.email
          })
        });
      } else {
        res = await fetch(`${API_BASE}/api/returns/eligibility/${order.orderId}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Unable to check return eligibility.');
      }

      const data = await res.json();
      setEligibilityData(data);

      // Auto-select first eligible item by default if form is eligible
      const firstEligible = (data.items || []).find((it) => it.isItemEligible);
      if (firstEligible) {
        const key = `${firstEligible.productId}_${firstEligible.size}`;
        const firstAvailableExchangeSize = (firstEligible.exchangeSizes || []).find((s) => s.inStock)?.size || '';
        setSelectedItems({
          [key]: {
            selected: true,
            quantity: 1,
            reason: REASON_OPTIONS[0],
            replacementSize: firstAvailableExchangeSize,
            comments: ''
          }
        });
      } else {
        setSelectedItems({});
      }
    } catch (err) {
      setLoadError(err.message || 'Error checking eligibility.');
    } finally {
      setLoadingEligibility(false);
    }
  }, [order, isGuest, guestEmail]);

  useEffect(() => {
    fetchEligibility();
  }, [fetchEligibility]);

  // Handle in-modal cancellation of active request to restore eligibility
  const handleCancelActiveRequest = async (requestId) => {
    if (!window.confirm(`Are you sure you want to cancel Request #${requestId}? Once cancelled, the garments in this request will immediately become eligible for a new return or size exchange.`)) {
      return;
    }

    setCancellingRequestId(requestId);
    setCancelFeedback({ text: '', type: '' });

    try {
      let res;
      if (isGuest) {
        res = await fetch(`${API_BASE}/api/returns/guest/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.orderId,
            email: guestEmail || order.customer?.email,
            requestId
          })
        });
      } else {
        res = await fetch(`${API_BASE}/api/returns/my-requests/${requestId}/cancel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Unable to cancel request.');
      }

      setCancelFeedback({
        text: `Request #${requestId} has been cancelled. Return eligibility has been restored!`,
        type: 'success'
      });

      // Refresh eligibility live to immediately show the return/exchange form!
      await fetchEligibility();
    } catch (err) {
      setCancelFeedback({
        text: err.message || 'Failed to cancel request.',
        type: 'error'
      });
    } finally {
      setCancellingRequestId(null);
    }
  };

  // Toggle item selection
  const handleToggleItem = (item) => {
    const key = `${item.productId}_${item.size}`;
    setSelectedItems((prev) => {
      const current = prev[key];
      if (current && current.selected) {
        const next = { ...prev };
        delete next[key];
        return next;
      } else {
        const firstAvailableExchangeSize = (item.exchangeSizes || []).find((s) => s.inStock)?.size || '';
        return {
          ...prev,
          [key]: {
            selected: true,
            quantity: 1,
            reason: generalReason,
            replacementSize: firstAvailableExchangeSize,
            comments: ''
          }
        };
      }
    });
  };

  // Update item field
  const handleItemFieldChange = (key, field, value) => {
    setSelectedItems((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  // Calculate estimated total refund
  const calculateTotalEstimatedRefund = () => {
    if (!eligibilityData || requestType !== 'Return') return 0;
    let sum = 0;
    for (const item of eligibilityData.items || []) {
      const key = `${item.productId}_${item.size}`;
      const state = selectedItems[key];
      if (state && state.selected) {
        const qty = parseInt(state.quantity, 10) || 1;
        sum += item.netUnitRefund * qty;
      }
    }
    return sum;
  };

  // Form submission handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');

    const selectedKeys = Object.keys(selectedItems).filter((k) => selectedItems[k].selected);
    if (selectedKeys.length === 0) {
      setSubmitError('Please select at least one garment for return or exchange.');
      return;
    }

    const payloadItems = [];
    for (const key of selectedKeys) {
      const state = selectedItems[key];
      const match = (eligibilityData?.items || []).find(
        (it) => `${it.productId}_${it.size}` === key
      );

      if (!match) continue;

      if (requestType === 'Exchange' && !state.replacementSize) {
        setSubmitError(`Please select a replacement size for "${match.name}".`);
        return;
      }

      payloadItems.push({
        productId: match.productId,
        name: match.name,
        size: match.size,
        quantity: parseInt(state.quantity, 10) || 1,
        reason: state.reason || generalReason,
        customerComments: state.comments || generalComments,
        replacementSize: requestType === 'Exchange' ? state.replacementSize : null
      });
    }

    setIsSubmitting(true);

    try {
      let res;
      if (isGuest) {
        res = await fetch(`${API_BASE}/api/returns/guest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: order.orderId,
            email: guestEmail || order.customer?.email,
            requestType,
            items: payloadItems,
            reason: generalReason,
            comments: generalComments
          })
        });
      } else {
        res = await fetch(`${API_BASE}/api/returns`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            orderId: order.orderId,
            requestType,
            items: payloadItems,
            reason: generalReason,
            comments: generalComments
          })
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit request.');
      }

      setSubmittedRequest(data.request);
      if (onSuccess) {
        onSuccess(data.request);
      }
    } catch (err) {
      setSubmitError(err.message || 'Network error while submitting request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalRefund = calculateTotalEstimatedRefund();

  // Date formatting helpers
  const deliveryDateDisplay = eligibilityData?.deliveryDate
    ? new Date(eligibilityData.deliveryDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : (order.deliveredAt
        ? new Date(order.deliveredAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          })
        : null);

  const expiryDateDisplay = eligibilityData?.expiryDate
    ? new Date(eligibilityData.expiryDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    : null;

  const isWindowExpired = eligibilityData?.ineligibilityCode === 'WINDOW_EXPIRED';

  return (
    <div className="return-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="return-modal-card" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="return-modal-header">
          <div>
            <span className="return-eyebrow">AURA CONCIERGE CARE</span>
            <h2 className="return-modal-title">Return or Exchange Request</h2>
            <span className="return-order-subtitle">
              Order #{order.orderId}
              {deliveryDateDisplay && ` • Delivered on ${deliveryDateDisplay}`}
              {expiryDateDisplay && !isWindowExpired && ` • Return window open until ${expiryDateDisplay}`}
              {isWindowExpired && expiryDateDisplay && ` • Window expired on ${expiryDateDisplay}`}
            </span>
          </div>
          <button 
            type="button" 
            className="return-close-btn" 
            onClick={onClose}
            aria-label="Close return modal"
            id="btn-close-return-modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="return-modal-body">
          {/* Feedback banner for in-modal actions */}
          {cancelFeedback.text && (
            <div 
              className={`return-feedback-banner ${cancelFeedback.type}`} 
              role="alert"
            >
              <span>{cancelFeedback.type === 'success' ? '✓' : '⚠️'}</span>
              <span>{cancelFeedback.text}</span>
            </div>
          )}

          {loadingEligibility ? (
            <div className="return-loading-state">
              <div className="return-spinner" />
              <p>Verifying return eligibility and garment stock...</p>
            </div>
          ) : loadError ? (
            <div className="return-error-banner" role="alert">
              <span className="error-icon">⚠️</span>
              <div>
                <strong>Ineligible for Return or Exchange</strong>
                <p>{loadError}</p>
              </div>
            </div>
          ) : !eligibilityData?.isOrderEligible ? (
            /* Specific Ineligible State */
            <div className="return-ineligible-state">
              {eligibilityData?.ineligibilityCode === 'ALL_ITEMS_REQUESTED' ? (
                <>
                  <div className="ineligible-icon-circle active-req-icon">🔄</div>
                  <h3 className="ineligible-title">Active Request in Progress</h3>
                  <p className="ineligible-desc">
                    All purchased garments from this order are currently reserved or have been processed under the request(s) detailed below.
                  </p>

                  {/* Existing Requests Details */}
                  {eligibilityData.existingRequests && eligibilityData.existingRequests.length > 0 && (
                    <div className="existing-requests-container">
                      <div className="existing-requests-header">
                        <span>Active Requests for Order #{order.orderId}</span>
                        <span className="req-count-tag">{eligibilityData.existingRequests.length} Active</span>
                      </div>

                      <div className="existing-requests-list">
                        {eligibilityData.existingRequests.map((req) => (
                          <div key={req.requestId} className="existing-request-card">
                            <div className="req-card-top-row">
                              <div className="req-ref-group">
                                <span className={`req-type-pill ${req.requestType.toLowerCase()}`}>
                                  {req.requestType}
                                </span>
                                <strong className="req-id-code">#{req.requestId}</strong>
                              </div>
                              <span className={`status-pill ${req.status.toLowerCase().replace(/\s+/g, '-')}`}>
                                {req.status}
                              </span>
                            </div>

                            <div className="req-card-meta">
                              <span>Submitted: <strong>{new Date(req.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                              {req.requestType === 'Return' && req.refundAmount > 0 && (
                                <span>Refund Amount: <strong>₹{Number(req.refundAmount).toLocaleString('en-IN')}</strong></span>
                              )}
                            </div>

                            {/* Item breakdown inside existing request */}
                            <div className="req-card-items-snippet">
                              {(req.items || []).map((it, idx) => (
                                <div key={idx} className="snippet-item-row">
                                  <span className="snippet-name">• {it.name}</span>
                                  <span className="snippet-size">Size: <strong>{it.size}</strong></span>
                                  <span className="snippet-qty">Qty: <strong>{it.quantity}</strong></span>
                                  {it.replacementSize && (
                                    <span className="snippet-replacement">Replacement Size: <strong>{it.replacementSize}</strong></span>
                                  )}
                                </div>
                              ))}
                            </div>

                            {/* In-modal cancellation button */}
                            {req.canCancel && (
                              <div className="req-card-actions">
                                <button
                                  type="button"
                                  className="btn-cancel-active-req"
                                  onClick={() => handleCancelActiveRequest(req.requestId)}
                                  disabled={cancellingRequestId === req.requestId}
                                  id={`btn-cancel-req-${req.requestId}`}
                                >
                                  {cancellingRequestId === req.requestId ? (
                                    'Cancelling Request...'
                                  ) : (
                                    `Cancel Request #${req.requestId} & Re-open Items`
                                  )}
                                </button>
                                <span className="cancel-note">
                                  Cancelling will immediately release these items back to this order for a new return or exchange.
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : eligibilityData?.ineligibilityCode === 'WINDOW_EXPIRED' ? (
                <>
                  <div className="ineligible-icon-circle expired-icon">⏰</div>
                  <h3 className="ineligible-title">Return Window Expired</h3>
                  <p className="ineligible-desc">
                    {eligibilityData?.ineligibilityReason ||
                      `The ${eligibilityData?.windowDays || 14}-day return window has expired for this order.`}
                  </p>
                </>
              ) : eligibilityData?.ineligibilityCode === 'NOT_DELIVERED' ? (
                <>
                  <div className="ineligible-icon-circle pending-delivery-icon">📦</div>
                  <h3 className="ineligible-title">Order Not Delivered Yet</h3>
                  <p className="ineligible-desc">
                    {eligibilityData?.ineligibilityReason ||
                      'Returns and exchanges can only be initiated once your order has been confirmed as delivered to your doorstep.'}
                  </p>
                </>
              ) : (
                <>
                  <div className="ineligible-icon-circle">✕</div>
                  <h3 className="ineligible-title">Order Ineligible</h3>
                  <p className="ineligible-desc">
                    {eligibilityData?.ineligibilityReason || 'This order does not meet current return criteria.'}
                  </p>
                </>
              )}

              <div className="policy-reminder-box">
                <div className="policy-reminder-header">
                  <strong>AURA Boutique Concierge Policy:</strong>
                </div>
                <p>
                  Complimentary doorstep returns and exchanges are available within {eligibilityData?.windowDays || 14} days of verified doorstep delivery for garments in unworn condition with original brand tags attached.
                </p>
                {deliveryDateDisplay && (
                  <div className="policy-dates-row">
                    <span>Delivered: <strong>{deliveryDateDisplay}</strong></span>
                    {expiryDateDisplay && (
                      <span>Window Cut-off: <strong>{expiryDateDisplay}</strong></span>
                    )}
                  </div>
                )}
              </div>

              <div className="ineligible-modal-footer">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onClose}
                  id="btn-close-ineligible-modal"
                >
                  Close & View Order Details
                </button>
              </div>
            </div>
          ) : submittedRequest ? (
            /* Success State */
            <div className="return-success-view">
              <div className="success-icon-badge">✓</div>
              <span className="success-eyebrow">REQUEST LODGED WITH BOUTIQUE</span>
              <h3 className="success-title">
                {submittedRequest.requestType} Request #{submittedRequest.requestId}
              </h3>
              <p className="success-desc">
                Your {submittedRequest.requestType.toLowerCase()} request has been received by our concierge team. Our logistics partner will schedule a complimentary doorstep inspection within 24–48 hours.
              </p>

              <div className="success-summary-card">
                <div className="summary-row">
                  <span>Reference ID:</span>
                  <strong>{submittedRequest.requestId}</strong>
                </div>
                <div className="summary-row">
                  <span>Order Number:</span>
                  <strong>{submittedRequest.orderId}</strong>
                </div>
                <div className="summary-row">
                  <span>Status:</span>
                  <span className="status-chip requested">Requested (Pending Verification)</span>
                </div>
                {submittedRequest.requestType === 'Return' && (
                  <div className="summary-row">
                    <span>Estimated Refund:</span>
                    <strong>₹{Number(submittedRequest.refundAmount || 0).toLocaleString('en-IN')}</strong>
                  </div>
                )}
              </div>

              <button 
                type="button" 
                className="btn-primary success-done-btn"
                onClick={onClose}
                id="btn-close-success-view"
              >
                Close & View Requests
              </button>
            </div>
          ) : (
            /* Form View */
            <form onSubmit={handleSubmit} className="return-request-form">
              {submitError && (
                <div className="return-error-banner" role="alert">
                  <span className="error-icon">⚠️</span>
                  <span>{submitError}</span>
                </div>
              )}

              {/* 1. Request Type Switcher */}
              <div className="form-section">
                <label className="section-label">Select Action</label>
                <div className="type-toggle-group">
                  <button
                    type="button"
                    className={`type-toggle-btn ${requestType === 'Return' ? 'active' : ''}`}
                    onClick={() => setRequestType('Return')}
                    id="btn-type-return"
                  >
                    <span className="type-icon">🔄</span>
                    <div className="type-text">
                      <strong>Return for Refund</strong>
                      <span>Complimentary doorstep return & refund to source</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={`type-toggle-btn ${requestType === 'Exchange' ? 'active' : ''}`}
                    onClick={() => setRequestType('Exchange')}
                    id="btn-type-exchange"
                  >
                    <span className="type-icon">📏</span>
                    <div className="type-text">
                      <strong>Size Exchange</strong>
                      <span>Exchange for an alternate size at zero fee</span>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. Select Items to Return/Exchange */}
              <div className="form-section">
                <div className="section-header-row">
                  <label className="section-label">Select Garments to {requestType}</label>
                  <span className="section-note">Tick the box next to each item</span>
                </div>

                <div className="return-items-list">
                  {(eligibilityData.items || []).map((item) => {
                    const key = `${item.productId}_${item.size}`;
                    const state = selectedItems[key] || { selected: false, quantity: 1 };
                    const isEligible = item.isItemEligible;

                    return (
                      <div 
                        key={key} 
                        className={`return-item-card ${state.selected ? 'selected' : ''} ${!isEligible ? 'ineligible' : ''}`}
                      >
                        <div className="item-checkbox-col">
                          <input
                            type="checkbox"
                            id={`check-${key}`}
                            checked={!!state.selected}
                            disabled={!isEligible}
                            onChange={() => handleToggleItem(item)}
                            className="item-checkbox"
                          />
                        </div>

                        <img 
                          src={normalizeProductImageUrl(item.image)} 
                          alt={item.name} 
                          className="item-thumb"
                          onError={handleImageError} 
                        />

                        <div className="item-details-col">
                          <strong className="item-name">{item.name}</strong>
                          <div className="item-meta-tags">
                            <span className="meta-tag">Purchased Size: <strong>{item.size}</strong></span>
                            <span className="meta-tag">Purchased Qty: <strong>{item.purchasedQuantity}</strong></span>
                            {item.alreadyRequestedQuantity > 0 && (
                              <span className="meta-tag alert">
                                In Active Request: {item.alreadyRequestedQuantity}
                              </span>
                            )}
                            {item.remainingQuantity > 0 && item.remainingQuantity !== item.purchasedQuantity && (
                              <span className="meta-tag remaining-tag">
                                Available to Request: <strong>{item.remainingQuantity}</strong>
                              </span>
                            )}
                            <span className="meta-tag price">
                              Paid: ₹{Number(item.originalPrice).toLocaleString('en-IN')}
                            </span>
                          </div>

                          {!isEligible ? (
                            <span className="ineligible-item-note">
                              {item.itemIneligibilityReason || 'All purchased units of this garment have already been requested or returned.'}
                            </span>
                          ) : state.selected && (
                            /* Sub-controls when item is checked */
                            <div className="item-action-controls">
                              {/* Quantity select */}
                              <div className="control-group">
                                <label htmlFor={`qty-${key}`} className="control-label">Quantity:</label>
                                <select
                                  id={`qty-${key}`}
                                  value={state.quantity}
                                  onChange={(e) => handleItemFieldChange(key, 'quantity', e.target.value)}
                                  className="control-select qty-select"
                                >
                                  {Array.from({ length: item.remainingQuantity }, (_, i) => i + 1).map((n) => (
                                    <option key={n} value={n}>{n}</option>
                                  ))}
                                </select>
                                <span className="max-qty-hint">(Max {item.remainingQuantity} eligible)</span>
                              </div>

                              {/* Exchange Size Select */}
                              {requestType === 'Exchange' && (
                                <div className="control-group">
                                  <label htmlFor={`size-${key}`} className="control-label">Replacement Size:</label>
                                  <select
                                    id={`size-${key}`}
                                    value={state.replacementSize || ''}
                                    onChange={(e) => handleItemFieldChange(key, 'replacementSize', e.target.value)}
                                    className="control-select size-select"
                                  >
                                    <option value="" disabled>Select new size...</option>
                                    {(item.exchangeSizes || []).map((s) => (
                                      <option key={s.size} value={s.size} disabled={!s.inStock}>
                                        {s.size === 'One Size' ? 'One Size (Replacement Unit)' : `Size ${s.size}`} {s.inStock ? `(In Stock - ${s.availableStock} available)` : '(Out of Stock)'}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Financial breakdown */}
                        {requestType === 'Return' && isEligible && (
                          <div className="item-refund-col">
                            <span className="refund-label">Est. Refund</span>
                            <strong className="refund-val">
                              ₹{(item.netUnitRefund * (state.selected ? (state.quantity || 1) : 1)).toLocaleString('en-IN')}
                            </strong>
                            {item.unitDiscount > 0 && (
                              <span className="coupon-adj-note">
                                (After ₹{item.unitDiscount * (state.selected ? (state.quantity || 1) : 1)} coupon share)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Reason for Request */}
              <div className="form-section">
                <label htmlFor="return-reason-select" className="section-label">
                  Primary Reason for {requestType} <span className="req-star">*</span>
                </label>
                <select
                  id="return-reason-select"
                  value={generalReason}
                  onChange={(e) => setGeneralReason(e.target.value)}
                  className="form-select reason-select"
                  required
                >
                  {REASON_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* 4. Optional Comments */}
              <div className="form-section">
                <label htmlFor="return-comments" className="section-label">
                  Additional Notes or Fit Feedback <span className="opt-tag">(Optional)</span>
                </label>
                <textarea
                  id="return-comments"
                  rows="3"
                  className="form-textarea"
                  value={generalComments}
                  onChange={(e) => setGeneralComments(e.target.value)}
                  placeholder="Share details on garment fit, damage, or specific exchange requests for our boutique team..."
                />
              </div>

              {/* 5. Summary & Submit Action */}
              <div className="return-modal-footer">
                <div className="footer-summary-text">
                  {requestType === 'Return' ? (
                    <div>
                      <span className="summary-subtitle">Estimated Total Refund:</span>
                      <strong className="summary-total-val">₹{totalRefund.toLocaleString('en-IN')}</strong>
                    </div>
                  ) : (
                    <div>
                      <span className="summary-subtitle">Exchange Fulfillment:</span>
                      <strong className="summary-total-val">Complimentary (₹0)</strong>
                    </div>
                  )}
                </div>

                <div className="footer-actions-group">
                  <button 
                    type="button" 
                    className="btn-secondary cancel-modal-btn"
                    onClick={onClose}
                    disabled={isSubmitting}
                    id="btn-cancel-return-modal"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="btn-primary submit-request-btn"
                    disabled={isSubmitting || Object.keys(selectedItems).length === 0}
                    id="btn-submit-return-request"
                  >
                    {isSubmitting ? 'Lodging Request...' : `Submit ${requestType} Request`}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

      </div>
    </div>
  );
}
