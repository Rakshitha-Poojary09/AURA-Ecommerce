import React, { useState, useEffect, useCallback } from 'react';
import AdminLogin from './components/AdminLogin';
import AdminDashboard from './components/AdminDashboard';
import { 
  setStoredAdminUser, 
  getAdminToken,
  clearAdminAuth, 
  adminFetch 
} from './utils/apiClient';

const ROUTE_MAP = {
  '': 'Dashboard',
  'dashboard': 'Dashboard',
  'products': 'Products',
  'orders': 'Orders',
  'returns': 'Returns',
  'coupons': 'Coupons',
  'customers': 'Customers',
  'reviews': 'Reviews',
  'notifications': 'Notifications',
  'profile': 'Profile'
};

const getMenuFromPath = (path) => {
  const clean = (path || '').replace(/^\/+/, '').split('/')[0].toLowerCase();
  return ROUTE_MAP[clean] || 'Dashboard';
};

const getPathForMenu = (menu) => {
  if (!menu || menu === 'Dashboard') return '/';
  return `/${menu.toLowerCase()}`;
};

export default function App() {
  // CRITICAL SECURITY REQUIREMENT:
  // adminUser MUST start as null. Never treat localStorage as proof of authentication.
  // Access to protected admin views is granted ONLY after the backend validates the session.
  const [adminUser, setAdminUser] = useState(null);
  const [isVerifying, setIsVerifying] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  
  // Track active menu from browser URL
  const [activeMenu, setActiveMenu] = useState(() => {
    if (typeof window !== 'undefined') {
      return getMenuFromPath(window.location.pathname);
    }
    return 'Dashboard';
  });

  const showToast = (message) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage('');
    }, 3500);
  };

  // Central session verification with backend
  const verifySession = useCallback(async () => {
    try {
      const response = await adminFetch('/api/auth/admin/me');
      if (response.ok) {
        const data = await response.json();
        if (data.user && data.user.role === 'admin') {
          setAdminUser(data.user);
          setStoredAdminUser(data.user);
          return true;
        } else {
          clearAdminAuth();
          setAdminUser(null);
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '/login');
          }
          return false;
        }
      } else {
        clearAdminAuth();
        setAdminUser(null);
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', '/login');
        }
        return false;
      }
    } catch (err) {
      clearAdminAuth();
      setAdminUser(null);
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '/login');
      }
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  // Verify on initial load
  useEffect(() => {
    verifySession();
  }, [verifySession]);

  // Handle unauthorized / expired session events dispatched from adminFetch
  useEffect(() => {
    const handleUnauthorized = () => {
      clearAdminAuth();
      setAdminUser((currentUser) => {
        if (currentUser) {
          showToast('Administrator session expired. Please sign in again.');
        }
        return null;
      });
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '/login');
      }
    };

    window.addEventListener('aura:admin:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('aura:admin:unauthorized', handleUnauthorized);
  }, []);

  // Prevent browser back button from accessing protected view after logout or when unauthenticated
  useEffect(() => {
    const handlePopState = () => {
      if (!adminUser) {
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', '/login');
        }
        return;
      }
      // If authenticated, sync menu with URL
      const currentRoute = getMenuFromPath(window.location.pathname);
      setActiveMenu(currentRoute);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [adminUser]);

  // Handle bfcache restorations (pageshow)
  useEffect(() => {
    const handlePageShow = (e) => {
      if (e.persisted) {
        verifySession();
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [verifySession]);

  const handleNavigate = (menu) => {
    setActiveMenu(menu);
    const newPath = getPathForMenu(menu);
    if (window.location.pathname !== newPath) {
      window.history.pushState(null, '', newPath);
    }
  };

  const handleLoginSuccess = (user) => {
    setAdminUser(user);
    // Explicit Requirement: Redirect directly to the Admin Dashboard upon authentication
    setActiveMenu('Dashboard');
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '/');
    }
    showToast(`Welcome back, ${user.name}! Administrative console unlocked ✨`);
  };

  const handleLogout = async () => {
    try {
      await adminFetch('/api/auth/admin/logout', { method: 'POST' });
    } catch (e) {
      // Ignore network errors during logout
    }
    clearAdminAuth();
    setAdminUser(null);
    setActiveMenu('Dashboard');

    // Replace current history entry so browser Back button cannot restore protected dashboard
    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, '', '/login');
    }

    showToast('Signed out of administrative console.');
  };

  if (isVerifying) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1f271c',
        color: '#e2b7b5',
        fontFamily: 'var(--font-family-base, Inter, sans-serif)',
        gap: '16px'
      }}>
        <div style={{
          width: '36px',
          height: '36px',
          border: '3px solid rgba(226, 183, 181, 0.2)',
          borderTopColor: '#e2b7b5',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }}></div>
        <span style={{ fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#c5cec2' }}>
          Verifying Administrator Session...
        </span>
      </div>
    );
  }

  return (
    <div className="admin-app">
      {!adminUser ? (
        <AdminLogin onLoginSuccess={handleLoginSuccess} />
      ) : (
        <AdminDashboard 
          adminUser={adminUser} 
          activeMenu={activeMenu}
          onNavigate={handleNavigate}
          onLogout={handleLogout} 
        />
      )}

      {toastMessage && (
        <div className="aura-toast" role="alert">
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
