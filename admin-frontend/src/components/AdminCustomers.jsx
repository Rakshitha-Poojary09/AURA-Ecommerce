import React, { useState, useEffect, useMemo } from 'react';
import './AdminCustomers.css';
import { adminFetch } from '../utils/apiClient';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';

export default function AdminCustomers() {
  const [customers, setCustomers] = useState([]);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    customersWithOrders: 0,
    customersWithoutOrders: 0,
    totalCustomerRevenue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Search, Filter & Sort states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'with_orders' | 'no_orders'
  const [sortOption, setSortOption] = useState('newest'); // 'newest' | 'oldest' | 'spending' | 'orders'

  // Modal inspection state
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [customerDetail, setCustomerDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3800);
  };

  /**
   * Fetch all customers and catalog statistics from GET /api/admin/customers
   */
  const fetchCustomers = async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const response = await adminFetch('/api/admin/customers');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch customers (Status ${response.status})`);
      }

      const data = await response.json();
      const customerList = Array.isArray(data.customers) ? data.customers : [];
      setCustomers(customerList);

      if (data.stats) {
        setStats(data.stats);
      } else {
        const totalCustomers = customerList.length;
        const customersWithOrders = customerList.filter((c) => c.totalOrders > 0).length;
        const customersWithoutOrders = customerList.filter((c) => c.totalOrders === 0).length;
        const totalCustomerRevenue = customerList.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
        setStats({
          totalCustomers,
          customersWithOrders,
          customersWithoutOrders,
          totalCustomerRevenue,
        });
      }
    } catch (err) {
      console.error('Error fetching admin customers:', err);
      setError(err.message || 'Could not load registered patrons.');
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  /**
   * Fetch specific customer details when modal opens: GET /api/admin/customers/:id
   */
  const handleOpenCustomerDetail = async (customerId) => {
    setSelectedCustomerId(customerId);
    setCustomerDetail(null);
    setLoadingDetail(true);
    setDetailError('');

    try {
      const response = await adminFetch(`/api/admin/customers/${customerId}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || 'Could not load customer profile details.');
      }
      const data = await response.json();
      setCustomerDetail(data.customer || null);
    } catch (err) {
      console.error('Error fetching customer details:', err);
      setDetailError(err.message || 'Unable to retrieve customer profile.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedCustomerId(null);
    setCustomerDetail(null);
    setDetailError('');
  };

  /**
   * Filter and Sort Customers
   */
  const filteredAndSortedCustomers = useMemo(() => {
    let result = [...customers];

    // 1. Search Query (Name, Email, Phone)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((c) => {
        const nameMatch = (c.name || '').toLowerCase().includes(query);
        const emailMatch = (c.email || '').toLowerCase().includes(query);
        const phoneMatch = (c.phone || '').toLowerCase().includes(query);
        return nameMatch || emailMatch || phoneMatch;
      });
    }

    // 2. Order Filters
    if (filterMode === 'with_orders') {
      result = result.filter((c) => (c.totalOrders || 0) > 0);
    } else if (filterMode === 'no_orders') {
      result = result.filter((c) => (c.totalOrders || 0) === 0);
    }

    // 3. Sorting
    result.sort((a, b) => {
      if (sortOption === 'newest') {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
      if (sortOption === 'oldest') {
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      }
      if (sortOption === 'spending') {
        return (b.totalSpent || 0) - (a.totalSpent || 0);
      }
      if (sortOption === 'orders') {
        return (b.totalOrders || 0) - (a.totalOrders || 0);
      }
      return 0;
    });

    return result;
  }, [customers, searchQuery, filterMode, sortOption]);

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  const formatCurrency = (amount) => {
    return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
  };

  const getStatusBadgeClass = (status = '') => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'badge-delivered';
      case 'shipped':
        return 'badge-shipped';
      case 'processing':
        return 'badge-processing';
      case 'cancelled':
        return 'badge-cancelled';
      case 'pending':
      default:
        return 'badge-pending';
    }
  };

  return (
    <div className="admin-customers-page" id="admin-customers-section">
      {/* 1. Header Section */}
      <div className="admin-page-header">
        <div>
          <span className="header-eyebrow">CLIENTELE MANAGEMENT</span>
          <h1 className="admin-page-title">Patrons & Customers</h1>
          <p className="admin-page-subtitle">
            Oversee registered clientele, review lifetime expenditure, and inspect individual order histories.
          </p>
        </div>
        <div className="header-actions">
          <button
            type="button"
            className="btn-refresh-customers"
            onClick={() => fetchCustomers(true)}
            disabled={isRefreshing || loading}
            id="refresh-customers-btn"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={isRefreshing ? 'spinning' : ''}
            >
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Patrons'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top KPI Cards */}
      <div className="customers-kpi-grid">
        <div className="customers-kpi-card">
          <div className="kpi-icon-wrapper kpi-icon-olive">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Total Patrons</span>
            <span className="kpi-value" id="kpi-total-customers">
              {stats.totalCustomers.toLocaleString('en-IN')}
            </span>
            <span className="kpi-subtext">Registered customer accounts</span>
          </div>
        </div>

        <div className="customers-kpi-card">
          <div className="kpi-icon-wrapper kpi-icon-emerald">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1"></circle>
              <circle cx="20" cy="21" r="1"></circle>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">With Orders</span>
            <span className="kpi-value" id="kpi-customers-with-orders">
              {stats.customersWithOrders.toLocaleString('en-IN')}
            </span>
            <span className="kpi-subtext">Active purchasers</span>
          </div>
        </div>

        <div className="customers-kpi-card">
          <div className="kpi-icon-wrapper kpi-icon-sand">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="8.5" cy="7" r="4"></circle>
              <line x1="18" y1="8" x2="23" y2="13"></line>
              <line x1="23" y1="8" x2="18" y2="13"></line>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Without Orders</span>
            <span className="kpi-value" id="kpi-customers-without-orders">
              {stats.customersWithoutOrders.toLocaleString('en-IN')}
            </span>
            <span className="kpi-subtext">Prospects & browsers</span>
          </div>
        </div>

        <div className="customers-kpi-card">
          <div className="kpi-icon-wrapper kpi-icon-gold">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Patron Revenue</span>
            <span className="kpi-value" id="kpi-total-revenue">
              {formatCurrency(stats.totalCustomerRevenue)}
            </span>
            <span className="kpi-subtext">Excludes cancelled orders</span>
          </div>
        </div>
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="customers-toolbar">
        {/* Search Input */}
        <div className="toolbar-search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search by patron name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="toolbar-search-input"
            id="customers-search-input"
          />
          {searchQuery && (
            <button
              type="button"
              className="toolbar-search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="toolbar-filters">
          <button
            type="button"
            className={`filter-chip ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
            id="filter-all-customers"
          >
            All Patrons ({customers.length})
          </button>
          <button
            type="button"
            className={`filter-chip ${filterMode === 'with_orders' ? 'active' : ''}`}
            onClick={() => setFilterMode('with_orders')}
            id="filter-with-orders"
          >
            With Orders ({stats.customersWithOrders})
          </button>
          <button
            type="button"
            className={`filter-chip ${filterMode === 'no_orders' ? 'active' : ''}`}
            onClick={() => setFilterMode('no_orders')}
            id="filter-no-orders"
          >
            No Orders ({stats.customersWithoutOrders})
          </button>
        </div>

        {/* Sorting Dropdown */}
        <div className="toolbar-sort">
          <label htmlFor="customer-sort-select" className="sort-label">Sort:</label>
          <select
            id="customer-sort-select"
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value)}
            className="toolbar-select"
          >
            <option value="newest">Newest Patron</option>
            <option value="oldest">Oldest Patron</option>
            <option value="spending">Highest Spending</option>
            <option value="orders">Most Orders</option>
          </select>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="admin-banner-alert error" role="alert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>{error}</span>
          <button className="banner-dismiss-btn" onClick={() => setError('')}>✕</button>
        </div>
      )}

      {/* 4. Customers Table */}
      <div className="customers-table-card">
        {loading ? (
          <div className="customers-loading-state">
            <div className="luxury-spinner"></div>
            <p>Loading registered clientele records...</p>
          </div>
        ) : filteredAndSortedCustomers.length === 0 ? (
          <div className="customers-empty-state">
            <div className="empty-state-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <line x1="23" y1="11" x2="17" y2="11"></line>
              </svg>
            </div>
            <h3 className="empty-state-title">No clientele found</h3>
            <p className="empty-state-text">
              {searchQuery || filterMode !== 'all'
                ? 'No registered patrons match your current filter or search criteria.'
                : 'No customer accounts have registered on AURA yet.'}
            </p>
            {(searchQuery || filterMode !== 'all') && (
              <button
                type="button"
                className="btn-secondary empty-reset-btn"
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('all');
                }}
              >
                Reset Search & Filters
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Patron</th>
                  <th>Contact Details</th>
                  <th>Joined Date</th>
                  <th>Orders</th>
                  <th>Total Spent</th>
                  <th>Status</th>
                  <th className="th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedCustomers.map((customer) => {
                  const initials = (customer.name || 'C')
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2);

                  return (
                    <tr key={customer._id} className="customer-row">
                      {/* Patron Identity */}
                      <td>
                        <div className="patron-identity-cell">
                          <div className="patron-avatar">
                            {initials}
                          </div>
                          <div className="patron-meta">
                            <span className="patron-name">{customer.name}</span>
                            <span className="patron-id-pill">ID: {customer._id.slice(-6)}</span>
                          </div>
                        </div>
                      </td>

                      {/* Contact Details */}
                      <td>
                        <div className="patron-contact-cell">
                          <span className="patron-email" title={customer.email}>
                            {customer.email}
                          </span>
                          {customer.phone ? (
                            <span className="patron-phone">{customer.phone}</span>
                          ) : (
                            <span className="patron-no-phone">Phone unlisted</span>
                          )}
                        </div>
                      </td>

                      {/* Registration Date */}
                      <td>
                        <span className="patron-date">{formatDate(customer.createdAt)}</span>
                      </td>

                      {/* Orders Count */}
                      <td>
                        <span className={`orders-badge ${customer.totalOrders > 0 ? 'has-orders' : 'zero-orders'}`}>
                          {customer.totalOrders} {customer.totalOrders === 1 ? 'order' : 'orders'}
                        </span>
                      </td>

                      {/* Total Spent */}
                      <td>
                        <div className="patron-spent-cell">
                          <span className="patron-spent-amount">
                            {formatCurrency(customer.totalSpent)}
                          </span>
                          {customer.lastOrderDate && (
                            <span className="patron-last-order">
                              Last: {formatDate(customer.lastOrderDate)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <span className="patron-status-badge active">
                          <span className="status-dot"></span>
                          Active
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="td-actions">
                        <button
                          type="button"
                          className="btn-view-customer"
                          onClick={() => handleOpenCustomerDetail(customer._id)}
                          title="Inspect Patron Profile & Orders"
                          id={`view-customer-${customer._id}`}
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                          </svg>
                          <span>View Profile</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 5. Customer Profile & Order History Modal */}
      {selectedCustomerId && (
        <div className="customer-modal-backdrop" onClick={handleCloseModal}>
          <div className="customer-modal-container" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="customer-modal-header">
              <div className="modal-header-left">
                <span className="modal-eyebrow">CLIENT DOSSIER</span>
                <h2 className="modal-title">
                  {customerDetail ? customerDetail.name : 'Loading Patron...'}
                </h2>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseModal}
                aria-label="Close dossier"
                id="close-customer-modal"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="customer-modal-body">
              {loadingDetail ? (
                <div className="modal-loading-state">
                  <div className="luxury-spinner"></div>
                  <p>Retrieving client dossier and order history from MongoDB...</p>
                </div>
              ) : detailError ? (
                <div className="modal-error-box">
                  <p>{detailError}</p>
                </div>
              ) : customerDetail ? (
                <div className="modal-sections">
                  {/* Top Stats Overview */}
                  <div className="modal-overview-strip">
                    <div className="overview-pill">
                      <span className="overview-label">Total Orders</span>
                      <span className="overview-value">{customerDetail.totalOrders}</span>
                    </div>
                    <div className="overview-pill">
                      <span className="overview-label">Lifetime Spend</span>
                      <span className="overview-value">{formatCurrency(customerDetail.totalSpent)}</span>
                    </div>
                    <div className="overview-pill">
                      <span className="overview-label">Member Since</span>
                      <span className="overview-value">{formatDate(customerDetail.createdAt)}</span>
                    </div>
                    <div className="overview-pill">
                      <span className="overview-label">Latest Activity</span>
                      <span className="overview-value">{formatDate(customerDetail.lastOrderDate)}</span>
                    </div>
                  </div>

                  {/* Section 1: Customer Information */}
                  <div className="modal-card">
                    <h3 className="modal-card-title">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      Customer Information
                    </h3>
                    <div className="info-grid-details">
                      <div className="info-field">
                        <span className="field-label">Full Name</span>
                        <span className="field-value">{customerDetail.name}</span>
                      </div>
                      <div className="info-field">
                        <span className="field-label">Email Address</span>
                        <span className="field-value font-mono">{customerDetail.email}</span>
                      </div>
                      <div className="info-field">
                        <span className="field-label">Phone Contact</span>
                        <span className="field-value">
                          {customerDetail.phone || 'Not provided in orders'}
                        </span>
                      </div>
                      <div className="info-field">
                        <span className="field-label">Account Role</span>
                        <span className="field-value role-tag">{customerDetail.role || 'customer'}</span>
                      </div>
                      <div className="info-field">
                        <span className="field-label">Registration Date</span>
                        <span className="field-value">{formatDate(customerDetail.createdAt)}</span>
                      </div>
                      <div className="info-field">
                        <span className="field-label">Account Status</span>
                        <span className="field-value status-tag">Active Patron</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Order History */}
                  <div className="modal-card">
                    <div className="order-history-header">
                      <h3 className="modal-card-title">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                          <line x1="3" y1="6" x2="21" y2="6"></line>
                          <path d="M16 10a4 4 0 0 1-8 0"></path>
                        </svg>
                        Order History ({customerDetail.orders?.length || 0})
                      </h3>
                      <span className="order-history-note">Excludes cancelled orders from spend total</span>
                    </div>

                    {!customerDetail.orders || customerDetail.orders.length === 0 ? (
                      <div className="orders-empty-state">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <p>This patron has not placed any orders yet.</p>
                      </div>
                    ) : (
                      <div className="modal-orders-list">
                        {customerDetail.orders.map((order) => (
                          <div key={order._id || order.orderId} className="modal-order-card">
                            <div className="order-card-top">
                              <div className="order-id-group">
                                <span className="order-id-title">{order.orderId || order._id}</span>
                                <span className="order-date-subtitle">{formatDate(order.date || order.createdAt)}</span>
                              </div>
                              <div className="order-status-group">
                                <span className={`order-status-badge ${getStatusBadgeClass(order.status)}`}>
                                  {order.status || 'Pending'}
                                </span>
                                <span className="order-amount-pill">{formatCurrency(order.total)}</span>
                              </div>
                            </div>

                            {/* Order Items */}
                            {order.items && order.items.length > 0 && (
                              <div className="order-items-preview">
                                <div className="preview-label">Purchased Items ({order.items.length}):</div>
                                <div className="preview-items-row">
                                  {order.items.map((item, iIdx) => (
                                    <div key={iIdx} className="preview-item-chip">
                                      {item.image && (
                                        <img 
                                          src={normalizeProductImageUrl(item.image)} 
                                          alt={item.name} 
                                          className="preview-item-thumb" 
                                          onError={handleImageError} 
                                        />
                                      )}
                                      <div className="preview-item-text">
                                        <span className="item-name">{item.name}</span>
                                        <span className="item-details">
                                          Size: {item.size || 'M'} • Qty: {item.quantity || 1} • {formatCurrency(item.price)}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="customer-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCloseModal}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Interactive Toast */}
      {toastMessage && (
        <div className="aura-toast" role="alert">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
