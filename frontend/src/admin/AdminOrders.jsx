import React, { useState, useEffect } from 'react';
import './AdminOrders.css';

/**
 * Fallback sample order data (used if backend is unavailable or MongoDB has no orders yet)
 */
const MOCK_FALLBACK_ORDERS = [];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isUsingLiveDb, setIsUsingLiveDb] = useState(false);

  // Status options requested
  const STATUS_OPTIONS = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];

  /**
   * Helper to display a temporary notification
   */
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3500);
  };

  /**
   * 1. GET /api/orders
   * MERN Explanation:
   * This function sends a GET request to our Express backend.
   * The backend queries MongoDB using Mongoose (Order.find().sort({ createdAt: -1 }))
   * and sends back an array of order objects as JSON.
   */
  const fetchOrders = async (showRefreshAnimation = false) => {
    if (showRefreshAnimation) setIsRefreshing(true);
    setError('');

    try {
      const response = await fetch('http://localhost:5000/api/orders');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Check if backend returned orders from MongoDB
      if (Array.isArray(data) && data.length > 0) {
        setOrders(data);
        setIsUsingLiveDb(true);
      } else {
        // If MongoDB collection is empty yet, fallback to mock data
        setOrders([]);
        setIsUsingLiveDb(false);
      }
    } catch (err) {
      console.warn('Backend unavailable or fetch failed, falling back to mock orders:', err);
      setError('Could not connect to live backend or fetch orders from database.');
      setOrders([]);
      setIsUsingLiveDb(false);
    } finally {
      setLoading(false);
      if (showRefreshAnimation) setIsRefreshing(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchOrders();
  }, []);

  const updateOrderDetails = async (order, payload) => {
    const targetId = order._id || order.orderId;
    setUpdatingOrderId(targetId);

    try {
      const response = await fetch(`http://localhost:5000/api/orders/${targetId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update order');
      }

      showToast(`Order ${order.orderId || targetId} updated successfully`);

      if (selectedOrder && (selectedOrder._id === targetId || selectedOrder.orderId === targetId)) {
        setSelectedOrder((prev) => ({ ...prev, ...payload }));
      }

      await fetchOrders(false);
    } catch (err) {
      console.error('Error updating order:', err);
      showToast(`Error: ${err.message}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleStatusChange = async (order, newStatus) => {
    if (order.status === newStatus) return;
    await updateOrderDetails(order, { status: newStatus });
  };




  // Filter orders by search and status
  const filteredOrders = orders.filter((order) => {
    const orderId = (order.orderId || '').toLowerCase();
    const customerName = (order.customer?.fullName || '').toLowerCase();
    const customerEmail = (order.customer?.email || '').toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch =
      orderId.includes(query) ||
      customerName.includes(query) ||
      customerEmail.includes(query);

    const matchesStatus =
      statusFilter === 'All' ||
      (order.status || '').toLowerCase() === statusFilter.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Calculate quick metrics for KPI cards
  const totalOrdersCount = orders.length;
  const pendingCount = orders.filter((o) => o.status === 'Pending').length;
  const processingCount = orders.filter((o) => o.status === 'Processing').length;
  const shippedCount = orders.filter((o) => o.status === 'Shipped').length;
  const deliveredCount = orders.filter((o) => o.status === 'Delivered').length;

  /**
   * Format dates cleanly for luxury UI
   */
  const formatOrderDate = (dateVal) => {
    if (!dateVal) return 'N/A';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return dateVal;
      return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return String(dateVal);
    }
  };

  const getStatusClass = (status = '') => {
    const s = status.toLowerCase();
    switch (s) {
      case 'delivered':
        return 'status-delivered';
      case 'processing':
        return 'status-processing';
      case 'shipped':
        return 'status-shipped';
      case 'cancelled':
        return 'status-cancelled';
      case 'pending':
      default:
        return 'status-pending';
    }
  };

  return (
    <div className="admin-orders-page">
      
      {/* 1. Page Header */}
      <div className="orders-page-header">
        <div>
          <div className="breadcrumb-nav">
            <span>Admin</span>
            <span className="breadcrumb-separator">/</span>
            <span className="breadcrumb-current">Orders</span>
          </div>
          <h2 className="products-main-title">Customer Orders</h2>
          <p className="products-main-subtitle">
            Manage customer purchases, update fulfillment statuses, and view live MongoDB orders.
          </p>
        </div>

        <div className="orders-header-actions">
          <button 
            className="orders-refresh-btn" 
            onClick={() => fetchOrders(true)} 
            disabled={isRefreshing}
            title="Fetch latest orders from MongoDB"
          >
            <svg 
              className={isRefreshing ? 'spinning' : ''} 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path d="M23 4v6h-6"></path>
              <path d="M1 20v-6h6"></path>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
            </svg>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh Orders'}</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Metrics Bar */}
      <div className="orders-kpi-grid">
        <div className="orders-kpi-card">
          <div className="kpi-text-box">
            <span className="kpi-title">Total Orders</span>
            <span className="kpi-val">{totalOrdersCount}</span>
          </div>
          <span className="kpi-indicator-dot" style={{ backgroundColor: '#273425' }}></span>
        </div>

        <div className="orders-kpi-card">
          <div className="kpi-text-box">
            <span className="kpi-title">Pending</span>
            <span className="kpi-val">{pendingCount}</span>
          </div>
          <span className="kpi-indicator-dot pending"></span>
        </div>

        <div className="orders-kpi-card">
          <div className="kpi-text-box">
            <span className="kpi-title">Processing</span>
            <span className="kpi-val">{processingCount}</span>
          </div>
          <span className="kpi-indicator-dot processing"></span>
        </div>

        <div className="orders-kpi-card">
          <div className="kpi-text-box">
            <span className="kpi-title">Shipped</span>
            <span className="kpi-val">{shippedCount}</span>
          </div>
          <span className="kpi-indicator-dot shipped"></span>
        </div>

        <div className="orders-kpi-card">
          <div className="kpi-text-box">
            <span className="kpi-title">Delivered</span>
            <span className="kpi-val">{deliveredCount}</span>
          </div>
          <span className="kpi-indicator-dot delivered"></span>
        </div>
      </div>

      {/* 3. Toolbar: Search & Status Filter Tabs */}
      <div className="orders-toolbar-card">
        
        {/* Search by Order ID, Name, or Email */}
        <div className="orders-search-box">
          <svg className="orders-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text"
            className="orders-search-input"
            placeholder="Search by Order ID, Customer, or Email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="orders-status-filters">
          {['All', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((tab) => (
            <button
              key={tab}
              className={`status-filter-tab ${statusFilter === tab ? 'active' : ''}`}
              onClick={() => setStatusFilter(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

      </div>

      {/* 4. Orders Data Table */}
      <div className="orders-table-card">
        
        <div className="orders-table-header-info">
          <span className="orders-count-text">
            Showing <strong>{filteredOrders.length}</strong> of {orders.length} orders
          </span>

          <span className="orders-live-indicator">
            <span className="live-pulse-dot"></span>
            {isUsingLiveDb ? 'Live MongoDB Connected' : 'Sample / Fallback Data'}
          </span>
        </div>

        {loading ? (
          <div className="orders-loading-state">
            <div className="orders-loading-spinner"></div>
            <p>Loading orders from database...</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="orders-empty-state">
            <span className="orders-empty-icon">📦</span>
            <h3 className="orders-empty-title">No orders found</h3>
            <p className="orders-empty-text">
              {searchQuery || statusFilter !== 'All' 
                ? 'Try adjusting your search query or status filter.'
                : 'Place an order through the customer checkout to see live records appear here!'}
            </p>
            {(searchQuery || statusFilter !== 'All') && (
              <button 
                className="btn-secondary" 
                onClick={() => { setSearchQuery(''); setStatusFilter('All'); }}
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="orders-table-responsive">
            <table className="orders-data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer Name</th>
                  <th>Date</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const targetId = order._id || order.orderId;
                  const isUpdatingThis = updatingOrderId === targetId;
                  const itemsCount = (order.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);

                  return (
                    <tr key={targetId} className={isUpdatingThis ? 'row-updating' : ''}>
                      
                      {/* 1. Order ID */}
                      <td className="cell-order-id">
                        <strong>{order.orderId || `#${String(targetId).slice(-6)}`}</strong>
                        {order._id && order.orderId && (
                          <span className="order-mongo-id-sub">ID: {String(order._id).slice(-6)}</span>
                        )}
                      </td>

                      {/* 2. Customer Name */}
                      <td className="cell-customer-info">
                        <span className="cell-customer-name">
                          {order.customer?.fullName || 'Guest Customer'}
                        </span>
                        <span className="cell-customer-contact">
                          {order.customer?.email} {order.customer?.phone ? `• ${order.customer.phone}` : ''}
                        </span>
                      </td>

                      {/* 3. Date */}
                      <td className="cell-date-time">
                        {formatOrderDate(order.createdAt || order.date)}
                      </td>

                      {/* 4. Number of Items & Thumbnails */}
                      <td>
                        <div className="cell-items-summary">
                          <div className="items-preview-stack">
                            {(order.items || []).slice(0, 3).map((item, idx) => (
                              <img 
                                key={idx}
                                src={item.image || 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=100&q=80'} 
                                alt={item.name} 
                                className="items-preview-thumb"
                                title={`${item.name} (${item.size || 'M'})`}
                              />
                            ))}
                          </div>
                          <span className="items-count-tag">
                            {itemsCount} {itemsCount === 1 ? 'item' : 'items'}
                          </span>
                        </div>
                      </td>

                      {/* 5. Total */}
                      <td className="cell-order-total">
                        ₹{(Number(order.total) || 0).toLocaleString('en-IN')}
                      </td>

                      {/* 6. Status Dropdown (PUT /api/orders/:id/status) */}
                      <td>
                        <div className="status-select-wrapper">
                          <select
                            className={`status-dropdown-select ${getStatusClass(order.status)}`}
                            value={order.status || 'Pending'}
                            onChange={(e) => handleStatusChange(order, e.target.value)}
                            disabled={isUpdatingThis}
                            title="Change order status (saves directly to MongoDB)"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                          <span className="status-chevron-icon">▼</span>
                        </div>
                      </td>

                      {/* 7. Action Button */}
                      <td>
                        <div className="orders-cell-actions">
                          <button
                            className="order-view-btn"
                            onClick={() => setSelectedOrder(order)}
                          >
                            Details
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

      {/* 5. Order Details Modal */}
      {selectedOrder && (
        <div className="order-modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="order-modal-card" onClick={(e) => e.stopPropagation()}>
            
            <div className="order-modal-header">
              <div className="modal-header-title-box">
                <h3 className="modal-title">Order Details</h3>
                <span className={`status-badge ${getStatusClass(selectedOrder.status)}`}>
                  {selectedOrder.status}
                </span>
              </div>
              <button 
                className="modal-close-btn" 
                onClick={() => setSelectedOrder(null)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="order-modal-body">
              
              {/* Order Reference */}
              <div className="modal-customer-grid">
                <div className="modal-info-block">
                  <span>Order Number</span>
                  <strong>{selectedOrder.orderId}</strong>
                </div>
                <div className="modal-info-block">
                  <span>Date Placed</span>
                  <strong>{formatOrderDate(selectedOrder.createdAt || selectedOrder.date)}</strong>
                </div>
                <div className="modal-info-block">
                  <span>Customer Name</span>
                  <strong>{selectedOrder.customer?.fullName}</strong>
                </div>
                <div className="modal-info-block">
                  <span>Contact Email / Phone</span>
                  <strong>{selectedOrder.customer?.email} • {selectedOrder.customer?.phone}</strong>
                </div>
              </div>

              {/* Shipping Address & Tracking Info */}
              <div>
                <h4 className="modal-section-title">Shipping & Tracking Information</h4>
                <div className="modal-customer-grid">
                  <div className="modal-info-block" style={{ gridColumn: 'span 2' }}>
                    <span>Delivery Address</span>
                    <strong>
                      {selectedOrder.shippingAddress?.address || selectedOrder.address?.address}, {' '}
                      {selectedOrder.shippingAddress?.city || selectedOrder.address?.city}, {' '}
                      {selectedOrder.shippingAddress?.state || selectedOrder.address?.state} – {' '}
                      {selectedOrder.shippingAddress?.pinCode || selectedOrder.shippingAddress?.pincode || selectedOrder.address?.pincode}
                    </strong>
                  </div>
                  
                  <div className="modal-info-block" style={{ gridColumn: 'span 2', marginTop: '1rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '12px', color: '#666' }}>Courier Name</span>
                        <input 
                          type="text"
                          defaultValue={selectedOrder.courierName || ''}
                          placeholder="e.g. BlueDart"
                          id="courierInput"
                          style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '12px', color: '#666' }}>Tracking Number</span>
                        <input 
                          type="text"
                          defaultValue={selectedOrder.trackingNumber || ''}
                          placeholder="e.g. 1234567890"
                          id="trackingInput"
                          style={{ width: '100%', padding: '0.5rem', marginTop: '0.25rem', border: '1px solid #ddd', borderRadius: '4px' }}
                        />
                      </div>
                      <div style={{ marginTop: '1.2rem' }}>
                        <button 
                          className="btn-primary"
                          style={{ padding: '0.5rem 1rem', fontSize: '13px' }}
                          onClick={() => {
                            const c = document.getElementById('courierInput').value;
                            const t = document.getElementById('trackingInput').value;
                            updateOrderDetails(selectedOrder, { status: selectedOrder.status, courierName: c, trackingNumber: t });
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div>
                <h4 className="modal-section-title">Purchased Items ({selectedOrder.items?.length || 0})</h4>
                <div className="modal-items-list">
                  {(selectedOrder.items || []).map((item, idx) => (
                    <div key={idx} className="modal-item-row">
                      <div className="modal-item-left">
                        {item.image && (
                          <img src={item.image} alt={item.name} className="modal-item-thumb" />
                        )}
                        <div>
                          <span className="modal-item-name">{item.name}</span>
                          <span className="modal-item-sub">
                            Size: {item.size || 'M'} • Quantity: {item.quantity || 1}
                          </span>
                        </div>
                      </div>
                      <span className="modal-item-price">
                        ₹{((Number(item.price) || 0) * (item.quantity || 1)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Price Breakdown */}
              <div className="modal-financials-card">
                <div className="financial-line">
                  <span>Subtotal</span>
                  <span>₹{(Number(selectedOrder.subtotal) || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="financial-line">
                  <span>Shipping Fee</span>
                  <span>{selectedOrder.shipping === 0 ? 'FREE' : `₹${selectedOrder.shipping}`}</span>
                </div>
                <div className="financial-line total">
                  <span>Total Amount</span>
                  <span>₹{(Number(selectedOrder.total) || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>

            </div>

            {/* Modal Footer with quick status change */}
            <div className="order-modal-footer">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '0.82rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>
                  Change Status:
                </span>
                <select
                  className={`status-dropdown-select ${getStatusClass(selectedOrder.status)}`}
                  value={selectedOrder.status || 'Pending'}
                  onChange={(e) => handleStatusChange(selectedOrder, e.target.value)}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <button className="btn-secondary" onClick={() => setSelectedOrder(null)}>
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Floating Success Toast */}
      {toastMessage && (
        <div className="orders-toast-notification">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}
