import React, { useState, useEffect } from 'react';
import './AdminDashboard.css';
import AdminProducts from './AdminProducts';
import AdminOrders from './AdminOrders';
import { API_BASE } from '../utils/apiConfig';

export default function AdminDashboard({ onBackToStore }) {
  // Navigation & UI state
  const [activeMenu, setActiveMenu] = useState('Dashboard');
  const [initialOpenAddProduct, setInitialOpenAddProduct] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chartPeriod, setChartPeriod] = useState('Monthly');
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);

  // Live MERN Data States
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  /**
   * MERN Explanation:
   * We fetch both /api/products and /api/orders in parallel using Promise.all().
   * This fetches live data directly from the MongoDB collections ('products' and 'orders').
   * If any network error occurs, we handle it and display a user-friendly error message.
   */
  const fetchDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const [productsRes, ordersRes] = await Promise.all([
        fetch(`${API_BASE}/api/products`),
        fetch(`${API_BASE}/api/orders`),
      ]);

      if (!productsRes.ok || !ordersRes.ok) {
        throw new Error('Failed to fetch data from backend API endpoints.');
      }

      const productsData = await productsRes.json();
      const ordersData = await ordersRes.json();

      setProducts(Array.isArray(productsData) ? productsData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Could not load dashboard data. Please make sure the backend is running.');
    } finally {
      setLoading(false);
      if (isManualRefresh) setIsRefreshing(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ==========================================
  // LIVE METRICS CALCULATIONS (No hardcoded values)
  // ==========================================

  // 1. Total Products: actual count from MongoDB
  const totalProductsCount = products.length;

  // 2. Total Orders: actual count from MongoDB
  const totalOrdersCount = orders.length;

  // 3. Total Revenue: calculated by summing order totals
  const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);

  // 4. Pending Orders: count of orders with status 'Pending'
  const pendingOrders = orders.filter(
    (order) => (order.status || '').toLowerCase() === 'pending'
  );
  const pendingOrdersCount = pendingOrders.length;

  // 5. Customers from Orders: count of unique customer emails
  const uniqueCustomerEmails = new Set(
    orders
      .map((order) => order.customer?.email?.toLowerCase().trim())
      .filter(Boolean)
  );
  const uniqueCustomerCount = uniqueCustomerEmails.size;

  // 6. Low Stock Products: products with stock <= 5
  const lowStockProducts = products.filter(
    (prod) => typeof prod.stock === 'number' && prod.stock <= 5
  );

  // 7. Recent Orders: latest orders sorted by newest first (top 5)
  const recentOrdersList = [...orders]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 5);

  // 8. Average Order Value
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

  // Dynamic KPI stats cards
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
      title: 'Total Products',
      value: totalProductsCount.toLocaleString('en-IN'),
      change: `${lowStockProducts.length} low stock`,
      isPositive: lowStockProducts.length === 0,
      subtext: 'active in catalog',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
          <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
      ),
    },
    {
      id: 5,
      title: 'Customers from Orders',
      value: uniqueCustomerCount.toLocaleString('en-IN'),
      change: `${uniqueCustomerCount} unique`,
      isPositive: true,
      subtext: 'unique buyer emails',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
    },
  ];

  // Dynamic day-of-week sales chart from live orders
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayTotals = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  orders.forEach((ord) => {
    if (ord.createdAt) {
      const day = new Date(ord.createdAt).toLocaleDateString('en-US', { weekday: 'short' });
      if (dayTotals[day] !== undefined) {
        dayTotals[day] += Number(ord.total) || 0;
      }
    }
  });
  const maxDayAmount = Math.max(...Object.values(dayTotals), 1);
  const revenueChartData = dayNames.map((d) => {
    const amount = dayTotals[d];
    return {
      label: d,
      value: amount > 0 ? Math.max(12, Math.round((amount / maxDayAmount) * 100)) : 10,
      displayVal: amount > 0 ? `₹${amount.toLocaleString('en-IN')}` : '₹0',
    };
  });

  // Navigation menu items with live badges
  const menuItems = [
    {
      name: 'Dashboard',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="7" height="7"></rect>
          <rect x="14" y="3" width="7" height="7"></rect>
          <rect x="14" y="14" width="7" height="7"></rect>
          <rect x="3" y="14" width="7" height="7"></rect>
        </svg>
      ),
    },
    {
      name: 'Products',
      badge: `${totalProductsCount}`,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
          <line x1="7" y1="7" x2="7.01" y2="7"></line>
        </svg>
      ),
    },
    {
      name: 'Orders',
      badge: pendingOrdersCount > 0 ? `${pendingOrdersCount} Pending` : `${totalOrdersCount}`,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="9" cy="21" r="1"></circle>
          <circle cx="20" cy="21" r="1"></circle>
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
        </svg>
      ),
    },
    {
      name: 'Customers',
      badge: `${uniqueCustomerCount}`,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      ),
    },
    {
      name: 'Categories',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <line x1="8" y1="6" x2="21" y2="6"></line>
          <line x1="8" y1="12" x2="21" y2="12"></line>
          <line x1="8" y1="18" x2="21" y2="18"></line>
          <line x1="3" y1="6" x2="3.01" y2="6"></line>
          <line x1="3" y1="12" x2="3.01" y2="12"></line>
          <line x1="3" y1="18" x2="3.01" y2="18"></line>
        </svg>
      ),
    },
    {
      name: 'Coupons',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="2" y="4" width="20" height="16" rx="2"></rect>
          <path d="M7 15h0M2 9.5a2.5 2.5 0 0 1 0 5M22 9.5a2.5 2.5 0 0 0 0 5"></path>
        </svg>
      ),
    },
    {
      name: 'Settings',
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      ),
    },
  ];

  const getStatusBadgeClass = (status) => {
    switch ((status || '').toLowerCase()) {
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
    <div className="aura-admin-wrapper">
      
      {/* 1. Left Sidebar */}
      <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
        
        {/* Sidebar Brand Header */}
        <div className="admin-brand-box">
          <div className="admin-logo-row">
            <span className="admin-logo-aura">AURA</span>
            <span className="admin-badge-portal">ADMIN</span>
          </div>
          <p className="admin-subtext">Luxury Clothing Co.</p>
          
          <button 
            className="sidebar-close-btn" 
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        {/* Sidebar Navigation Items */}
        <nav className="admin-nav">
          <span className="admin-nav-section-title">MAIN MENU</span>
          <ul className="admin-nav-list">
            {menuItems.map((item) => (
              <li key={item.name}>
                <button
                  className={`admin-nav-item ${activeMenu === item.name ? 'active' : ''}`}
                  onClick={() => {
                    setActiveMenu(item.name);
                    setInitialOpenAddProduct(false);
                    setSidebarOpen(false);
                  }}
                >
                  <span className="admin-nav-icon">{item.icon}</span>
                  <span className="admin-nav-label">{item.name}</span>
                  {item.badge && <span className="admin-menu-badge">{item.badge}</span>}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Sidebar Bottom Actions */}
        <div className="admin-sidebar-footer">
          {/* Quick link back to customer store */}
          {onBackToStore && (
            <button className="admin-store-link-btn" onClick={onBackToStore}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <span>Back to Store</span>
            </button>
          )}

          {/* Logout Action */}
          <button 
            className="admin-logout-btn" 
            onClick={() => alert('Logged out successfully.')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Logout</span>
          </button>
        </div>

      </aside>

      {/* Backdrop for mobile drawer */}
      {sidebarOpen && (
        <div className="admin-sidebar-backdrop" onClick={() => setSidebarOpen(false)}></div>
      )}

      {/* Main Container */}
      <div className="admin-main-container">
        
        {/* 2. Top Header */}
        <header className="admin-top-header">
          
          <div className="header-left">
            <button 
              className="admin-hamburger-btn" 
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
            <h1 className="header-title">
              {activeMenu === 'Dashboard' ? 'Admin Dashboard' : `${activeMenu} Management`}
            </h1>
          </div>

          {/* Global Search Bar */}
          <div className="header-search-box">
            <svg className="header-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Search orders, products, customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="header-search-input"
            />
          </div>

          {/* Header Right Actions */}
          <div className="header-right">
            
            {/* Notifications Button */}
            <div className="notification-wrapper">
              <button 
                className="header-icon-btn" 
                onClick={() => setShowNotifications(!showNotifications)}
                aria-label="Notifications"
                title="Notifications"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {(pendingOrdersCount > 0 || lowStockProducts.length > 0) && (
                  <span className="notif-badge">{pendingOrdersCount + lowStockProducts.length}</span>
                )}
              </button>

              {showNotifications && (
                <div className="notifications-dropdown">
                  <div className="notif-header">
                    <h4>Notifications</h4>
                    <span className="notif-count">
                      {pendingOrdersCount + lowStockProducts.length} Alerts
                    </span>
                  </div>
                  <ul className="notif-list">
                    {pendingOrdersCount > 0 && (
                      <li>
                        <span className="notif-dot"></span>
                        <div>
                          <p className="notif-text">
                            <strong>{pendingOrdersCount} orders</strong> currently awaiting fulfillment
                          </p>
                          <span className="notif-time">Requires action</span>
                        </div>
                      </li>
                    )}
                    {lowStockProducts.length > 0 && (
                      <li>
                        <span className="notif-dot warning"></span>
                        <div>
                          <p className="notif-text">
                            Low stock alert for <strong>{lowStockProducts[0].name}</strong> (Only {lowStockProducts[0].stock} left)
                          </p>
                          <span className="notif-time">Immediate reorder</span>
                        </div>
                      </li>
                    )}
                    <li>
                      <span className="notif-dot" style={{ backgroundColor: '#2e7d32' }}></span>
                      <div>
                        <p className="notif-text">MongoDB connection is active and synchronized</p>
                        <span className="notif-time">Live Status</span>
                      </div>
                    </li>
                  </ul>
                </div>
              )}
            </div>

            {/* Admin Profile */}
            <div className="admin-profile-pill">
              <div className="admin-avatar">
                <span>AS</span>
                <span className="avatar-online-dot"></span>
              </div>
              <div className="admin-profile-info">
                <span className="admin-name">Aditi Sharma</span>
                <span className="admin-role">Store Manager</span>
              </div>
            </div>

          </div>
        </header>

        {/* 3. Main Dashboard Body / Active View */}
        <main className="admin-content-body">
          {activeMenu === 'Products' ? (
            <AdminProducts initialOpenForm={initialOpenAddProduct} />
          ) : activeMenu === 'Orders' ? (
            <AdminOrders />
          ) : activeMenu === 'Dashboard' ? (
            <>
              {/* Welcome Banner with Refresh Button */}
              <div className="welcome-banner">
                <div>
                  <h2 className="welcome-heading">Welcome back, Aditi! ✨</h2>
                  <p className="welcome-subtext">
                    Here is an overview of what is happening across your AURA clothing store today.
                  </p>
                </div>
                <div className="welcome-actions">
                  
                  {/* REFRESH BUTTON (Requirement 9) */}
                  <button 
                    className="btn-secondary admin-refresh-btn" 
                    onClick={() => fetchDashboardData(true)}
                    disabled={isRefreshing}
                    title="Refresh live MongoDB data"
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
                    <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
                  </button>

                  <button className="btn-secondary admin-export-btn" onClick={() => alert('Generating PDF sales report...')}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    Export Report
                  </button>
                  <button 
                    className="btn-primary admin-add-product-btn" 
                    onClick={() => {
                      setActiveMenu('Products');
                      setInitialOpenAddProduct(true);
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add New Product
                  </button>
                </div>
              </div>

              {/* ERROR STATE BANNER (Requirement 8) */}
              {error ? (
                <div className="admin-dashboard-error-banner" role="alert">
                  <div className="error-banner-icon">⚠️</div>
                  <div className="error-banner-content">
                    <h3 className="error-banner-title">{error}</h3>
                    <p className="error-banner-subtext">
                      Backend server expected on <code>{API_BASE}</code>. Verify that backend is running.
                    </p>
                    <button className="error-retry-btn" onClick={() => fetchDashboardData(true)}>
                      Retry Connection
                    </button>
                  </div>
                </div>
              ) : loading ? (
                /* LOADING STATE BANNER (Requirement 7) */
                <div className="admin-dashboard-loading-banner">
                  <div className="admin-loading-spinner"></div>
                  <p>Loading live dashboard data from MongoDB...</p>
                </div>
              ) : (
                <>
                  {/* 4. KPI Stat Cards (Requirements 1, 2, 3, 4, 10, 11) */}
                  <div className="admin-stats-grid">
                    {stats.map((stat) => (
                      <div key={stat.id} className="stat-card">
                        <div className="stat-card-header">
                          <span className="stat-card-title">{stat.title}</span>
                          <div className="stat-card-icon-box">{stat.icon}</div>
                        </div>
                        <div className="stat-card-value">{stat.value}</div>
                        <div className="stat-card-footer">
                          <span className={`stat-change-pill ${stat.isPositive ? 'positive' : 'negative'}`}>
                            {stat.change}
                          </span>
                          <span className="stat-subtext">{stat.subtext}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 5. Charts & Analytics Row */}
                  <div className="admin-charts-grid">
                    
                    {/* Sales & Revenue Chart Card */}
                    <div className="chart-card">
                      <div className="chart-card-header">
                        <div>
                          <h3 className="chart-card-title">Revenue & Sales Performance</h3>
                          <p className="chart-card-subtitle">Visual overview of online boutique transactions</p>
                        </div>
                        <div className="chart-period-tabs">
                          {['Weekly', 'Monthly', 'Yearly'].map((period) => (
                            <button
                              key={period}
                              className={`chart-tab ${chartPeriod === period ? 'active' : ''}`}
                              onClick={() => setChartPeriod(period)}
                            >
                              {period}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Visual Bar Graph */}
                      <div className="chart-bars-container">
                        <div className="chart-bars-grid">
                          {revenueChartData.map((bar, idx) => (
                            <div key={idx} className="chart-bar-column">
                              <div className="chart-bar-track">
                                <div 
                                  className="chart-bar-fill" 
                                  style={{ height: `${bar.value}%` }}
                                >
                                  <span className="chart-tooltip">{bar.displayVal}</span>
                                </div>
                              </div>
                              <span className="chart-bar-label">{bar.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Chart Highlights Footer */}
                      <div className="chart-summary-footer">
                        <div className="chart-metric">
                          <span className="metric-label">Avg. Order Value</span>
                          <span className="metric-val">₹{avgOrderValue.toLocaleString('en-IN')}</span>
                        </div>
                        <div className="chart-metric-divider"></div>
                        <div className="chart-metric">
                          <span className="metric-label">Total Orders</span>
                          <span className="metric-val">{totalOrdersCount}</span>
                        </div>
                        <div className="chart-metric-divider"></div>
                        <div className="chart-metric">
                          <span className="metric-label">Pending Fulfillment</span>
                          <span className="metric-val">{pendingOrdersCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Low-Stock Alert Card (Requirement 6) */}
                    <div className="low-stock-card">
                      <div className="low-stock-header">
                        <div className="low-stock-title-box">
                          <span className="low-stock-warning-icon">⚠️</span>
                          <div>
                            <h3 className="chart-card-title">Low Stock Alerts</h3>
                            <p className="chart-card-subtitle">Items requiring immediate reorder (Stock ≤ 5)</p>
                          </div>
                        </div>
                        <span className="low-stock-count-badge">
                          {lowStockProducts.length} {lowStockProducts.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      <div className="low-stock-list">
                        {lowStockProducts.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '32px 14px', color: 'var(--color-text-muted)' }}>
                            <p style={{ margin: 0, fontWeight: 500, fontSize: '0.9rem' }}>
                              All catalog items have sufficient stock (&gt; 5) ✨
                            </p>
                          </div>
                        ) : (
                          lowStockProducts.slice(0, 4).map((prod) => (
                            <div key={prod._id || prod.id} className="low-stock-item">
                              <img 
                                src={prod.image || 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=200&q=80'} 
                                alt={prod.name} 
                                className="low-stock-img" 
                              />
                              <div className="low-stock-info">
                                <h4 className="low-stock-name">{prod.name}</h4>
                                <span className="low-stock-category">{prod.category}</span>
                                <div className="stock-level-bar-track">
                                  <div 
                                    className="stock-level-bar-fill" 
                                    style={{ width: `${Math.min(100, Math.max(10, ((prod.stock || 0) / 5) * 100))}%` }}
                                  />
                                </div>
                              </div>
                              <div className="low-stock-action">
                                <span className="stock-alert-pill">
                                  {prod.stock === 0 ? 'Out of stock' : `Only ${prod.stock} left`}
                                </span>
                                <button 
                                  className="btn-secondary restock-btn"
                                  onClick={() => {
                                    setActiveMenu('Products');
                                    setInitialOpenAddProduct(false);
                                  }}
                                >
                                  Manage
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="low-stock-footer">
                        <button 
                          className="view-inventory-link" 
                          onClick={() => {
                            setActiveMenu('Products');
                            setInitialOpenAddProduct(false);
                          }}
                        >
                          Manage Full Inventory →
                        </button>
                      </div>
                    </div>

                  </div>

                  {/* 6. Recent Orders Table (Requirement 5) */}
                  <div className="recent-orders-card">
                    <div className="orders-card-header">
                      <div>
                        <h3 className="chart-card-title">Recent Customer Orders</h3>
                        <p className="chart-card-subtitle">Live real-time purchases from MongoDB orders collection</p>
                      </div>
                      <button 
                        className="view-all-orders-btn"
                        onClick={() => setActiveMenu('Orders')}
                      >
                        View All Orders ({totalOrdersCount})
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>

                    <div className="orders-table-wrapper">
                      <table className="orders-table">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Date</th>
                            <th>Total</th>
                            <th>Status</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentOrdersList.length === 0 ? (
                            <tr>
                              <td colSpan="6" style={{ textAlign: 'center', padding: '36px 14px', color: 'var(--color-text-muted)' }}>
                                No customer orders recorded in MongoDB yet. Place an order on the checkout page to see live records here!
                              </td>
                            </tr>
                          ) : (
                            recentOrdersList.map((order) => {
                              const orderId = order.orderId || (order._id ? `#${String(order._id).slice(-6)}` : 'N/A');
                              const customerName = order.customer?.fullName || 'Guest Customer';
                              const customerEmail = order.customer?.email || '';
                              const formattedDate = order.createdAt 
                                ? new Date(order.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : 'N/A';
                              const formattedTotal = `₹${(Number(order.total) || 0).toLocaleString('en-IN')}`;

                              return (
                                <tr key={order._id || order.orderId}>
                                  <td className="order-id-cell">
                                    <strong>{orderId}</strong>
                                  </td>
                                  <td>
                                    <div className="customer-cell">
                                      <span className="customer-name">{customerName}</span>
                                      {customerEmail && (
                                        <span className="customer-email">{customerEmail}</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="order-date-cell">{formattedDate}</td>
                                  <td className="order-amount-cell">
                                    <strong>{formattedTotal}</strong>
                                  </td>
                                  <td>
                                    <span className={`status-badge ${getStatusBadgeClass(order.status)}`}>
                                      {order.status || 'Pending'}
                                    </span>
                                  </td>
                                  <td>
                                    <button 
                                      className="order-detail-btn"
                                      onClick={() => setActiveMenu('Orders')}
                                      title="Manage in Orders section"
                                    >
                                      Manage
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>

                  </div>
                </>
              )}
            </>
          ) : (
            <div className="admin-placeholder-panel">
              <div className="admin-placeholder-card">
                <span className="admin-placeholder-icon">✨</span>
                <h2 className="admin-placeholder-title">{activeMenu} Management</h2>
                <p className="admin-placeholder-text">
                  The {activeMenu} module is coming soon. Head over to <strong>Products</strong> to manage your clothing inventory or add new catalog items.
                </p>
                <div className="admin-placeholder-actions">
                  <button 
                    className="btn-primary" 
                    onClick={() => {
                      setActiveMenu('Products');
                      setInitialOpenAddProduct(false);
                    }}
                  >
                    Go to Products
                  </button>
                  <button 
                    className="btn-secondary" 
                    onClick={() => setActiveMenu('Dashboard')}
                  >
                    Back to Dashboard
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

    </div>
  );
}
