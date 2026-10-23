import React, { useState, useEffect } from 'react';
import './AdminOrders.css';
import { adminFetch } from '../utils/apiClient';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';

export default function AdminOrders({ initialSelectedOrderId = null }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const STATUS_OPTIONS = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3500);
  };

  /**
   * GET /api/orders
   * Protected with requireAdmin on Express backend
   */
  const fetchOrders = async (showRefreshAnimation = false) => {
    if (showRefreshAnimation) setIsRefreshing(true);
    setError('');

    try {
      const response = await adminFetch('/api/orders');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        setOrders(data);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.warn('Backend unavailable or fetch failed:', err);
      setError('Could not connect to live backend or fetch orders from database.');
      setOrders([]);
    } finally {
      setLoading(false);
      if (showRefreshAnimation) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // Automatically open order details if navigated with an order ID
  useEffect(() => {
    if (initialSelectedOrderId && orders.length > 0) {
      const match = orders.find(
        (o) => o.orderId === initialSelectedOrderId || o._id === initialSelectedOrderId
      );
      if (match) {
        setSelectedOrder(match);
      }
    }
  }, [initialSelectedOrderId, orders]);

  /**
   * PUT /api/orders/:id/status
   * Protected with requireAdmin on Express backend
   */
  const handleUpdateStatus = async (orderId, newStatus) => {
    if (!newStatus || !STATUS_OPTIONS.includes(newStatus)) {
      showToast('Please select a valid order status.');
      return;
    }

    setUpdatingOrderId(orderId);

    try {
      const response = await adminFetch(`/api/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to update status (${response.status})`);
      }

      const result = await response.json();

      setOrders((prevOrders) =>
        prevOrders.map((ord) => {
          const currentId = ord._id || ord.orderId;
          const targetId = orderId;
          if (currentId === targetId || ord.orderId === targetId || ord._id === targetId) {
            return { ...ord, status: newStatus };
          }
          return ord;
        })
      );

      if (selectedOrder) {
        const selId = selectedOrder._id || selectedOrder.orderId;
        if (selId === orderId || selectedOrder.orderId === orderId) {
          setSelectedOrder((prev) => ({ ...prev, status: newStatus }));
        }
      }

      showToast(`Order status updated to "${newStatus}"! ✓`);
    } catch (err) {
      console.warn('Failed to update status on server:', err.message);
      showToast(`Failed to update status: ${err.message || 'Server error'}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const getStatusBadgeClass = (status = '') => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'status-delivered';
      case 'shipped':
        return 'status-shipped';
      case 'processing':
        return 'status-processing';
      case 'cancelled':
        return 'status-cancelled';
      case 'pending':
      default:
        return 'status-pending';
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === 'All' || (order.status || '').toLowerCase() === statusFilter.toLowerCase();
    
    const customerName = order.customer?.fullName || '';
    const customerEmail = order.customer?.email || '';
    const orderNum = order.orderId || order._id || '';
    
    const matchesSearch = 
      orderNum.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customerEmail.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const totalRevenue = orders.reduce((acc, curr) => acc + (Number(curr.total) || 0), 0);
  const pendingCount = orders.filter((o) => (o.status || '').toLowerCase() === 'pending').length;
  const deliveredCount = orders.filter((o) => (o.status || '').toLowerCase() === 'delivered').length;

  return (
    <div className="admin-orders-page">
      
      {/* 1. Header Section */}
      <div className="orders-header-row">
        <div>
          <div className="breadcrumb-nav">
            <span className="breadcrumb-item">Admin</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Orders</span>
          </div>
          <h1 className="orders-main-title">Order Management</h1>
          <p className="orders-main-subtitle">
            Track customer purchases, update fulfillment statuses, and inspect shipping information.
          </p>
        </div>

        <div className="header-actions">
          <button 
            type="button" 
            className="btn-secondary refresh-btn"
            onClick={() => fetchOrders(true)}
            disabled={isRefreshing}
            title="Refresh from MongoDB"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isRefreshing ? 'spinning' : ''}>
              <polyline points="23 4 23 10 17 10"></polyline>
              <polyline points="1 20 1 14 7 14"></polyline>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <span>{isRefreshing ? 'Syncing...' : 'Sync Live Orders'}</span>
          </button>
        </div>
      </div>

      {/* Error banner if database query fails */}
      {error && (
        <div className="orders-error-banner" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', padding: '12px 16px', borderRadius: '8px', fontSize: '0.88rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={() => fetchOrders(true)}>Retry</button>
        </div>
      )}

      {/* 2. Key Metrics Summary Cards */}
      <div className="orders-kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon-box kpi-orders">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <path d="M16 10a4 4 0 0 1-8 0"></path>
            </svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Total Orders</span>
            <span className="kpi-value">{orders.length}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-pending">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Pending Fulfillment</span>
            <span className="kpi-value">{pendingCount}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-delivered">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Delivered Orders</span>
            <span className="kpi-value">{deliveredCount}</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon-box kpi-revenue">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Gross Revenue</span>
            <span className="kpi-value">₹{totalRevenue.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* 3. Filter and Control Bar */}
      <div className="orders-control-bar">
        
        {/* Status Filter Tabs */}
        <div className="status-tabs">
          <button 
            className={`status-tab ${statusFilter === 'All' ? 'active' : ''}`}
            onClick={() => setStatusFilter('All')}
          >
            All Orders ({orders.length})
          </button>
          {STATUS_OPTIONS.map((status) => {
            const count = orders.filter((o) => (o.status || '').toLowerCase() === status.toLowerCase()).length;
            return (
              <button
                key={status}
                className={`status-tab ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {status} ({count})
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div className="orders-search-wrapper">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            type="text"
            placeholder="Search order ID, customer, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="orders-search-input"
          />
          {searchQuery && (
            <button className="clear-btn" onClick={() => setSearchQuery('')}>✕</button>
          )}
        </div>

      </div>

      {/* 4. Orders Table Section */}
      <div className="orders-table-wrapper">
        <table className="orders-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Date</th>
              <th>Items</th>
              <th>Total</th>
              <th>Current Status</th>
              <th>Change Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="table-empty-cell">
                  <div className="loading-spinner-row">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="spinning">
                      <line x1="12" y1="2" x2="12" y2="6"></line>
                      <line x1="12" y1="18" x2="12" y2="22"></line>
                      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                      <line x1="2" y1="12" x2="6" y2="12"></line>
                      <line x1="18" y1="12" x2="22" y2="12"></line>
                      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                    </svg>
                    <span>Loading customer orders from MongoDB...</span>
                  </div>
                </td>
              </tr>
            ) : filteredOrders.length > 0 ? (
              filteredOrders.map((order) => {
                const orderIdentifier = order.orderId || (order._id ? `AUR-${order._id.slice(-6).toUpperCase()}` : 'AUR-ORD');
                const targetDbId = order._id || order.orderId;
                const isUpdating = updatingOrderId === targetDbId;
                const dateString = order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'Just now';

                return (
                  <tr key={order._id || order.orderId}>
                    {/* Order ID */}
                    <td className="order-id-cell">
                      <span className="order-id-badge">{orderIdentifier}</span>
                    </td>

                    {/* Customer */}
                    <td className="customer-cell">
                      <span className="customer-name">{order.customer?.fullName || 'Guest Customer'}</span>
                      <span className="customer-email">{order.customer?.email || '—'}</span>
                    </td>

                    {/* Date */}
                    <td className="date-cell">
                      <span>{dateString}</span>
                    </td>

                    {/* Items count */}
                    <td className="items-cell">
                      <span className="items-count-tag">
                        {Array.isArray(order.items) ? `${order.items.reduce((s, i) => s + (i.quantity || 1), 0)} items` : '1 item'}
                      </span>
                    </td>

                    {/* Total Amount */}
                    <td className="total-cell">
                      <strong>₹{Number(order.total || 0).toLocaleString('en-IN')}</strong>
                    </td>

                    {/* Current Status Badge */}
                    <td>
                      <span className={`order-status-badge ${getStatusBadgeClass(order.status)}`}>
                        <span className="status-indicator-dot"></span>
                        {order.status || 'Pending'}
                      </span>
                    </td>

                    {/* Change Status Dropdown */}
                    <td className="change-status-cell">
                      <div className="status-select-wrapper">
                        <select
                          className="status-dropdown-select"
                          value={order.status || 'Pending'}
                          onChange={(e) => handleUpdateStatus(targetDbId, e.target.value)}
                          disabled={isUpdating}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        {isUpdating && (
                          <span className="updating-spinner" title="Saving status to MongoDB...">⟳</span>
                        )}
                      </div>
                    </td>

                    {/* Actions: View Details Modal */}
                    <td>
                      <button
                        type="button"
                        className="btn-action-view"
                        onClick={() => setSelectedOrder(order)}
                        title="View order details and items"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan="8" className="table-empty-cell">
                  <div className="empty-orders-state">
                    <p>{error ? 'Unable to load orders from database.' : 'No customer orders found in MongoDB.'}</p>
                    {error ? (
                      <button 
                        className="btn-secondary btn-sm"
                        onClick={() => fetchOrders(true)}
                      >
                        Retry
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              <tr>
                <td colSpan="8" className="table-empty-cell">
                  <div className="empty-orders-state">
                    <p>No customer orders match the selected filters or search query.</p>
                    <button 
                      className="btn-secondary btn-sm"
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('All');
                      }}
                    >
                      Clear Filters
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Detailed Order Inspection Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="order-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="modal-eyebrow">ORDER INSPECTION</span>
                <h2 className="modal-title">
                  {selectedOrder.orderId || selectedOrder._id}
                </h2>
              </div>
              <button 
                type="button" 
                className="modal-close-btn"
                onClick={() => setSelectedOrder(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* Customer and Shipping Details */}
              <div className="modal-grid-two">
                <div className="modal-info-box">
                  <h3 className="box-title">Customer Information</h3>
                  <p><strong>Name:</strong> {selectedOrder.customer?.fullName}</p>
                  <p><strong>Email:</strong> {selectedOrder.customer?.email}</p>
                  <p><strong>Phone:</strong> {selectedOrder.customer?.phone || 'Not provided'}</p>
                </div>

                <div className="modal-info-box">
                  <h3 className="box-title">Shipping Address</h3>
                  <p>{selectedOrder.shippingAddress?.address}</p>
                  <p>{selectedOrder.shippingAddress?.city}, {selectedOrder.shippingAddress?.state} - {selectedOrder.shippingAddress?.pinCode}</p>
                  <p><strong>Payment:</strong> {selectedOrder.paymentMethod || 'COD'}</p>
                </div>
              </div>

              {/* Items List */}
              <div className="modal-items-section">
                <h3 className="box-title">Order Items ({selectedOrder.items?.length || 0})</h3>
                <div className="modal-items-list">
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div key={idx} className="modal-item-row">
                      {item.image && (
                        <img 
                          src={normalizeProductImageUrl(item.image)} 
                          alt={item.name} 
                          className="modal-item-thumb" 
                          onError={handleImageError} 
                        />
                      )}
                      <div className="modal-item-info">
                        <span className="modal-item-name">{item.name}</span>
                        <span className="modal-item-meta">Size: {item.size || item.selectedSize || 'Standard'}{(item.color || item.colorName) ? ` • Colour: ${item.colorName || item.color}` : ''} • Qty: {item.quantity || 1}</span>
                      </div>
                      <span className="modal-item-price">
                        ₹{(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div className="modal-summary-row">
                <div>
                  <span className="summary-label">Order Status:</span>
                  <span className={`order-status-badge ${getStatusBadgeClass(selectedOrder.status)}`}>
                    {selectedOrder.status || 'Pending'}
                  </span>
                </div>
                <div className="total-number-box">
                  <span>Grand Total:</span>
                  <strong>₹{Number(selectedOrder.total || 0).toLocaleString('en-IN')}</strong>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setSelectedOrder(null)}
              >
                Close Inspection
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
