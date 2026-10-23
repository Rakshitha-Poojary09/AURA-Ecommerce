import React, { useState, useEffect } from 'react';
import './AccountPage.css';
import { normalizeProductImageUrl, handleImageError } from '../utils/imageUtils';
import ReturnRequestModal from './ReturnRequestModal';
import { API_BASE } from '../utils/apiConfig';

// Indian states list for address selection
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi'
];

export default function AccountPage({ 
  user, 
  onLogout, 
  onNavigate,
  onUserUpdate,
  wishlistCount = 0,
  initialTab = 'overview' 
}) {
  const [orders, setOrders] = useState([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(true);
  const [orderError, setOrderError] = useState(null);
  const [activeTab, setActiveTab] = useState(
    initialTab === 'orders' ? 'orders' : initialTab === 'returns' ? 'returns' : initialTab === 'addresses' ? 'addresses' : initialTab === 'password' ? 'password' : 'overview'
  );
  
  // Return & Exchange state
  const [returnRequests, setReturnRequests] = useState([]);
  const [isLoadingReturns, setIsLoadingReturns] = useState(false);
  const [returnRequestsError, setReturnRequestsError] = useState('');
  const [returnModalOrder, setReturnModalOrder] = useState(null);
  const [cancellingRequestId, setCancellingRequestId] = useState(null);
  const [selectedReturnRequest, setSelectedReturnRequest] = useState(null);
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  
  // Saved Addresses state
  const [addresses, setAddresses] = useState([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  const [addressError, setAddressError] = useState('');
  const [addressSuccessMsg, setAddressSuccessMsg] = useState('');
  const [isAddressFormOpen, setIsAddressFormOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressFormData, setAddressFormData] = useState({
    fullName: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pinCode: '',
    isDefault: false
  });
  const [addressFieldErrors, setAddressFieldErrors] = useState({});
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccessMsg, setPasswordSuccessMsg] = useState('');
  const [passwordErrorMsg, setPasswordErrorMsg] = useState('');
  
  // Detailed order modal state
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Profile edit form state
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessMsg, setProfileSuccessMsg] = useState('');
  const [profileErrorMsg, setProfileErrorMsg] = useState('');

  // Keep form data synced when user prop updates
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  // Sync tab if initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(['orders', 'returns', 'profile', 'addresses', 'password'].includes(initialTab) ? (initialTab === 'profile' ? 'overview' : initialTab) : 'overview');
    }
  }, [initialTab]);

  // Fetch logged in customer's actual order history from MongoDB backend
  useEffect(() => {
    let isMounted = true;

    const fetchMyOrders = async () => {
      setIsLoadingOrders(true);
      setOrderError(null);
      try {
        const response = await fetch(`${API_BASE}/api/orders/my-orders`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Sends HTTP-only cookie
        });

        if (response.status === 401) {
          // Session expired or unauthenticated: notify parent
          if (onLogout) onLogout();
          return;
        }

        if (!response.ok) {
          throw new Error('Failed to load order history.');
        }

        const data = await response.json();
        if (isMounted) {
          setOrders(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (isMounted) {
          setOrderError('Could not retrieve orders. Please check your connection.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingOrders(false);
        }
      }
    };

    if (user) {
      fetchMyOrders();
      fetchMyReturnRequests();
      fetchMyAddresses();
    }

    return () => {
      isMounted = false;
    };
  }, [user, onLogout]);

  // Fetch logged-in customer's saved addresses
  const fetchMyAddresses = async () => {
    setIsLoadingAddresses(true);
    setAddressError('');
    try {
      const response = await fetch(`${API_BASE}/api/auth/addresses`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setAddresses(Array.isArray(data.addresses) ? data.addresses : []);
      } else if (response.status === 401) {
        if (onLogout) onLogout();
      } else {
        setAddressError('Failed to load saved addresses.');
      }
    } catch (err) {
      setAddressError('Could not retrieve addresses. Please check your connection.');
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  // Open address modal/form for adding new or editing existing
  const handleOpenAddressForm = (addr = null) => {
    setAddressError('');
    setAddressSuccessMsg('');
    setAddressFieldErrors({});
    if (addr) {
      setEditingAddressId(addr._id);
      setAddressFormData({
        fullName: addr.fullName || '',
        phone: addr.phone || '',
        address: addr.address || '',
        city: addr.city || '',
        state: addr.state || '',
        pinCode: addr.pinCode || '',
        isDefault: Boolean(addr.isDefault)
      });
    } else {
      setEditingAddressId(null);
      setAddressFormData({
        fullName: user?.name || '',
        phone: user?.phone || '',
        address: '',
        city: '',
        state: '',
        pinCode: '',
        isDefault: addresses.length === 0
      });
    }
    setIsAddressFormOpen(true);
  };

  const handleCloseAddressForm = () => {
    setIsAddressFormOpen(false);
    setEditingAddressId(null);
    setAddressFieldErrors({});
  };

  const validateAddressForm = () => {
    const errs = {};
    if (!addressFormData.fullName.trim()) {
      errs.fullName = 'Recipient name is required';
    }
    if (!addressFormData.phone.trim()) {
      errs.phone = 'Contact phone number is required';
    } else if (!/^[0-9+() -]{7,15}$/.test(addressFormData.phone.trim())) {
      errs.phone = 'Please enter a valid phone number';
    }
    if (!addressFormData.address.trim() || addressFormData.address.trim().length < 5) {
      errs.address = 'Street address must be at least 5 characters';
    }
    if (!addressFormData.city.trim()) {
      errs.city = 'City is required';
    }
    if (!addressFormData.state.trim()) {
      errs.state = 'State is required';
    }
    if (!addressFormData.pinCode.trim() || !/^\d{6}$/.test(addressFormData.pinCode.trim())) {
      errs.pinCode = 'A valid 6-digit PIN code is required';
    }
    return errs;
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setAddressError('');
    setAddressSuccessMsg('');

    const validationErrors = validateAddressForm();
    if (Object.keys(validationErrors).length > 0) {
      setAddressFieldErrors(validationErrors);
      return;
    }

    setIsSavingAddress(true);
    try {
      const isEditing = Boolean(editingAddressId);
      const url = isEditing 
        ? `${API_BASE}/api/auth/addresses/${editingAddressId}`
        : `${API_BASE}/api/auth/addresses`;
      const method = isEditing ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: addressFormData.fullName.trim(),
          phone: addressFormData.phone.trim(),
          address: addressFormData.address.trim(),
          city: addressFormData.city.trim(),
          state: addressFormData.state.trim(),
          pinCode: addressFormData.pinCode.trim(),
          isDefault: addressFormData.isDefault
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to save address.');
      }

      setAddresses(Array.isArray(data.addresses) ? data.addresses : []);
      setAddressSuccessMsg(isEditing ? 'Delivery address updated successfully! ✨' : 'New delivery address saved! ✨');
      handleCloseAddressForm();
    } catch (err) {
      setAddressError(err.message || 'Error saving address. Please try again.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm('Are you sure you want to remove this delivery address?')) {
      return;
    }
    setAddressError('');
    setAddressSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/auth/addresses/${addressId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete address.');
      }
      setAddresses(Array.isArray(data.addresses) ? data.addresses : []);
      setAddressSuccessMsg('Address removed from your address book.');
    } catch (err) {
      setAddressError(err.message || 'Could not delete address.');
    }
  };

  const handleSetDefaultAddress = async (addressId) => {
    setAddressError('');
    setAddressSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE}/api/auth/addresses/${addressId}/default`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update default address.');
      }
      setAddresses(Array.isArray(data.addresses) ? data.addresses : []);
      setAddressSuccessMsg('Default delivery address updated! ✨');
    } catch (err) {
      setAddressError(err.message || 'Could not update default address.');
    }
  };

  // Handle password change submission
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordErrorMsg('');
    setPasswordSuccessMsg('');

    if (!passwordData.currentPassword) {
      setPasswordErrorMsg('Please enter your current password.');
      return;
    }
    if (!passwordData.newPassword || passwordData.newPassword.length < 6) {
      setPasswordErrorMsg('New password must be at least 6 characters long.');
      return;
    }
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordErrorMsg('New password and confirmation do not match.');
      return;
    }
    if (passwordData.currentPassword === passwordData.newPassword) {
      setPasswordErrorMsg('New password must be different from current password.');
      return;
    }

    setIsChangingPassword(true);
    try {
      
      const response = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword,
          confirmPassword: passwordData.confirmPassword
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to update password.');
      }

      setPasswordSuccessMsg('Your password has been changed successfully! ✨');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPasswordErrorMsg(err.message || 'Could not change password.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Fetch logged-in customer's return and exchange requests
  const fetchMyReturnRequests = async () => {
    setIsLoadingReturns(true);
    setReturnRequestsError('');
    try {
      const response = await fetch(`${API_BASE}/api/returns/my-requests`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        const reqList = Array.isArray(data) ? data : (Array.isArray(data?.requests) ? data.requests : []);
        setReturnRequests(reqList);
      } else if (response.status === 401) {
        if (onLogout) onLogout();
      } else {
        setReturnRequestsError('Failed to load return requests.');
      }
    } catch (err) {
      setReturnRequestsError('Could not retrieve return requests. Please check your connection.');
    } finally {
      setIsLoadingReturns(false);
    }
  };

  // Open details and status history modal for a return/exchange request
  const handleOpenReturnDetails = async (req) => {
    if (!req) return;
    setSelectedReturnRequest(req);
    const idToFetch = req.requestId || req._id;
    if (!idToFetch) return;

    try {
      setLoadingDetailId(req.requestId || req._id);
      const res = await fetch(`${API_BASE}/api/returns/my-requests/${encodeURIComponent(idToFetch)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        if (data.request) {
          setSelectedReturnRequest(data.request);
        }
      }
    } catch (err) {
      // Continue displaying the already loaded request
    } finally {
      setLoadingDetailId(null);
    }
  };

  // Cancel an active return/exchange request if allowed
  const handleCancelReturnRequest = async (requestId) => {
    if (!window.confirm(`Are you sure you want to cancel return request #${requestId}?`)) {
      return;
    }
    setCancellingRequestId(requestId);
    try {
      const res = await fetch(`${API_BASE}/api/returns/my-requests/${encodeURIComponent(requestId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || 'Unable to cancel return request.');
      } else {
        await fetchMyReturnRequests();
        if (selectedReturnRequest && (selectedReturnRequest.requestId === requestId || selectedReturnRequest._id === requestId)) {
          if (data.request) {
            setSelectedReturnRequest(data.request);
          } else {
            setSelectedReturnRequest(null);
          }
        }
      }
    } catch (err) {
      alert('Network error while cancelling request.');
    } finally {
      setCancellingRequestId(null);
    }
  };

  // Handle Profile Update submission
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setIsSavingProfile(true);
    setProfileSuccessMsg('');
    setProfileErrorMsg('');

    const trimmedName = formData.name.trim();
    const trimmedEmail = formData.email.trim().toLowerCase();
    const trimmedPhone = (formData.phone || '').trim();

    if (!trimmedName || trimmedName.length < 2) {
      setProfileErrorMsg('Please provide a full name of at least 2 characters.');
      setIsSavingProfile(false);
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setProfileErrorMsg('Please enter a valid email address.');
      setIsSavingProfile(false);
      return;
    }

    if (trimmedPhone && !/^[0-9+() -]{7,15}$/.test(trimmedPhone)) {
      setProfileErrorMsg('Please enter a valid phone number (7 to 15 digits).');
      setIsSavingProfile(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update profile.');
      }

      setProfileSuccessMsg('Profile details updated successfully! ✨');
      if (onUserUpdate && data.user) {
        onUserUpdate(data.user);
      }
    } catch (err) {
      setProfileErrorMsg(err.message || 'Could not update profile. Please try again.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // If user is not logged in
  if (!user) {
    return (
      <div className="aura-account-page">
        <div className="aura-container">
          <div className="account-empty-card">
            <h2>Authentication Required</h2>
            <p>Please sign in to access your personal AURA account and order history.</p>
            <button className="btn-primary" onClick={() => onNavigate('login')}>
              Sign In to Your Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Helper date formatter
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
      case 'pending':
      default:
        return 'status-pending';
    }
  };

  // Helper to determine status progress on 4-step timeline
  const getTimelineStepIndex = (status = '') => {
    const s = status.toLowerCase();
    if (s === 'delivered') return 3;
    if (s === 'shipped') return 2;
    if (s === 'processing') return 1;
    return 0; // 'pending' or 'placed'
  };

  const isCancelled = (status = '') => {
    return status.toLowerCase() === 'cancelled';
  };

  const memberSinceFormatted = user.createdAt 
    ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : 'Oct 2026';

  return (
    <div className="aura-account-page">
      <div className="aura-container">
        
        {/* Breadcrumb Navigation */}
        <nav className="account-breadcrumb" aria-label="Breadcrumb">
          <button className="account-breadcrumb-link" onClick={() => onNavigate('home')}>
            Home
          </button>
          <span className="account-breadcrumb-sep">/</span>
          <button 
            className="account-breadcrumb-link" 
            onClick={() => {
              setActiveTab('overview');
              if (onNavigate) onNavigate('account');
            }}
          >
            My Account
          </button>
          <span className="account-breadcrumb-sep">/</span>
          <span className="account-breadcrumb-active">
            {activeTab === 'orders' 
              ? 'My Orders' 
              : activeTab === 'returns' 
              ? 'Returns & Exchanges' 
              : activeTab === 'addresses' 
              ? 'Saved Addresses'
              : activeTab === 'password'
              ? 'Change Password'
              : 'Profile & Overview'}
          </span>
        </nav>

        {/* 2-Column Responsive Portal Layout */}
        <div className="account-layout-grid">
          
          {/* LEFT COLUMN: Customer Account Sidebar / Menu (Requirement 1 & 8) */}
          <aside className="account-sidebar">
            <div className="account-user-card">
              <div className="account-avatar-circle">
                {user.name ? user.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="account-user-meta">
                <span className="user-greeting">CLIENT PORTAL</span>
                <strong className="user-name-text">{user.name}</strong>
                <span className="user-email-text">{user.email}</span>
                <span className="user-tier-pill">Member Since {memberSinceFormatted}</span>
              </div>
            </div>

            <nav className="account-sidebar-nav" aria-label="Account Navigation">
              {/* 1. Profile / Overview */}
              <button 
                type="button" 
                className={`account-nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('overview');
                  if (onNavigate) onNavigate('account');
                }}
                id="account-nav-overview"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Profile</span>
              </button>

              {/* 2. My Orders */}
              <button 
                type="button" 
                className={`account-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('orders');
                  if (onNavigate) onNavigate('orders');
                }}
                id="account-nav-orders"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <path d="M16 10a4 4 0 0 1-8 0"></path>
                </svg>
                <span>My Orders</span>
                {orders.length > 0 && (
                  <span className="nav-badge-pill">{orders.length}</span>
                )}
              </button>

              {/* 3. Returns & Exchanges */}
              <button 
                type="button" 
                className={`account-nav-item ${activeTab === 'returns' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('returns');
                  fetchMyReturnRequests();
                }}
                id="account-nav-returns"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 4 1 10 7 10"></polyline>
                  <polyline points="23 20 23 14 17 14"></polyline>
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                </svg>
                <span>Returns & Exchanges</span>
                {returnRequests.length > 0 && (
                  <span className="nav-badge-pill">{returnRequests.length}</span>
                )}
              </button>

              {/* 4. My Wishlist (reusing existing page via onNavigate) */}
              <button 
                type="button" 
                className="account-nav-item"
                onClick={() => onNavigate && onNavigate('wishlist')}
                id="account-nav-wishlist"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <span>My Wishlist</span>
                {wishlistCount > 0 && (
                  <span className="nav-badge-pill gold">{wishlistCount}</span>
                )}
              </button>

              {/* 5. Saved Addresses */}
              <button 
                type="button" 
                className={`account-nav-item ${activeTab === 'addresses' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('addresses');
                  fetchMyAddresses();
                }}
                id="account-nav-addresses"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                  <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>Saved Addresses</span>
                {addresses.length > 0 && (
                  <span className="nav-badge-pill">{addresses.length}</span>
                )}
              </button>

              {/* 6. Change Password */}
              <button 
                type="button" 
                className={`account-nav-item ${activeTab === 'password' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('password');
                  setPasswordErrorMsg('');
                  setPasswordSuccessMsg('');
                }}
                id="account-nav-password"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <span>Change Password</span>
              </button>

              <div className="sidebar-divider"></div>

              {/* 7. Sign Out */}
              <button 
                type="button" 
                className="account-nav-item logout-nav-item"
                onClick={onLogout}
                id="account-nav-logout"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Sign Out</span>
              </button>
            </nav>
          </aside>

          {/* RIGHT COLUMN: Account Main Workspace */}
          <main className="account-main-content">
            
            {/* TAB 1: ACCOUNT OVERVIEW & PROFILE INFORMATION */}
            {activeTab === 'overview' && (
              <div className="account-tab-pane">
                
                {/* Header */}
                <div className="pane-header">
                  <div>
                    <h1 className="pane-title">Account Overview</h1>
                    <p className="pane-subtitle">
                      Personalized summary of your AURA boutique membership, active orders, and profile details.
                    </p>
                  </div>
                </div>

                {/* Requirement 2: Clean Summary Cards */}
                <div className="overview-summary-grid">
                  {/* Card 1: Customer Profile Overview */}
                  <div className="overview-card" id="summary-card-patron">
                    <div className="overview-card-header">
                      <span className="overview-label">Client Identity</span>
                      <div className="overview-icon-circle forest">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                          <circle cx="12" cy="7" r="4"></circle>
                        </svg>
                      </div>
                    </div>
                    <strong className="overview-main-val">{user.name}</strong>
                    <div className="overview-card-footer">
                      <span className="footer-subtext">{user.email}</span>
                      <span className="status-chip verified">Verified Patron</span>
                    </div>
                  </div>

                  {/* Card 2: Total Orders */}
                  <div className="overview-card" id="summary-card-orders">
                    <div className="overview-card-header">
                      <span className="overview-label">Total Orders</span>
                      <div className="overview-icon-circle gold">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                          <line x1="3" y1="6" x2="21" y2="6"></line>
                          <path d="M16 10a4 4 0 0 1-8 0"></path>
                        </svg>
                      </div>
                    </div>
                    <strong className="overview-main-val">{orders.length}</strong>
                    <div className="overview-card-footer">
                      <span className="footer-subtext">Actual MongoDB checkouts</span>
                      <button 
                        type="button" 
                        className="card-quick-link" 
                        onClick={() => setActiveTab('orders')}
                      >
                        View Orders →
                      </button>
                    </div>
                  </div>

                  {/* Card 3: Wishlist Count */}
                  <div className="overview-card" id="summary-card-wishlist">
                    <div className="overview-card-header">
                      <span className="overview-label">Saved Garments</span>
                      <div className="overview-icon-circle rose">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                      </div>
                    </div>
                    <strong className="overview-main-val">{wishlistCount}</strong>
                    <div className="overview-card-footer">
                      <span className="footer-subtext">Curated wishlist items</span>
                      <button 
                        type="button" 
                        className="card-quick-link" 
                        onClick={() => onNavigate && onNavigate('wishlist')}
                      >
                        Open Wishlist →
                      </button>
                    </div>
                  </div>

                  {/* Card 4: Member Since */}
                  <div className="overview-card" id="summary-card-membership">
                    <div className="overview-card-header">
                      <span className="overview-label">Membership</span>
                      <div className="overview-icon-circle sage">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"></circle>
                          <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                      </div>
                    </div>
                    <strong className="overview-main-val">{memberSinceFormatted}</strong>
                    <div className="overview-card-footer">
                      <span className="footer-subtext">AURA Sustainable Luxury</span>
                      <span className="status-chip active">Session Protected</span>
                    </div>
                  </div>
                </div>

                {/* Requirement 3: Profile Information (Edit Full Name, Edit Email, Save Changes) */}
                <div className="account-panel-card profile-settings-card">
                  <div className="panel-card-header">
                    <div>
                      <h2 className="panel-card-title">Profile Information</h2>
                      <p className="panel-card-subtitle">
                        Update your client details below. Passwords and credentials remain securely encrypted.
                      </p>
                    </div>
                  </div>

                  {profileSuccessMsg && (
                    <div className="account-alert-banner success" role="alert">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      <span>{profileSuccessMsg}</span>
                    </div>
                  )}

                  {profileErrorMsg && (
                    <div className="account-alert-banner error" role="alert">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span>{profileErrorMsg}</span>
                    </div>
                  )}

                  <form className="profile-edit-form" onSubmit={handleProfileSubmit}>
                    <div className="form-grid-two-col">
                      <div className="form-group">
                        <label htmlFor="customer-full-name" className="form-label">
                          Full Name <span className="required-star">*</span>
                        </label>
                        <input
                          id="customer-full-name"
                          type="text"
                          className="form-input"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder="Your full name"
                          required
                          disabled={isSavingProfile}
                        />
                        <span className="form-hint">Used for order confirmations and boutique communications.</span>
                      </div>

                      <div className="form-group">
                        <label htmlFor="customer-email" className="form-label">
                          Email Address <span className="required-star">*</span>
                        </label>
                        <input
                          id="customer-email"
                          type="email"
                          className="form-input"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder="name@example.com"
                          required
                          disabled={isSavingProfile}
                        />
                        <span className="form-hint">Your primary sign-in and shipment tracking contact.</span>
                      </div>

                      <div className="form-group">
                        <label htmlFor="customer-phone" className="form-label">
                          Phone Number
                        </label>
                        <input
                          id="customer-phone"
                          type="tel"
                          className="form-input"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          placeholder="e.g. 9876543210"
                          disabled={isSavingProfile}
                        />
                        <span className="form-hint">Used for courier delivery SMS and doorstep updates.</span>
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          Account Role & Tier
                        </label>
                        <input
                          type="text"
                          className="form-input readonly-input"
                          value="Verified Client (Protected)"
                          readOnly
                          disabled
                        />
                        <span className="form-hint">Protected system field. Administrator privileges are strictly separated.</span>
                      </div>
                    </div>

                    <div className="form-actions-row">
                      <button 
                        type="submit" 
                        className="btn-primary profile-save-btn"
                        disabled={isSavingProfile}
                        id="btn-save-profile"
                      >
                        {isSavingProfile ? (
                          <>
                            <span className="auth-spinner mini"></span>
                            <span>Saving Changes...</span>
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                              <polyline points="17 21 17 13 7 13 7 21"></polyline>
                              <polyline points="7 3 7 8 15 8"></polyline>
                            </svg>
                            <span>Save Changes</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>

              </div>
            )}

            {/* TAB 2: MY ORDERS (/account/orders) (Requirement 4 & 5 & 6) */}
            {activeTab === 'orders' && (
              <div className="account-tab-pane">
                
                {/* Header */}
                <div className="pane-header">
                  <div>
                    <h1 className="pane-title">My Orders</h1>
                    <p className="pane-subtitle">
                      Track and review all fashion orders placed with your AURA customer account.
                    </p>
                  </div>
                  <span className="orders-count-badge">
                    {orders.length} {orders.length === 1 ? 'Order' : 'Orders'}
                  </span>
                </div>

                {isLoadingOrders ? (
                  <div className="orders-loading-state">
                    <div className="auth-spinner"></div>
                    <span>Retrieving your order history from MongoDB...</span>
                  </div>
                ) : orderError ? (
                  <div className="orders-error-banner" role="alert">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{orderError}</span>
                  </div>
                ) : orders.length === 0 ? (
                  /* Requirement 12: Clean Empty State */
                  <div className="orders-empty-state">
                    <div className="empty-orders-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <path d="M16 10a4 4 0 0 1-8 0"></path>
                      </svg>
                    </div>
                    <h3>No orders yet.</h3>
                    <p>
                      You haven't placed any orders with AURA yet. Discover our latest collections, timeless luxury silhouettes, and conscious materials.
                    </p>
                    <button 
                      className="btn-primary empty-shop-btn" 
                      onClick={() => onNavigate('shop')}
                      id="btn-start-shopping"
                    >
                      Start Shopping
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  /* Orders List */
                  <div className="orders-list-wrapper">
                    {orders.map((ord) => (
                      <div 
                        key={ord._id || ord.orderId} 
                        className="order-card-card"
                        onClick={() => setSelectedOrder(ord)}
                        title="Click to view detailed order breakdown and status timeline"
                      >
                        {/* Order Header */}
                        <div className="order-card-header">
                          <div className="header-meta-group">
                            <span className="order-id-label">ORDER ID</span>
                            <strong className="order-id-code">{ord.orderId}</strong>
                          </div>

                          <div className="header-meta-group">
                            <span className="order-date-label">PLACED ON</span>
                            <span className="order-date-val">{formatDate(ord.createdAt)}</span>
                          </div>

                          <div className="header-meta-group">
                            <span className="order-total-label">TOTAL AMOUNT</span>
                            <strong className="order-total-amount">
                              ₹{Number(ord.total || 0).toLocaleString('en-IN')}
                            </strong>
                          </div>

                          <div className="header-meta-group status-meta">
                            <span className={`order-status-pill ${getStatusBadgeClass(ord.status)}`}>
                              {ord.status || 'Pending'}
                            </span>
                          </div>
                        </div>

                        {/* Order Items Preview */}
                        <div className="order-card-items-preview">
                          {(ord.items || []).map((item, idx) => (
                            <div key={idx} className="item-preview-row">
                              {item.image && (
                                <img 
                                  src={normalizeProductImageUrl(item.image)} 
                                  alt={item.name} 
                                  className="item-preview-thumb" 
                                  onError={handleImageError} 
                                />
                              )}
                              <div className="item-preview-info">
                                <strong className="item-preview-name">{item.name}</strong>
                                <div className="item-preview-tags">
                                  <span className="preview-size-tag">
                                    Size: <strong>{item.size || item.selectedSize || 'Standard'}</strong>
                                  </span>
                                  {(item.colorName || item.color || item.selectedColor) && (
                                    <span className="preview-size-tag preview-color-tag">
                                      Colour: <strong>{item.colorName || item.color || item.selectedColor}</strong>
                                    </span>
                                  )}
                                  <span className="preview-qty-tag">
                                    Qty: <strong>{item.quantity}</strong>
                                  </span>
                                  <span className="preview-price-tag">
                                    ₹{Number(item.price || 0).toLocaleString('en-IN')}
                                  </span>
                                </div>
                              </div>
                              <span className="item-preview-subtotal">
                                ₹{(Number(item.price || 0) * Number(item.quantity || 1)).toLocaleString('en-IN')}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Order Card Footer */}
                        <div className="order-card-actions-footer">
                          <div className="footer-address-snippet">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                              <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span>
                              {ord.shippingAddress?.city 
                                ? `Delivering to ${ord.shippingAddress.city}, ${ord.shippingAddress.state}`
                                : 'Delivery Address Recorded'}
                            </span>
                          </div>

                          <div className="order-card-buttons-group">
                            {ord.status?.toLowerCase() === 'delivered' && (
                              <button 
                                type="button" 
                                className="btn-secondary order-return-cta"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReturnModalOrder(ord);
                                }}
                                title="Request Return or Size Exchange for this delivered order"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <polyline points="1 4 1 10 7 10"></polyline>
                                  <polyline points="23 20 23 14 17 14"></polyline>
                                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                                </svg>
                                <span>Return or Exchange</span>
                              </button>
                            )}
                            <button 
                              type="button" 
                              className="btn-secondary order-details-cta"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedOrder(ord);
                              }}
                            >
                              <span>View Order Details & Timeline</span>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

            {/* TAB 3: RETURNS & EXCHANGES */}
            {activeTab === 'returns' && (
              <div className="account-tab-pane">
                
                {/* Header */}
                <div className="pane-header">
                  <div>
                    <h1 className="pane-title">Returns & Exchanges</h1>
                    <p className="pane-subtitle">
                      Manage and track all return and exchange requests lodged for your delivered AURA garments.
                    </p>
                  </div>
                  <span className="orders-count-badge">
                    {returnRequests.length} {returnRequests.length === 1 ? 'Request' : 'Requests'}
                  </span>
                </div>

                {isLoadingReturns ? (
                  <div className="orders-loading-state">
                    <div className="auth-spinner"></div>
                    <span>Retrieving return and exchange history from database...</span>
                  </div>
                ) : returnRequestsError ? (
                  <div className="orders-error-banner" role="alert">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{returnRequestsError}</span>
                  </div>
                ) : returnRequests.length === 0 ? (
                  <div className="orders-empty-state">
                    <div className="empty-orders-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <polyline points="1 4 1 10 7 10"></polyline>
                        <polyline points="23 20 23 14 17 14"></polyline>
                        <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"></path>
                      </svg>
                    </div>
                    <h3>No returns or exchanges yet</h3>
                    <p>
                      You currently have no return or exchange requests. Delivered items within our 14-day window can be returned or exchanged directly from your order history.
                    </p>
                    <button 
                      className="btn-primary empty-shop-btn" 
                      onClick={() => setActiveTab('orders')}
                    >
                      View Orders
                    </button>
                  </div>
                ) : (
                  <div className="return-requests-list">
                    {returnRequests.map((req) => (
                      <div 
                        key={req._id || req.requestId} 
                        className="return-request-card"
                        onClick={() => handleOpenReturnDetails(req)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpenReturnDetails(req); }}
                        title="Click to view full request details and status history"
                      >
                        
                        {/* Header */}
                        <div className="return-req-header">
                          <div className="req-header-left">
                            <span className={`request-type-badge ${req.requestType.toLowerCase()}`}>
                              {req.requestType === 'Exchange' ? '📏 Size Exchange' : '🔄 Return for Refund'}
                            </span>
                            <strong className="req-id-code">Request #{req.requestId}</strong>
                            <span className="req-order-ref">Original Order #{req.orderId}</span>
                          </div>
                          <div className="req-header-right">
                            <span className={`return-status-pill ${(req.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                              {req.status}
                            </span>
                            <span className="req-date-text">{formatDate(req.createdAt)}</span>
                          </div>
                        </div>

                        {/* Workflow Timeline Tracker */}
                        <div className="return-workflow-tracker">
                          {req.status === 'Rejected' ? (
                            <div className="special-terminal-banner rejected">
                              <span className="terminal-icon">✕</span>
                              <div>
                                <strong>Request Rejected</strong>
                                <p>Our boutique inspection team was unable to approve this request.</p>
                              </div>
                            </div>
                          ) : req.status === 'Cancelled' ? (
                            <div className="special-terminal-banner cancelled">
                              <span className="terminal-icon">ℹ</span>
                              <div>
                                <strong>Request Cancelled</strong>
                                <p>This request was cancelled by the customer prior to processing.</p>
                              </div>
                            </div>
                          ) : (
                            <div className="workflow-steps-row">
                              {['Requested', 'Approved', 'In Transit', 'Received and Inspected', 'Completed'].map((step, sIdx) => {
                                const workflowOrder = ['Requested', 'Approved', 'In Transit', 'Received and Inspected', 'Completed'];
                                const currentIdx = workflowOrder.indexOf(req.status);
                                const isDone = currentIdx > sIdx;
                                const isCurrent = currentIdx === sIdx;

                                return (
                                  <div key={step} className={`wf-step-node ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                                    <div className="wf-node-circle">
                                      {isDone ? '✓' : sIdx + 1}
                                    </div>
                                    <span className="wf-node-label">{step}</span>
                                    {sIdx < 4 && <div className={`wf-node-line ${isDone ? 'filled' : ''}`} />}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Items in Request */}
                        <div className="return-req-items-list">
                          {(req.items || []).map((it, idx) => (
                            <div key={idx} className="return-req-item-row">
                              <div className="return-req-item-details">
                                <strong className="return-item-title">{it.name}</strong>
                                <div className="return-item-pills">
                                  <span className="meta-pill">Size: <strong>{it.size}</strong></span>
                                  <span className="meta-pill">Quantity: <strong>{it.quantity}</strong></span>
                                  {req.requestType === 'Exchange' && it.replacementSize && (
                                    <span className="meta-pill exchange-target">
                                      Replacement: <strong>Size {it.replacementSize}</strong>
                                    </span>
                                  )}
                                  <span className="meta-pill reason-pill">
                                    Reason: {it.reason || req.reason}
                                  </span>
                                </div>
                                {it.customerComments && (
                                  <p className="return-item-note">"{it.customerComments}"</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Financial / Refund Banner */}
                        {req.requestType === 'Return' && (
                          <div className="return-financial-bar">
                            <div className="financial-amount-col">
                              <span className="financial-label">Eligible Refund Amount:</span>
                              <strong className="financial-amount">
                                ₹{Number(req.refundAmount || 0).toLocaleString('en-IN')}
                              </strong>
                              <span className="financial-subtext">
                                (Historical purchase value minus coupon discount)
                              </span>
                            </div>
                            <div className="financial-status-col">
                              <span className="financial-label">Refund Status:</span>
                              <span className={`refund-chip ${(req.refundStatus || '').toLowerCase()}`}>
                                {req.refundStatus === 'Completed' ? '✓ Refund Credited' : '⏳ Refund ' + (req.refundStatus || 'Pending')}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Admin Concierge Notes if provided */}
                        {req.adminNotes && (
                          <div className="admin-concierge-note">
                            <strong>AURA Concierge Update:</strong>
                            <p>{req.adminNotes}</p>
                          </div>
                        )}

                        {/* Footer with Details & Cancellation Action */}
                        <div className="return-card-actions" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn-secondary view-return-details-btn"
                            onClick={() => handleOpenReturnDetails(req)}
                          >
                            {loadingDetailId === (req.requestId || req._id) ? 'Loading...' : 'View Details & Status History'}
                          </button>
                          {req.status === 'Requested' && (
                            <button
                              type="button"
                              className="btn-secondary cancel-return-btn"
                              onClick={() => handleCancelReturnRequest(req.requestId)}
                              disabled={cancellingRequestId === req.requestId}
                            >
                              {cancellingRequestId === req.requestId ? 'Cancelling...' : 'Cancel Request'}
                            </button>
                          )}
                        </div>

                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

            {/* TAB 4: SAVED ADDRESSES */}
            {activeTab === 'addresses' && (
              <div className="account-tab-pane">
                
                {/* Header */}
                <div className="pane-header address-pane-header">
                  <div>
                    <h1 className="pane-title">Saved Addresses</h1>
                    <p className="pane-subtitle">
                      Manage your delivery destinations for expedited checkout and order dispatch.
                    </p>
                  </div>
                  {!isAddressFormOpen && (
                    <button 
                      type="button" 
                      className="btn-primary add-address-btn"
                      onClick={() => handleOpenAddressForm(null)}
                      id="btn-add-address"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                      </svg>
                      <span>Add New Address</span>
                    </button>
                  )}
                </div>

                {/* Notifications */}
                {addressSuccessMsg && (
                  <div className="account-alert-banner success" role="alert">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span>{addressSuccessMsg}</span>
                  </div>
                )}

                {addressError && (
                  <div className="account-alert-banner error" role="alert">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{addressError}</span>
                  </div>
                )}

                {/* Address Form Card (when adding or editing) */}
                {isAddressFormOpen && (
                  <div className="account-panel-card address-form-panel">
                    <div className="panel-card-header">
                      <div>
                        <h2 className="panel-card-title">
                          {editingAddressId ? 'Edit Delivery Address' : 'Add New Delivery Address'}
                        </h2>
                        <p className="panel-card-subtitle">
                          Provide complete destination details for secure luxury shipping.
                        </p>
                      </div>
                      <button 
                        type="button" 
                        className="form-close-btn"
                        onClick={handleCloseAddressForm}
                        aria-label="Close form"
                      >
                        ✕
                      </button>
                    </div>

                    <form className="address-form" onSubmit={handleSaveAddress}>
                      <div className="form-grid-two-col">
                        
                        {/* Recipient Full Name */}
                        <div className={`form-group ${addressFieldErrors.fullName ? 'has-error' : ''}`}>
                          <label className="form-label" htmlFor="addr-name">
                            Recipient Full Name <span className="required-star">*</span>
                          </label>
                          <input
                            id="addr-name"
                            type="text"
                            className="form-input"
                            value={addressFormData.fullName}
                            onChange={(e) => {
                              setAddressFormData({ ...addressFormData, fullName: e.target.value });
                              if (addressFieldErrors.fullName) setAddressFieldErrors({ ...addressFieldErrors, fullName: '' });
                            }}
                            placeholder="e.g. Ananya Sharma"
                            disabled={isSavingAddress}
                          />
                          {addressFieldErrors.fullName && (
                            <span className="field-error-text">{addressFieldErrors.fullName}</span>
                          )}
                        </div>

                        {/* Phone Number */}
                        <div className={`form-group ${addressFieldErrors.phone ? 'has-error' : ''}`}>
                          <label className="form-label" htmlFor="addr-phone">
                            Contact Phone Number <span className="required-star">*</span>
                          </label>
                          <input
                            id="addr-phone"
                            type="tel"
                            className="form-input"
                            value={addressFormData.phone}
                            onChange={(e) => {
                              setAddressFormData({ ...addressFormData, phone: e.target.value });
                              if (addressFieldErrors.phone) setAddressFieldErrors({ ...addressFieldErrors, phone: '' });
                            }}
                            placeholder="10-digit mobile number"
                            disabled={isSavingAddress}
                          />
                          {addressFieldErrors.phone && (
                            <span className="field-error-text">{addressFieldErrors.phone}</span>
                          )}
                        </div>

                        {/* Street Address */}
                        <div className={`form-group full-width ${addressFieldErrors.address ? 'has-error' : ''}`}>
                          <label className="form-label" htmlFor="addr-street">
                            Street Address <span className="required-star">*</span>
                          </label>
                          <input
                            id="addr-street"
                            type="text"
                            className="form-input"
                            value={addressFormData.address}
                            onChange={(e) => {
                              setAddressFormData({ ...addressFormData, address: e.target.value });
                              if (addressFieldErrors.address) setAddressFieldErrors({ ...addressFieldErrors, address: '' });
                            }}
                            placeholder="Flat / House no., Apartment, Street, Locality"
                            disabled={isSavingAddress}
                          />
                          {addressFieldErrors.address && (
                            <span className="field-error-text">{addressFieldErrors.address}</span>
                          )}
                        </div>

                        {/* City */}
                        <div className={`form-group ${addressFieldErrors.city ? 'has-error' : ''}`}>
                          <label className="form-label" htmlFor="addr-city">
                            City <span className="required-star">*</span>
                          </label>
                          <input
                            id="addr-city"
                            type="text"
                            className="form-input"
                            value={addressFormData.city}
                            onChange={(e) => {
                              setAddressFormData({ ...addressFormData, city: e.target.value });
                              if (addressFieldErrors.city) setAddressFieldErrors({ ...addressFieldErrors, city: '' });
                            }}
                            placeholder="e.g. Mumbai"
                            disabled={isSavingAddress}
                          />
                          {addressFieldErrors.city && (
                            <span className="field-error-text">{addressFieldErrors.city}</span>
                          )}
                        </div>

                        {/* State */}
                        <div className={`form-group ${addressFieldErrors.state ? 'has-error' : ''}`}>
                          <label className="form-label" htmlFor="addr-state">
                            State <span className="required-star">*</span>
                          </label>
                          <select
                            id="addr-state"
                            className="form-select"
                            value={addressFormData.state}
                            onChange={(e) => {
                              setAddressFormData({ ...addressFormData, state: e.target.value });
                              if (addressFieldErrors.state) setAddressFieldErrors({ ...addressFieldErrors, state: '' });
                            }}
                            disabled={isSavingAddress}
                          >
                            <option value="">Select State</option>
                            {INDIAN_STATES.map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                          {addressFieldErrors.state && (
                            <span className="field-error-text">{addressFieldErrors.state}</span>
                          )}
                        </div>

                        {/* PIN Code */}
                        <div className={`form-group ${addressFieldErrors.pinCode ? 'has-error' : ''}`}>
                          <label className="form-label" htmlFor="addr-pincode">
                            PIN Code <span className="required-star">*</span>
                          </label>
                          <input
                            id="addr-pincode"
                            type="text"
                            maxLength={6}
                            className="form-input"
                            value={addressFormData.pinCode}
                            onChange={(e) => {
                              setAddressFormData({ ...addressFormData, pinCode: e.target.value });
                              if (addressFieldErrors.pinCode) setAddressFieldErrors({ ...addressFieldErrors, pinCode: '' });
                            }}
                            placeholder="e.g. 400001"
                            disabled={isSavingAddress}
                          />
                          {addressFieldErrors.pinCode && (
                            <span className="field-error-text">{addressFieldErrors.pinCode}</span>
                          )}
                        </div>

                        {/* Set as Default Checkbox */}
                        <div className="form-group full-width">
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={addressFormData.isDefault}
                              onChange={(e) => setAddressFormData({ ...addressFormData, isDefault: e.target.checked })}
                              disabled={isSavingAddress}
                              className="checkbox-input"
                            />
                            <span>Make this my default delivery address</span>
                          </label>
                        </div>

                      </div>

                      {/* Action buttons */}
                      <div className="form-actions-row">
                        <button 
                          type="submit" 
                          className="btn-primary"
                          disabled={isSavingAddress}
                          id="btn-save-address"
                        >
                          {isSavingAddress ? (
                            <>
                              <span className="auth-spinner mini"></span>
                              <span>Saving Address...</span>
                            </>
                          ) : (
                            <span>{editingAddressId ? 'Update Address' : 'Save Address'}</span>
                          )}
                        </button>
                        <button 
                          type="button" 
                          className="btn-secondary"
                          onClick={handleCloseAddressForm}
                          disabled={isSavingAddress}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Loading State */}
                {isLoadingAddresses ? (
                  <div className="orders-loading-box">
                    <span className="orders-spinner"></span>
                    <p>Loading your saved addresses...</p>
                  </div>
                ) : addresses.length === 0 && !isAddressFormOpen ? (
                  /* Empty State */
                  <div className="account-empty-card">
                    <div className="empty-icon-box">
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                      </svg>
                    </div>
                    <h2>No Saved Addresses Found</h2>
                    <p>Save your home and office addresses for a fast, one-click checkout experience.</p>
                    <button 
                      type="button" 
                      className="btn-primary"
                      onClick={() => handleOpenAddressForm(null)}
                    >
                      Add Your First Address
                    </button>
                  </div>
                ) : (
                  /* Addresses Grid */
                  <div className="addresses-cards-grid">
                    {addresses.map((addr) => (
                      <div 
                        key={addr._id} 
                        className={`address-item-card ${addr.isDefault ? 'is-default' : ''}`}
                      >
                        <div className="address-card-header">
                          <div className="address-recipient-info">
                            <strong className="address-recipient-name">{addr.fullName || user.name}</strong>
                            {addr.phone && <span className="address-phone">{addr.phone}</span>}
                          </div>
                          {addr.isDefault && (
                            <span className="default-address-pill">DEFAULT</span>
                          )}
                        </div>

                        <p className="address-street-text">
                          {addr.address}
                        </p>
                        <p className="address-region-text">
                          {addr.city}, {addr.state} — <strong>{addr.pinCode}</strong>
                        </p>

                        <div className="address-card-actions">
                          {!addr.isDefault && (
                            <button 
                              type="button" 
                              className="address-action-link default-link"
                              onClick={() => handleSetDefaultAddress(addr._id)}
                            >
                              Set as Default
                            </button>
                          )}
                          <button 
                            type="button" 
                            className="address-action-link"
                            onClick={() => handleOpenAddressForm(addr)}
                          >
                            Edit
                          </button>
                          <button 
                            type="button" 
                            className="address-action-link delete-link"
                            onClick={() => handleDeleteAddress(addr._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

            {/* TAB 5: CHANGE PASSWORD */}
            {activeTab === 'password' && (
              <div className="account-tab-pane">
                
                {/* Header */}
                <div className="pane-header">
                  <div>
                    <h1 className="pane-title">Change Password</h1>
                    <p className="pane-subtitle">
                      Keep your boutique client credentials secure with an updated password.
                    </p>
                  </div>
                </div>

                <div className="account-panel-card password-settings-card">
                  
                  {passwordSuccessMsg && (
                    <div className="account-alert-banner success" role="alert">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      <span>{passwordSuccessMsg}</span>
                    </div>
                  )}

                  {passwordErrorMsg && (
                    <div className="account-alert-banner error" role="alert">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span>{passwordErrorMsg}</span>
                    </div>
                  )}

                  <form className="password-change-form" onSubmit={handleChangePassword}>
                    
                    {/* Current Password */}
                    <div className="form-group password-input-group">
                      <label htmlFor="current-password-input" className="form-label">
                        Current Password <span className="required-star">*</span>
                      </label>
                      <div className="password-input-wrapper">
                        <input
                          id="current-password-input"
                          type={showCurrentPassword ? 'text' : 'password'}
                          className="form-input"
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          placeholder="Enter current password"
                          required
                          disabled={isChangingPassword}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                          aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                        >
                          {showCurrentPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>

                    {/* New Password */}
                    <div className="form-group password-input-group">
                      <label htmlFor="new-password-input" className="form-label">
                        New Password <span className="required-star">*</span>
                      </label>
                      <div className="password-input-wrapper">
                        <input
                          id="new-password-input"
                          type={showNewPassword ? 'text' : 'password'}
                          className="form-input"
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          placeholder="At least 6 characters"
                          required
                          minLength={6}
                          disabled={isChangingPassword}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                        >
                          {showNewPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <span className="form-hint">Must be at least 6 characters. Use letters, numbers, and symbols for high security.</span>
                    </div>

                    {/* Confirm New Password */}
                    <div className="form-group password-input-group">
                      <label htmlFor="confirm-password-input" className="form-label">
                        Confirm New Password <span className="required-star">*</span>
                      </label>
                      <div className="password-input-wrapper">
                        <input
                          id="confirm-password-input"
                          type={showConfirmPassword ? 'text' : 'password'}
                          className="form-input"
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          placeholder="Re-enter new password"
                          required
                          minLength={6}
                          disabled={isChangingPassword}
                        />
                        <button
                          type="button"
                          className="password-toggle-btn"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? 'Hide' : 'Show'}
                        </button>
                      </div>
                    </div>

                    <div className="form-actions-row">
                      <button 
                        type="submit" 
                        className="btn-primary"
                        disabled={isChangingPassword}
                        id="btn-update-password"
                      >
                        {isChangingPassword ? (
                          <>
                            <span className="auth-spinner mini"></span>
                            <span>Updating Password...</span>
                          </>
                        ) : (
                          <>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                            <span>Update Password</span>
                          </>
                        )}
                      </button>
                    </div>

                  </form>

                </div>

              </div>
            )}

          </main>
        </div>

        {/* =========================================================================
           REQUIREMENT 5 & 6: DETAILED ORDER VIEW MODAL + ORDER STATUS TIMELINE
           ========================================================================= */}
        {selectedOrder && (
          <div className="order-modal-backdrop" onClick={() => setSelectedOrder(null)}>
            <div 
              className="order-modal-card" 
              role="dialog" 
              aria-modal="true" 
              aria-labelledby="modal-order-title"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div className="order-modal-header">
                <div>
                  <span className="modal-eyebrow">ORDER DETAILS & SHIPMENT TRACKING</span>
                  <h2 id="modal-order-title" className="modal-order-id">
                    Order {selectedOrder.orderId}
                  </h2>
                  <span className="modal-order-date">Placed on {formatDate(selectedOrder.createdAt)}</span>
                </div>

                <div className="modal-header-right">
                  <span className={`order-status-pill ${getStatusBadgeClass(selectedOrder.status)}`}>
                    {selectedOrder.status || 'Pending'}
                  </span>
                  <button 
                    type="button" 
                    className="modal-close-btn" 
                    onClick={() => setSelectedOrder(null)}
                    aria-label="Close order details modal"
                  >
                    ✕
                  </button>
                </div>
              </div>
              
              {selectedOrder.trackingNumber && (
                <div className="modal-section tracking-info-section" style={{ backgroundColor: '#f9f9f9', padding: '1rem', borderRadius: '4px', marginBottom: '1rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '14px', color: '#555' }}>Shipping Information</h4>
                  <p style={{ margin: '0 0 0.25rem 0' }}><strong>Courier:</strong> {selectedOrder.courierName || 'Standard Shipping'}</p>
                  <p style={{ margin: 0 }}><strong>Tracking Number:</strong> {selectedOrder.trackingNumber}</p>
                </div>
              )}

              {/* Requirement 6: Order Status Timeline */}
              <div className="modal-section timeline-section">
                <h3 className="modal-section-title">Order Status Timeline</h3>
                
                {isCancelled(selectedOrder.status) ? (
                  /* Cancelled State Banner */
                  <div className="cancelled-status-banner">
                    <div className="cancelled-icon-circle">✕</div>
                    <div className="cancelled-text">
                      <strong>Order Cancelled</strong>
                      <p>
                        This order has been cancelled. No further payment was collected, and inventory units have been safely restored.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Active 4-step Timeline or Dynamic Timeline */
                  <div className="order-status-timeline">
                    {selectedOrder.statusHistory && selectedOrder.statusHistory.length > 0 ? (
                      <div className="dynamic-timeline">
                        {selectedOrder.statusHistory.map((historyItem, sIdx) => (
                          <div key={sIdx} className="timeline-history-item" style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <div className="timeline-history-dot" style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: sIdx === selectedOrder.statusHistory.length - 1 ? '#000' : '#ccc', marginRight: '1rem' }}></div>
                            <div style={{ flex: 1 }}>
                              <strong style={{ display: 'block' }}>{historyItem.status}</strong>
                              <span style={{ fontSize: '12px', color: '#666' }}>{formatDate(historyItem.timestamp)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="order-status-timeline">
                        {['Placed', 'Processing', 'Shipped', 'Delivered'].map((stepName, sIdx) => {
                          const currentActiveIdx = getTimelineStepIndex(selectedOrder.status);
                          const isComplete = sIdx < currentActiveIdx;
                          const isCurrent = sIdx === currentActiveIdx;
    
                          return (
                            <div 
                              key={stepName} 
                              className={`timeline-step ${isComplete ? 'complete' : ''} ${isCurrent ? 'current' : ''}`}
                            >
                              <div className="timeline-node">
                                {isComplete ? (
                                  <span className="step-check">✓</span>
                                ) : (
                                  <span className="step-num">{sIdx + 1}</span>
                                )}
                              </div>
                              <span className="timeline-label">{stepName}</span>
                              {sIdx < 3 && (
                                <div className={`timeline-connector ${sIdx < currentActiveIdx ? 'filled' : ''}`}></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Requirement 5: Items list with Product Image, Name, Selected Size, Quantity, Price, Subtotal */}
              <div className="modal-section items-section">
                <h3 className="modal-section-title">Purchased Items ({(selectedOrder.items || []).length})</h3>
                <div className="modal-items-table">
                  {(selectedOrder.items || []).map((it, idx) => (
                    <div key={idx} className="modal-item-row">
                      <img 
                        src={normalizeProductImageUrl(it.image)} 
                        alt={it.name} 
                        className="modal-item-image"
                        onError={handleImageError} 
                      />
                      <div className="modal-item-details">
                        <strong className="modal-item-name">{it.name}</strong>
                        <div className="modal-item-meta">
                          <span className="size-badge-pill">
                            Selected Size: <strong>{it.size || it.selectedSize || 'Standard'}</strong>
                          </span>
                          {(it.colorName || it.color || it.selectedColor) && (
                            <span className="size-badge-pill color-badge-pill">
                              Colour: <strong>{it.colorName || it.color || it.selectedColor}</strong>
                            </span>
                          )}
                          <span className="qty-badge-pill">
                            Quantity: <strong>{it.quantity}</strong>
                          </span>
                          <span className="unit-price-pill">
                            Unit Price: <strong>₹{Number(it.price || 0).toLocaleString('en-IN')}</strong>
                          </span>
                        </div>
                      </div>
                      <div className="modal-item-subtotal">
                        <span className="subtotal-label">Subtotal</span>
                        <strong className="subtotal-val">
                          ₹{(Number(it.price || 0) * Number(it.quantity || 1)).toLocaleString('en-IN')}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Order Financials & Shipping Summary */}
              <div className="modal-summary-grid">
                {/* Shipping Address */}
                <div className="modal-info-box">
                  <h4 className="info-box-title">Shipping Information</h4>
                  <p className="shipping-recipient-name">
                    {selectedOrder.customer?.fullName || user.name}
                  </p>
                  <p className="shipping-address-lines">
                    {selectedOrder.shippingAddress?.address ? (
                      <>
                        {selectedOrder.shippingAddress.address}<br />
                        {selectedOrder.shippingAddress.city}, {selectedOrder.shippingAddress.state} - {selectedOrder.shippingAddress.pinCode}
                      </>
                    ) : (
                      'Delivery address details recorded.'
                    )}
                  </p>
                  <span className="shipping-phone-line">
                    Phone: {selectedOrder.customer?.phone || 'On file'}
                  </span>
                </div>

                {/* Payment & Totals */}
                <div className="modal-info-box totals-box">
                  <h4 className="info-box-title">Payment & Totals</h4>
                  <div className="receipt-row">
                    <span>Payment Method:</span>
                    <strong>{selectedOrder.paymentMethod || 'Cash on Delivery (COD)'}</strong>
                  </div>
                  <div className="receipt-row">
                    <span>Subtotal:</span>
                    <span>₹{Number(selectedOrder.subtotal || selectedOrder.total || 0).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="receipt-row">
                    <span>Shipping:</span>
                    <span>{selectedOrder.shipping === 0 ? 'FREE' : `₹${selectedOrder.shipping}`}</span>
                  </div>
                  <div className="receipt-divider"></div>
                  <div className="receipt-row grand-total">
                    <span>Total Amount:</span>
                    <strong>₹{Number(selectedOrder.total || 0).toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="order-modal-footer">
                {selectedOrder.status?.toLowerCase() === 'delivered' && (
                  <button 
                    type="button" 
                    className="btn-primary modal-return-action-btn" 
                    onClick={() => {
                      const targetOrd = selectedOrder;
                      setSelectedOrder(null);
                      setReturnModalOrder(targetOrd);
                    }}
                  >
                    🔄 Return or Exchange Garments
                  </button>
                )}
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setSelectedOrder(null)}
                >
                  Close Details
                </button>
              </div>

            </div>
          </div>
        )}

        {/* =========================================================================
           RETURN & EXCHANGE REQUEST DETAILS & STATUS HISTORY MODAL
           ========================================================================= */}
        {selectedReturnRequest && (
          <div className="order-modal-backdrop" onClick={() => setSelectedReturnRequest(null)}>
            <div 
              className="order-modal-card return-detail-modal-card" 
              role="dialog" 
              aria-modal="true" 
              aria-labelledby="modal-return-title"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div className="order-modal-header">
                <div>
                  <span className="modal-eyebrow">RETURN & EXCHANGE AUDIT & STATUS TIMELINE</span>
                  <h2 id="modal-return-title" className="modal-order-id">
                    Request #{selectedReturnRequest.requestId}
                  </h2>
                  <span className="modal-order-date">
                    Original Order #{selectedReturnRequest.orderId} • Requested on {formatDate(selectedReturnRequest.createdAt)}
                  </span>
                </div>

                <div className="modal-header-right">
                  <span className={`return-status-pill ${(selectedReturnRequest.status || '').toLowerCase().replace(/\s+/g, '-')}`}>
                    {selectedReturnRequest.status}
                  </span>
                  <button 
                    type="button" 
                    className="modal-close-btn" 
                    onClick={() => setSelectedReturnRequest(null)}
                    aria-label="Close return details modal"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Workflow Status Tracker */}
              <div className="modal-section timeline-section">
                <h3 className="modal-section-title">Workflow Progress</h3>
                {selectedReturnRequest.status === 'Rejected' ? (
                  <div className="special-terminal-banner rejected">
                    <span className="terminal-icon">✕</span>
                    <div>
                      <strong>Request Rejected</strong>
                      <p>Our boutique inspection team was unable to approve this request.</p>
                    </div>
                  </div>
                ) : selectedReturnRequest.status === 'Cancelled' ? (
                  <div className="special-terminal-banner cancelled">
                    <span className="terminal-icon">ℹ</span>
                    <div>
                      <strong>Request Cancelled</strong>
                      <p>This request was cancelled by the customer prior to processing.</p>
                    </div>
                  </div>
                ) : (
                  <div className="workflow-steps-row">
                    {['Requested', 'Approved', 'In Transit', 'Received and Inspected', 'Completed'].map((step, sIdx) => {
                      const workflowOrder = ['Requested', 'Approved', 'In Transit', 'Received and Inspected', 'Completed'];
                      const currentIdx = workflowOrder.indexOf(selectedReturnRequest.status);
                      const isDone = currentIdx > sIdx;
                      const isCurrent = currentIdx === sIdx;

                      return (
                        <div key={step} className={`wf-step-node ${isDone ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
                          <div className="wf-node-circle">
                            {isDone ? '✓' : sIdx + 1}
                          </div>
                          <span className="wf-node-label">{step}</span>
                          {sIdx < 4 && <div className={`wf-node-line ${isDone ? 'filled' : ''}`} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Items Section */}
              <div className="modal-section">
                <h3 className="modal-section-title">Requested Items</h3>
                <div className="modal-items-list">
                  {(selectedReturnRequest.items || []).map((item, idx) => (
                    <div key={idx} className="modal-item-row" style={{ display: 'flex', gap: '16px', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid #f2eee9' }}>
                      {item.image && (
                        <img 
                          src={normalizeProductImageUrl(item.image)} 
                          alt={item.name} 
                          onError={handleImageError}
                          style={{ width: '60px', height: '75px', objectFit: 'cover', borderRadius: '4px' }}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.name}</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                          <span className="meta-pill">Size: <strong>{item.size}</strong></span>
                          <span className="meta-pill">Quantity: <strong>{item.quantity}</strong></span>
                          {selectedReturnRequest.requestType === 'Exchange' && item.replacementSize && (
                            <span className="meta-pill exchange-target">
                              Replacement: <strong>Size {item.replacementSize}</strong>
                            </span>
                          )}
                          <span className="meta-pill reason-pill">Reason: {item.reason || selectedReturnRequest.reason}</span>
                        </div>
                        {item.customerComments && (
                          <p style={{ margin: '6px 0 0', fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
                            "{item.customerComments}"
                          </p>
                        )}
                      </div>
                      {selectedReturnRequest.requestType === 'Return' && item.eligibleRefundAmount > 0 && (
                        <div style={{ textAlign: 'right', fontWeight: 600, color: '#059669' }}>
                          ₹{item.eligibleRefundAmount.toLocaleString('en-IN')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Financial / Refund Details */}
              {selectedReturnRequest.requestType === 'Return' && (
                <div className="modal-section" style={{ backgroundColor: '#fdfaf7', padding: '16px', borderRadius: '8px', border: '1px dashed #e2b7b5' }}>
                  <h3 className="modal-section-title" style={{ margin: '0 0 10px 0' }}>Refund & Settlement Overview</h3>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', display: 'block' }}>Eligible Refund Amount</span>
                      <strong style={{ fontSize: '1.25rem', color: '#059669' }}>
                        ₹{Number(selectedReturnRequest.refundAmount || 0).toLocaleString('en-IN')}
                      </strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#6b7280', display: 'block' }}>Refund Status</span>
                      <span className={`refund-chip ${(selectedReturnRequest.refundStatus || '').toLowerCase()}`}>
                        {selectedReturnRequest.refundStatus === 'Completed' ? '✓ Refund Credited' : '⏳ Refund ' + (selectedReturnRequest.refundStatus || 'Pending')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Status History & Audit Trail */}
              <div className="modal-section timeline-section">
                <h3 className="modal-section-title">Audit History & Status Timeline</h3>
                {selectedReturnRequest.statusHistory && selectedReturnRequest.statusHistory.length > 0 ? (
                  <div className="return-audit-timeline">
                    {selectedReturnRequest.statusHistory.map((hist, hIdx) => (
                      <div key={hIdx} className="return-audit-node">
                        <div className="return-audit-dot"></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className={`return-status-pill ${(hist.status || '').toLowerCase().replace(/\s+/g, '-')}`} style={{ fontSize: '0.75rem' }}>
                            {hist.status}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                            {new Date(hist.timestamp).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: '#4b5563', marginTop: '2px' }}>
                          {hist.message || `Status updated to ${hist.status}`}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                          Updated by: {hist.updatedBy || 'AURA Boutique'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: '#9ca3af', fontSize: '0.85rem' }}>No status history logged yet.</p>
                )}
              </div>

              {/* Admin Notes if present */}
              {selectedReturnRequest.adminNotes && (
                <div className="modal-section">
                  <div className="admin-concierge-note">
                    <strong>AURA Concierge Update:</strong>
                    <p>{selectedReturnRequest.adminNotes}</p>
                  </div>
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="order-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #f2eee9' }}>
                {selectedReturnRequest.status === 'Requested' ? (
                  <button
                    type="button"
                    className="btn-secondary cancel-return-btn"
                    onClick={() => handleCancelReturnRequest(selectedReturnRequest.requestId)}
                    disabled={cancellingRequestId === selectedReturnRequest.requestId}
                  >
                    {cancellingRequestId === selectedReturnRequest.requestId ? 'Cancelling...' : 'Cancel Request'}
                  </button>
                ) : (
                  <div></div>
                )}
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => setSelectedReturnRequest(null)}
                >
                  Close Details
                </button>
              </div>

            </div>
          </div>
        )}



        {/* =========================================================================
           RETURN & EXCHANGE REQUEST MODAL
           ========================================================================= */}
        {returnModalOrder && (
          <ReturnRequestModal
            order={returnModalOrder}
            isGuest={false}
            onClose={() => setReturnModalOrder(null)}
            onSuccess={() => {
              fetchMyReturnRequests();
              setActiveTab('returns');
            }}
          />
        )}

      </div>
    </div>
  );
}
