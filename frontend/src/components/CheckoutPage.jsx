import React, { useState, useEffect } from 'react';
import './CheckoutPage.css';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';
import AvailableCoupons from './AvailableCoupons';
import { API_BASE } from '../utils/apiConfig';

// Indian states list for shipping selection
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi'
];

export default function CheckoutPage({ 
  cartItems = [], 
  isBuyNow = false,
  onCancelBuyNow,
  onNavigate, 
  onOrderPlaced,
  currentUser = null,
  appliedCoupon = null,
  onApplyCoupon,
  onRemoveCoupon,
  onRemoveItem
}) {
  // Customer information state - prefilled if customer is authenticated
  const [customerInfo, setCustomerInfo] = useState({
    fullName: currentUser?.name || '',
    email: currentUser?.email || '',
    phone: '',
  });

  // Update customerInfo if user changes or loads
  React.useEffect(() => {
    if (currentUser) {
      setCustomerInfo((prev) => ({
        fullName: prev.fullName || currentUser.name || '',
        email: prev.email || currentUser.email || '',
        phone: prev.phone || '',
      }));
    }
  }, [currentUser]);

  // Shipping address state
  const [shippingAddress, setShippingAddress] = useState({
    address: '',
    city: '',
    state: '',
    pincode: '',
  });

  // Validation errors
  const [errors, setErrors] = useState({});

  // Coupon state for checkout page
  const [couponInput, setCouponInput] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponFeedback, setCouponFeedback] = useState(null);
  const [showAvailableCoupons, setShowAvailableCoupons] = useState(false);

  // Payment method selection (UI only - no real processing)
  const [paymentMethod, setPaymentMethod] = useState('cod');

  // Order completion state
  const [isOrderPlaced, setIsOrderPlaced] = useState(false);
  const [placedOrder, setPlacedOrder] = useState(null);

  // MERN API submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Financial calculations
  const subtotal = (cartItems || []).reduce(
    (acc, item) => acc + (Number(item?.price) || 0) * (Number(item?.quantity) || 1),
    0
  );
  const isFreeShipping = subtotal >= 999;
  const shippingFee = isFreeShipping || subtotal === 0 ? 0 : 99;

  // Real backend-aligned coupon discount calculation
  let discountAmount = 0;
  if (appliedCoupon && subtotal > 0) {
    if (appliedCoupon.discountType === 'percentage') {
      discountAmount = Math.round((subtotal * (Number(appliedCoupon.discountValue) || 0)) / 100);
      if (appliedCoupon.maxDiscountAmount && Number(appliedCoupon.maxDiscountAmount) > 0) {
        discountAmount = Math.min(discountAmount, Number(appliedCoupon.maxDiscountAmount));
      }
    } else if (appliedCoupon.discountType === 'fixed') {
      discountAmount = Math.round(Number(appliedCoupon.discountValue) || 0);
    } else if (typeof appliedCoupon.discountAmount === 'number' && appliedCoupon.eligibleSubtotal === subtotal) {
      discountAmount = appliedCoupon.discountAmount;
    }
    discountAmount = Math.min(discountAmount, subtotal);
    discountAmount = Math.max(0, discountAmount);
  }

  const finalTotal = Math.max(0, subtotal - discountAmount + shippingFee);

  // Monitor if subtotal drops to 0 or below minimum required order for applied coupon
  useEffect(() => {
    if (appliedCoupon) {
      if (subtotal <= 0) {
        if (onRemoveCoupon) onRemoveCoupon();
        setCouponFeedback({
          type: 'error',
          message: `Your order is empty. Coupon "${appliedCoupon.code}" was removed.`
        });
      } else if (appliedCoupon.minOrderAmount && subtotal < Number(appliedCoupon.minOrderAmount)) {
        if (onRemoveCoupon) onRemoveCoupon();
        setCouponFeedback({
          type: 'error',
          message: `Subtotal dropped below ₹${Number(appliedCoupon.minOrderAmount).toLocaleString('en-IN')}. Coupon "${appliedCoupon.code}" was removed.`
        });
      }
    }
  }, [subtotal, appliedCoupon]);

  // Apply Coupon directly in checkout by code string
  const applyCouponByCode = async (codeToApply) => {
    const code = (codeToApply || '').trim().toUpperCase();
    if (!code) {
      setCouponFeedback({ type: 'error', message: 'Please enter a coupon code.' });
      return;
    }

    if (subtotal <= 0) {
      setCouponFeedback({ type: 'error', message: 'Cart is empty. Add items to apply coupon.' });
      return;
    }

    setIsApplyingCoupon(true);
    setCouponFeedback(null);

    try {
      const response = await fetch(`${API_BASE}/api/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          code,
          subtotal,
          customerEmail: customerInfo.email.trim() || currentUser?.email,
          customerId: currentUser?._id
        })
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        throw new Error(data.message || 'Invalid coupon code.');
      }

      if (onApplyCoupon) onApplyCoupon(data.coupon);
      setCouponInput('');
      setCouponFeedback({ type: 'success', message: data.message });
    } catch (err) {
      if (onRemoveCoupon) onRemoveCoupon();
      setCouponFeedback({ type: 'error', message: err.message || 'Coupon could not be applied.' });
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleApplyCoupon = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    applyCouponByCode(couponInput);
  };

  const handleRemoveCoupon = () => {
    if (onRemoveCoupon) onRemoveCoupon();
    setCouponFeedback({ type: 'info', message: 'Coupon removed from order.' });
  };

  // Remove individual item from checkout Order Summary
  const handleRemoveItem = (itemToRemove) => {
    if (onRemoveItem) {
      onRemoveItem(itemToRemove);
    }
  };

  // Navigate back to Shop without placing order, clearing cart, or initiating payment
  const handleContinueShopping = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (onNavigate) {
      onNavigate('shop');
    }
  };

  // Handle customer input change
  const handleCustomerChange = (e) => {
    const { name, value } = e.target;
    setCustomerInfo((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Handle address input change
  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setShippingAddress((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Validate all required fields
  const validateForm = () => {
    const newErrors = {};

    // 1. Full Name
    if (!customerInfo.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (customerInfo.fullName.trim().length < 2) {
      newErrors.fullName = 'Please enter your complete name';
    }

    // 2. Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!customerInfo.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!emailRegex.test(customerInfo.email.trim())) {
      newErrors.email = 'Please enter a valid email address';
    }

    // 3. Phone Number
    const phoneClean = customerInfo.phone.replace(/[\s-]/g, '');
    if (!customerInfo.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\d{10,12}$/.test(phoneClean)) {
      newErrors.phone = 'Please enter a valid 10-digit mobile number';
    }

    // 4. Street Address
    if (!shippingAddress.address.trim()) {
      newErrors.address = 'Street address is required';
    } else if (shippingAddress.address.trim().length < 5) {
      newErrors.address = 'Please provide a complete delivery address';
    }

    // 5. City
    if (!shippingAddress.city.trim()) {
      newErrors.city = 'City is required';
    }

    // 6. State
    if (!shippingAddress.state) {
      newErrors.state = 'Please select a state';
    }

    // 7. PIN Code
    if (!shippingAddress.pincode.trim()) {
      newErrors.pincode = 'PIN Code is required';
    } else if (!/^\d{6}$/.test(shippingAddress.pincode.trim())) {
      newErrors.pincode = 'PIN Code must be a 6-digit number';
    }

    return newErrors;
  };

  // Handle Place Order submit - Connects to MongoDB backend via POST /api/orders
  const handlePlaceOrder = async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }

    // Prevent accidental duplicate order submissions or ordering with empty checkout
    if (isSubmitting) return;

    if (!cartItems || cartItems.length === 0 || subtotal <= 0) {
      setSubmitError('Cannot place order: your checkout is empty. Please add items before proceeding.');
      return;
    }

    // Clear any previous backend error
    setSubmitError('');

    const validationErrors = validateForm();

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      // Scroll to the first field with an error
      const firstErrorKey = Object.keys(validationErrors)[0];
      const el = document.getElementById(firstErrorKey);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
      }
      return;
    }

    setIsSubmitting(true);

    // Generate unique order ID in AURA luxury format
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const orderId = `AUR-ORD-${randomSuffix}`;

    // Prepare complete order payload matching backend Mongoose schema
    const orderPayload = {
      orderId,
      customer: {
        fullName: customerInfo.fullName.trim(),
        email: customerInfo.email.trim(),
        phone: customerInfo.phone.trim(),
      },
      shippingAddress: {
        address: shippingAddress.address.trim(),
        city: shippingAddress.city.trim(),
        state: shippingAddress.state.trim(),
        pinCode: shippingAddress.pincode.trim(), // Matches schema pinCode
      },
      items: cartItems.map((item) => ({
        productId: item._id || item.productId || item.id,
        name: item.name,
        image: item.image || '',
        price: Number(item.price) || 0,
        mrp: item.mrp ? Number(item.mrp) : (item.originalPrice ? Number(item.originalPrice) : null),
        quantity: Number(item.quantity) || 1,
        size: item.size || item.selectedSize || 'M',
        color: item.color || item.colorName || item.selectedColor || '',
        colorName: item.colorName || item.selectedColor || item.color || '',
        colorCode: item.colorCode || '',
      })),
      subtotal,
      discount: discountAmount,
      shipping: shippingFee,
      total: finalTotal,
      ...(appliedCoupon ? { couponCode: appliedCoupon.code } : {}),
      status: 'Pending',
      paymentMethod: paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Online Payment',
    };

    try {
      /* MERN API Call: Send order payload to Express/MongoDB backend */
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Automatically passes auth cookie if customer is logged in
        body: JSON.stringify(orderPayload),
      });

      const data = await response.json();

      if (!response.ok) {
        let errorMsg = data.message || 'Failed to place order. Server returned an error.';
        if (
          errorMsg.toLowerCase().includes('stock') ||
          errorMsg.toLowerCase().includes('available') ||
          errorMsg.toLowerCase().includes('insufficient')
        ) {
          errorMsg = `${errorMsg}. Some products are no longer available in the requested quantity. Please update your cart.`;
        }
        throw new Error(errorMsg);
      }

      // Backend confirmed order saved to MongoDB!
      const savedOrder = data.order || orderPayload;

      setPlacedOrder({
        ...savedOrder,
        date: new Date(savedOrder.createdAt || Date.now()).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        address: {
          address: savedOrder.shippingAddress?.address || shippingAddress.address,
          city: savedOrder.shippingAddress?.city || shippingAddress.city,
          state: savedOrder.shippingAddress?.state || shippingAddress.state,
          pincode: savedOrder.shippingAddress?.pinCode || shippingAddress.pincode,
        },
        paymentMethod: paymentMethod === 'cod' ? 'Cash / UPI on Delivery' : 'Online Payment (Demo)',
      });

      setIsOrderPlaced(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Clear the cart in parent App component
      if (onOrderPlaced) {
        onOrderPlaced(savedOrder);
      }
    } catch (err) {
      console.error('Error placing order:', err);
      setSubmitError(err.message || 'Could not connect to server. Please ensure the backend is running.');
      window.scrollTo({ top: 100, behavior: 'smooth' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // SUCCESS / ORDER CONFIRMATION SCREEN
  if (isOrderPlaced && placedOrder) {
    return (
      <div className="aura-checkout-page">
        <div className="aura-container">
          
          <div className="order-success-card">
            
            <div className="order-success-icon-box">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>

            <span className="success-eyebrow">ORDER CONFIRMED</span>
            <h1 className="success-title">Order Placed Successfully!</h1>
            <p className="success-subtitle">
              Thank you for choosing AURA, <strong>{placedOrder.customer.fullName}</strong>. We've received your order and are preparing your luxury garments with care.
            </p>

            {/* Order Details Capsule */}
            <div className="order-reference-box">
              <div className="reference-item">
                <span className="ref-label">Order Number</span>
                <span className="ref-value order-id">{placedOrder.orderId}</span>
              </div>
              <div className="reference-divider"></div>
              <div className="reference-item">
                <span className="ref-label">Date</span>
                <span className="ref-value">{placedOrder.date}</span>
              </div>
              <div className="reference-divider"></div>
              <div className="reference-item">
                <span className="ref-label">Payment Method</span>
                <span className="ref-value">{placedOrder.paymentMethod}</span>
              </div>
              <div className="reference-divider"></div>
              <div className="reference-item">
                <span className="ref-label">Payment Status</span>
                <span className="ref-value" style={{ color: '#92400e', fontWeight: 600 }}>
                  {placedOrder.paymentMethod.toLowerCase().includes('online') ? 'Pending (Test Flow)' : 'Pending (Pay on Delivery)'}
                </span>
              </div>
              <div className="reference-divider"></div>
              <div className="reference-item">
                <span className="ref-label">Total Amount</span>
                <span className="ref-value total-highlight">₹{placedOrder.total.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Shipping & Delivery Preview */}
            <div className="order-delivery-card">
              <div className="delivery-card-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="1" y="3" width="15" height="13"></rect>
                  <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                  <circle cx="5.5" cy="18.5" r="2.5"></circle>
                  <circle cx="18.5" cy="18.5" r="2.5"></circle>
                </svg>
                <span>Estimated Delivery: 3 – 5 Business Days</span>
              </div>
              <p className="delivery-address-text">
                Shipping to: <strong>{placedOrder.address.address}</strong>, {placedOrder.address.city}, {placedOrder.address.state} – {placedOrder.address.pincode}
              </p>
              <p className="delivery-contact-text">
                Order confirmation and tracking details sent to <strong>{placedOrder.customer.email}</strong>.
              </p>
            </div>

            {/* Ordered Items Preview */}
            <div className="success-items-preview">
              <h3 className="preview-heading">Purchased Items ({placedOrder.items.length})</h3>
              <div className="success-items-grid">
                {placedOrder.items.map((item, idx) => (
                  <div key={idx} className="success-item-row">
                    <img src={item.image} alt={item.name} className="success-item-thumb" />
                    <div className="success-item-meta">
                      <span className="success-item-name">{item.name}</span>
                      <span className="success-item-sub">
                        Size: {item.selectedSize || item.size || 'Standard'} • Qty: {item.quantity || 1}
                        {(item.colorName || item.color || item.selectedColor) ? ` • Colour: ${item.colorName || item.color || item.selectedColor}` : ''}
                      </span>
                    </div>
                    <span className="success-item-price">
                      ₹{((Number(item.price) || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="success-actions-row">
              <button 
                className="btn-primary continue-shopping-btn"
                onClick={() => onNavigate && onNavigate('shop')}
              >
                Continue Shopping
              </button>
              <button 
                className="btn-secondary view-home-btn"
                onClick={() => onNavigate && onNavigate('home')}
              >
                Return to Home
              </button>
            </div>

          </div>

        </div>
      </div>
    );
  }

  // EMPTY CHECKOUT PREVENTER
  if (!cartItems || cartItems.length === 0) {
    return (
      <div className="aura-checkout-page">
        <div className="aura-container">
          <div className="checkout-empty-card">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
            <h2>{isBuyNow ? 'Your Checkout is Empty' : 'Your Shopping Bag is Empty'}</h2>
            <p>
              {isBuyNow
                ? 'The item was removed from checkout. You can explore more styles from our collection.'
                : 'Please add some luxury apparel from our catalog before proceeding to checkout.'}
            </p>
            <button 
              className="btn-primary"
              onClick={() => onNavigate && onNavigate('shop')}
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="aura-checkout-page">
      <div className="aura-container">
        
        {/* Breadcrumb Navigation */}
        <nav className="checkout-breadcrumb" aria-label="Breadcrumb">
          <button className="breadcrumb-link" onClick={() => onNavigate && onNavigate('home')}>
            Home
          </button>
          <span className="breadcrumb-separator">/</span>
          <button className="breadcrumb-link" onClick={() => onNavigate && onNavigate('cart')}>
            Cart
          </button>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Checkout</span>
        </nav>

        {/* Page Header */}
        <header className="checkout-header">
          <span className="checkout-eyebrow">FINAL STEP</span>
          <h1 className="checkout-title">Secure Checkout</h1>
          <p className="checkout-subtitle">
            Provide your contact details and shipping address to complete your AURA order.
          </p>
        </header>

        {/* Main Two-Column Layout */}
        <div className="checkout-layout-grid">
          
          {/* LEFT COLUMN: Customer Information, Delivery Details & Payment */}
          <div className="checkout-forms-column">
            
            <form id="checkout-form" onSubmit={handlePlaceOrder} noValidate className="checkout-main-form">
              
              {/* Submission Error Banner */}
              {submitError && (
                <div className="checkout-error-banner" role="alert">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <div>
                    <strong>Order Placement Failed</strong>
                    <p>{submitError}</p>
                  </div>
                </div>
              )}

              {/* SECTION 1: Customer Information */}
              <div className="checkout-section-card">
                <div className="section-title-row">
                  <span className="section-step-badge">1</span>
                  <div>
                    <h2 className="section-heading">Customer Information</h2>
                    <p className="section-desc">We'll use this to send order confirmations and digital receipts.</p>
                  </div>
                </div>

                <div className="form-fields-grid">
                  
                  {/* Full Name */}
                  <div className={`form-field full-width ${errors.fullName ? 'has-error' : ''}`}>
                    <label htmlFor="fullName" className="field-label">
                      Full Name <span className="req-star">*</span>
                    </label>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      className="field-input"
                      placeholder="e.g. Ananya Sharma"
                      value={customerInfo.fullName}
                      onChange={handleCustomerChange}
                      aria-invalid={!!errors.fullName}
                    />
                    {errors.fullName && <span className="field-error-text" role="alert">{errors.fullName}</span>}
                  </div>

                  {/* Phone */}
                  <div className={`form-field ${errors.phone ? 'has-error' : ''}`}>
                    <label htmlFor="phone" className="field-label">
                      Phone Number <span className="req-star">*</span>
                    </label>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      className="field-input"
                      placeholder="10-digit mobile number"
                      value={customerInfo.phone}
                      onChange={handleCustomerChange}
                      aria-invalid={!!errors.phone}
                    />
                    {errors.phone && <span className="field-error-text" role="alert">{errors.phone}</span>}
                  </div>

                  {/* Email */}
                  <div className={`form-field ${errors.email ? 'has-error' : ''}`}>
                    <label htmlFor="email" className="field-label">
                      Email Address <span className="req-star">*</span>
                    </label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      className="field-input"
                      placeholder="ananya@example.com"
                      value={customerInfo.email}
                      onChange={handleCustomerChange}
                      aria-invalid={!!errors.email}
                    />
                    {errors.email && <span className="field-error-text" role="alert">{errors.email}</span>}
                  </div>

                </div>
              </div>

              {/* SECTION 2: Delivery Details */}
              <div className="checkout-section-card">
                <div className="section-title-row">
                  <span className="section-step-badge">2</span>
                  <div>
                    <h2 className="section-heading">Delivery Details</h2>
                    <p className="section-desc">Where should we deliver your luxury package?</p>
                  </div>
                </div>

                <div className="form-fields-grid">
                  
                  {/* Address */}
                  <div className={`form-field full-width ${errors.address ? 'has-error' : ''}`}>
                    <label htmlFor="address" className="field-label">
                      Street Address <span className="req-star">*</span>
                    </label>
                    <input
                      id="address"
                      name="address"
                      type="text"
                      className="field-input"
                      placeholder="Flat, House no., Apartment, Street, Locality"
                      value={shippingAddress.address}
                      onChange={handleAddressChange}
                      aria-invalid={!!errors.address}
                    />
                    {errors.address && <span className="field-error-text" role="alert">{errors.address}</span>}
                  </div>

                  {/* City */}
                  <div className={`form-field ${errors.city ? 'has-error' : ''}`}>
                    <label htmlFor="city" className="field-label">
                      City <span className="req-star">*</span>
                    </label>
                    <input
                      id="city"
                      name="city"
                      type="text"
                      className="field-input"
                      placeholder="e.g. Mumbai"
                      value={shippingAddress.city}
                      onChange={handleAddressChange}
                      aria-invalid={!!errors.city}
                    />
                    {errors.city && <span className="field-error-text" role="alert">{errors.city}</span>}
                  </div>

                  {/* State */}
                  <div className={`form-field ${errors.state ? 'has-error' : ''}`}>
                    <label htmlFor="state" className="field-label">
                      State <span className="req-star">*</span>
                    </label>
                    <select
                      id="state"
                      name="state"
                      className="field-select"
                      value={shippingAddress.state}
                      onChange={handleAddressChange}
                      aria-invalid={!!errors.state}
                    >
                      <option value="">Select State</option>
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                    {errors.state && <span className="field-error-text" role="alert">{errors.state}</span>}
                  </div>

                  {/* PIN Code */}
                  <div className={`form-field ${errors.pincode ? 'has-error' : ''}`}>
                    <label htmlFor="pincode" className="field-label">
                      PIN Code <span className="req-star">*</span>
                    </label>
                    <input
                      id="pincode"
                      name="pincode"
                      type="text"
                      maxLength={6}
                      className="field-input"
                      placeholder="e.g. 400001"
                      value={shippingAddress.pincode}
                      onChange={handleAddressChange}
                      aria-invalid={!!errors.pincode}
                    />
                    {errors.pincode && <span className="field-error-text" role="alert">{errors.pincode}</span>}
                  </div>

                </div>
              </div>

              {/* SECTION 3: Payment Details */}
              <div className="checkout-section-card checkout-payment-card">
                <div className="section-title-row">
                  <span className="section-step-badge">3</span>
                  <div>
                    <h2 className="section-heading">Payment Method</h2>
                    <p className="section-desc">Select how you'd like to pay upon delivery or online.</p>
                  </div>
                </div>

                <div className="payment-options-list">
                  
                  {/* Option 1: Cash/UPI on Delivery */}
                  <label className={`payment-option-card ${paymentMethod === 'cod' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="cod"
                      checked={paymentMethod === 'cod'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="payment-radio"
                    />
                    <div className="payment-option-content">
                      <div className="payment-option-title-row">
                        <strong>Cash or UPI on Delivery</strong>
                        <span className="payment-badge">RECOMMENDED</span>
                      </div>
                      <p className="payment-option-sub">
                        Pay conveniently at your doorstep via Cash, Google Pay, PhonePe, or Paytm QR.
                      </p>
                    </div>
                  </label>

                  {/* Option 2: Online Payment */}
                  <label className={`payment-option-card ${paymentMethod === 'online' ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="online"
                      checked={paymentMethod === 'online'}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="payment-radio"
                    />
                    <div className="payment-option-content">
                      <div className="payment-option-title-row">
                        <strong>Online Payment (Cards / NetBanking / UPI)</strong>
                        <span className="payment-badge demo">DEMO MODE</span>
                      </div>
                      <p className="payment-option-sub">
                        Gateway integration is in test mode. No actual card will be charged.
                      </p>
                    </div>
                  </label>

                </div>
              </div>

            </form>

          </div>

          {/* RIGHT COLUMN: Sticky Order Summary */}
          <aside className="checkout-summary-column" aria-label="Order Summary">
            
            <div className="summary-sticky-card">
              
              {/* Top Continue Shopping Action inside Order Summary card */}
              <div className="summary-top-action-bar">
                <button
                  type="button"
                  className="summary-continue-shopping-btn checkout-continue-shopping-btn"
                  id="checkout-continue-shopping-btn"
                  onClick={handleContinueShopping}
                  aria-label="Continue Shopping"
                >
                  <span className="continue-shopping-arrow" aria-hidden="true">←</span>
                  <span>Continue Shopping</span>
                </button>
              </div>

              <div className="summary-card-header">
                <h2 className="summary-title">Order Summary</h2>
                <span className="summary-count-badge">
                  {cartItems.reduce((acc, item) => acc + (item.quantity || 1), 0)} items
                </span>
              </div>

              {/* Cart Items List */}
              <div className="summary-items-list">
                {cartItems.map((item, idx) => {
                  const key = item.cartItemId || `${item.id || item._id}-${item.selectedSize || item.size || 'M'}-${item.colorName || item.selectedColor || ''}-${idx}`;
                  const itemPrice = Number(item.price) || 0;
                  const itemQty = item.quantity || 1;

                  return (
                    <div key={key} className="summary-item-card">
                      
                      {/* Product Thumbnail */}
                      <div className="summary-item-thumb-box">
                        <img 
                          src={normalizeProductImageUrl(item.image)} 
                          alt={item.name} 
                          className="summary-item-img"
                          onError={handleImageError}
                        />
                        <span className="summary-item-qty-badge">{itemQty}</span>
                      </div>

                      {/* Product Details */}
                      <div className="summary-item-info">
                        <h4 className="summary-item-name">{item.name}</h4>
                        <div className="summary-item-attributes">
                          <span className="attr-pill">Size: {item.selectedSize || item.size || 'Standard'}</span>
                          {(item.colorName || item.selectedColor || item.color) && (
                            <span className="attr-pill attr-color-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                              Colour: <strong>{item.colorName || item.color || item.selectedColor}</strong>
                              <span 
                                className="attr-color-dot" 
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
                                title={item.colorName || item.selectedColor}
                              />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Item Total Price */}
                      <div className="summary-item-price">
                        {item.mrp && Number(item.mrp) > itemPrice && (
                          <span className="summary-item-original-price">
                            ₹{(Number(item.mrp) * itemQty).toLocaleString('en-IN')}
                          </span>
                        )}
                        <span>₹{(itemPrice * itemQty).toLocaleString('en-IN')}</span>
                      </div>

                      {/* Remove item (✕) button */}
                      <button
                        type="button"
                        className="summary-item-remove-btn"
                        onClick={() => handleRemoveItem(item)}
                        aria-label={`Remove ${item.name} from checkout`}
                        title={`Remove ${item.name}`}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>

                    </div>
                  );
                })}
              </div>

              {/* Coupon Redemption Section */}
              <div className="checkout-coupon-section">
                <div className="checkout-coupon-header-row">
                  <span className="checkout-coupon-label">Promo or Coupon Code</span>
                  <button
                    type="button"
                    className="checkout-view-coupons-toggle-btn"
                    onClick={() => setShowAvailableCoupons(prev => !prev)}
                    id="checkout-toggle-coupons-btn"
                    aria-expanded={showAvailableCoupons}
                  >
                    {showAvailableCoupons ? '✕ Hide Available Offers' : '🏷️ View Available Offers'}
                  </button>
                </div>

                {appliedCoupon ? (
                  <div className="checkout-applied-coupon-card">
                    <div className="applied-coupon-meta">
                      <span className="applied-coupon-icon">✨</span>
                      <div className="applied-coupon-text-group">
                        <span className="applied-coupon-code">{appliedCoupon.code}</span>
                        <span className="applied-coupon-text">
                          {appliedCoupon.discountType === 'percentage'
                            ? `${appliedCoupon.discountValue}% Discount Applied`
                            : `₹${appliedCoupon.discountValue} Off Applied`}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="checkout-remove-coupon-btn"
                      onClick={handleRemoveCoupon}
                      title="Remove coupon"
                      id="checkout-remove-coupon-btn"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <form className="checkout-coupon-form" onSubmit={handleApplyCoupon}>
                    <div className="checkout-coupon-input-box">
                      <input
                        id="checkout-coupon-input"
                        type="text"
                        placeholder="Enter coupon code..."
                        value={couponInput}
                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                        className="checkout-coupon-input"
                        disabled={isApplyingCoupon}
                      />
                      <button
                        type="submit"
                        className="checkout-coupon-apply-btn"
                        disabled={isApplyingCoupon || !couponInput.trim()}
                        id="checkout-apply-coupon-btn"
                      >
                        {isApplyingCoupon ? '...' : 'Apply'}
                      </button>
                    </div>
                  </form>
                )}

                {couponFeedback && (
                  <p className={`checkout-coupon-feedback ${couponFeedback.type}`} role="status">
                    {couponFeedback.message}
                  </p>
                )}

                {/* Available Offers Drawer in Checkout */}
                {showAvailableCoupons && (
                  <div className="checkout-available-coupons-drawer" id="checkout-available-coupons-drawer">
                    <AvailableCoupons
                      variant="checkout"
                      subtotal={subtotal}
                      appliedCoupon={appliedCoupon}
                      onApplyCouponCode={(code) => applyCouponByCode(code)}
                      isApplying={isApplyingCoupon}
                    />
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="summary-cost-breakdown">
                
                <div className="breakdown-row">
                  <span className="cost-label">Subtotal</span>
                  <span className="cost-val">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="breakdown-row discount-breakdown-row">
                    <span className="cost-label">Coupon Discount ({appliedCoupon?.code})</span>
                    <span className="cost-val discount-val">−₹{discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="breakdown-row">
                  <span className="cost-label">Delivery Charges</span>
                  <span className="cost-val">
                    {isFreeShipping ? (
                      <span className="free-shipping-tag">FREE</span>
                    ) : (
                      `₹${shippingFee}`
                    )}
                  </span>
                </div>

                <div className="breakdown-row">
                  <span className="cost-label">Taxes (GST Included)</span>
                  <span className="cost-val">₹0</span>
                </div>

                <div className="breakdown-divider"></div>

                {/* Final Total */}
                <div className="breakdown-total-row">
                  <span className="total-label">Final Total</span>
                  <div className="total-val-box">
                    <span className="total-val">₹{finalTotal.toLocaleString('en-IN')}</span>
                    <span className="tax-inclusive-subtext">All taxes inclusive</span>
                  </div>
                </div>

              </div>

              {/* Place Order CTA Button */}
              <div className="summary-place-order-box">
                <button 
                  type="submit"
                  form="checkout-form"
                  className="btn-primary place-order-btn"
                  onClick={handlePlaceOrder}
                  disabled={isSubmitting}
                  id="checkout-place-order-btn"
                >
                  {isSubmitting ? (
                    <>
                      <span className="btn-spinner"></span>
                      <span>Placing Order in MongoDB...</span>
                    </>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                      <span>Place Order • ₹{finalTotal.toLocaleString('en-IN')}</span>
                    </>
                  )}
                </button>
              </div>

              {/* Security and Guarantees */}
              <div className="summary-trust-badges">
                <div className="trust-badge-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                  </svg>
                  <span>256-Bit SSL Encrypted Checkout</span>
                </div>
                <div className="trust-badge-item">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5"></path>
                  </svg>
                  <span>14-Day Easy Returns & Exchanges</span>
                </div>
              </div>

            </div>

          </aside>

        </div>

      </div>
    </div>
  );
}
