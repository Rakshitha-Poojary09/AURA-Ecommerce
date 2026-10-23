import React, { useState, useEffect } from 'react';
import './AccountPage.css';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';
import ReturnRequestModal from './ReturnRequestModal';

export default function TrackOrderPage({ currentUser = null, onNavigate }) {
  const [mode, setMode] = useState(currentUser ? 'account' : 'guest');
  const [orderId, setOrderId] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);

  // Authenticated customer orders state
  const [myOrders, setMyOrders] = useState([]);
  const [loadingMyOrders, setLoadingMyOrders] = useState(false);
  const [myOrdersError, setMyOrdersError] = useState('');

  // Fetch logged-in user's orders securely from the existing endpoint
  useEffect(() => {
    if (currentUser) {
      setMode('account');
      fetchMyOrders();
    } else {
      setMode('guest');
    }
  }, [currentUser]);

  const fetchMyOrders = async () => {
    setLoadingMyOrders(true);
    setMyOrdersError('');
    try {
      const response = await fetch('http://localhost:5000/api/orders/my-orders', {
        method: 'GET',
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setMyOrders(Array.isArray(data) ? data : []);
      } else if (response.status === 401) {
        setMyOrdersError('Session expired. Please sign in again.');
      } else {
        setMyOrdersError('Could not load your orders. Please try again later.');
      }
    } catch (err) {
      setMyOrdersError('Network error while retrieving orders.');
    } finally {
      setLoadingMyOrders(false);
    }
  };

  const handleTrackGuest = async (e) => {
    e.preventDefault();
    if (!orderId.trim() || !email.trim()) return;

    setLoading(true);
    setError('');
    setOrder(null);

    try {
      const response = await fetch('http://localhost:5000/api/orders/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderId.trim(), email: email.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setOrder(data);
      } else {
        setError(data.message || 'Order not found or email does not match.');
      }
    } catch (err) {
      setError('Network error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Recent';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadgeClass = (status = '') => {
    switch (status.toLowerCase()) {
      case 'delivered': return 'status-delivered';
      case 'shipped': return 'status-shipped';
      case 'processing': return 'status-processing';
      case 'cancelled': return 'status-cancelled';
      case 'pending': default: return 'status-pending';
    }
  };

  const isCancelled = (status = '') => status.toLowerCase() === 'cancelled';

  return (
    <div className="aura-account-page" style={{ minHeight: '60vh', padding: '40px 0 80px 0', backgroundColor: '#fbfaf8' }}>
      <div className="aura-container">
        
        {/* Breadcrumb Navigation */}
        <div style={{ display: 'flex', gap: '8px', fontSize: '0.88rem', color: '#718096', marginBottom: '24px' }}>
          <button 
            type="button" 
            onClick={() => onNavigate && onNavigate('home')} 
            style={{ background: 'none', border: 'none', padding: 0, color: '#2d3b2d', cursor: 'pointer', textDecoration: 'underline', fontSize: 'inherit' }}
          >
            Home
          </button>
          <span>/</span>
          <span style={{ color: '#2d3748', fontWeight: 600 }}>Order Tracking</span>
        </div>

        {/* 1. SINGLE ORDER TRACKING DETAILS VIEW */}
        {order ? (
          <div className="track-card-container">
            <div className="order-modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #edf2f7', paddingBottom: '20px', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4a5d4e' }}>
                  Live Order Tracking
                </span>
                <h2 style={{ fontSize: '1.6rem', color: '#1a202c', margin: '4px 0 6px 0' }}>Order #{order.orderId}</h2>
                <span style={{ fontSize: '0.88rem', color: '#718096' }}>Placed on {formatDate(order.createdAt)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span className={`order-status-pill ${getStatusBadgeClass(order.status)}`}>
                  {order.status || 'Pending'}
                </span>
                <button 
                  type="button" 
                  onClick={() => setOrder(null)} 
                  style={{ background: '#f7fafc', border: '1px solid #cbd5e0', padding: '6px 14px', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 500, cursor: 'pointer' }}
                >
                  ← Back to Orders
                </button>
              </div>
            </div>

            {/* Courier & Shipping Information (Displayed only if recorded in MongoDB) */}
            {order.trackingNumber && (
              <div style={{ backgroundColor: '#f7f9f7', border: '1px solid #d2ded2', padding: '16px 20px', borderRadius: '8px', marginBottom: '24px' }}>
                <h4 style={{ margin: '0 0 6px 0', fontSize: '0.95rem', color: '#2d3b2d' }}>Logistics & Dispatch Information</h4>
                <p style={{ margin: '0 0 4px 0', fontSize: '0.9rem', color: '#4a5568' }}>
                  <strong>Courier Partner:</strong> {order.courierName || 'Standard Tracked Courier'}
                </p>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#4a5568' }}>
                  <strong>Carrier Tracking ID:</strong> {order.trackingNumber}
                </p>
              </div>
            )}

            {/* Chronological Status Timeline */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '1.15rem', color: '#1a202c', marginBottom: '16px' }}>Status Progression Timeline</h3>
              
              {isCancelled(order.status) ? (
                <div style={{ backgroundColor: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#e53e3e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>✕</div>
                  <div>
                    <strong style={{ color: '#c53030' }}>Order Cancelled</strong>
                    <p style={{ margin: 0, fontSize: '0.88rem', color: '#742a2a' }}>This order has been cancelled and cannot be fulfilled. Any collected amounts are refunded per store policy.</p>
                  </div>
                </div>
              ) : (
                <div style={{ border: '1px solid #edf2f7', borderRadius: '8px', padding: '20px' }}>
                  {order.statusHistory && order.statusHistory.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {order.statusHistory.map((historyItem, sIdx) => {
                        const isLatest = sIdx === order.statusHistory.length - 1;
                        return (
                          <div key={sIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', position: 'relative' }}>
                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: isLatest ? '#2d3b2d' : '#a0aec0', marginTop: '4px', flexShrink: 0 }} />
                            <div style={{ flex: 1 }}>
                              <strong style={{ color: isLatest ? '#1a202c' : '#4a5568', fontSize: '0.95rem' }}>{historyItem.status}</strong>
                              {historyItem.message && <p style={{ margin: '2px 0 0 0', fontSize: '0.85rem', color: '#718096' }}>{historyItem.message}</p>}
                              <span style={{ fontSize: '0.82rem', color: '#a0aec0' }}>{formatDate(historyItem.timestamp)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p style={{ margin: 0, color: '#718096', fontSize: '0.9rem' }}>
                      Initial state: <strong>{order.status || 'Pending'}</strong> (Placed on {formatDate(order.createdAt)})
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Items Summary */}
            <div style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '1.15rem', color: '#1a202c', marginBottom: '16px' }}>
                Purchased Garments ({(order.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0)} items)
              </h3>
              <div style={{ border: '1px solid #edf2f7', borderRadius: '8px', overflow: 'hidden' }}>
                {(order.items || []).map((it, idx) => (
                  <div key={idx} className="track-item-row" style={{ borderBottom: idx < (order.items || []).length - 1 ? '1px solid #edf2f7' : 'none' }}>
                    <img 
                      src={normalizeProductImageUrl(it.image)} 
                      alt={it.name} 
                      onError={handleImageError}
                      style={{ width: '56px', height: '70px', objectFit: 'cover', borderRadius: '4px', backgroundColor: '#f0f0f0' }} 
                    />
                    <div style={{ flex: 1 }}>
                      <strong style={{ display: 'block', fontSize: '0.95rem', color: '#2d3748' }}>{it.name}</strong>
                      <div style={{ fontSize: '0.85rem', color: '#718096', marginTop: '2px' }}>
                        <span>Size: <strong>{it.size || it.selectedSize || 'Standard'}</strong></span>
                        {(it.colorName || it.color || it.selectedColor) && (
                          <>
                            <span style={{ margin: '0 8px' }}>•</span>
                            <span>Colour: <strong>{it.colorName || it.color || it.selectedColor}</strong></span>
                          </>
                        )}
                        <span style={{ margin: '0 8px' }}>•</span>
                        <span>Quantity: <strong>{it.quantity || 1}</strong></span>
                      </div>
                    </div>
                    <div style={{ fontWeight: 600, color: '#1a202c' }}>
                      ₹{((Number(it.price) || 0) * (it.quantity || 1)).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Totals */}
            <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: '100%', maxWidth: '280px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.92rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4a5568' }}>
                  <span>Subtotal</span>
                  <span>₹{Number(order.subtotal || 0).toLocaleString('en-IN')}</span>
                </div>
                {(order.discount || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c53030' }}>
                    <span>Coupon Discount</span>
                    <span>-₹{Number(order.discount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#4a5568' }}>
                  <span>Shipping Fee</span>
                  <span>{Number(order.shipping || 0) === 0 ? 'Complimentary' : `₹${Number(order.shipping).toLocaleString('en-IN')}`}</span>
                </div>
                <div style={{ borderTop: '1px solid #edf2f7', paddingTop: '8px', marginTop: '4px', display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem', color: '#1a202c' }}>
                  <span>Total Amount</span>
                  <span>₹{Number(order.total || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Return or Exchange Action Box for Delivered Order */}
            {order.status?.toLowerCase() === 'delivered' && (
              <div style={{ marginTop: '24px', padding: '16px 20px', backgroundColor: '#fcf9f6', border: '1px solid #eadfd8', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <strong style={{ display: 'block', color: '#1f271c', fontSize: '0.95rem' }}>
                    Garment Return or Size Exchange
                  </strong>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    Need an alternate size or returning an item? Complimentary requests are accepted within 14 days of delivery.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReturnModal(true)}
                  style={{ backgroundColor: '#1f271c', color: '#ffffff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer', transition: 'background-color 0.2s' }}
                >
                  🔄 Return or Exchange
                </button>
              </div>
            )}

          </div>
        ) : mode === 'account' && currentUser ? (
          /* 2. AUTHENTICATED CUSTOMER ORDERS LIST */
          <div style={{ maxWidth: '880px', margin: '0 auto' }}>
            <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4a5d4e' }}>
                  Account Orders
                </span>
                <h1 style={{ fontSize: '2rem', color: '#1a202c', margin: '4px 0 6px 0' }}>Your Orders & Tracking</h1>
                <p style={{ color: '#718096', margin: 0, fontSize: '0.95rem' }}>
                  Signed in as <strong>{currentUser.email}</strong>. Track the progress of all your purchases.
                </p>
              </div>

              <button 
                type="button" 
                onClick={() => setMode('guest')} 
                style={{ background: 'none', border: 'none', color: '#2d3b2d', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}
              >
                Track a guest order with ID →
              </button>
            </div>

            {loadingMyOrders ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#718096', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <p>Loading your orders...</p>
              </div>
            ) : myOrdersError ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#fff5f5', borderRadius: '12px', border: '1px solid #fed7d7', color: '#c53030' }}>
                <p>{myOrdersError}</p>
                <button type="button" onClick={fetchMyOrders} style={{ padding: '8px 18px', backgroundColor: '#2d3b2d', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                  Retry
                </button>
              </div>
            ) : myOrders.length === 0 ? (
              /* HELPFUL EMPTY STATE FOR AUTHENTICATED USER WITH NO ORDERS */
              <div style={{ textAlign: 'center', padding: '64px 24px', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.02)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>📦</div>
                <h3 style={{ fontSize: '1.4rem', color: '#1a202c', margin: '0 0 8px 0' }}>No Orders Found</h3>
                <p style={{ color: '#718096', maxWidth: '440px', margin: '0 auto 24px auto', fontSize: '0.95rem', lineHeight: 1.5 }}>
                  You have not placed any orders with this account yet. When you place an order, its real-time shipment updates will appear right here.
                </p>
                <button 
                  type="button" 
                  onClick={() => onNavigate && onNavigate('shop', 'All')} 
                  style={{ backgroundColor: '#2d3b2d', color: '#fff', padding: '12px 28px', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer' }}
                >
                  Explore AURA Collections
                </button>
              </div>
            ) : (
              /* LIST OF CUSTOMER ORDERS */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {myOrders.map((ord) => (
                  <div key={ord._id || ord.orderId} style={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
                        <strong style={{ fontSize: '1.1rem', color: '#1a202c' }}>Order #{ord.orderId}</strong>
                        <span className={`order-status-pill ${getStatusBadgeClass(ord.status)}`}>
                          {ord.status || 'Pending'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.88rem', color: '#718096' }}>
                        <span>Placed on {formatDate(ord.createdAt)}</span>
                        <span style={{ margin: '0 8px' }}>•</span>
                        <span>{(ord.items || []).length} items</span>
                        <span style={{ margin: '0 8px' }}>•</span>
                        <strong style={{ color: '#2d3748' }}>₹{Number(ord.total || 0).toLocaleString('en-IN')}</strong>
                      </div>
                    </div>

                    <button 
                      type="button" 
                      onClick={() => setOrder(ord)} 
                      style={{ backgroundColor: '#2d3b2d', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
                    >
                      Track Order Details →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* 3. GUEST ORDER LOOKUP FLOW */
          <div className="track-lookup-card">
            <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#4a5d4e' }}>
              Secure Order Lookup
            </span>
            <h2 style={{ fontSize: '1.75rem', color: '#1a202c', margin: '6px 0 8px 0' }}>Track Your Order</h2>
            <p style={{ color: '#718096', fontSize: '0.92rem', marginBottom: '24px', lineHeight: 1.5 }}>
              Enter your Order ID and the email address used during checkout to view your real-time shipment status.
            </p>

            <form onSubmit={handleTrackGuest} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#2d3748', marginBottom: '6px' }}>
                  Order ID
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. AURA-XXXXX" 
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  required 
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#2d3748', marginBottom: '6px' }}>
                  Billing / Checkout Email Address
                </label>
                <input 
                  type="email" 
                  placeholder="e.g. name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                  style={{ width: '100%', padding: '12px 14px', border: '1px solid #cbd5e0', borderRadius: '8px', fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {error && (
                <div style={{ color: '#c53030', backgroundColor: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '6px', padding: '10px 14px', fontSize: '0.88rem' }}>
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                style={{ backgroundColor: '#2d3b2d', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '8px', fontWeight: 600, fontSize: '0.95rem', cursor: 'pointer', marginTop: '6px' }}
              >
                {loading ? 'Searching...' : 'Track Order Status'}
              </button>
            </form>

            <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid #edf2f7', textAlign: 'center', fontSize: '0.9rem', color: '#718096' }}>
              {currentUser ? (
                <button 
                  type="button" 
                  onClick={() => setMode('account')}
                  style={{ background: 'none', border: 'none', color: '#2d3b2d', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}
                >
                  ← Return to my account orders
                </button>
              ) : (
                <span>
                  Have an account?{' '}
                  <button 
                    type="button" 
                    onClick={() => onNavigate && onNavigate('login')}
                    style={{ background: 'none', border: 'none', color: '#2d3b2d', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer', padding: 0 }}
                  >
                    Sign in to view your order history
                  </button>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Guest or Account Return / Exchange Request Modal */}
        {showReturnModal && order && (
          <ReturnRequestModal
            order={order}
            isGuest={mode === 'guest' || !currentUser}
            guestEmail={email || order.customer?.email}
            onClose={() => setShowReturnModal(false)}
            onSuccess={() => {
              // Stay on page and allow viewing or tracking
            }}
          />
        )}

      </div>
    </div>
  );
}
