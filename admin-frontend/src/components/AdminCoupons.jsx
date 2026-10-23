import React, { useState, useEffect } from 'react';
import './AdminCoupons.css';
import { adminFetch } from '../utils/apiClient';

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState([]);
  const [stats, setStats] = useState({
    totalCoupons: 0,
    activeCoupons: 0,
    expiredCoupons: 0,
    scheduledCoupons: 0,
    inactiveCoupons: 0,
    totalDiscountGiven: 0,
    totalSuccessfulUses: 0,
    mostUsedCoupons: []
  });

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [deletingCoupon, setDeletingCoupon] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: '',
    minOrderAmount: '',
    maxDiscountAmount: '',
    startDate: '',
    expiryDate: '',
    usageLimit: '',
    usageLimitPerCustomer: '1',
    isActive: true
  });
  const [formErrors, setFormErrors] = useState({});
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [bannerAlert, setBannerAlert] = useState(null); // { type: 'success' | 'error', message }

  const showAlert = (message, type = 'success') => {
    setBannerAlert({ message, type });
    setTimeout(() => {
      setBannerAlert(null);
    }, 4500);
  };

  // Helper to format ISO date to datetime-local input string (YYYY-MM-DDTHH:MM)
  const formatDateTimeLocal = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Helper to get formatted default start & end dates
  const getDefaultDates = () => {
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days
    return {
      startDate: formatDateTimeLocal(now),
      expiryDate: formatDateTimeLocal(future)
    };
  };

  // Fetch real coupons & statistics from MongoDB
  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (sortBy !== 'newest') params.append('sort', sortBy);

      const res = await adminFetch(`/api/admin/coupons?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Failed to retrieve coupons from backend API');
      }

      const data = await res.json();
      setCoupons(Array.isArray(data.coupons) ? data.coupons : []);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching coupons:', err);
      showAlert('Could not load coupon records from MongoDB', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, [statusFilter, sortBy]);

  // Handle Search submit
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCoupons();
  };

  // Open Create Modal
  const openCreateModal = () => {
    const defaultDates = getDefaultDates();
    setFormData({
      code: '',
      discountType: 'percentage',
      discountValue: '',
      minOrderAmount: '',
      maxDiscountAmount: '',
      startDate: defaultDates.startDate,
      expiryDate: defaultDates.expiryDate,
      usageLimit: '',
      usageLimitPerCustomer: '1',
      isActive: true
    });
    setFormErrors({});
    setEditingCoupon(null);
    setShowCreateModal(true);
  };

  // Open Edit Modal
  const openEditModal = (coupon) => {
    setFormData({
      code: coupon.code,
      discountType: coupon.discountType || 'percentage',
      discountValue: String(coupon.discountValue || ''),
      minOrderAmount: coupon.minOrderAmount ? String(coupon.minOrderAmount) : '',
      maxDiscountAmount: coupon.maxDiscountAmount ? String(coupon.maxDiscountAmount) : '',
      startDate: formatDateTimeLocal(coupon.startDate),
      expiryDate: formatDateTimeLocal(coupon.expiryDate),
      usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : '',
      usageLimitPerCustomer: String(coupon.usageLimitPerCustomer || 1),
      isActive: Boolean(coupon.isActive)
    });
    setFormErrors({});
    setEditingCoupon(coupon);
    setShowCreateModal(true);
  };

  // Client-side form validation
  const validateForm = () => {
    const errors = {};
    const code = formData.code.trim().toUpperCase();

    if (!code) {
      errors.code = 'Coupon code is required';
    } else if (code.length < 2) {
      errors.code = 'Coupon code must be at least 2 characters';
    } else if (!/^[A-Z0-9_-]+$/.test(code)) {
      errors.code = 'Code can only contain letters, numbers, hyphens, and underscores';
    }

    const val = Number(formData.discountValue);
    if (!formData.discountValue || isNaN(val) || val <= 0) {
      errors.discountValue = 'Please enter a valid discount value greater than 0';
    } else if (formData.discountType === 'percentage' && val > 100) {
      errors.discountValue = 'Percentage discount cannot exceed 100%';
    }

    if (formData.minOrderAmount && (isNaN(Number(formData.minOrderAmount)) || Number(formData.minOrderAmount) < 0)) {
      errors.minOrderAmount = 'Minimum order amount cannot be negative';
    }

    if (formData.maxDiscountAmount && (isNaN(Number(formData.maxDiscountAmount)) || Number(formData.maxDiscountAmount) < 0)) {
      errors.maxDiscountAmount = 'Maximum discount amount cannot be negative';
    }

    if (!formData.startDate) {
      errors.startDate = 'Start date and time is required';
    }
    if (!formData.expiryDate) {
      errors.expiryDate = 'Expiry date and time is required';
    }

    if (formData.startDate && formData.expiryDate) {
      const start = new Date(formData.startDate);
      const expiry = new Date(formData.expiryDate);
      if (expiry <= start) {
        errors.expiryDate = 'Expiry date must be later than start date';
      }
    }

    if (formData.usageLimit && (isNaN(Number(formData.usageLimit)) || Number(formData.usageLimit) < 1)) {
      errors.usageLimit = 'Usage limit must be a positive integer';
    }

    if (formData.usageLimitPerCustomer && (isNaN(Number(formData.usageLimitPerCustomer)) || Number(formData.usageLimitPerCustomer) < 1)) {
      errors.usageLimitPerCustomer = 'Per-customer limit must be at least 1';
    }

    return errors;
  };

  // Handle Create / Update Submission
  const handleSaveCoupon = async (e) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormSubmitting(true);
    setFormErrors({});

    const payload = {
      code: formData.code.trim().toUpperCase(),
      discountType: formData.discountType,
      discountValue: Number(formData.discountValue),
      minOrderAmount: formData.minOrderAmount ? Number(formData.minOrderAmount) : 0,
      maxDiscountAmount: formData.maxDiscountAmount ? Number(formData.maxDiscountAmount) : null,
      startDate: new Date(formData.startDate).toISOString(),
      expiryDate: new Date(formData.expiryDate).toISOString(),
      usageLimit: formData.usageLimit ? Math.floor(Number(formData.usageLimit)) : null,
      usageLimitPerCustomer: formData.usageLimitPerCustomer ? Math.floor(Number(formData.usageLimitPerCustomer)) : 1,
      isActive: Boolean(formData.isActive)
    };

    try {
      let res;
      if (editingCoupon) {
        res = await adminFetch(`/api/admin/coupons/${editingCoupon._id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
      } else {
        res = await adminFetch('/api/admin/coupons', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Operation failed');
      }

      showAlert(editingCoupon ? `Coupon "${payload.code}" updated successfully!` : `Coupon "${payload.code}" created successfully!`);
      setShowCreateModal(false);
      setEditingCoupon(null);
      fetchCoupons();
    } catch (err) {
      setFormErrors({ submit: err.message });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Toggle Coupon Active Status
  const handleToggleStatus = async (coupon) => {
    try {
      const res = await adminFetch(`/api/admin/coupons/${coupon._id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ isActive: !coupon.isActive })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to toggle status');

      showAlert(`Coupon "${coupon.code}" is now ${!coupon.isActive ? 'active' : 'inactive'}.`);
      fetchCoupons();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  // Delete Coupon
  const handleDeleteCoupon = async () => {
    if (!deletingCoupon) return;
    try {
      const res = await adminFetch(`/api/admin/coupons/${deletingCoupon._id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete coupon');

      showAlert(`Coupon "${deletingCoupon.code}" deleted successfully.`);
      setDeletingCoupon(null);
      fetchCoupons();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  };

  // Determine computed status for display
  const getDisplayStatus = (coupon) => {
    const now = new Date();
    const expiry = new Date(coupon.expiryDate);
    const start = new Date(coupon.startDate);

    if (!coupon.isActive) {
      return { label: 'Inactive', className: 'status-inactive' };
    }
    if (now > expiry) {
      return { label: 'Expired', className: 'status-expired' };
    }
    if (now < start) {
      return { label: 'Scheduled', className: 'status-scheduled' };
    }
    return { label: 'Active', className: 'status-active' };
  };

  // Format date helper
  const formatDateDisplay = (dateString) => {
    if (!dateString) return '—';
    try {
      const d = new Date(dateString);
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="admin-coupons-page">
      {/* Top Breadcrumb & Page Header */}
      <div className="coupons-page-header">
        <div className="coupons-header-left">
          <nav className="breadcrumb-nav">
            <span>Management</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Coupons & Discounts</span>
          </nav>
          <h1 className="coupons-main-title">Coupons & Discounts</h1>
          <p className="coupons-main-subtitle">
            Create promotional codes, manage checkout discounts, and monitor customer usage.
          </p>
        </div>

        <div className="coupons-header-actions">
          <button 
            type="button" 
            className="btn-secondary refresh-coupons-btn" 
            onClick={fetchCoupons}
            title="Refresh coupons from MongoDB"
            id="refresh-coupons-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <span>Refresh</span>
          </button>

          <button 
            type="button" 
            className="btn-primary create-coupon-btn"
            onClick={openCreateModal}
            id="create-coupon-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Create Coupon</span>
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {bannerAlert && (
        <div className={`coupon-banner-alert ${bannerAlert.type}`} role="alert">
          <div className="alert-content">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {bannerAlert.type === 'success' ? (
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14M22 4L12 14.01l-3-3"></path>
              ) : (
                <>
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </>
              )}
            </svg>
            <span>{bannerAlert.message}</span>
          </div>
          <button className="alert-dismiss-btn" onClick={() => setBannerAlert(null)}>✕</button>
        </div>
      )}

      {/* 1. Real MongoDB Statistics Cards */}
      <div className="coupons-stats-grid">
        <div className="coupon-stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Coupons</span>
            <div className="stat-icon-circle total">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
            </div>
          </div>
          <div className="stat-value">{stats.totalCoupons}</div>
          <div className="stat-subtext">All time promotional campaigns</div>
        </div>

        <div className="coupon-stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Active Coupons</span>
            <div className="stat-icon-circle active">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 14 14"></polyline>
              </svg>
            </div>
          </div>
          <div className="stat-value active-val">{stats.activeCoupons}</div>
          <div className="stat-subtext">Currently valid & redeemable</div>
        </div>

        <div className="coupon-stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Expired Coupons</span>
            <div className="stat-icon-circle expired">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
          </div>
          <div className="stat-value">{stats.expiredCoupons}</div>
          <div className="stat-subtext">Exceeded validity period</div>
        </div>

        <div className="coupon-stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total Discount Given</span>
            <div className="stat-icon-circle discount">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
          </div>
          <div className="stat-value discount-val">₹{stats.totalDiscountGiven.toLocaleString('en-IN')}</div>
          <div className="stat-subtext">Across {stats.totalSuccessfulUses} successful orders</div>
        </div>
      </div>

      {/* 2. Search, Filters, and Table Controls */}
      <div className="coupons-controls-card">
        <form className="coupons-search-form" onSubmit={handleSearchSubmit}>
          <div className="search-input-wrapper">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              className="coupons-search-input"
              placeholder="Search by coupon code (e.g. WELCOME10)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              id="coupons-search-input"
            />
            {searchQuery && (
              <button 
                type="button" 
                className="clear-search-btn" 
                onClick={() => {
                  setSearchQuery('');
                  setTimeout(fetchCoupons, 0);
                }}
              >
                ✕
              </button>
            )}
          </div>
          <button type="submit" className="btn-secondary search-submit-btn">
            Search
          </button>
        </form>

        <div className="coupons-filters-bar">
          {/* Status Filter Buttons */}
          <div className="status-filter-pills" role="tablist">
            {[
              { id: 'all', label: 'All' },
              { id: 'active', label: 'Active' },
              { id: 'scheduled', label: 'Scheduled' },
              { id: 'inactive', label: 'Inactive' },
              { id: 'expired', label: 'Expired' }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`filter-pill-btn ${statusFilter === tab.id ? 'active' : ''}`}
                onClick={() => setStatusFilter(tab.id)}
                id={`filter-pill-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Sort Dropdown */}
          <div className="coupons-sort-wrapper">
            <label htmlFor="coupons-sort-select" className="sort-label">Sort by:</label>
            <select
              id="coupons-sort-select"
              className="coupons-sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest First</option>
              <option value="expiry">Expiry Date</option>
              <option value="usage">Most Used</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. Coupons Management Table */}
      <div className="coupons-table-card">
        {loading ? (
          <div className="coupons-loading-box">
            <div className="coupon-spinner"></div>
            <span>Loading coupon records from MongoDB...</span>
          </div>
        ) : coupons.length === 0 ? (
          /* Empty State */
          <div className="coupons-empty-state">
            <div className="empty-icon-box">
              <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
            </div>
            {stats.totalCoupons === 0 ? (
              <>
                <h3 className="empty-title">No coupons created yet</h3>
                <p className="empty-desc">
                  Create your first promotional discount coupon to drive customer purchases and reward luxury patrons.
                </p>
                <button 
                  type="button" 
                  className="btn-primary empty-cta-btn"
                  onClick={openCreateModal}
                >
                  + Create First Coupon
                </button>
              </>
            ) : (
              <>
                <h3 className="empty-title">No matching coupons found</h3>
                <p className="empty-desc">
                  No coupons match your filter or search query "{searchQuery}". Try clearing your filters.
                </p>
                <button 
                  type="button" 
                  className="btn-secondary empty-cta-btn"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    fetchCoupons();
                  }}
                >
                  Clear Filters
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="coupons-table">
              <thead>
                <tr>
                  <th>Coupon Code</th>
                  <th>Discount</th>
                  <th>Min Order</th>
                  <th>Max Cap</th>
                  <th>Validity Window</th>
                  <th>Usage Limit</th>
                  <th>Status</th>
                  <th className="actions-header">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => {
                  const statusInfo = getDisplayStatus(coupon);
                  const isExpired = new Date() > new Date(coupon.expiryDate);
                  const usageRatio = coupon.usageLimit ? `${coupon.usedCount || 0} / ${coupon.usageLimit}` : `${coupon.usedCount || 0} / ∞`;
                  const usagePct = coupon.usageLimit ? Math.min(100, Math.round(((coupon.usedCount || 0) / coupon.usageLimit) * 100)) : 0;

                  return (
                    <tr key={coupon._id} className={!coupon.isActive || isExpired ? 'row-dimmed' : ''}>
                      {/* Coupon Code */}
                      <td>
                        <div className="coupon-code-cell">
                          <span className="coupon-code-badge">{coupon.code}</span>
                          <button
                            type="button"
                            className="copy-code-btn"
                            title="Copy coupon code"
                            onClick={() => {
                              navigator.clipboard.writeText(coupon.code);
                              showAlert(`Copied "${coupon.code}" to clipboard!`);
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                          </button>
                        </div>
                      </td>

                      {/* Discount Value */}
                      <td>
                        <div className="discount-cell">
                          <span className="discount-primary">
                            {coupon.discountType === 'percentage' 
                              ? `${coupon.discountValue}% OFF` 
                              : `₹${coupon.discountValue.toLocaleString('en-IN')} OFF`}
                          </span>
                          <span className="discount-type-sub">
                            {coupon.discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                          </span>
                        </div>
                      </td>

                      {/* Min Order */}
                      <td>
                        <span className="criteria-text">
                          {coupon.minOrderAmount > 0 ? `₹${coupon.minOrderAmount.toLocaleString('en-IN')}` : 'No minimum'}
                        </span>
                      </td>

                      {/* Max Discount */}
                      <td>
                        <span className="criteria-text">
                          {coupon.maxDiscountAmount ? `₹${coupon.maxDiscountAmount.toLocaleString('en-IN')}` : 'No limit'}
                        </span>
                      </td>

                      {/* Validity Window */}
                      <td>
                        <div className="validity-cell">
                          <span className="validity-start">From: {formatDateDisplay(coupon.startDate)}</span>
                          <span className={`validity-expiry ${isExpired ? 'expired-text' : ''}`}>
                            Until: {formatDateDisplay(coupon.expiryDate)}
                          </span>
                        </div>
                      </td>

                      {/* Usage */}
                      <td>
                        <div className="usage-cell">
                          <span className="usage-count">{usageRatio}</span>
                          {coupon.usageLimit && (
                            <div className="usage-bar-track">
                              <div 
                                className="usage-bar-fill" 
                                style={{ width: `${usagePct}%` }}
                              />
                            </div>
                          )}
                          <span className="per-cust-sub">
                            Limit: {coupon.usageLimitPerCustomer || 1}/customer
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span className={`coupon-status-badge ${statusInfo.className}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="actions-cell">
                        <div className="action-buttons-group">
                          {/* Toggle Active / Inactive */}
                          <button
                            type="button"
                            className={`action-btn toggle-btn ${coupon.isActive ? 'active' : ''}`}
                            onClick={() => handleToggleStatus(coupon)}
                            title={coupon.isActive ? 'Deactivate Coupon' : 'Activate Coupon'}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              {coupon.isActive ? (
                                <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"></path>
                              ) : (
                                <circle cx="12" cy="12" r="10"></circle>
                              )}
                            </svg>
                          </button>

                          {/* Edit Coupon */}
                          <button
                            type="button"
                            className="action-btn edit-btn"
                            onClick={() => openEditModal(coupon)}
                            title="Edit Coupon Details"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>

                          {/* Delete Coupon */}
                          <button
                            type="button"
                            className="action-btn delete-btn"
                            onClick={() => setDeletingCoupon(coupon)}
                            title="Delete Coupon"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Top Most-Used Coupons Analytics Strip */}
      {stats.mostUsedCoupons && stats.mostUsedCoupons.length > 0 && (
        <div className="coupons-insights-card">
          <div className="insights-header">
            <h3 className="insights-title">Most-Used Promotional Codes</h3>
            <span className="insights-sub">Calculated from verified customer orders in MongoDB</span>
          </div>
          <div className="insights-grid">
            {stats.mostUsedCoupons.map((item, index) => (
              <div key={item._id} className="insight-item-box">
                <span className="insight-rank">#{index + 1}</span>
                <div className="insight-info">
                  <span className="insight-code">{item._id}</span>
                  <span className="insight-stats">
                    {item.timesUsed} {item.timesUsed === 1 ? 'order' : 'orders'} • ₹{Math.round(item.totalDiscountGranted || 0).toLocaleString('en-IN')} saved
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Create / Edit Coupon Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => !formSubmitting && setShowCreateModal(false)}>
          <div className="coupon-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">{editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Coupon'}</h2>
                <p className="modal-subtitle">
                  Configure discount parameters and validity rules stored securely in MongoDB.
                </p>
              </div>
              <button 
                type="button" 
                className="modal-close-btn"
                onClick={() => !formSubmitting && setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            {formErrors.submit && (
              <div className="form-submit-error" role="alert">
                <span>{formErrors.submit}</span>
              </div>
            )}

            <form className="coupon-form" onSubmit={handleSaveCoupon}>
              <div className="form-grid-2">
                
                {/* Coupon Code */}
                <div className={`form-group ${formErrors.code ? 'has-error' : ''}`}>
                  <label className="form-label">
                    Coupon Code <span className="req-star">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input text-uppercase"
                    placeholder="e.g. LUXURY20"
                    value={formData.code}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }));
                      if (formErrors.code) setFormErrors((prev) => ({ ...prev, code: '' }));
                    }}
                    maxLength={30}
                    id="form-coupon-code"
                  />
                  {formErrors.code && <span className="form-error-msg">{formErrors.code}</span>}
                  <span className="form-hint">Auto-normalized to uppercase. E.g. AURA15</span>
                </div>

                {/* Discount Type */}
                <div className="form-group">
                  <label className="form-label">
                    Discount Type <span className="req-star">*</span>
                  </label>
                  <select
                    className="form-select"
                    value={formData.discountType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, discountType: e.target.value }))}
                    id="form-discount-type"
                  >
                    <option value="percentage">Percentage Discount (%)</option>
                    <option value="fixed">Fixed Amount Discount (₹)</option>
                  </select>
                  <span className="form-hint">Percentage off or exact rupee deduction</span>
                </div>

                {/* Discount Value */}
                <div className={`form-group ${formErrors.discountValue ? 'has-error' : ''}`}>
                  <label className="form-label">
                    Discount Value <span className="req-star">*</span>
                  </label>
                  <div className="input-with-adornment">
                    <span className="input-adornment">
                      {formData.discountType === 'percentage' ? '%' : '₹'}
                    </span>
                    <input
                      type="number"
                      step={formData.discountType === 'percentage' ? '1' : '1'}
                      className="form-input"
                      placeholder={formData.discountType === 'percentage' ? 'e.g. 15' : 'e.g. 500'}
                      value={formData.discountValue}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, discountValue: e.target.value }));
                        if (formErrors.discountValue) setFormErrors((prev) => ({ ...prev, discountValue: '' }));
                      }}
                      id="form-discount-value"
                    />
                  </div>
                  {formErrors.discountValue && <span className="form-error-msg">{formErrors.discountValue}</span>}
                </div>

                {/* Minimum Order Amount */}
                <div className={`form-group ${formErrors.minOrderAmount ? 'has-error' : ''}`}>
                  <label className="form-label">
                    Minimum Order Amount (₹)
                  </label>
                  <div className="input-with-adornment">
                    <span className="input-adornment">₹</span>
                    <input
                      type="number"
                      step="1"
                      className="form-input"
                      placeholder="e.g. 1999 (0 for none)"
                      value={formData.minOrderAmount}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, minOrderAmount: e.target.value }));
                        if (formErrors.minOrderAmount) setFormErrors((prev) => ({ ...prev, minOrderAmount: '' }));
                      }}
                      id="form-min-order"
                    />
                  </div>
                  {formErrors.minOrderAmount && <span className="form-error-msg">{formErrors.minOrderAmount}</span>}
                  <span className="form-hint">Merchandise subtotal threshold required to apply</span>
                </div>

                {/* Maximum Discount Amount (For percentage discounts) */}
                <div className={`form-group ${formErrors.maxDiscountAmount ? 'has-error' : ''}`}>
                  <label className="form-label">
                    Maximum Discount Cap (₹)
                  </label>
                  <div className="input-with-adornment">
                    <span className="input-adornment">₹</span>
                    <input
                      type="number"
                      step="1"
                      className="form-input"
                      placeholder="e.g. 1000 (Optional cap)"
                      value={formData.maxDiscountAmount}
                      onChange={(e) => {
                        setFormData((prev) => ({ ...prev, maxDiscountAmount: e.target.value }));
                        if (formErrors.maxDiscountAmount) setFormErrors((prev) => ({ ...prev, maxDiscountAmount: '' }));
                      }}
                      id="form-max-discount"
                    />
                  </div>
                  {formErrors.maxDiscountAmount && <span className="form-error-msg">{formErrors.maxDiscountAmount}</span>}
                  <span className="form-hint">Prevents disproportionate percentage deductions</span>
                </div>

                {/* Start Date & Time */}
                <div className={`form-group ${formErrors.startDate ? 'has-error' : ''}`}>
                  <label className="form-label">
                    Start Date & Time <span className="req-star">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={formData.startDate}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, startDate: e.target.value }));
                      if (formErrors.startDate) setFormErrors((prev) => ({ ...prev, startDate: '' }));
                    }}
                    id="form-start-date"
                  />
                  {formErrors.startDate && <span className="form-error-msg">{formErrors.startDate}</span>}
                </div>

                {/* Expiry Date & Time */}
                <div className={`form-group ${formErrors.expiryDate ? 'has-error' : ''}`}>
                  <label className="form-label">
                    Expiry Date & Time <span className="req-star">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={formData.expiryDate}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, expiryDate: e.target.value }));
                      if (formErrors.expiryDate) setFormErrors((prev) => ({ ...prev, expiryDate: '' }));
                    }}
                    id="form-expiry-date"
                  />
                  {formErrors.expiryDate && <span className="form-error-msg">{formErrors.expiryDate}</span>}
                </div>

                {/* Total Usage Limit */}
                <div className={`form-group ${formErrors.usageLimit ? 'has-error' : ''}`}>
                  <label className="form-label">
                    Total Campaign Usage Limit
                  </label>
                  <input
                    type="number"
                    step="1"
                    className="form-input"
                    placeholder="e.g. 100 (Blank for unlimited)"
                    value={formData.usageLimit}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, usageLimit: e.target.value }));
                      if (formErrors.usageLimit) setFormErrors((prev) => ({ ...prev, usageLimit: '' }));
                    }}
                    id="form-usage-limit"
                  />
                  {formErrors.usageLimit && <span className="form-error-msg">{formErrors.usageLimit}</span>}
                  <span className="form-hint">Max total times this code can be used across all buyers</span>
                </div>

                {/* Usage Limit Per Customer */}
                <div className={`form-group ${formErrors.usageLimitPerCustomer ? 'has-error' : ''}`}>
                  <label className="form-label">
                    Usage Limit Per Customer
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    className="form-input"
                    value={formData.usageLimitPerCustomer}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, usageLimitPerCustomer: e.target.value }));
                      if (formErrors.usageLimitPerCustomer) setFormErrors((prev) => ({ ...prev, usageLimitPerCustomer: '' }));
                    }}
                    id="form-per-customer-limit"
                  />
                  {formErrors.usageLimitPerCustomer && <span className="form-error-msg">{formErrors.usageLimitPerCustomer}</span>}
                  <span className="form-hint">Default 1: One redemption per patron email/account</span>
                </div>

                {/* Active Status Checkbox */}
                <div className="form-group full-width checkbox-group">
                  <label className="checkbox-label-container">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                      id="form-is-active"
                    />
                    <span className="checkbox-custom"></span>
                    <span className="checkbox-text">
                      <strong>Active Status:</strong> Allow customers to redeem this coupon immediately within validity window
                    </span>
                  </label>
                </div>

              </div>

              {/* Form Actions */}
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={formSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary modal-submit-btn"
                  disabled={formSubmitting}
                  id="submit-coupon-form-btn"
                >
                  {formSubmitting ? (
                    <>
                      <span className="btn-spinner"></span>
                      <span>Saving to MongoDB...</span>
                    </>
                  ) : (
                    <span>{editingCoupon ? 'Update Coupon' : 'Create Coupon'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Delete Confirmation Modal */}
      {deletingCoupon && (
        <div className="modal-backdrop" onClick={() => setDeletingCoupon(null)}>
          <div className="confirm-delete-card" onClick={(e) => e.stopPropagation()}>
            <div className="delete-icon-box">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </div>
            <h3 className="confirm-title">Delete Coupon "{deletingCoupon.code}"?</h3>
            <p className="confirm-desc">
              Are you sure you want to permanently delete this promotional coupon? Historical orders that already used this coupon will not be altered.
            </p>
            <div className="confirm-actions">
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => setDeletingCoupon(null)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-danger-confirm"
                onClick={handleDeleteCoupon}
                id="confirm-delete-coupon-btn"
              >
                Yes, Delete Coupon
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
