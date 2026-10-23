import React, { useState } from 'react';
import './LoginPage.css';

export default function LoginPage({ 
  onNavigate, 
  onLoginSuccess 
}) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendStatus, setResendStatus] = useState('');
  const [isResending, setIsResending] = useState(false);

  const handleResendFromLogin = async () => {
    const targetEmail = unverifiedEmail || formData.email.trim().toLowerCase();
    if (!targetEmail) return;
    setIsResending(true);
    setResendStatus('');
    try {
      const response = await fetch('http://localhost:5000/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: targetEmail }),
      });
      const data = await response.json();
      setResendStatus(data.message || 'If an unverified account exists, a new verification link has been sent.');
    } catch (e) {
      setResendStatus('Could not send verification email. Please try again later.');
    } finally {
      setIsResending(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
    if (apiError) {
      setApiError('');
    }
  };

  const validate = () => {
    const newErrors = {};

    // 1. Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Please provide a valid email address';
    }

    // 2. Password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Sends & receives HTTP-only cookies
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 403 && data.requiresVerification) {
          setRequiresVerification(true);
          setUnverifiedEmail(formData.email.trim().toLowerCase());
          setResendStatus('');
          throw new Error(data.message || 'Please verify your email address before signing in.');
        }
        setRequiresVerification(false);
        throw new Error(data.message || 'Invalid email or password.');
      }

      if (onLoginSuccess) {
        onLoginSuccess(data.user);
      }
    } catch (err) {
      setApiError(err.message || 'Could not connect to authentication service.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="aura-auth-page">
      <div className="aura-container">
        <div className="auth-card-wrapper">
          
          {/* Breadcrumb Navigation */}
          <nav className="auth-breadcrumb" aria-label="Breadcrumb">
            <button className="auth-breadcrumb-link" onClick={() => onNavigate('home')}>
              Home
            </button>
            <span className="auth-breadcrumb-sep">/</span>
            <span className="auth-breadcrumb-active">Sign In</span>
          </nav>

          <div className="auth-card">
            {/* Header */}
            <div className="auth-header">
              <span className="auth-eyebrow">AURA CLIENT LOGIN</span>
              <h1 className="auth-title">Welcome Back</h1>
              <p className="auth-subtitle">
                Sign in to access your saved wardrobe, order tracking, and curated fashion recommendations.
              </p>
            </div>

            {/* Error Banner */}
            {apiError && (
              <div className="auth-error-banner" role="alert" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                  <span>{apiError}</span>
                </div>
                {requiresVerification && (
                  <div style={{ marginTop: '8px', paddingLeft: '26px' }}>
                    <button
                      type="button"
                      onClick={handleResendFromLogin}
                      disabled={isResending}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 0,
                        color: '#384935',
                        fontWeight: '600',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontSize: '0.86rem'
                      }}
                    >
                      {isResending ? 'Sending verification link...' : 'Resend verification email'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {resendStatus && (
              <div className="verify-success-banner" style={{ marginBottom: '16px' }} role="status">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
                <span>{resendStatus}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} noValidate className="auth-form">
              
              {/* Email */}
              <div className={`auth-field ${errors.email ? 'has-error' : ''}`}>
                <label htmlFor="login-email" className="auth-label">
                  Email Address <span className="req-star">*</span>
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  placeholder="ananya@example.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="auth-input"
                  autoComplete="email"
                />
                {errors.email && <span className="auth-field-error">{errors.email}</span>}
              </div>

              {/* Password */}
              <div className={`auth-field ${errors.password ? 'has-error' : ''}`}>
                <div className="auth-label-row">
                  <label htmlFor="login-password" className="auth-label">
                    Password <span className="req-star">*</span>
                  </label>
                  <button
                    type="button"
                    className="auth-forgot-password-link"
                    onClick={() => onNavigate('forgot-password')}
                    id="login-forgot-password-link"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="password-input-wrapper">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleChange}
                    className="auth-input"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                {errors.password && <span className="auth-field-error">{errors.password}</span>}
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                className="btn-primary auth-submit-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="auth-spinner"></span>
                    Signing In...
                  </>
                ) : (
                  <>
                    Sign In
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>

            </form>

            {/* Footer switcher */}
            <div className="auth-footer-switch">
              <span>Don't have an AURA account?</span>
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => onNavigate('register')}
              >
                Create an account
              </button>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}
