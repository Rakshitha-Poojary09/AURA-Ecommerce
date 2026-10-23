import React, { useState } from 'react';
import './ForgotPasswordPage.css';

export default function ForgotPasswordPage({ onNavigate }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const [emailDelivery, setEmailDelivery] = useState(null);

  const validate = () => {
    const trimmed = email.trim();
    if (!trimmed) {
      return 'Please enter your registered email address';
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return 'Please provide a valid email address';
    }
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    const targetEmail = email.trim().toLowerCase();

    try {
      const response = await fetch('http://localhost:5000/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email: targetEmail })
      });

      const data = await response.json();

      if (!response.ok && response.status === 429) {
        throw new Error(data.message || 'Too many reset requests. Please wait a few minutes.');
      } else if (!response.ok && response.status === 400) {
        throw new Error(data.message || 'Please check the email provided.');
      }

      // Record email and delivery status
      setSubmittedEmail(targetEmail);
      setEmailDelivery(data.emailDelivery || null);
      setIsSubmitted(true);
    } catch (err) {
      setError(err.message || 'Could not process password reset request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="aura-auth-page forgot-password-page">
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
            <span className="auth-breadcrumb-active">Forgot Password</span>
          </nav>

          <div className="auth-card">
            {!isSubmitted ? (
              <>
                {/* Header */}
                <div className="auth-header">
                  <span className="auth-eyebrow">AURA CLIENT SECURITY</span>
                  <h1 className="auth-title">Reset Password</h1>
                  <p className="auth-subtitle">
                    Enter the email address associated with your AURA account. We will send you instructions to securely reset your password.
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="auth-error-banner" role="alert">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>{error}</span>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} noValidate className="auth-form">
                  <div className={`auth-field ${error ? 'has-error' : ''}`}>
                    <label htmlFor="forgot-email" className="auth-label">
                      Registered Email Address <span className="req-star">*</span>
                    </label>
                    <input
                      id="forgot-email"
                      name="email"
                      type="email"
                      placeholder="e.g. ananya@example.com"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (error) setError('');
                      }}
                      className="auth-input"
                      autoComplete="email"
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-primary auth-submit-btn"
                    disabled={isSubmitting}
                    id="btn-submit-forgot-password"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="auth-spinner"></span>
                        Sending Instructions...
                      </>
                    ) : (
                      <>
                        Send Reset Instructions
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="22" y1="2" x2="11" y2="13"></line>
                          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                      </>
                    )}
                  </button>
                </form>

                {/* Back to Sign In */}
                <div className="auth-footer-switch">
                  <span>Remember your password?</span>
                  <button
                    type="button"
                    className="auth-switch-link"
                    onClick={() => onNavigate('login')}
                  >
                    Return to Sign In
                  </button>
                </div>
              </>
            ) : (
              /* Success / Neutral Confirmation State (Requirement 2) */
              <div className="forgot-success-state">
                <div className="forgot-success-icon-wrap">
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                </div>

                <span className="auth-eyebrow">REQUEST PROCESSED</span>
                <h2 className="auth-title">
                  {emailDelivery && emailDelivery.delivered === false ? "Delivery Notice" : "Check Your Inbox"}
                </h2>
                
                <p className="forgot-success-text">
                  {emailDelivery && emailDelivery.delivered === true
                    ? <>Password reset instructions have been dispatched to <strong>{submittedEmail}</strong>.</>
                    : emailDelivery && emailDelivery.delivered === false
                    ? <>We processed your request for <strong>{submittedEmail}</strong>, but live email delivery is currently unconfigured or unavailable.</>
                    : <>If an account exists for <strong>{submittedEmail}</strong>, password reset instructions have been sent.</>}
                </p>

                {emailDelivery && emailDelivery.delivered === false && (
                  <div className="auth-error-banner" style={{ background: '#FAF7F2', borderColor: '#E2B7B5', color: '#666', marginBottom: '20px', width: '100%', textAlign: 'left' }} role="alert">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b9770e" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>
                      {emailDelivery.reason === 'SMTP_NOT_CONFIGURED'
                        ? 'Email delivery is not configured on this server. Please check SMTP credentials in backend/.env.'
                        : `Email delivery failed: ${emailDelivery.error || 'Server could not reach SMTP mailer'}. Please check backend logs.`}
                    </span>
                  </div>
                )}

                <div className="forgot-guidance-box">
                  <div className="guidance-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"></circle>
                      <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <span>The reset link is valid for <strong>15 minutes</strong> and can only be used once.</span>
                  </div>
                  <div className="guidance-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>
                    </svg>
                    <span>If you do not see the email shortly, please check your spam or promotions folder.</span>
                  </div>
                </div>

                <div className="forgot-action-buttons">
                  <button
                    type="button"
                    className="btn-primary auth-submit-btn"
                    onClick={() => onNavigate('login')}
                  >
                    Return to Sign In
                  </button>
                  <button
                    type="button"
                    className="auth-btn-secondary"
                    onClick={() => {
                      setIsSubmitted(false);
                      setEmail('');
                    }}
                  >
                    Try another email address
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
