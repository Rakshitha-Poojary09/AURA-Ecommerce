import React, { useState, useEffect } from 'react';
import './VerifyEmailPage.css';
import { API_BASE } from '../utils/apiConfig';

/**
 * AURA Customer Email Verification Page
 * Handles 5 distinct states:
 * 1. loading: Verifying token with backend
 * 2. success: Email newly verified
 * 3. already-verified: Account already verified earlier
 * 4. expired: Token expired (with resend form)
 * 5. invalid: Invalid or missing token (with resend form)
 */
export default function VerifyEmailPage({ token, onNavigate }) {
  const [verificationState, setVerificationState] = useState('loading'); // 'loading' | 'success' | 'already-verified' | 'expired' | 'invalid'
  const [statusMessage, setStatusMessage] = useState('');
  const [userEmail, setUserEmail] = useState('');

  // Resend form state
  const [resendEmail, setResendEmail] = useState('');
  const [resendError, setResendError] = useState('');
  const [resendSuccess, setResendSuccess] = useState('');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    // If no token provided in URL, immediately set invalid state
    if (!token || !token.trim()) {
      setVerificationState('invalid');
      setStatusMessage('No email verification token was provided in the link.');
      return;
    }

    let isMounted = true;

    const verifyToken = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/verify-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ token: token.trim() })
        });

        const data = await response.json();

        if (!isMounted) return;

        if (response.ok && data.verified) {
          if (data.state === 'already-verified') {
            setVerificationState('already-verified');
            setStatusMessage(data.message || 'Your email address is already verified.');
          } else {
            setVerificationState('success');
            setStatusMessage(data.message || 'Your email address has been verified successfully!');
          }
          if (data.email) {
            setUserEmail(data.email);
            setResendEmail(data.email);
          }
        } else {
          if (data.state === 'expired') {
            setVerificationState('expired');
            setStatusMessage(data.message || 'This verification link has expired.');
          } else {
            setVerificationState('invalid');
            setStatusMessage(data.message || 'This verification link is invalid or has already been used.');
          }
          if (data.email) {
            setUserEmail(data.email);
            setResendEmail(data.email);
          }
        }
      } catch (err) {
        if (!isMounted) return;
        setVerificationState('invalid');
        setStatusMessage('Could not reach the verification service. Please try again later.');
      }
    };

    verifyToken();

    return () => {
      isMounted = false;
    };
  }, [token]);

  // Handle resend verification email
  const handleResend = async (e) => {
    e.preventDefault();
    setResendError('');
    setResendSuccess('');

    const cleanEmail = resendEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setResendError('Please enter your email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setResendError('Please enter a valid email address.');
      return;
    }

    setIsResending(true);

    try {
      const response = await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email: cleanEmail })
      });

      const data = await response.json();

      if (!response.ok && response.status === 429) {
        setResendError(data.message || 'Too many verification requests. Please wait a few minutes.');
      } else {
        // Neutral response
        setResendSuccess(data.message || 'If an unverified account exists for this email, a new verification link has been sent.');
      }
    } catch (err) {
      setResendError('Could not process resend request. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="aura-auth-page verify-email-page">
      <div className="aura-container">
        <div className="auth-card-wrapper">
          
          {/* Breadcrumb Navigation */}
          <nav className="auth-breadcrumb" aria-label="Breadcrumb">
            <button className="auth-breadcrumb-link" onClick={() => onNavigate('home')}>
              Home
            </button>
            <span className="auth-breadcrumb-sep">/</span>
            <span className="auth-breadcrumb-active">Verify Email</span>
          </nav>

          <div className="auth-card">
            
            {/* Header */}
            <div className="auth-header">
              <span className="auth-eyebrow">AURA CLIENT SECURITY</span>
              <h1 className="auth-title">Email Verification</h1>
            </div>

            {/* State 1: Loading */}
            {verificationState === 'loading' && (
              <div className="verify-state-card verify-loading-state">
                <div className="verify-spinner-wrap">
                  <div className="verify-spinner"></div>
                </div>
                <h2 className="verify-state-title">Verifying Your Email...</h2>
                <p className="verify-state-desc">
                  Please wait a moment while we validate your security credentials.
                </p>
              </div>
            )}

            {/* State 2: Success (Newly verified) */}
            {verificationState === 'success' && (
              <div className="verify-state-card verify-success-state">
                <div className="verify-icon-wrap verify-icon-success">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                </div>
                <h2 className="verify-state-title">Email Verified!</h2>
                <p className="verify-state-desc">
                  {statusMessage || 'Your email address has been successfully confirmed. Welcome to the AURA collective.'}
                </p>
                {userEmail && (
                  <div className="verify-email-badge">
                    <span>{userEmail}</span>
                  </div>
                )}
                <div className="verify-actions">
                  <button 
                    type="button" 
                    className="auth-submit-btn"
                    onClick={() => onNavigate('login')}
                  >
                    Sign In to Your Account
                  </button>
                  <button 
                    type="button" 
                    className="auth-btn-secondary"
                    onClick={() => onNavigate('home')}
                  >
                    Continue to Home
                  </button>
                </div>
              </div>
            )}

            {/* State 3: Already Verified */}
            {verificationState === 'already-verified' && (
              <div className="verify-state-card verify-already-verified-state">
                <div className="verify-icon-wrap verify-icon-info">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                </div>
                <h2 className="verify-state-title">Already Verified</h2>
                <p className="verify-state-desc">
                  {statusMessage || 'Your email address is already verified. You can sign in to your AURA account.'}
                </p>
                {userEmail && (
                  <div className="verify-email-badge">
                    <span>{userEmail}</span>
                  </div>
                )}
                <div className="verify-actions">
                  <button 
                    type="button" 
                    className="auth-submit-btn"
                    onClick={() => onNavigate('login')}
                  >
                    Sign In to Your Account
                  </button>
                  <button 
                    type="button" 
                    className="auth-btn-secondary"
                    onClick={() => onNavigate('home')}
                  >
                    Continue to Home
                  </button>
                </div>
              </div>
            )}

            {/* State 4: Expired Link */}
            {verificationState === 'expired' && (
              <div className="verify-state-card verify-expired-state">
                <div className="verify-icon-wrap verify-icon-warning">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <h2 className="verify-state-title">Verification Link Expired</h2>
                <p className="verify-state-desc">
                  For your security, verification links expire after 24 hours. Please enter your email below to receive a new link.
                </p>

                {/* Resend Verification Form */}
                <form onSubmit={handleResend} className="verify-resend-form" noValidate>
                  {resendError && (
                    <div className="auth-error-banner" role="alert">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span>{resendError}</span>
                    </div>
                  )}

                  {resendSuccess && (
                    <div className="verify-success-banner" role="status">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      <span>{resendSuccess}</span>
                    </div>
                  )}

                  <div className="auth-field">
                    <label htmlFor="resend-email" className="auth-label">
                      Registered Email Address
                    </label>
                    <input
                      id="resend-email"
                      type="email"
                      className="auth-input"
                      placeholder="client@aura.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      disabled={isResending}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="auth-submit-btn"
                    disabled={isResending}
                  >
                    {isResending ? 'Sending New Link...' : 'Resend Verification Email'}
                  </button>
                </form>

                <div className="verify-footer-links">
                  <button 
                    type="button" 
                    className="auth-switch-link"
                    onClick={() => onNavigate('login')}
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            )}

            {/* State 5: Invalid Link */}
            {verificationState === 'invalid' && (
              <div className="verify-state-card verify-invalid-state">
                <div className="verify-icon-wrap verify-icon-danger">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                </div>
                <h2 className="verify-state-title">Invalid Verification Link</h2>
                <p className="verify-state-desc">
                  This verification link is invalid, corrupted, or has already been consumed. Request a fresh verification link below:
                </p>

                {/* Resend Verification Form */}
                <form onSubmit={handleResend} className="verify-resend-form" noValidate>
                  {resendError && (
                    <div className="auth-error-banner" role="alert">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <span>{resendError}</span>
                    </div>
                  )}

                  {resendSuccess && (
                    <div className="verify-success-banner" role="status">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                      <span>{resendSuccess}</span>
                    </div>
                  )}

                  <div className="auth-field">
                    <label htmlFor="resend-invalid-email" className="auth-label">
                      Registered Email Address
                    </label>
                    <input
                      id="resend-invalid-email"
                      type="email"
                      className="auth-input"
                      placeholder="client@aura.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      disabled={isResending}
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="auth-submit-btn"
                    disabled={isResending}
                  >
                    {isResending ? 'Sending New Link...' : 'Resend Verification Email'}
                  </button>
                </form>

                <div className="verify-footer-links">
                  <button 
                    type="button" 
                    className="auth-switch-link"
                    onClick={() => onNavigate('login')}
                  >
                    Back to Sign In
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
