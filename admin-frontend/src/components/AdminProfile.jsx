import React, { useState } from 'react';
import './AdminProfile.css';

export default function AdminProfile({ adminUser, onLogout }) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const adminName = adminUser?.name || 'AURA Executive Administrator';
  const adminEmail = adminUser?.email || 'admin@aura.com';
  const adminRole = adminUser?.role || 'admin';
  const adminId = adminUser?._id || 'AUR-ADM-SEC-01';

  return (
    <div className="admin-profile-view">
      {/* 1. Page Header */}
      <div className="profile-page-header">
        <div className="profile-header-text">
          <div className="profile-header-eyebrow">
            <span className="security-shield-icon">🛡️</span>
            <span>EXECUTIVE CREDENTIALS & SECURITY</span>
          </div>
          <h1 className="profile-header-title">Administrator Profile</h1>
          <p className="profile-header-desc">
            Manage your authenticated administrator session, review role permissions, and securely terminate access.
          </p>
        </div>

        <div className="profile-header-actions">
          <button 
            type="button" 
            className="btn-danger-outline header-logout-action-btn"
            onClick={() => setShowLogoutConfirm(true)}
            id="admin-profile-logout-btn"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
            <span>Terminate Session</span>
          </button>
        </div>
      </div>

      {/* 2. Main Profile Grid */}
      <div className="profile-content-grid">
        
        {/* Left Column: Identity Hero Card */}
        <div className="profile-card profile-hero-card">
          <div className="hero-avatar-wrapper">
            <div className="hero-avatar-ring">
              <div className="hero-avatar-circle">
                {adminName.charAt(0).toUpperCase()}
              </div>
            </div>
            <span className="hero-status-dot" title="Authenticated & Active Session"></span>
          </div>

          <div className="hero-identity-details">
            <h2 className="hero-admin-name">{adminName}</h2>
            <p className="hero-admin-email">{adminEmail}</p>
            <div className="hero-role-badge">
              <span className="role-sparkle">✦</span>
              <span className="role-label">{adminRole === 'admin' ? 'SYSTEM ADMINISTRATOR' : adminRole.toUpperCase()}</span>
            </div>
          </div>

          <div className="hero-quick-stats">
            <div className="quick-stat-item">
              <span className="stat-label">Access Level</span>
              <span className="stat-val">Full Privileges</span>
            </div>
            <div className="quick-stat-divider"></div>
            <div className="quick-stat-item">
              <span className="stat-label">Session Status</span>
              <span className="stat-val active-status">Active & Verified</span>
            </div>
          </div>

          <div className="hero-logout-section">
            <button
              type="button"
              className="btn-danger hero-logout-btn"
              onClick={() => setShowLogoutConfirm(true)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Sign Out of Admin Console</span>
            </button>
          </div>
        </div>

        {/* Right Column: Account Specifications & Security Information */}
        <div className="profile-details-column">
          
          {/* Card: Account Credentials Summary */}
          <div className="profile-card">
            <div className="profile-card-header">
              <div className="header-icon-box">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
              <div>
                <h3 className="card-title">Authenticated Identity Details</h3>
                <p className="card-subtitle">Verified credentials currently signed in</p>
              </div>
            </div>

            <div className="account-specs-table">
              {/* Full Name */}
              <div className="spec-row">
                <div className="spec-label-col">
                  <span className="spec-label">Admin Full Name</span>
                  <span className="spec-hint">Publicly displayed in executive logs</span>
                </div>
                <div className="spec-value-col">
                  <strong className="spec-primary-val" id="profile-admin-name">{adminName}</strong>
                </div>
              </div>

              {/* Email Address */}
              <div className="spec-row">
                <div className="spec-label-col">
                  <span className="spec-label">Primary Email</span>
                  <span className="spec-hint">Used for administrative authentication</span>
                </div>
                <div className="spec-value-col">
                  <div className="spec-value-interactive">
                    <span className="spec-code-val" id="profile-admin-email">{adminEmail}</span>
                    <button 
                      type="button" 
                      className="copy-btn"
                      onClick={() => handleCopy(adminEmail, 'email')}
                      title="Copy email to clipboard"
                    >
                      {copiedField === 'email' ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>
                </div>
              </div>

              {/* System Role */}
              <div className="spec-row">
                <div className="spec-label-col">
                  <span className="spec-label">System Role</span>
                  <span className="spec-hint">Authorization tier stored in MongoDB</span>
                </div>
                <div className="spec-value-col">
                  <span className="role-tag-pill" id="profile-admin-role">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    <span>{adminRole}</span>
                  </span>
                </div>
              </div>

              {/* Account ID */}
              <div className="spec-row">
                <div className="spec-label-col">
                  <span className="spec-label">Account Identifier</span>
                  <span className="spec-hint">Unique MongoDB ObjectID</span>
                </div>
                <div className="spec-value-col">
                  <span className="mono-badge">{adminId}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card: Architectural Security & Session Controls */}
          <div className="profile-card">
            <div className="profile-card-header">
              <div className="header-icon-box gold">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <div>
                <h3 className="card-title">Session Architecture & Protection</h3>
                <p className="card-subtitle">Security parameters enforcing frontend separation</p>
              </div>
            </div>

            <div className="security-features-grid">
              <div className="sec-feature-box">
                <div className="sec-feature-header">
                  <span className="check-bullet">✓</span>
                  <h4>Separate Frontend Application</h4>
                </div>
                <p>
                  Isolated Vite app on <strong>Port 5174</strong>. Completely removed from the customer storefront (Port 5173).
                </p>
              </div>

              <div className="sec-feature-box">
                <div className="sec-feature-header">
                  <span className="check-bullet">✓</span>
                  <h4>Strict Backend Authorization</h4>
                </div>
                <p>
                  Protected by <code>requireAdmin</code> middleware. Normal customer tokens receive <strong>403 Forbidden</strong>.
                </p>
              </div>

              <div className="sec-feature-box">
                <div className="sec-feature-header">
                  <span className="check-bullet">✓</span>
                  <h4>Zero Credential Exposure</h4>
                </div>
                <p>
                  Passwords and secrets are excluded from state, sanitized before response, and never hardcoded in client source.
                </p>
              </div>

              <div className="sec-feature-box">
                <div className="sec-feature-header">
                  <span className="check-bullet">✓</span>
                  <h4>Session Invalidation on Logout</h4>
                </div>
                <p>
                  Clicking Sign Out immediately purges authentication tokens and destroys session cookies, locking the console.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 3. Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="profile-modal-backdrop" onClick={() => setShowLogoutConfirm(false)}>
          <div className="profile-modal-box" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="modal-icon-badge danger">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>
            <h3 className="modal-title">Terminate Administrator Session?</h3>
            <p className="modal-desc">
              Signing out will invalidate your active administrative token, destroy your session cookie, and return to the login screen. You will not be able to navigate back using browser history.
            </p>
            <div className="modal-actions-row">
              <button 
                type="button" 
                className="btn-secondary"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-danger"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
              >
                Confirm Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
