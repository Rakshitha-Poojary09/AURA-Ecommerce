import React, { useState, useEffect } from 'react';
import './AdminReturns.css';
import { adminFetch } from '../utils/apiClient';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';

export default function AdminReturns() {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    requested: 0,
    approved: 0,
    inTransit: 0,
    receivedAndInspected: 0,
    completed: 0,
    rejected: 0,
    cancelled: 0,
    returnsCount: 0,
    exchangesCount: 0,
    pendingRefundsCount: 0,
    completedRefundsCount: 0
  });

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [refundFilter, setRefundFilter] = useState('All');

  // Detail inspection modal
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [actionNotes, setActionNotes] = useState('');
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null); // { title, message, onConfirm }
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  // Fetch admin stats and list
  const fetchReturnsData = async (options = {}) => {
    const {
      overrideSearch,
      overrideType,
      overrideStatus,
      overrideRefund,
      isManual = false
    } = typeof options === 'boolean' ? { isManual: options } : options;

    if (isManual) setIsRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const activeSearch = overrideSearch !== undefined ? overrideSearch : searchQuery;
      const activeType = overrideType !== undefined ? overrideType : typeFilter;
      const activeStatus = overrideStatus !== undefined ? overrideStatus : statusFilter;
      const activeRefund = overrideRefund !== undefined ? overrideRefund : refundFilter;

      const queryParams = new URLSearchParams();
      if (activeType !== 'All') queryParams.append('type', activeType);
      if (activeStatus !== 'All') queryParams.append('status', activeStatus);
      if (activeRefund !== 'All') queryParams.append('refundStatus', activeRefund);
      if (activeSearch.trim()) queryParams.append('search', activeSearch.trim());

      const [statsRes, listRes] = await Promise.all([
        adminFetch('/api/returns/admin/stats'),
        adminFetch(`/api/returns/admin?${queryParams.toString()}`)
      ]);

      const statsContentType = statsRes.headers.get('content-type') || '';
      const listContentType = listRes.headers.get('content-type') || '';

      if (!statsRes.ok || !listRes.ok || !statsContentType.includes('application/json') || !listContentType.includes('application/json')) {
        throw new Error('Failed to retrieve return and exchange data from database. Non-JSON response received.');
      }

      const statsData = await statsRes.json();
      const listData = await listRes.json();

      setStats(statsData || {});
      const reqList = Array.isArray(listData)
        ? listData
        : (Array.isArray(listData?.requests) ? listData.requests : []);
      setRequests(reqList);

      // If a modal is open, refresh its data
      if (selectedRequest) {
        const updated = reqList.find((r) => r.requestId === selectedRequest.requestId);
        if (updated) setSelectedRequest(updated);
      }
    } catch (err) {
      console.error('Error fetching admin returns:', err);
      setError('Unable to connect to database or fetch return requests.');
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReturnsData();
  }, [typeFilter, statusFilter, refundFilter]);

  // Handle search submission
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchReturnsData();
  };

  const handleResetAllFilters = () => {
    setSearchQuery('');
    setTypeFilter('All');
    setStatusFilter('All');
    setRefundFilter('All');
    fetchReturnsData({
      overrideSearch: '',
      overrideType: 'All',
      overrideStatus: 'All',
      overrideRefund: 'All'
    });
  };

  // Status transition handler
  const handleStatusUpdate = async (newStatus) => {
    if (!selectedRequest) return;

    let confirmPrompt = `Are you sure you want to transition Request #${selectedRequest.requestId} to "${newStatus}"?`;
    if (newStatus === 'Received and Inspected' && selectedRequest.requestType === 'Return' && !selectedRequest.stockRestored) {
      confirmPrompt = `Marking this returned item as "Received and Inspected" will safely restore the garment units to live inventory stock. Proceed?`;
    } else if (newStatus === 'Approved' && selectedRequest.requestType === 'Exchange' && !selectedRequest.exchangeStockDeducted) {
      confirmPrompt = `Approving this exchange will reserve and deduct replacement garment units from inventory. Proceed?`;
    }

    setConfirmModal({
      title: `Confirm Status Transition`,
      message: confirmPrompt,
      error: null,
      onConfirm: async () => {
        setIsActionSubmitting(true);
        setConfirmModal((prev) => (prev ? { ...prev, error: null } : null));

        try {
          const reqId = selectedRequest.requestId;
          const encodedId = encodeURIComponent(reqId);
          const res = await adminFetch(`/api/returns/admin/${encodedId}/status`, {
            method: 'PATCH',
            body: JSON.stringify({
              requestId: reqId,
              returnRequestId: selectedRequest._id,
              status: newStatus,
              adminNotes: actionNotes.trim()
            })
          });

          // Check response content type before attempting to parse JSON
          const contentType = res.headers.get('content-type') || '';
          let data = null;
          if (contentType.includes('application/json')) {
            try {
              data = await res.json();
            } catch (jsonErr) {
              console.error('Failed to parse JSON body from status endpoint:', jsonErr);
            }
          } else {
            const rawText = await res.text();
            console.error('Received non-JSON response from status endpoint:', rawText.slice(0, 300));
          }

          if (!res.ok || !data) {
            const errorMessage =
              data?.message ||
              data?.error ||
              (res.status === 404
                ? `Endpoint or Request #${reqId} not found on server (HTTP 404).`
                : `Status update failed with HTTP ${res.status} (${res.statusText || 'Error'}).`);
            throw new Error(errorMessage);
          }

          // Update UI and audit history ONLY after backend confirms the change
          showToast(`Request #${selectedRequest.requestId} updated to ${newStatus} ✨`);
          setSelectedRequest(data.request);
          setActionNotes('');
          setConfirmModal(null);
          await fetchReturnsData();
        } catch (err) {
          const errorMsg = err.message || 'Error updating request status.';
          setConfirmModal((prev) => (prev ? { ...prev, error: errorMsg } : null));
          showToast(`⚠️ ${errorMsg}`);
        } finally {
          setIsActionSubmitting(false);
        }
      }
    });
  };

  // Refund status update handler
  const handleRefundUpdate = async (newRefundStatus) => {
    if (!selectedRequest) return;

    setConfirmModal({
      title: 'Confirm Refund Processing',
      message: `Marking refund as "${newRefundStatus}" confirms that financial adjustment of ₹${Number(selectedRequest.refundAmount || 0).toLocaleString('en-IN')} has been authorized or settled. Proceed?`,
      error: null,
      onConfirm: async () => {
        setIsActionSubmitting(true);
        setConfirmModal((prev) => (prev ? { ...prev, error: null } : null));

        try {
          const reqId = selectedRequest.requestId;
          const encodedId = encodeURIComponent(reqId);
          const res = await adminFetch(`/api/returns/admin/${encodedId}/refund`, {
            method: 'PATCH',
            body: JSON.stringify({
              requestId: reqId,
              returnRequestId: selectedRequest._id,
              refundStatus: newRefundStatus,
              adminNotes: actionNotes.trim()
            })
          });

          // Check response content type before attempting to parse JSON
          const contentType = res.headers.get('content-type') || '';
          let data = null;
          if (contentType.includes('application/json')) {
            try {
              data = await res.json();
            } catch (jsonErr) {
              console.error('Failed to parse JSON body from refund endpoint:', jsonErr);
            }
          } else {
            const rawText = await res.text();
            console.error('Received non-JSON response from refund endpoint:', rawText.slice(0, 300));
          }

          if (!res.ok || !data) {
            const errorMessage =
              data?.message ||
              data?.error ||
              (res.status === 404
                ? `Endpoint or Request #${reqId} not found on server (HTTP 404).`
                : `Refund update failed with HTTP ${res.status} (${res.statusText || 'Error'}).`);
            throw new Error(errorMessage);
          }

          // Update UI and audit history ONLY after backend confirms the change
          showToast(`Refund status for #${selectedRequest.requestId} marked as ${newRefundStatus}!`);
          setSelectedRequest(data.request);
          setActionNotes('');
          setConfirmModal(null);
          await fetchReturnsData();
        } catch (err) {
          const errorMsg = err.message || 'Error updating refund status.';
          setConfirmModal((prev) => (prev ? { ...prev, error: errorMsg } : null));
          showToast(`⚠️ ${errorMsg}`);
        } finally {
          setIsActionSubmitting(false);
        }
      }
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="admin-returns-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="admin-toast-banner" role="status">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="admin-returns-header">
        <div>
          <span className="returns-eyebrow">POST-PURCHASE LOGISTICS</span>
          <h1 className="returns-title">Returns & Exchanges</h1>
          <p className="returns-subtitle">
            Manage customer return requests, garment quality inspections, size replacements, and verified refund approvals.
          </p>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-secondary refresh-btn"
            onClick={() => fetchReturnsData(true)}
            disabled={isRefreshing}
            title="Refresh database records"
          >
            <span className={isRefreshing ? 'spin' : ''}>🔄</span>
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards (From MongoDB) */}
      <div className="returns-kpi-grid">
        <div
          className={`kpi-card ${statusFilter === 'All' && refundFilter === 'All' ? 'active-filter' : ''}`}
          onClick={() => {
            setStatusFilter('All');
            setRefundFilter('All');
          }}
          role="button"
          tabIndex={0}
          title="Show all requests"
        >
          <span className="kpi-label">Total Requests</span>
          <strong className="kpi-value">{stats.total || 0}</strong>
          <span className="kpi-subtext">{stats.returnsCount || 0} Returns • {stats.exchangesCount || 0} Exchanges</span>
        </div>

        <div
          className={`kpi-card alert ${statusFilter === 'Requested' ? 'active-filter' : ''}`}
          onClick={() => {
            setStatusFilter('Requested');
            setRefundFilter('All');
          }}
          role="button"
          tabIndex={0}
          title="Filter by Pending Verification"
        >
          <span className="kpi-label">Pending Verification</span>
          <strong className="kpi-value alert">{stats.requested || 0}</strong>
          <span className="kpi-subtext">Awaiting admin review</span>
        </div>

        <div
          className={`kpi-card info ${statusFilter === 'Approved' ? 'active-filter' : ''}`}
          onClick={() => {
            setStatusFilter('Approved');
            setRefundFilter('All');
          }}
          role="button"
          tabIndex={0}
          title="Filter by Approved"
        >
          <span className="kpi-label">Approved & In Transit</span>
          <strong className="kpi-value info">{(stats.approved || 0) + (stats.inTransit || 0)}</strong>
          <span className="kpi-subtext">{stats.inTransit || 0} with courier</span>
        </div>

        <div
          className={`kpi-card purple ${statusFilter === 'Received and Inspected' ? 'active-filter' : ''}`}
          onClick={() => {
            setStatusFilter('Received and Inspected');
            setRefundFilter('All');
          }}
          role="button"
          tabIndex={0}
          title="Filter by Received & Inspected"
        >
          <span className="kpi-label">Received & Inspected</span>
          <strong className="kpi-value purple">{stats.receivedAndInspected ?? stats.received ?? 0}</strong>
          <span className="kpi-subtext">Restocked & ready</span>
        </div>

        <div
          className={`kpi-card success ${statusFilter === 'Completed' ? 'active-filter' : ''}`}
          onClick={() => {
            setStatusFilter('Completed');
            setRefundFilter('All');
          }}
          role="button"
          tabIndex={0}
          title="Filter by Completed"
        >
          <span className="kpi-label">Completed</span>
          <strong className="kpi-value success">{stats.completed || 0}</strong>
          <span className="kpi-subtext">{stats.completedRefundsCount ?? stats.completedRefunds ?? 0} refunded</span>
        </div>

        <div
          className={`kpi-card warning ${refundFilter === 'Pending' ? 'active-filter' : ''}`}
          onClick={() => {
            setRefundFilter('Pending');
            setStatusFilter('All');
          }}
          role="button"
          tabIndex={0}
          title="Filter by Refunds Pending"
        >
          <span className="kpi-label">Refunds Pending</span>
          <strong className="kpi-value warning">{stats.pendingRefundsCount ?? stats.pendingRefunds ?? 0}</strong>
          <span className="kpi-subtext">Pending financial confirmation</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="returns-filter-bar">
        <form onSubmit={handleSearchSubmit} className="search-form-control" role="search">
          <label htmlFor="returns-search-input" className="filter-label">Search Requests</label>
          <div className="search-input-wrapper">
            <span className="search-icon" aria-hidden="true">🔍</span>
            <input
              id="returns-search-input"
              name="search"
              type="text"
              placeholder="Search by Request #, Order #, or Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              aria-label="Search requests by reference ID, order number, or customer name"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-inline-clear-btn"
                onClick={() => {
                  setSearchQuery('');
                  fetchReturnsData({ overrideSearch: '' });
                }}
                title="Clear search text"
                aria-label="Clear search text"
              >
                ✕
              </button>
            )}
            <button type="submit" className="search-submit-btn">
              Search
            </button>
          </div>
        </form>

        <div className="filter-controls-group">
          {/* Type Filter */}
          <div className="filter-select-control">
            <label htmlFor="returns-type-filter" className="filter-label">Request Type</label>
            <select
              id="returns-type-filter"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="filter-select"
            >
              <option value="All">All Types</option>
              <option value="Return">Returns Only</option>
              <option value="Exchange">Exchanges Only</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="filter-select-control">
            <label htmlFor="returns-status-filter" className="filter-label">Workflow Status</label>
            <select
              id="returns-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-select"
            >
              <option value="All">All Statuses</option>
              <option value="Requested">Pending Verification</option>
              <option value="Approved">Approved</option>
              <option value="In Transit">In Transit</option>
              <option value="Received and Inspected">Received & Inspected</option>
              <option value="Completed">Completed</option>
              <option value="Rejected">Rejected</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Refund Status Filter */}
          <div className="filter-select-control">
            <label htmlFor="returns-refund-filter" className="filter-label">Refund Status</label>
            <select
              id="returns-refund-filter"
              value={refundFilter}
              onChange={(e) => setRefundFilter(e.target.value)}
              className="filter-select"
            >
              <option value="All">All Refunds</option>
              <option value="Pending">Pending Refund</option>
              <option value="Completed">Completed Refund</option>
              <option value="None">None (Exchanges)</option>
              <option value="N/A">Not Applicable</option>
            </select>
          </div>

          {/* Reset All Filters Button */}
          {(searchQuery || typeFilter !== 'All' || statusFilter !== 'All' || refundFilter !== 'All') && (
            <div className="filter-reset-control">
              <label className="filter-label">&nbsp;</label>
              <button
                type="button"
                className="btn-reset-filters"
                onClick={handleResetAllFilters}
                title="Reset all filters and search query"
              >
                ✕ Reset All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Table View */}
      {loading ? (
        <div className="returns-loading-box">
          <div className="admin-spinner" />
          <p>Loading returns and exchanges from MongoDB...</p>
        </div>
      ) : error ? (
        <div className="returns-error-banner" role="alert">
          <span>⚠️ {error}</span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => fetchReturnsData()}
            style={{ marginTop: '0.75rem' }}
          >
            Retry Connection
          </button>
        </div>
      ) : requests.length === 0 ? (
        <div className="returns-empty-box">
          <div className="empty-icon">📦</div>
          <h3>No Return or Exchange Requests Found</h3>
          <p>
            {searchQuery || typeFilter !== 'All' || statusFilter !== 'All' || refundFilter !== 'All'
              ? 'No requests match your current filters or search query.'
              : 'There are currently zero return or exchange requests logged in the database.'}
          </p>
          {(searchQuery || typeFilter !== 'All' || statusFilter !== 'All' || refundFilter !== 'All') && (
            <button
              type="button"
              className="btn-secondary empty-reset-btn"
              onClick={handleResetAllFilters}
            >
              Clear Filters & View All
            </button>
          )}
        </div>
      ) : (
        <div className="returns-table-wrapper">
          <table className="returns-data-table">
            <thead>
              <tr>
                <th>Request Reference</th>
                <th>Original Order</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Items & Quantities</th>
                <th>Financial / Replacement</th>
                <th>Workflow Status</th>
                <th>Refund</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req) => (
                <tr key={req._id || req.requestId} className="return-row">
                  <td className="ref-cell">
                    <strong>#{req.requestId}</strong>
                    <span className="row-date">{formatDate(req.createdAt)}</span>
                  </td>
                  <td className="order-cell">
                    <span className="order-code">#{req.orderId}</span>
                  </td>
                  <td className="cust-cell">
                    <strong className="cust-name">
                      {req.customer?.fullName || req.customer?.name || 'Patron'}
                    </strong>
                    <span className="cust-email">{req.customer?.email || 'N/A'}</span>
                    {req.customer?.phone && (
                      <span className="cust-phone">{req.customer.phone}</span>
                    )}
                    {req.customer?.isGuest && (
                      <span className="guest-badge">Guest Checkout</span>
                    )}
                  </td>
                  <td>
                    <span className={`type-tag ${req.requestType.toLowerCase()}`}>
                      {req.requestType === 'Exchange' ? '📏 Exchange' : '🔄 Return'}
                    </span>
                  </td>
                  <td className="items-cell">
                    <div className="items-condensed-list">
                      {(req.items || []).map((it, idx) => (
                        <div key={idx} className="item-condensed-row">
                          <span className="it-qty">{it.quantity}x</span>
                          <span className="it-name">{it.name}</span>
                          <span className="it-size">Size {it.size}</span>
                          {req.requestType === 'Exchange' && it.replacementSize && (
                            <span className="it-replacement">→ Size {it.replacementSize}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="fin-cell">
                    {req.requestType === 'Return' ? (
                      <div>
                        <strong className="refund-amount-text">
                          ₹{Number(req.refundAmount || 0).toLocaleString('en-IN')}
                        </strong>
                        <span className="fin-subtext">net calculated refund</span>
                      </div>
                    ) : (
                      <span className="exchange-fee-text">Complimentary (₹0)</span>
                    )}
                  </td>
                  <td>
                    <span className={`status-pill ${req.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {req.status}
                    </span>
                  </td>
                  <td>
                    <span className={`refund-pill ${(req.refundStatus || '').toLowerCase()}`}>
                      {req.refundStatus}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-inspect"
                      onClick={() => setSelectedRequest(req)}
                      title="Inspect full request details and update workflow"
                    >
                      Inspect →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* =========================================================================
         DETAIL INSPECTION MODAL
         ========================================================================= */}
      {selectedRequest && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedRequest(null)}>
          <div className="admin-modal-card" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="admin-modal-header">
              <div>
                <span className="modal-eyebrow">AURA AUDIT CONSOLE</span>
                <h2 className="modal-title">
                  {selectedRequest.requestType} Request #{selectedRequest.requestId}
                </h2>
                <span className="modal-subtitle">
                  Order #{selectedRequest.orderId} • Lodged on {formatDate(selectedRequest.createdAt)}
                </span>
              </div>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setSelectedRequest(null)}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="admin-modal-body">
              {/* Customer Info Card */}
              <div className="modal-info-section">
                <h4 className="section-title">Customer & Order Details</h4>
                <div className="customer-details-grid">
                  <div className="detail-item">
                    <span className="detail-label">Client Name:</span>
                    <strong>{selectedRequest.customer?.fullName || selectedRequest.customer?.name || 'Patron'}</strong>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Email:</span>
                    <strong>{selectedRequest.customer?.email || 'N/A'}</strong>
                  </div>
                  {selectedRequest.customer?.phone && (
                    <div className="detail-item">
                      <span className="detail-label">Phone:</span>
                      <strong>{selectedRequest.customer.phone}</strong>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">Account Type:</span>
                    <span>{selectedRequest.customer?.isGuest ? 'Guest Checkout (Verified Email)' : 'Registered Patron Account'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Current Status:</span>
                    <span className={`status-pill ${selectedRequest.status.toLowerCase().replace(/\s+/g, '-')}`}>
                      {selectedRequest.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Breakdown */}
              <div className="modal-info-section">
                <h4 className="section-title">
                  Requested Items ({(selectedRequest.items || []).length})
                </h4>
                <div className="modal-items-list">
                  {(selectedRequest.items || []).map((it, idx) => (
                    <div key={idx} className="modal-item-detail-card">
                      <div className="item-detail-left">
                        <strong className="modal-item-name">{it.name}</strong>
                        <div className="modal-item-meta-row">
                          <span className="tag">Purchased Size: <strong>{it.size}</strong></span>
                          <span className="tag">Quantity: <strong>{it.quantity}</strong></span>
                          {it.originalPrice && (
                            <span className="tag">Original Paid: ₹{Number(it.originalPrice).toLocaleString('en-IN')}</span>
                          )}
                          {it.allocatedDiscount > 0 && (
                            <span className="tag discount">Coupon Share: -₹{it.allocatedDiscount}</span>
                          )}
                        </div>

                        {selectedRequest.requestType === 'Exchange' && (
                          <div className="exchange-replacement-box">
                            <span className="exchange-arrow">↳</span>
                            <div>
                              <span className="replacement-label">Requested Replacement Variant:</span>
                              <strong className="replacement-size-text">Size {it.replacementSize}</strong>
                              {selectedRequest.exchangeStockDeducted ? (
                                <span className="stock-status-pill reserved">✓ Stock Deducted & Reserved</span>
                              ) : (
                                <span className="stock-status-pill pending">Pending Approval Reservation</span>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="item-reasons-box">
                          <span className="reason-label">Customer Reason:</span>
                          <span className="reason-text">{it.reason || selectedRequest.reason}</span>
                        </div>

                        {(it.customerComments || selectedRequest.customerComments) && (
                          <div className="item-comments-box">
                            <span className="comments-label">Feedback Notes:</span>
                            <p className="comments-text">
                              "{it.customerComments || selectedRequest.customerComments}"
                            </p>
                          </div>
                        )}
                      </div>

                      {selectedRequest.requestType === 'Return' && (
                        <div className="item-detail-right">
                          <span className="item-refund-label">Eligible Net Refund</span>
                          <strong className="item-refund-value">
                            ₹{Number(it.eligibleRefundAmount || 0).toLocaleString('en-IN')}
                          </strong>
                          {selectedRequest.stockRestored ? (
                            <span className="stock-badge restored">✓ Restocked to MongoDB</span>
                          ) : (
                            <span className="stock-badge pending">Restock on Inspection</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Status History Audit Trail */}
              <div className="modal-info-section">
                <h4 className="section-title">Audit Trail & Status History</h4>
                <div className="status-history-timeline">
                  {(selectedRequest.statusHistory || []).map((sh, sIdx) => (
                    <div key={sIdx} className="history-timeline-entry">
                      <div className="history-dot" />
                      <div className="history-content">
                        <div className="history-header">
                          <strong className="history-status">{sh.status}</strong>
                          <span className="history-time">{formatDate(sh.timestamp)}</span>
                        </div>
                        {(sh.updatedBy || sh.actor) && (
                          <span className="history-actor">Updated by: {sh.updatedBy || sh.actor}</span>
                        )}
                        {(sh.message || sh.notes) && (
                          <p className="history-note">"{sh.message || sh.notes}"</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Administrative Workflow Actions */}
              <div className="modal-info-section actions-section">
                <h4 className="section-title">Concierge Workflow Decisions</h4>

                <div className="admin-notes-field">
                  <label htmlFor="modal-admin-notes">Internal Admin Notes / Audit Remark:</label>
                  <textarea
                    id="modal-admin-notes"
                    rows="2"
                    value={actionNotes}
                    onChange={(e) => setActionNotes(e.target.value)}
                    placeholder="Enter audit rationale, courier tracking details, or inspection feedback..."
                    className="admin-notes-textarea"
                  />
                </div>

                {/* Workflow Buttons */}
                <div className="workflow-action-buttons">
                  {selectedRequest.status === 'Requested' && (
                    <>
                      <button
                        type="button"
                        className="btn-action approve-btn"
                        onClick={() => handleStatusUpdate('Approved')}
                        disabled={isActionSubmitting}
                      >
                        ✓ Approve Request
                      </button>
                      <button
                        type="button"
                        className="btn-action reject-btn"
                        onClick={() => handleStatusUpdate('Rejected')}
                        disabled={isActionSubmitting}
                      >
                        ✕ Reject Request
                      </button>
                    </>
                  )}

                  {selectedRequest.status === 'Approved' && (
                    <button
                      type="button"
                      className="btn-action transit-btn"
                      onClick={() => handleStatusUpdate('In Transit')}
                      disabled={isActionSubmitting}
                    >
                      🚚 Mark In Transit (Courier Picked Up)
                    </button>
                  )}

                  {selectedRequest.status === 'In Transit' && (
                    <button
                      type="button"
                      className="btn-action inspect-btn"
                      onClick={() => handleStatusUpdate('Received and Inspected')}
                      disabled={isActionSubmitting}
                    >
                      📦 Mark Received & Inspected (Restore Inventory)
                    </button>
                  )}

                  {selectedRequest.status === 'Received and Inspected' && (
                    <button
                      type="button"
                      className="btn-action complete-btn"
                      onClick={() => handleStatusUpdate('Completed')}
                      disabled={isActionSubmitting}
                    >
                      🎉 Mark Entire Request Completed
                    </button>
                  )}

                  {/* Financial Refund Confirmation for Returns */}
                  {selectedRequest.requestType === 'Return' && selectedRequest.refundStatus !== 'Completed' && (
                    <button
                      type="button"
                      className="btn-action refund-confirm-btn"
                      onClick={() => handleRefundUpdate('Completed')}
                      disabled={isActionSubmitting}
                    >
                      💳 Confirm Refund Credited (₹{Number(selectedRequest.refundAmount || 0).toLocaleString('en-IN')})
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedRequest(null)}
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {confirmModal && (
        <div className="admin-confirm-backdrop">
          <div className="admin-confirm-box" role="dialog" aria-modal="true">
            <h3>{confirmModal.title}</h3>
            <p>{confirmModal.message}</p>
            {confirmModal.error && (
              <div
                className="confirm-error-banner"
                role="alert"
                style={{
                  background: '#fef2f2',
                  color: '#b91c1c',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '0.8125rem',
                  marginBottom: '1.25rem',
                  border: '1px solid #fecaca',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>⚠️ {confirmModal.error}</span>
              </div>
            )}
            <div className="confirm-buttons-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmModal(null)}
                disabled={isActionSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmModal.onConfirm}
                disabled={isActionSubmitting}
              >
                {isActionSubmitting ? 'Updating...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
