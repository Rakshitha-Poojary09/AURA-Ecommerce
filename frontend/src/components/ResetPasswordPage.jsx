import React, { useState, useEffect } from 'react';
import './ResetPasswordPage.css';

export default function ResetPasswordPage({ token: propToken, onNavigate }) {
  // Extract token from prop or from window.location.search (?token=...)
  const [token, setToken] = useState(() => {
    if (propToken) return propToken;
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('token') || '';
    } catch {
      return '';
    }
  });

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isVerifyingToken, setIsVerifyingToken] = useState(Boolean(token));
  const [tokenInvalid, setTokenInvalid] = useState(!token);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Verify token on initial mount
  useEffect(() => {
    if (!token) {
      setTokenInvalid(true);
      setApiError('No password reset token was found in the link. Please request a new password reset.');
      setIsVerifyingToken(false);
      return;
    }

    let isMounted = true;
    const verifyToken = async () => {
      setIsVerifyingToken(true);
      try {
        const res = await fetch('http://localhost:5000/api/auth/verify-reset-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });
        const data = await res.json();
        if (isMounted) {
          if (!res.ok) {
            setTokenInvalid(true);
            setApiError(data.message || 'This password reset link is invalid or has expired.');
          } else {
            setTokenInvalid(false);
            setApiError('');
          }
        }
      } catch (err) {
        if (isMounted) {
          // If server check fails due to connectivity, let user proceed to form submission
          console.warn('Token pre-validation network warning:', err);
        }
      } finally {
        if (isMounted) {
          setIsVerifyingToken(false);
        }
      }
    };

    verifyToken();
    return () => {
      isMounted = false;
    };
  }, [token]);

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

    if (!formData.password) {
      newErrors.password = 'New password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters long';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
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
      const response = await fetch('http://localhost:5000/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          token,
          password: formData.password,
          confirmPassword: formData.confirmPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Could not reset password. The link may have expired.');
      }

      setIsSuccess(true);
      // Clean up token from local state to prevent any resubmission attempt
      setToken('');
    } catch (err) {
      setApiError(err.message || 'Failed to reset password. Please try again or request a new link.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="aura-auth-page reset-password-page">
      <div className="aura-container">
        <div className="auth-card-wrapper">

          {/* Breadcrumb Navigation */}
          <nav className="auth-breadcrumb" aria-label="Breadcrumb">
            <button className="auth-breadcrumb-link" onClick={() => onNavigate('home')}>
              Home
            </button>
            <span className="auth-breadcrumb-sep">/</span>
            <button className="auth-breadcrumb-link" onClick={() => onNavigate('login')}>
              Sign In
            </button>
            <span className="auth-breadcrumb-sep">/</span>
            <span className="auth-breadcrumb-active">Reset Password</span>
          </nav>

          <div className="auth-card">
            {isVerifyingToken ? (
              <div className="reset-loading-state">
                <div className="auth-spinner large-spinner"></div>
                <p>Verifying your password reset link...</p>
              </div>
            ) : isSuccess ? (
              /* Success State */
              <div className="reset-success-state">
                <div className="reset-success-icon-wrap">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
                <span className="auth-eyebrow">PASSWORD UPDATED</span>
                <h1 className="auth-title">Security Confirmed</h1>
                <p className="reset-success-text">
                  Your password has been successfully reset and all prior customer sessions have been invalidated for your safety.
                </p>
                <button
                  type="button"
                  className="btn-primary auth-submit-btn"
                  onClick={() => onNavigate('login')}
                  id="btn-return-login-after-reset"
                >
                  Sign In with New Password
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            ) : tokenInvalid ? (
              /* Invalid or Expired Token State */
              <div className="reset-invalid-state">
                <div className="reset-invalid-icon-wrap">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <span className="auth-eyebrow">LINK EXPIRED OR INVALID</span>
                <h2 className="auth-title">Unable to Reset Password</h2>
                <p className="reset-invalid-text">
                  {apiError || 'This password reset link is invalid or has already expired. For your security, reset links are single-use and expire after 15 minutes.'}
                </p>
                <div className="forgot-action-buttons">
                  <button
                    type="button"
                    className="btn-primary auth-submit-btn"
                    onClick={() => onNavigate('forgot-password')}
                  >
                    Request a New Reset Link
                  </button>
                  <button
                    type="button"
                    className="auth-btn-secondary"
                    onClick={() => onNavigate('login')}
                  >
                    Return to Sign In
                  </button>
                </div>
              </div>
            ) : (
              /* Reset Password Form */
              <>
                <div className="auth-header">
                  <span className="auth-eyebrow">AURA CLIENT SECURITY</span>
                  <h1 className="auth-title">Create New Password</h1>
                  <p className="auth-subtitle">
                    Please choose a strong password to protect your AURA client profile and order history.
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

                <form onSubmit={handleSubmit} noValidate className="auth-form">
                  {/* New Password */}
                  <div className={`auth-field ${errors.password ? 'has-error' : ''}`}>
                    <label htmlFor="reset-new-password" className="auth-label">
                      New Password <span className="req-star">*</span>
                    </label>
                    <div className="password-input-wrapper">
                      <input
                        id="reset-new-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 6 characters"
                        value={formData.password}
                        onChange={handleChange}
                        className="auth-input"
                        autoComplete="new-password"
                        autoFocus
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
                    <label htmlFor="reset-confirm-password" className="auth-label">
                      Confirm New Password <span className="req-star">*</span>
                    </label>
                    <div className="password-input-wrapper">
                      <input
                        id="reset-confirm-password"
                        name="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="Re-enter your new password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="auth-input"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="password-toggle-btn"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? (
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
                    {errors.confirmPassword && <span className="auth-field-error">{errors.confirmPassword}</span>}
                  </div>

                  {/* Password Requirements Guide */}
                  <div className="password-checklist">
                    <span className="checklist-title">Password requirements:</span>
                    <div className={`checklist-item ${formData.password.length >= 6 ? 'met' : ''}`}>
                      <span className="bullet">{formData.password.length >= 6 ? '✓' : '•'}</span>
                      <span>Minimum 6 characters in length</span>
                    </div>
                    <div className={`checklist-item ${formData.password && formData.password === formData.confirmPassword ? 'met' : ''}`}>
                      <span className="bullet">{formData.password && formData.password === formData.confirmPassword ? '✓' : '•'}</span>
                      <span>Passwords match</span>
                    </div>
                  </div>

                  {/* Submit CTA */}
                  <button
                    type="submit"
                    className="btn-primary auth-submit-btn"
                    disabled={isSubmitting}
                    id="btn-submit-reset-password"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="auth-spinner"></span>
                        Saving New Password...
                      </>
                    ) : (
                      <>
                        Save New Password
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      </>
                    )}
                  </button>
                </form>

                {/* Return to Sign In */}
                <div className="auth-footer-switch">
                  <span>Cancel password reset?</span>
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => onNavigate('login')}
                  >
                    Return to Sign In
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
