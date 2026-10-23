import React, { useState, useEffect, useMemo } from 'react';
import './AdminNotifications.css';
import { adminFetch } from '../utils/apiClient';

export default function AdminNotifications({ onNavigateToSection }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState({
    all: 0,
    inventory: 0,
    orders: 0,
    customers: 0,
    reviews: 0,
    system: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'inventory' | 'orders' | 'customers' | 'reviews' | 'system'
  const [readFilter, setReadFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3500);
  };

  /**
   * Fetch notifications from GET /api/admin/notifications
   */
  const fetchNotifications = async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const response = await adminFetch('/api/admin/notifications');
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch alerts (Status ${response.status})`);
      }

      const data = await response.json();
      setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
      setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
      if (data.categoryCounts) {
        setCategoryCounts(data.categoryCounts);
      }
    } catch (err) {
      console.error('Error fetching admin notifications:', err);
      setError(err.message || 'Could not load notifications from MongoDB.');
    } finally {
      setLoading(false);
      if (isManual) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  /**
   * Mark single notification as read: PUT /api/admin/notifications/:id/read
   */
  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      const response = await adminFetch(`/api/admin/notifications/${id}/read`, {
        method: 'PUT',
      });
      if (!response.ok) {
        throw new Error('Could not update notification.');
      }
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      showToast('Notification marked as read.');
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      showToast('Could not mark notification as read.');
    }
  };

  /**
   * Mark all notifications as read: PUT /api/admin/notifications/mark-all-read
   */
  const handleMarkAllRead = async () => {
    try {
      const response = await adminFetch('/api/admin/notifications/mark-all-read', {
        method: 'PUT',
      });
      if (!response.ok) {
        throw new Error('Could not mark all notifications as read.');
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      showToast('All notifications marked as read.');
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      showToast('Could not mark all as read.');
    }
  };

  /**
   * Handle clicking on a notification action button or card
   */
  const handleNotificationClick = async (notif) => {
    // If unread, mark as read
    if (!notif.read) {
      handleMarkAsRead(notif._id);
    }

    // Navigate to target section if provided
    if (notif.targetPage && onNavigateToSection) {
      onNavigateToSection(notif.targetPage);
    }
  };

  /**
   * Filter and search notifications
   */
  const filteredNotifications = useMemo(() => {
    return notifications.filter((notif) => {
      // 1. Category Filter
      if (categoryFilter !== 'all' && notif.type !== categoryFilter) {
        return false;
      }
      // 2. Read / Unread Filter
      if (readFilter === 'unread' && notif.read) {
        return false;
      }
      if (readFilter === 'read' && !notif.read) {
        return false;
      }
      // 3. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const titleMatch = (notif.title || '').toLowerCase().includes(query);
        const msgMatch = (notif.message || '').toLowerCase().includes(query);
        const refMatch = (notif.referenceId || '').toLowerCase().includes(query);
        return titleMatch || msgMatch || refMatch;
      }
      return true;
    });
  }, [notifications, categoryFilter, readFilter, searchQuery]);

  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'Just now';
    try {
      const date = new Date(dateString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  const getCategoryIcon = (type) => {
    switch (type) {
      case 'inventory':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
        );
      case 'orders':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <path d="M16 10a4 4 0 0 1-8 0"></path>
          </svg>
        );
      case 'customers':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
          </svg>
        );
      case 'reviews':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        );
      case 'system':
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        );
    }
  };

  return (
    <div className="admin-notifications-page" id="admin-notifications-section">
      {/* 1. Header Section */}
      <div className="admin-page-header">
        <div>
          <span className="header-eyebrow">ALERT DISPATCH</span>
          <h1 className="admin-page-title">Notification Center</h1>
          <p className="admin-page-subtitle">
            Centralized operational alerts across inventory stock levels, pending orders, patron registrations, and critique submissions.
          </p>
        </div>
        <div className="header-actions">
          {unreadCount > 0 && (
            <button
              type="button"
              className="btn-mark-all-read"
              onClick={handleMarkAllRead}
              id="mark-all-read-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
              <span>Mark All as Read ({unreadCount})</span>
            </button>
          )}

          <button
            type="button"
            className="btn-refresh-notifications"
            onClick={() => fetchNotifications(true)}
            disabled={isRefreshing || loading}
            id="refresh-notifications-btn"
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
            <span>{isRefreshing ? 'Syncing...' : 'Sync Alerts'}</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Banner */}
      <div className="notifications-summary-bar">
        <div className="summary-stat-box">
          <span className="stat-label">Active Unread Alerts</span>
          <span className="stat-val highlight">{unreadCount}</span>
        </div>
        <div className="summary-stat-box">
          <span className="stat-label">Total Dispatch Logs</span>
          <span className="stat-val">{notifications.length}</span>
        </div>
        <div className="summary-stat-box">
          <span className="stat-label">Inventory Flags</span>
          <span className="stat-val">{categoryCounts.inventory || 0}</span>
        </div>
        <div className="summary-stat-box">
          <span className="stat-label">Order Events</span>
          <span className="stat-val">{categoryCounts.orders || 0}</span>
        </div>
      </div>

      {/* 3. Toolbar: Search & Category Chips */}
      <div className="notifications-toolbar">
        {/* Category Filters */}
        <div className="toolbar-category-chips">
          <button
            type="button"
            className={`category-chip ${categoryFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('all')}
            id="notif-cat-all"
          >
            All Alerts ({notifications.length})
          </button>
          <button
            type="button"
            className={`category-chip ${categoryFilter === 'inventory' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('inventory')}
            id="notif-cat-inventory"
          >
            Inventory ({categoryCounts.inventory || 0})
          </button>
          <button
            type="button"
            className={`category-chip ${categoryFilter === 'orders' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('orders')}
            id="notif-cat-orders"
          >
            Orders ({categoryCounts.orders || 0})
          </button>
          <button
            type="button"
            className={`category-chip ${categoryFilter === 'customers' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('customers')}
            id="notif-cat-customers"
          >
            Customers ({categoryCounts.customers || 0})
          </button>
          <button
            type="button"
            className={`category-chip ${categoryFilter === 'reviews' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('reviews')}
            id="notif-cat-reviews"
          >
            Reviews ({categoryCounts.reviews || 0})
          </button>
        </div>

        {/* Status Toggle & Search */}
        <div className="toolbar-controls-right">
          {/* Read / Unread Toggle */}
          <div className="read-toggle-group">
            <button
              type="button"
              className={`toggle-btn ${readFilter === 'all' ? 'active' : ''}`}
              onClick={() => setReadFilter('all')}
            >
              All
            </button>
            <button
              type="button"
              className={`toggle-btn ${readFilter === 'unread' ? 'active' : ''}`}
              onClick={() => setReadFilter('unread')}
            >
              Unread ({unreadCount})
            </button>
            <button
              type="button"
              className={`toggle-btn ${readFilter === 'read' ? 'active' : ''}`}
              onClick={() => setReadFilter('read')}
            >
              Read
            </button>
          </div>

          {/* Search Input */}
          <div className="toolbar-search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Filter alerts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="toolbar-search-input"
            />
            {searchQuery && (
              <button
                type="button"
                className="toolbar-search-clear"
                onClick={() => setSearchQuery('')}
              >
                ✕
              </button>
            )}
          </div>
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

      {/* 4. Notifications List Card */}
      <div className="notifications-container-card">
        {loading ? (
          <div className="notifications-loading-state">
            <div className="luxury-spinner"></div>
            <p>Aggregating operational alerts from MongoDB...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notifications-empty-state">
            <div className="empty-state-icon">
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </div>
            <h3 className="empty-state-title">No new notifications</h3>
            <p className="empty-state-text">
              {searchQuery || categoryFilter !== 'all' || readFilter !== 'all'
                ? 'No alerts match your selected category or search filter.'
                : 'No new notifications'}
            </p>
            {(searchQuery || categoryFilter !== 'all' || readFilter !== 'all') && (
              <button
                type="button"
                className="btn-secondary empty-reset-btn"
                onClick={() => {
                  setSearchQuery('');
                  setCategoryFilter('all');
                  setReadFilter('all');
                }}
              >
                Reset All Filters
              </button>
            )}
          </div>
        ) : (
          <div className="notifications-list">
            {filteredNotifications.map((notif) => {
              const isUnread = !notif.read;
              return (
                <div
                  key={notif._id}
                  className={`notification-item-card ${isUnread ? 'unread' : 'read'} type-${notif.type}`}
                  onClick={() => handleNotificationClick(notif)}
                >
                  {/* Category Icon Badge */}
                  <div className={`notif-type-icon notif-${notif.type}`}>
                    {getCategoryIcon(notif.type)}
                  </div>

                  {/* Main Content */}
                  <div className="notif-content-area">
                    <div className="notif-card-header">
                      <div className="notif-title-group">
                        <span className={`notif-type-pill type-pill-${notif.type}`}>
                          {notif.type}
                        </span>
                        <h4 className="notif-title">{notif.title}</h4>
                      </div>
                      <div className="notif-meta-group">
                        <span className="notif-timestamp">
                          {formatRelativeTime(notif.createdAt)}
                        </span>
                        {isUnread && <span className="unread-dot-indicator"></span>}
                      </div>
                    </div>

                    <p className="notif-message-text">{notif.message}</p>

                    <div className="notif-actions-strip">
                      {notif.targetPage && (
                        <button
                          type="button"
                          className="btn-navigate-target"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleNotificationClick(notif);
                          }}
                        >
                          <span>Inspect in {notif.targetPage}</span>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                            <polyline points="12 5 19 12 12 19"></polyline>
                          </svg>
                        </button>
                      )}

                      {isUnread && (
                        <button
                          type="button"
                          className="btn-mark-single-read"
                          onClick={(e) => handleMarkAsRead(notif._id, e)}
                          title="Mark this alert as read"
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                          <span>Mark as read</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Interactive Toast */}
      {toastMessage && (
        <div className="aura-toast" role="alert">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
