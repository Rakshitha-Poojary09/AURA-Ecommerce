import React, { useState, useEffect, useRef } from 'react';
import './AdminDashboard.css';
import AdminProducts from './AdminProducts';
import AdminOrders from './AdminOrders';
import AdminReturns from './AdminReturns';
import AdminCoupons from './AdminCoupons';
import AdminProfile from './AdminProfile';
import AdminAnalytics from './AdminAnalytics';
import AdminReviews from './AdminReviews';
import AdminCustomers from './AdminCustomers';
import AdminNotifications from './AdminNotifications';
import { adminFetch } from '../utils/apiClient';

export default function AdminDashboard({ onLogout, adminUser, activeMenu: propMenu, onNavigate }) {
  // Navigation & UI state
  const [internalMenu, setInternalMenu] = useState('Dashboard');
  const activeMenu = propMenu || internalMenu;
  const setActiveMenu = (menu) => {
    setInternalMenu(menu);
    if (onNavigate) {
      onNavigate(menu);
    }
  };
  const [initialOpenAddProduct, setInitialOpenAddProduct] = useState(false);
  const [selectedOrderIdForOrders, setSelectedOrderIdForOrders] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chartPeriod, setChartPeriod] = useState('Monthly');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  // Live MERN Data States
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [returnsPendingCount, setReturnsPendingCount] = useState(0);
  const [couponCount, setCouponCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [hiddenReviewCount, setHiddenReviewCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const notifDropdownRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [error, setError] = useState('');

  /**
   * Fetches /api/products and /api/orders in parallel from Express/MongoDB
   */
  const fetchDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
      setRefreshTrigger((prev) => prev + 1);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const [productsRes, ordersRes, reviewsRes, customersRes, notifsRes, couponsRes, returnsRes] = await Promise.all([
        adminFetch('/api/products'),
        adminFetch('/api/orders'),
        adminFetch('/api/admin/reviews').catch(() => null),
        adminFetch('/api/admin/customers').catch(() => null),
        adminFetch('/api/admin/notifications').catch(() => null),
        adminFetch('/api/admin/coupons').catch(() => null),
        adminFetch('/api/returns/admin/stats').catch(() => null),
      ]);

      if (!productsRes.ok || !ordersRes.ok) {
        throw new Error('Failed to fetch data from backend API endpoints.');
      }

      const productsData = await productsRes.json();
      const ordersData = await ordersRes.json();

      setProducts(Array.isArray(productsData) ? productsData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);

      if (returnsRes && returnsRes.ok) {
        const returnsData = await returnsRes.json();
        if (typeof returnsData.requested === 'number') {
          setReturnsPendingCount(returnsData.requested);
        }
      }

      if (reviewsRes && reviewsRes.ok) {
        const reviewsData = await reviewsRes.json();
        if (reviewsData.stats) {
          setReviewCount(reviewsData.stats.total || 0);
          setHiddenReviewCount(reviewsData.stats.hidden || 0);
        } else if (Array.isArray(reviewsData)) {
          setReviewCount(reviewsData.length);
          setHiddenReviewCount(reviewsData.filter(r => r.status === 'hidden').length);
        }
      }

      if (customersRes && customersRes.ok) {
        const customersData = await customersRes.json();
        if (typeof customersData.count === 'number') {
          setCustomerCount(customersData.count);
        } else if (Array.isArray(customersData.customers)) {
          setCustomerCount(customersData.customers.length);
        }
      }

      if (notifsRes && notifsRes.ok) {
        const notifsData = await notifsRes.json();
        if (typeof notifsData.unreadCount === 'number') {
          setUnreadNotificationsCount(notifsData.unreadCount);
        }
        if (Array.isArray(notifsData.notifications)) {
          setRecentNotifications(notifsData.notifications);
        }
      }

      if (couponsRes && couponsRes.ok) {
        const couponsData = await couponsRes.json();
        if (couponsData.stats && typeof couponsData.stats.totalCoupons === 'number') {
          setCouponCount(couponsData.stats.totalCoupons);
        } else if (Array.isArray(couponsData.coupons)) {
          setCouponCount(couponsData.coupons.length);
        }
      }


    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Could not load dashboard data. Please make sure the backend is running.');
    } finally {
      setLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Close notifications dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setShowNotificationsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDropdownMarkAllRead = async (e) => {
    e.stopPropagation();
    try {
      await adminFetch('/api/admin/notifications/mark-all-read', { method: 'PUT' });
      setRecentNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadNotificationsCount(0);
    } catch (err) {
      console.error('Failed to mark all as read from dropdown:', err);
    }
  };

  const handleDropdownNotificationClick = (notif) => {
    if (!notif.read) {
      adminFetch(`/api/admin/notifications/${notif._id}/read`, { method: 'PUT' }).catch(() => null);
      setRecentNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, read: true } : n))
      );
      setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
    }
    setShowNotificationsDropdown(false);
    if (notif.targetPage) {
      setActiveMenu(notif.targetPage);
    }
  };

  const formatDropdownTime = (dateString) => {
    if (!dateString) return 'Just now';
    try {
      const date = new Date(dateString);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  };

  const getDropdownCategoryIcon = (type) => {
    switch (type) {
      case 'inventory':
        return (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          </svg>
        );
      case 'orders':
        return (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          </svg>
        );
      case 'customers':
        return (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
            <circle cx="9" cy="7" r="4"></circle>
          </svg>
        );
      case 'reviews':
        return (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        );
      default:
        return (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
          </svg>
        );
    }
  };

  // 1. Total Products
  const totalProductsCount = products.length;

  // 2. Total Orders
  const totalOrdersCount = orders.length;

  // 3. Total Revenue
  const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);

  // 4. Pending Orders
  const pendingOrders = orders.filter(
    (order) => (order.status || '').toLowerCase() === 'pending'
  );
  const pendingOrdersCount = pendingOrders.length;

  // 5. Unique Customers from Orders
  const uniqueCustomerEmails = new Set(
    orders
      .map((order) => order.customer?.email?.toLowerCase().trim())
      .filter(Boolean)
  );
  const uniqueCustomerCount = uniqueCustomerEmails.size;

  // 6. Low Stock Products
  const lowStockProducts = products.filter(
    (prod) => typeof prod.stock === 'number' && prod.stock <= 5
  );

  // 7. Recent Orders
  const recentOrdersList = [...orders]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 5);

  // 8. Average Order Value
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

  const stats = [
    {
      id: 1,
      title: 'Total Revenue',
      value: `₹${totalRevenue.toLocaleString('en-IN')}`,
      change: totalOrdersCount > 0 ? `${totalOrdersCount} orders` : '₹0',
      isPositive: true,
      subtext: 'from live MongoDB orders',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="1" x2="12" y2="23"></line>
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
        </svg>
      ),
    },
    {
      id: 2,
      title: 'Total Orders',
      value: totalOrdersCount.toLocaleString('en-IN'),
      change: `${pendingOrdersCount} pending`,
      isPositive: pendingOrdersCount === 0,
      subtext: 'all-time customer purchases',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <path d="M16 10a4 4 0 0 1-8 0"></path>
        </svg>
      ),
    },
    {
      id: 3,
      title: 'Pending Orders',
      value: pendingOrdersCount.toLocaleString('en-IN'),
      change: pendingOrdersCount > 0 ? 'Needs Attention' : 'All Clear',
      isPositive: pendingOrdersCount === 0,
      subtext: 'awaiting fulfillment',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      ),
    },
    {
      id: 4,
      title: 'Catalog Items',
      value: totalProductsCount.toLocaleString('en-IN'),
      change: `${lowStockProducts.length} low stock`,
      isPositive: lowStockProducts.length === 0,
      subtext: 'active luxury products',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
      ),
    },
    {
      id: 5,
      title: 'Customer Reach',
      value: uniqueCustomerCount.toLocaleString('en-IN'),
      change: 'Active Patrons',
      isPositive: true,
      subtext: 'unique ordering accounts',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
    },
    {
      id: 6,
      title: 'Average Order Value',
      value: `₹${avgOrderValue.toLocaleString('en-IN')}`,
      change: 'Per Transaction',
      isPositive: true,
      subtext: 'live cart basket size',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
        </svg>
      ),
    },
  ];

  const handleNavigateToAddProduct = () => {
    setInitialOpenAddProduct(true);
    setActiveMenu('Products');
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
    <div className="admin-portal-layout">
      {/* Mobile Backdrop */}
      {sidebarOpen && (
        <div 
          className="admin-sidebar-backdrop" 
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 1. Collapsible Admin Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-brand-wrapper">
          <div className="sidebar-brand-content">
            <span className="sidebar-brand-eyebrow">PORTAL</span>
            <h2 className="sidebar-brand-logo">AURA</h2>
          </div>
          <button 
            className="sidebar-close-btn" 
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar menu"
          >
            ✕
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          <div className="nav-section-label">MANAGEMENT</div>
          <ul className="nav-items-list">
            <li>
              <button 
                className={`nav-item-btn ${activeMenu === 'Dashboard' ? 'active' : ''}`}
                onClick={() => {
                  setActiveMenu('Dashboard');
                  setSidebarOpen(false);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7"></rect>
                  <rect x="14" y="3" width="7" height="7"></rect>
                  <rect x="14" y="14" width="7" height="7"></rect>
                  <rect x="3" y="14" width="7" height="7"></rect>
                </svg>
                <span>Dashboard</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-item-btn ${activeMenu === 'Products' ? 'active' : ''}`}
                onClick={() => {
                  setInitialOpenAddProduct(false);
                  setActiveMenu('Products');
                  setSidebarOpen(false);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                  <line x1="7" y1="7" x2="7.01" y2="7"></line>
                </svg>
                <span>Products Catalog</span>
                <span className="sidebar-badge">{totalProductsCount}</span>
              </button>
            </li>
            <li>
              <button 
                className={`nav-item-btn ${activeMenu === 'Orders' ? 'active' : ''}`}
                onClick={() => {
                  setActiveMenu('Orders');
                  setSidebarOpen(false);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                <span>Orders Management</span>
                {pendingOrdersCount > 0 && (
                  <span className="sidebar-badge alert-badge">{pendingOrdersCount}</span>
                )}
              </button>
            </li>
            <li>
              <button 
                className={`nav-item-btn ${activeMenu === 'Returns' ? 'active' : ''}`}
                onClick={() => {
                  setActiveMenu('Returns');
                  setSidebarOpen(false);
                }}
                id="sidebar-nav-returns-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <polyline points="23 20 23 14 17 14"></polyline>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
                <span>Returns & Exchanges</span>
                {returnsPendingCount > 0 && (
                  <span className="sidebar-badge alert-badge">{returnsPendingCount}</span>
                )}
              </button>
            </li>
            <li>
              <button 
                className={`nav-item-btn ${activeMenu === 'Coupons' ? 'active' : ''}`}
                onClick={() => {
                  setActiveMenu('Coupons');
                  setSidebarOpen(false);
                }}
                id="sidebar-nav-coupons-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                  <line x1="7" y1="7" x2="7.01" y2="7"></line>
                </svg>
                <span>Coupons</span>
                {couponCount > 0 && (
                  <span className="sidebar-badge">{couponCount}</span>
                )}
              </button>
            </li>
            <li>
              <button 
                className={`nav-item-btn ${activeMenu === 'Customers' ? 'active' : ''}`}
                onClick={() => {
                  setActiveMenu('Customers');
                  setSidebarOpen(false);
                }}
                id="sidebar-nav-customers-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                <span>Customers</span>
                {customerCount > 0 && (
                  <span className="sidebar-badge">{customerCount}</span>
                )}
              </button>
            </li>
            <li>
              <button 
                className={`nav-item-btn ${activeMenu === 'Reviews' ? 'active' : ''}`}
                onClick={() => {
                  setActiveMenu('Reviews');
                  setSidebarOpen(false);
                }}
                id="sidebar-nav-reviews-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
                </svg>
                <span>Reviews Moderation</span>
                {reviewCount > 0 && (
                  <span className={`sidebar-badge ${hiddenReviewCount > 0 ? 'alert-badge' : ''}`}>
                    {reviewCount}
                  </span>
                )}
              </button>
            </li>

            <li>
              <button 
                className={`nav-item-btn ${activeMenu === 'Notifications' ? 'active' : ''}`}
                onClick={() => {
                  setActiveMenu('Notifications');
                  setSidebarOpen(false);
                }}
                id="sidebar-nav-notifications-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span>Notifications</span>
                {unreadNotificationsCount > 0 && (
                  <span className="sidebar-badge alert-badge">{unreadNotificationsCount}</span>
                )}
              </button>
            </li>
            <li>
              <button 
                className={`nav-item-btn ${activeMenu === 'Profile' ? 'active' : ''}`}
                onClick={() => {
                  setActiveMenu('Profile');
                  setSidebarOpen(false);
                }}
                id="sidebar-nav-profile-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Admin Profile</span>
              </button>
            </li>
          </ul>
        </nav>

        {/* Sidebar Footer with Profile & Sign Out */}
        <div className="sidebar-footer">
          <button 
            type="button" 
            className={`admin-user-pill clickable ${activeMenu === 'Profile' ? 'active' : ''}`}
            onClick={() => {
              setActiveMenu('Profile');
              setSidebarOpen(false);
            }}
            title="View Administrator Profile"
            id="sidebar-user-pill-btn"
          >
            <div className="user-avatar-circle">
              {(adminUser?.name ? adminUser.name.charAt(0).toUpperCase() : 'A')}
            </div>
            <div className="user-details-text">
              <span className="user-name-display">{adminUser?.name || 'Administrator'}</span>
              <span className="user-role-display">Role: {adminUser?.role || 'admin'}</span>
            </div>
          </button>
          <button 
            type="button" 
            className="sidebar-action-btn logout-action-btn"
            onClick={onLogout}
            title="Sign Out of Admin Portal"
            id="sidebar-logout-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* 2. Main Administration Area */}
      <div className="admin-main-wrapper">
        
        {/* Top Operational Bar */}
        <header className="admin-topbar">
          <div className="topbar-left">
            <button 
              className="topbar-hamburger-btn"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle navigation drawer"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            
            <div className="topbar-status-indicator">
              <span className="live-indicator-dot"></span>
              <span className="status-label">ADMIN PORTAL (PORT 5174) — LIVE BACKEND</span>
            </div>
          </div>

          <div className="topbar-right">
            {/* Notification Bell & Dropdown */}
            <div className="topbar-notifications-wrapper" ref={notifDropdownRef}>
              <button 
                type="button"
                className="topbar-icon-btn topbar-bell-btn" 
                onClick={() => setShowNotificationsDropdown(!showNotificationsDropdown)}
                title="Operational Alerts & Notifications"
                id="topbar-notification-bell-btn"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadNotificationsCount > 0 && (
                  <span className="bell-badge-pill" id="bell-unread-badge">
                    {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              {showNotificationsDropdown && (
                <div className="notifications-dropdown-menu">
                  <div className="dropdown-header">
                    <div className="dropdown-header-left">
                      <span className="dropdown-title">Alerts & Notifications</span>
                      {unreadNotificationsCount > 0 && (
                        <span className="dropdown-unread-pill">{unreadNotificationsCount} unread</span>
                      )}
                    </div>
                    {unreadNotificationsCount > 0 && (
                      <button 
                        type="button" 
                        className="dropdown-mark-all-btn"
                        onClick={handleDropdownMarkAllRead}
                        id="dropdown-mark-all-btn"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="dropdown-items-list">
                    {recentNotifications.length === 0 ? (
                      <div className="dropdown-empty-state">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                        </svg>
                        <p>No new notifications</p>
                      </div>
                    ) : (
                      recentNotifications.slice(0, 6).map((notif) => (
                        <div 
                          key={notif._id} 
                          className={`dropdown-item-row ${!notif.read ? 'unread' : ''}`}
                          onClick={() => handleDropdownNotificationClick(notif)}
                        >
                          <div className={`dropdown-item-icon notif-${notif.type}`}>
                            {getDropdownCategoryIcon(notif.type)}
                          </div>
                          <div className="dropdown-item-content">
                            <div className="dropdown-item-title-row">
                              <span className="dropdown-item-title">{notif.title}</span>
                              <span className="dropdown-item-time">{formatDropdownTime(notif.createdAt)}</span>
                            </div>
                            <p className="dropdown-item-message">{notif.message}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="dropdown-footer">
                    <button 
                      type="button" 
                      className="dropdown-view-all-btn"
                      onClick={() => {
                        setShowNotificationsDropdown(false);
                        setActiveMenu('Notifications');
                      }}
                      id="dropdown-view-all-btn"
                    >
                      View All Notifications ({recentNotifications.length})
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button 
              className="topbar-icon-btn" 
              onClick={() => fetchDashboardData(true)}
              disabled={isRefreshing}
              title="Refresh all metrics from MongoDB"
            >
              <svg 
                width="18" 
                height="18" 
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
            </button>

            <button 
              className="btn-primary topbar-add-btn"
              onClick={handleNavigateToAddProduct}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Add Product</span>
            </button>

            <button 
              type="button"
              className={`topbar-profile-btn ${activeMenu === 'Profile' ? 'active' : ''}`}
              onClick={() => setActiveMenu('Profile')}
              title="View Admin Profile"
              id="topbar-profile-btn"
            >
              <div className="topbar-avatar-circle">
                {(adminUser?.name ? adminUser.name.charAt(0).toUpperCase() : 'A')}
              </div>
              <span className="topbar-profile-name">{adminUser?.name?.split(' ')[0] || 'Admin'}</span>
            </button>

            <button
              type="button"
              className="btn-secondary topbar-logout-btn"
              onClick={onLogout}
              title="Sign Out of Admin Console"
              id="topbar-logout-btn"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </header>

        {/* Dynamic Main Workspace Container */}
        <main className="admin-workspace-container">
          
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

          {/* Conditional Sub-View Routing based on sidebar menu */}
          {activeMenu === 'Products' ? (
            <AdminProducts 
              initialOpenForm={initialOpenAddProduct} 
            />
          ) : activeMenu === 'Orders' ? (
            <AdminOrders 
              initialSelectedOrderId={selectedOrderIdForOrders}
            />
          ) : activeMenu === 'Returns' ? (
            <AdminReturns />
          ) : activeMenu === 'Coupons' ? (
            <AdminCoupons />
          ) : activeMenu === 'Customers' ? (
            <AdminCustomers />
          ) : activeMenu === 'Reviews' ? (
            <AdminReviews />
          ) : activeMenu === 'Notifications' ? (
            <AdminNotifications 
              onNavigateToSection={(section) => setActiveMenu(section)}
            />
          ) : activeMenu === 'Profile' ? (
            <AdminProfile 
              adminUser={adminUser} 
              onLogout={onLogout} 
            />
          ) : (
            /* DEFAULT: PROFESSIONAL ANALYTICS DASHBOARD */
            <AdminAnalytics 
              adminUser={adminUser}
              onNavigateToProducts={() => setActiveMenu('Products')}
              onNavigateToOrders={(orderId = null) => {
                setSelectedOrderIdForOrders(orderId);
                setActiveMenu('Orders');
              }}
              onNavigateToReviews={() => setActiveMenu('Reviews')}
              onNavigateToCustomers={() => setActiveMenu('Customers')}
              onNavigateToAddProduct={handleNavigateToAddProduct}
              refreshTrigger={refreshTrigger}
            />
          )}

        </main>
      </div>
    </div>
  );
}
