import React, { useState } from 'react';
import './RegisterPage.css';
import { API_BASE } from '../utils/apiConfig';

export default function RegisterPage({ 
  onNavigate, 
  onRegisterSuccess 
}) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Email verification confirmation screen state
  const [isVerificationPending, setIsVerificationPending] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [deliveryNotice, setDeliveryNotice] = useState('');
  const [resendStatus, setResendStatus] = useState('');
  const [isResending, setIsResending] = useState(false);

  const handleResendVerification = async () => {
    if (!registeredEmail) return;
    setIsResending(true);
    setResendStatus('');
    try {
      const response = await fetch(`${API_BASE}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email: registeredEmail }),
      });
      const data = await response.json();
      setResendStatus(data.message || 'If an unverified account exists, a new verification link has been sent.');
    } catch (e) {
      setResendStatus('Could not resend verification email. Please try again later.');
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

    // 1. Full Name
    if (!formData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = 'Please enter your complete name';
    }

    // 2. Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!emailRegex.test(formData.email.trim())) {
      newErrors.email = 'Please provide a valid email address';
    }

    // 3. Password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long';
    }

    // 4. Confirm Password
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Sends & receives HTTP-only cookies
        body: JSON.stringify({
          fullName: formData.fullName.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          confirmPassword: formData.confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed. Please try again.');
      }

      if (data.requiresVerification) {
        setRegisteredEmail(formData.email.trim().toLowerCase());
        setIsVerificationPending(true);
        if (data.emailDelivery && data.emailDelivery.delivered === false && data.emailDelivery.reason === 'SMTP_NOT_CONFIGURED') {
          setDeliveryNotice('Note: Email delivery is not configured on this server. Please configure SMTP in backend/.env to deliver live emails.');
        }
        return;
      }

      if (onRegisterSuccess) {
        onRegisterSuccess(data.user);
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
            <span className="auth-breadcrumb-active">Create Account</span>
          </nav>

          <div className="auth-card">
            {isVerificationPending ? (
              <div className="verify-state-card verify-success-state" style={{ padding: '20px 0' }}>
                <div className="verify-icon-wrap verify-icon-success">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </div>
                <h2 className="verify-state-title">Verify Your Email Address</h2>
                <p className="verify-state-desc">
                  Thank you for joining AURA. We have sent a verification link to your email address:
                </p>
                <div className="verify-email-badge">
                  <span>{registeredEmail}</span>
                </div>
                <p className="verify-state-desc" style={{ fontSize: '0.88rem', marginTop: '-12px' }}>
                  Please click the link in your email to activate your account. If you do not see it within a couple of minutes, please check your spam folder.
                </p>

                {deliveryNotice && (
                  <div className="auth-error-banner" style={{ background: '#FAF7F2', borderColor: '#E2B7B5', color: '#666', marginBottom: '20px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b9770e" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{deliveryNotice}</span>
                  </div>
                )}

                {resendStatus && (
                  <div className="verify-success-banner" style={{ marginBottom: '20px', width: '100%' }}>
                    <span>{resendStatus}</span>
                  </div>
                )}

                <div className="verify-actions">
                  <button 
                    type="button" 
                    className="auth-submit-btn"
                    onClick={() => onNavigate('login')}
                  >
                    Proceed to Sign In
                  </button>
                  <button 
                    type="button" 
                    className="auth-btn-secondary"
                    onClick={handleResendVerification}
                    disabled={isResending}
                  >
                    {isResending ? 'Resending Link...' : 'Resend Verification Email'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="auth-header">
              <span className="auth-eyebrow">WELCOME TO AURA</span>
              <h1 className="auth-title">Create Your Account</h1>
              <p className="auth-subtitle">
                Join our conscious fashion collective for personalized wardrobes, easy tracking, and exclusive previews.
              </p>
            </div>

            {/* Error Banner */}
            {apiError && (
              <div className="auth-error-banner" role="alert">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>{apiError}</span>
              </div>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit} noValidate className="auth-form">
              
              {/* Full Name */}
              <div className={`auth-field ${errors.fullName ? 'has-error' : ''}`}>
                <label htmlFor="reg-fullName" className="auth-label">
                  Full Name <span className="req-star">*</span>
                </label>
                <input
                  id="reg-fullName"
                  name="fullName"
                  type="text"
                  placeholder="e.g. Ananya Sharma"
                  value={formData.fullName}
                  onChange={handleChange}
                  className="auth-input"
                  autoComplete="name"
                />
                {errors.fullName && <span className="auth-field-error">{errors.fullName}</span>}
              </div>

              {/* Email */}
              <div className={`auth-field ${errors.email ? 'has-error' : ''}`}>
                <label htmlFor="reg-email" className="auth-label">
                  Email Address <span className="req-star">*</span>
                </label>
                <input
                  id="reg-email"
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
                  <label htmlFor="reg-password" className="auth-label">
                    Password <span className="req-star">*</span>
                  </label>
                  <span className="auth-hint-text">Minimum 6 characters</span>
                </div>
                <div className="password-input-wrapper">
                  <input
                    id="reg-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a secure password"
                    value={formData.password}
                    onChange={handleChange}
                    className="auth-input"
                    autoComplete="new-password"
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

              {/* Confirm Password */}
              <div className={`auth-field ${errors.confirmPassword ? 'has-error' : ''}`}>
                <label htmlFor="reg-confirmPassword" className="auth-label">
                  Confirm Password <span className="req-star">*</span>
                </label>
                <input
                  id="reg-confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Re-enter your password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="auth-input"
                  autoComplete="new-password"
                />
                {errors.confirmPassword && (
                  <span className="auth-field-error">{errors.confirmPassword}</span>
                )}
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
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>

            </form>

            {/* Footer switcher */}
            <div className="auth-footer-switch">
              <span>Already have an account?</span>
              <button
                type="button"
                className="auth-switch-link"
                onClick={() => onNavigate('login')}
              >
                Sign in to your account
              </button>
            </div>
              </>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
