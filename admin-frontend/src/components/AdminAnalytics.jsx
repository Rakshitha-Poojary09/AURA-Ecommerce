import React, { useState, useEffect, useCallback } from 'react';
import './AdminAnalytics.css';
import { adminFetch } from '../utils/apiClient';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';

export default function AdminAnalytics({ 
  adminUser, 
  onNavigateToProducts, 
  onNavigateToOrders, 
  onNavigateToReviews,
  onNavigateToAddProduct,
  refreshTrigger 
}) {
  // Date filter state: '7d' (Last 7 Days), '30d' (Last 30 Days), '90d' (Last 90 Days), 'all' (All Time)
  const [period, setPeriod] = useState('7d');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [reviewStats, setReviewStats] = useState({ total: 0, hidden: 0, approved: 0, averageRating: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredBucket, setHoveredBucket] = useState(null);

  // Fetch real analytics from MongoDB aggregation endpoint
  const fetchAnalytics = useCallback(async (selectedPeriod = period) => {
    setLoading(true);
    setError('');

    try {
      const [response, revResponse] = await Promise.all([
        adminFetch(`/api/admin/analytics?period=${selectedPeriod}`),
        adminFetch('/api/admin/reviews').catch(() => null)
      ]);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Failed to fetch analytics (Status ${response.status})`);
      }

      const data = await response.json();
      setAnalyticsData(data);

      if (revResponse && revResponse.ok) {
        const revData = await revResponse.json();
        if (revData.stats) {
          setReviewStats(revData.stats);
        } else if (Array.isArray(revData)) {
          const total = revData.length;
          const hidden = revData.filter(r => r.status === 'hidden').length;
          const approved = revData.filter(r => r.status !== 'hidden').length;
          const averageRating = total === 0 ? 0 : Math.round((revData.reduce((s, r) => s + r.rating, 0) / total) * 10) / 10;
          setReviewStats({ total, hidden, approved, averageRating });
        }
      }
    } catch (err) {
      console.error('Error fetching admin analytics:', err);
      setError(err.message || 'Could not load analytics. Please ensure backend is running.');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchAnalytics(period);
  }, [fetchAnalytics, period, refreshTrigger]);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
    setHoveredBucket(null);
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

  const formatCurrency = (val) => {
    return `₹${Number(val || 0).toLocaleString('en-IN')}`;
  };

  // Safe fallback for Summary KPI stats
  const summary = analyticsData?.summary || {
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalCustomers: 0,
    pendingOrders: 0,
    deliveredOrders: 0,
    lowStockCount: 0,
    lowStockProductsCount: 0,
    avgOrderValue: 0,
    periodRevenue: 0,
    periodOrdersCount: 0
  };

  // Order status breakdown (supports both ordersByStatus array and statusDistribution object)
  const ordersByStatus = analyticsData?.ordersByStatus || [
    { status: 'Pending', count: summary.pendingOrders || 0, percentage: 0, color: 'amber' },
    { status: 'Processing', count: 0, percentage: 0, color: 'blue' },
    { status: 'Shipped', count: 0, percentage: 0, color: 'indigo' },
    { status: 'Delivered', count: summary.deliveredOrders || 0, percentage: 0, color: 'emerald' },
    { status: 'Cancelled', count: 0, percentage: 0, color: 'rose' }
  ];

  const totalStatusCount = ordersByStatus.reduce((sum, item) => sum + (item.count || 0), 0) || 1;

  // Timeline buckets (supports revenueByDate or revenueTimeline)
  const timeline = analyticsData?.revenueByDate || analyticsData?.revenueTimeline || [];
  const totalTimelineRevenue = timeline.reduce((sum, t) => sum + (Number(t.revenue) || 0), 0);
  const maxRevenueInTimeline = Math.max(...timeline.map((t) => Number(t.revenue) || 0), 100);

  // Best sellers, low stock items, and recent orders from database
  const bestSellers = analyticsData?.bestSellingProducts || [];
  const lowStockList = analyticsData?.lowStockItems || analyticsData?.lowStockProducts || [];
  const recentOrders = analyticsData?.recentOrders || [];

  // Determine if sales exist to avoid showing misleading fake ₹0 charts
  const hasSalesInPeriod = summary.totalOrders > 0 && (totalTimelineRevenue > 0 || summary.periodRevenue > 0);

  return (
    <div className="admin-analytics-view">
      
      {/* 1. Clean Dashboard Header */}
      <div className="analytics-hero-banner">
        <div className="hero-text-block">
          <div className="hero-badge-tag">
            <span className="live-sparkle">✦</span>
            <span>EXECUTIVE OVERVIEW</span>
          </div>
          <h1 className="hero-title">
            Dashboard Overview
          </h1>
          <p className="hero-subtitle">
            Welcome to the AURA Executive Portal. Real-time overview of boutique sales, order fulfillment, and luxury garment performance.
          </p>
        </div>
      </div>

      {/* 2. Error Banner with Retry */}
      {error && (
        <div className="analytics-error-banner" role="alert">
          <div className="error-icon-box">✕</div>
          <div className="error-text-content">
            <strong>Analytics Synchronization Error</strong>
            <p>{error}</p>
          </div>
          <button 
            type="button" 
            className="btn-secondary error-retry-btn" 
            onClick={() => fetchAnalytics(period)}
          >
            Retry
          </button>
        </div>
      )}

      {/* 3. Summary Cards (7 KPIs from MongoDB) */}
      <div className="summary-cards-grid">
        {/* KPI 1: Total Revenue (excludes Cancelled orders) */}
        <div className="kpi-card" id="kpi-total-revenue">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Total Revenue</span>
            <div className="kpi-icon-pill gold" title="Revenue excluding Cancelled orders">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="1" x2="12" y2="23"></line>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
              </svg>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-main-number">{formatCurrency(summary.totalRevenue)}</span>
          </div>
          <div className="kpi-footer-row">
            <span className="kpi-badge positive">All-Time Sales</span>
            <span className="kpi-subtext">Avg basket: {formatCurrency(summary.avgOrderValue)}</span>
          </div>
        </div>

        {/* KPI 2: Total Orders */}
        <div className="kpi-card" id="kpi-total-orders">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Total Orders</span>
            <div className="kpi-icon-pill forest">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <path d="M16 10a4 4 0 0 1-8 0"></path>
              </svg>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-main-number">{summary.totalOrders.toLocaleString('en-IN')}</span>
          </div>
          <div className="kpi-footer-row">
            <span className="kpi-badge positive">Live Orders</span>
            <span className="kpi-subtext">Customer checkouts recorded</span>
          </div>
        </div>

        {/* KPI 3: Total Products */}
        <div className="kpi-card" id="kpi-total-products">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Total Products</span>
            <div className="kpi-icon-pill sage">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                <line x1="7" y1="7" x2="7.01" y2="7"></line>
              </svg>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-main-number">{summary.totalProducts.toLocaleString('en-IN')}</span>
          </div>
          <div className="kpi-footer-row">
            <span className="kpi-badge neutral">Catalog Items</span>
            <span className="kpi-subtext">Active luxury designs</span>
          </div>
        </div>

        {/* KPI 4: Total Customers */}
        <div className="kpi-card" id="kpi-total-customers">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Total Customers</span>
            <div className="kpi-icon-pill forest">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-main-number">{(summary.totalCustomers || 0).toLocaleString('en-IN')}</span>
          </div>
          <div className="kpi-footer-row">
            <span className="kpi-badge positive">Customer Reach</span>
            <span className="kpi-subtext">Active patron accounts</span>
          </div>
        </div>

        {/* KPI 5: Pending Orders */}
        <div className="kpi-card" id="kpi-pending-orders">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Pending Orders</span>
            <div className="kpi-icon-pill amber">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-main-number">{summary.pendingOrders.toLocaleString('en-IN')}</span>
          </div>
          <div className="kpi-footer-row">
            <span className={`kpi-badge ${summary.pendingOrders > 0 ? 'attention' : 'positive'}`}>
              {summary.pendingOrders > 0 ? 'Needs Attention' : 'All Processed'}
            </span>
            <span className="kpi-subtext">Awaiting fulfillment</span>
          </div>
        </div>

        {/* KPI 6: Delivered Orders */}
        <div className="kpi-card" id="kpi-delivered-orders">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Delivered Orders</span>
            <div className="kpi-icon-pill emerald">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-main-number">{summary.deliveredOrders.toLocaleString('en-IN')}</span>
          </div>
          <div className="kpi-footer-row">
            <span className="kpi-badge positive">Fulfilled</span>
            <span className="kpi-subtext">Delivered to patrons</span>
          </div>
        </div>

        {/* KPI 7: Low Stock Items */}
        <div className="kpi-card" id="kpi-low-stock-items">
          <div className="kpi-card-header">
            <span className="kpi-card-label">Low Stock Items</span>
            <div className={`kpi-icon-pill ${(summary.lowStockCount || summary.lowStockProductsCount) > 0 ? 'rose' : 'emerald'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
              </svg>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-main-number">
              {(summary.lowStockCount ?? summary.lowStockProductsCount ?? 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="kpi-footer-row">
            <span className={`kpi-badge ${(summary.lowStockCount || summary.lowStockProductsCount) > 0 ? 'danger' : 'positive'}`}>
              {(summary.lowStockCount || summary.lowStockProductsCount) > 0 ? 'Restock Required' : 'Levels Healthy'}
            </span>
            <span className="kpi-subtext">Size-wise ≤ 5 units</span>
          </div>
        </div>

        {/* KPI 8: Customer Reviews */}
        <div 
          className="kpi-card" 
          id="kpi-customer-reviews"
          onClick={onNavigateToReviews}
          style={{ cursor: onNavigateToReviews ? 'pointer' : 'default' }}
          title={onNavigateToReviews ? 'View and moderate customer reviews' : ''}
        >
          <div className="kpi-card-header">
            <span className="kpi-card-label">Customer Reviews</span>
            <div className={`kpi-icon-pill ${reviewStats.hidden > 0 ? 'amber' : 'emerald'}`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
              </svg>
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-main-number">
              {reviewStats.total.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="kpi-footer-row">
            <span className={`kpi-badge ${reviewStats.hidden > 0 ? 'alert' : 'positive'}`}>
              {reviewStats.hidden > 0 ? `${reviewStats.hidden} Hidden` : `${reviewStats.approved} Approved`}
            </span>
            <span className="kpi-subtext">{reviewStats.averageRating ? `Avg: ${reviewStats.averageRating} ★` : 'No ratings yet'}</span>
          </div>
        </div>
      </div>

      {/* 4. Analytics Visual Grid (Revenue Chart & Order Status Chart) */}
      <div className="analytics-charts-grid">
        
        {/* Sales / Revenue Chart Card */}
        <div className="analytics-card revenue-chart-card">
          <div className="analytics-card-header">
            <div className="header-titles">
              <h2 className="card-heading">Revenue Over Time</h2>
              <span className="card-subheading">
                Actual MongoDB customer orders (Date → Revenue) • Period Total: <strong>{formatCurrency(summary.periodRevenue)}</strong> ({summary.periodOrdersCount} orders)
              </span>
            </div>

            {/* Date Filter: Last 7 Days, Last 30 Days, Last 90 Days, All Time */}
            <div className="chart-period-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={period === '7d'}
                className={`period-tab-btn ${period === '7d' ? 'active' : ''}`}
                onClick={() => handlePeriodChange('7d')}
                id="filter-period-7d"
              >
                Last 7 Days
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={period === '30d'}
                className={`period-tab-btn ${period === '30d' ? 'active' : ''}`}
                onClick={() => handlePeriodChange('30d')}
                id="filter-period-30d"
              >
                Last 30 Days
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={period === '90d'}
                className={`period-tab-btn ${period === '90d' ? 'active' : ''}`}
                onClick={() => handlePeriodChange('90d')}
                id="filter-period-90d"
              >
                Last 90 Days
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={period === 'all'}
                className={`period-tab-btn ${period === 'all' ? 'active' : ''}`}
                onClick={() => handlePeriodChange('all')}
                id="filter-period-all"
              >
                All Time
              </button>
            </div>
          </div>

          <div className="chart-body-container">
            {loading ? (
              <div className="chart-loading-state">
                <div className="spinner-ring"></div>
                <span>Aggregating live revenue from MongoDB...</span>
              </div>
            ) : !hasSalesInPeriod ? (
              /* Requirement 10: Clean message if no orders exist, without misleading fake charts */
              <div className="chart-empty-state">
                <div className="empty-chart-icon-box">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <line x1="12" y1="1" x2="12" y2="23"></line>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                  </svg>
                </div>
                <h3>No sales data available yet.</h3>
                <p>Customer purchases within this timeframe will appear here automatically.</p>
              </div>
            ) : (
              <div className="visual-bar-chart-wrapper">
                {/* Visual Tooltip if hovering over bucket */}
                {hoveredBucket && (
                  <div className="chart-tooltip-floating">
                    <span className="tooltip-date">{hoveredBucket.label || hoveredBucket.date}</span>
                    <strong className="tooltip-revenue">{formatCurrency(hoveredBucket.revenue)}</strong>
                    <span className="tooltip-orders">
                      {hoveredBucket.orders} {hoveredBucket.orders === 1 ? 'order' : 'orders'}
                    </span>
                  </div>
                )}

                <div className="chart-bars-track">
                  {timeline.map((bucket, idx) => {
                    const rev = Number(bucket.revenue) || 0;
                    const heightPercent = maxRevenueInTimeline > 0 
                      ? Math.max(Math.round((rev / maxRevenueInTimeline) * 100), rev > 0 ? 6 : 2) 
                      : 2;

                    const isZero = rev === 0;

                    return (
                      <div 
                        key={bucket.date || bucket.key || idx} 
                        className={`chart-bar-column ${(hoveredBucket?.date === bucket.date || hoveredBucket?.key === bucket.key) ? 'hovered' : ''}`}
                        onMouseEnter={() => setHoveredBucket(bucket)}
                        onMouseLeave={() => setHoveredBucket(null)}
                      >
                        <div className="bar-pillar-container">
                          <div 
                            className={`bar-pillar ${isZero ? 'empty-bar' : 'filled-bar'}`}
                            style={{ height: `${heightPercent}%` }}
                          >
                            <span className="bar-hover-val">{formatCurrency(rev)}</span>
                          </div>
                        </div>
                        <span className="bar-label-text">{bucket.label}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="chart-axis-indicator">
                  <span>₹0</span>
                  <span className="axis-mid">Max: {formatCurrency(maxRevenueInTimeline)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Order Status Distribution Summary Card */}
        <div className="analytics-card status-chart-card">
          <div className="analytics-card-header">
            <div>
              <h2 className="card-heading">Order Status Summary</h2>
              <span className="card-subheading">Fulfillment lifecycle breakdown ({summary.totalOrders} total)</span>
            </div>
            <button 
              type="button" 
              className="card-text-link" 
              onClick={() => onNavigateToOrders()}
            >
              Manage Orders →
            </button>
          </div>

          <div className="status-chart-body">
            {/* Stacked Progress Bar */}
            <div className="status-stacked-bar">
              {ordersByStatus.map((item) => {
                const pct = totalStatusCount > 0 ? (item.count / totalStatusCount) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div 
                    key={item.status}
                    className={`stack-segment ${(item.status || '').toLowerCase()}`} 
                    style={{ width: `${pct}%` }}
                    title={`${item.status}: ${item.count}`}
                  ></div>
                );
              })}
            </div>

            {/* Status Metric Breakdown Rows */}
            <div className="status-metric-rows">
              {ordersByStatus.map((item) => {
                const key = (item.status || '').toLowerCase();
                const pct = totalStatusCount > 0 ? Math.round((item.count / totalStatusCount) * 100) : 0;
                return (
                  <div key={item.status} className="status-row-item">
                    <div className="status-meta-left">
                      <span className={`status-color-dot ${key}`}></span>
                      <span className="status-title-label">{item.status}</span>
                    </div>
                    <div className="status-meta-right">
                      <strong className="status-count-num" id={`status-count-${key}`}>
                        {item.count}
                      </strong>
                      <span className="status-pct">{pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="status-footer-note">
              <span>All {summary.totalOrders} customer orders tracked via live MongoDB pipeline.</span>
            </div>
          </div>
        </div>

      </div>

      {/* 5. Second Data Row: Best-Selling Products & Size-Wise Low Stock Alerts */}
      <div className="analytics-split-row">
        
        {/* Best-Selling Products Card */}
        <div className="analytics-card best-sellers-card">
          <div className="analytics-card-header">
            <div>
              <h2 className="card-heading">Top 5 Best-Selling Products</h2>
              <span className="card-subheading">Ranked by actual cumulative units sold from MongoDB</span>
            </div>
            <button 
              type="button" 
              className="card-text-link" 
              onClick={onNavigateToProducts}
            >
              Catalog →
            </button>
          </div>

          <div className="card-content-table-wrapper">
            {loading ? (
              <div className="card-loading-row">
                <span>Computing top sales from orders...</span>
              </div>
            ) : bestSellers.length === 0 ? (
              <div className="card-empty-row">
                <p>No sales data available yet.</p>
              </div>
            ) : (
              <div className="best-sellers-list">
                {bestSellers.map((item, index) => {
                  const sold = item.quantitySold ?? item.unitsSold ?? 0;
                  return (
                    <div key={item.productId || index} className="best-seller-item-row">
                      <div className="item-rank-badge">
                        #{index + 1}
                      </div>
                      <img 
                        src={normalizeProductImageUrl(item.image)} 
                        alt={item.name} 
                        className="best-seller-thumb"
                        onError={handleImageError}
                      />
                      <div className="best-seller-info">
                        <span className="bestseller-title">{item.name}</span>
                        <span className="bestseller-stats">
                          {sold} {sold === 1 ? 'unit' : 'units'} sold
                        </span>
                      </div>
                      <div className="best-seller-revenue">
                        <strong className="revenue-number">{formatCurrency(item.revenueGenerated)}</strong>
                        <span className="revenue-label">Generated</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Section with Size-Wise Stock Display */}
        <div className="analytics-card low-stock-card">
          <div className="analytics-card-header">
            <div>
              <h2 className="card-heading">Low Stock Alerts</h2>
              <span className="card-subheading">Size-wise replenishment (Out of Stock = 0, Low = 1–5, Available = &gt;5)</span>
            </div>
            <button 
              type="button" 
              className="card-text-link" 
              onClick={onNavigateToProducts}
            >
              Restock Catalog →
            </button>
          </div>

          <div className="card-content-table-wrapper">
            {loading ? (
              <div className="card-loading-row">
                <span>Inspecting size-wise stock in MongoDB...</span>
              </div>
            ) : lowStockList.length === 0 ? (
              /* Requirement 10: Clean message if no low-stock products exist */
              <div className="healthy-stock-message">
                <div className="healthy-check-circle">✓</div>
                <h3>All sizes are sufficiently stocked.</h3>
                <p>Every size in your catalog currently has inventory above the low-stock threshold.</p>
              </div>
            ) : (
              <div className="low-stock-alert-list">
                {lowStockList.map((prod) => (
                  <div key={prod._id || prod.id} className="low-stock-alert-item">
                    <img 
                      src={normalizeProductImageUrl(prod.image)} 
                      alt={prod.name} 
                      className="low-stock-alert-thumb"
                      onError={handleImageError}
                    />
                    <div className="low-stock-alert-info">
                      <div className="low-stock-title-row">
                        <span className="low-stock-name">{prod.name}</span>
                        <span className="low-stock-cat">{prod.category} • {formatCurrency(prod.price)}</span>
                      </div>
                      
                      {/* Size-wise stock tags: Show low-stock sizes individually */}
                      {Array.isArray(prod.sizes) && prod.sizes.length > 0 ? (
                        <div className="low-stock-sizes-tags" aria-label="Size stock breakdown">
                          {prod.sizes.map((s) => {
                            const q = Number(s.quantity) || 0;
                            const tagCls = q === 0 ? 'tag-out' : q <= 5 ? 'tag-low' : 'tag-ok';
                            return (
                              <span key={s.size} className={`size-restock-tag ${tagCls}`}>
                                <strong>{s.size}</strong>: {q} ({s.status})
                              </span>
                            );
                          })}
                        </div>
                      ) : prod.sizeStock && Object.keys(prod.sizeStock).length > 0 ? (
                        <div className="low-stock-sizes-tags">
                          {Object.entries(prod.sizeStock).map(([sz, qty]) => {
                            const q = Number(qty) || 0;
                            const tagCls = q === 0 ? 'tag-out' : q <= 5 ? 'tag-low' : 'tag-ok';
                            const statusLabel = q === 0 ? 'Out of Stock' : q <= 5 ? 'Low Stock' : 'Available';
                            return (
                              <span key={sz} className={`size-restock-tag ${tagCls}`}>
                                <strong>{sz}</strong>: {q} ({statusLabel})
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>

                    <div className="low-stock-action-col">
                      <button 
                        type="button"
                        className="btn-text-action"
                        onClick={onNavigateToProducts}
                        title="Update inventory for this product"
                      >
                        Edit →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 6. Recent Orders Section */}
      <div className="analytics-card recent-orders-card">
        <div className="analytics-card-header">
          <div>
            <h2 className="card-heading">Recent Orders</h2>
            <span className="card-subheading">Latest live customer transactions recorded in MongoDB (Click order to view details)</span>
          </div>
          <button 
            type="button" 
            className="card-text-link" 
            onClick={() => onNavigateToOrders()}
          >
            View All {summary.totalOrders} Orders →
          </button>
        </div>

        <div className="table-responsive">
          {loading ? (
            <div className="card-loading-row">
              <span>Retrieving recent orders...</span>
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="card-empty-row">
              <p>No sales data available yet.</p>
            </div>
          ) : (
            <table className="recent-orders-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((ord) => {
                  const formattedDate = ord.date 
                    ? new Date(ord.date).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'Recent';

                  const customerDisplay = ord.customer || ord.customerName || 'Guest Customer';
                  const amountDisplay = ord.amount ?? ord.total ?? 0;
                  const orderCode = ord.orderId || ord._id?.slice(-8);

                  return (
                    <tr 
                      key={ord._id || ord.orderId}
                      className="clickable-order-row"
                      onClick={() => onNavigateToOrders(ord.orderId || ord._id)}
                      title="Click to view order details in Orders Management"
                    >
                      <td>
                        <span className="mono-code">{orderCode}</span>
                      </td>
                      <td>
                        <div className="customer-cell">
                          <strong className="customer-cell-name">{customerDisplay}</strong>
                          {ord.customerEmail && (
                            <span className="customer-cell-email">{ord.customerEmail}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="order-date-text">{formattedDate}</span>
                      </td>
                      <td>
                        <strong className="order-total-amount">{formatCurrency(amountDisplay)}</strong>
                      </td>
                      <td>
                        <span className={`table-status-pill ${getStatusBadgeClass(ord.status)}`}>
                          {ord.status || 'Pending'}
                        </span>
                      </td>
                      <td>
                        <span className="row-action-link">View →</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
