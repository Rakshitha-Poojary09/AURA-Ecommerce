import React, { useState } from 'react';
import './AdminLogin.css';
import { adminFetch, setAdminToken, setStoredAdminUser } from '../utils/apiClient';

export default function AdminLogin({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter both your administrator email and password.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await adminFetch('/api/auth/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed. Please verify your administrator credentials.');
      }

      if (!data.user || data.user.role !== 'admin') {
        throw new Error('Access denied. Administrator privileges required.');
      }

      // Store token and user details
      if (data.token) {
        setAdminToken(data.token);
      }
      setStoredAdminUser(data.user);

      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      console.error('Admin login error:', err);
      setErrorMessage(err.message || 'Could not connect to authentication server. Please check backend.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-login-wrapper">
      <div className="admin-login-container">
        
        {/* Brand Header */}
        <div className="admin-login-brand">
          <div className="admin-badge">ADMINISTRATION PORTAL</div>
          <h1 className="admin-brand-title">AURA</h1>
          <p className="admin-brand-subtitle">
            Executive Operations & Catalog Management
          </p>
        </div>

        {/* Login Card */}
        <div className="admin-login-card">
          <div className="card-header">
            <h2>Authorized Sign In</h2>
            <p>Enter your administrator credentials to access management controls.</p>
          </div>

          {errorMessage && (
            <div className="admin-login-alert" role="alert">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="admin-login-form" autoComplete="off">
            <div className="form-group">
              <label htmlFor="admin-email">Admin Email</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                  <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                <input
                  id="admin-email"
                  type="email"
                  required
                  placeholder="Enter administrator email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="off"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="admin-password">Password</label>
              <div className="input-wrapper">
                <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex="-1"
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                      <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary admin-submit-btn" 
              disabled={isLoading}
              id="admin-login-submit-btn"
            >
              {isLoading ? (
                <>
                  <svg className="spinning" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 2a10 10 0 0 1 10 10"></path>
                  </svg>
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                    <polyline points="10 17 15 12 10 7"></polyline>
                    <line x1="15" y1="12" x2="3" y2="12"></line>
                  </svg>
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="admin-login-footer">
            <span className="security-notice">
              🔒 Restricted to authorized boutique administrators only.
            </span>
          </div>
        </div>

      </div>
    </div>
  );
}
