const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const nodemailer = require("nodemailer");

/**
 * Safely masks an email address for diagnostic logs without leaking personal data.
 */
function maskEmail(email) {
  if (!email || typeof email !== "string") return "unknown";
  const parts = email.split("@");
  if (parts.length !== 2) return "***";
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? name[0] + "***" : name.slice(0, 2) + "***" + name.slice(-2);
  return `${maskedName}@${domain}`;
}

/**
 * Checks whether the necessary SMTP credentials are provided in the environment.
 */
function isEmailConfigured() {
  const host = (process.env.SMTP_HOST || "").trim();
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();
  return Boolean(host && user && pass);
}

/**
 * Returns a list of missing email configuration environment variable names.
 */
function getMissingEmailConfig() {
  const missing = [];
  if (!process.env.SMTP_HOST) missing.push("SMTP_HOST");
  if (!process.env.SMTP_USER) missing.push("SMTP_USER");
  if (!process.env.SMTP_PASS) missing.push("SMTP_PASS");
  if (!process.env.EMAIL_FROM) missing.push("EMAIL_FROM (optional, defaults to noreply@aura.com)");
  return missing;
}

/**
 * Creates and returns an active Nodemailer transport instance with sanitized credentials.
 */
function createTransporter() {
  const host = (process.env.SMTP_HOST || "").trim();
  const port = parseInt(process.env.SMTP_PORT, 10) || 587;
  const isSecure = process.env.SMTP_SECURE !== undefined 
    ? process.env.SMTP_SECURE === "true" 
    : port === 465;
  const user = (process.env.SMTP_USER || "").trim();
  let pass = (process.env.SMTP_PASS || "").trim();

  // For Gmail / Google SMTP, if an app password contains spaces (e.g. "xxxx xxxx xxxx xxxx"),
  // normalize it by stripping inner spaces so authentication is consistent across environments.
  if ((host.includes("gmail") || host.includes("google")) && pass.replace(/\s+/g, "").length === 16) {
    pass = pass.replace(/\s+/g, "");
  }

  const transportConfig = {
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass
    },
    // Reasonable timeouts to prevent hanging server connections
    connectionTimeout: 10000,
    greetingTimeout: 5000,
    socketTimeout: 15000
  };

  // If using STARTTLS on port 587, enforce STARTTLS
  if (port === 587 && !isSecure) {
    transportConfig.requireTLS = true;
  }

  return nodemailer.createTransport(transportConfig);
}

/**
 * Verifies active connectivity to the configured SMTP server without leaking sensitive data.
 */
async function verifySmtpConnection() {
  if (!isEmailConfigured()) {
    const missing = getMissingEmailConfig();
    console.warn(`[AURA Email Service] SMTP configuration is incomplete. Missing: ${missing.join(", ")}`);
    return { verified: false, reason: "SMTP_NOT_CONFIGURED", missing };
  }

  try {
    const transporter = createTransporter();
    await transporter.verify();
    const host = (process.env.SMTP_HOST || "").trim();
    const port = parseInt(process.env.SMTP_PORT, 10) || 587;
    const user = (process.env.SMTP_USER || "").trim();
    console.log(`[AURA Email Service] ✓ SMTP verified successfully with ${host}:${port} for ${maskEmail(user)}`);
    return { verified: true };
  } catch (err) {
    console.error(`[AURA Email Service Error] SMTP verification failed: ${err.message}`);
    return { verified: false, reason: "VERIFICATION_FAILED", error: err.message };
  }
}

/**
 * Generates an elegant, luxury AURA branded HTML email for password reset.
 */
function generateResetEmailHtml({ name, resetUrl, expirationMinutes = 15 }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your AURA Password</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #FAF7F2;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1C1C1C;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #FAF7F2;
      padding: 40px 15px;
    }
    .card {
      max-width: 560px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border: 1px solid #E8DED2;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(56, 73, 53, 0.05);
    }
    .header {
      background-color: #384935;
      padding: 32px 24px;
      text-align: center;
    }
    .brand-title {
      color: #FAF7F2;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0.15em;
      margin: 0;
      text-transform: uppercase;
    }
    .content {
      padding: 36px 32px;
    }
    .salutation {
      font-size: 18px;
      font-weight: 600;
      color: #1C1C1C;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .message {
      font-size: 15px;
      line-height: 1.6;
      color: #555555;
      margin-bottom: 24px;
    }
    .button-wrap {
      text-align: center;
      margin: 32px 0;
    }
    .reset-btn {
      display: inline-block;
      background-color: #384935;
      color: #FAF7F2 !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
      padding: 14px 32px;
      border-radius: 4px;
      letter-spacing: 0.04em;
    }
    .expiry-note {
      background-color: #FAF7F2;
      border-left: 3px solid #E2B7B5;
      padding: 12px 16px;
      font-size: 13px;
      color: #666666;
      margin-bottom: 24px;
      border-radius: 0 4px 4px 0;
    }
    .link-fallback {
      font-size: 12px;
      color: #888888;
      word-break: break-all;
      margin-top: 24px;
      line-height: 1.4;
    }
    .footer {
      border-top: 1px solid #F0ECE6;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #999999;
      background-color: #FCFBF9;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1 class="brand-title">AURA</h1>
      </div>
      <div class="content">
        <h2 class="salutation">Hello ${name ? name : "valued client"},</h2>
        <p class="message">
          We received a request to reset the password for your AURA client account. Please click the button below to choose your new password:
        </p>
        <div class="button-wrap">
          <a href="${resetUrl}" class="reset-btn" target="_blank" rel="noopener noreferrer">Reset Your Password</a>
        </div>
        <div class="expiry-note">
          <strong>Security Notice:</strong> This link is strictly single-use and will expire in ${expirationMinutes} minutes. If you did not request this password reset, no action is required and your account remains secure.
        </div>
        <p class="link-fallback">
          If the button above does not open, copy and paste this URL into your browser:<br>
          <a href="${resetUrl}" style="color: #384935;">${resetUrl}</a>
        </p>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} AURA Luxury Fashion & E-Commerce. All rights reserved.<br>
        This is an automated security transmission. Please do not reply directly to this email.
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Sends a password reset email.
 * If SMTP credentials are not configured, logs a clear warning and returns { delivered: false }.
 */
async function sendPasswordResetEmail({ to, name, resetUrl, expirationMinutes = 15 }) {
  if (!isEmailConfigured()) {
    const missing = getMissingEmailConfig();
    console.warn(
      `\n[AURA Email Service Warning] Password reset requested for ${to}, but SMTP configuration is missing.` +
      `\nRequired environment variables in backend/.env:` +
      `\n  ${missing.join("\n  ")}` +
      `\nEmail was not sent. The client was provided the standard neutral response.\n`
    );
    return {
      delivered: false,
      reason: "SMTP_NOT_CONFIGURED",
      missingConfig: missing
    };
  }

  try {
    const transporter = createTransporter();
    const from = process.env.EMAIL_FROM || '"AURA Luxury" <noreply@aura.com>';

    console.log(`[AURA Email Service] Initiating password reset email delivery to ${maskEmail(to)}...`);

    const info = await transporter.sendMail({
      from,
      to,
      subject: "AURA — Password Reset Request",
      text: `Hello ${name || "there"},\n\n` +
        `We received a request to reset your password for AURA.\n\n` +
        `Please use the following link to choose a new password (valid for ${expirationMinutes} minutes):\n` +
        `${resetUrl}\n\n` +
        `If you did not request this reset, you can safely ignore this email.\n\n` +
        `Best regards,\nThe AURA Team`,
      html: generateResetEmailHtml({ name, resetUrl, expirationMinutes })
    });

    console.log(`[AURA Email Service] ✓ Password reset email delivered to ${maskEmail(to)} (Message ID: ${info.messageId})`);
    return {
      delivered: true,
      messageId: info.messageId
    };
  } catch (err) {
    console.error(`[AURA Email Service Error] Failed to deliver password reset email to ${maskEmail(to)}:`, err.message);
    return {
      delivered: false,
      reason: "TRANSPORTER_ERROR",
      error: err.message
    };
  }
}

/**
 * Generates an elegant, luxury AURA branded HTML email for email verification.
 */
function generateVerificationEmailHtml({ name, verificationUrl, expirationHours = 24 }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your AURA Account</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #FAF7F2;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1C1C1C;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #FAF7F2;
      padding: 40px 15px;
    }
    .card {
      max-width: 560px;
      margin: 0 auto;
      background-color: #FFFFFF;
      border: 1px solid #E8DED2;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(56, 73, 53, 0.05);
    }
    .header {
      background-color: #384935;
      padding: 32px 24px;
      text-align: center;
    }
    .brand-title {
      color: #FAF7F2;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0.15em;
      margin: 0;
      text-transform: uppercase;
    }
    .content {
      padding: 36px 32px;
    }
    .salutation {
      font-size: 18px;
      font-weight: 600;
      color: #1C1C1C;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .message {
      font-size: 15px;
      line-height: 1.6;
      color: #555555;
      margin-bottom: 24px;
    }
    .button-wrap {
      text-align: center;
      margin: 32px 0;
    }
    .verify-btn {
      display: inline-block;
      background-color: #384935;
      color: #FAF7F2 !important;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
      padding: 14px 32px;
      border-radius: 4px;
      letter-spacing: 0.04em;
    }
    .expiry-note {
      background-color: #FAF7F2;
      border-left: 3px solid #E2B7B5;
      padding: 12px 16px;
      font-size: 13px;
      color: #666666;
      margin-bottom: 24px;
      border-radius: 0 4px 4px 0;
    }
    .link-fallback {
      font-size: 12px;
      color: #888888;
      word-break: break-all;
      margin-top: 24px;
      line-height: 1.4;
    }
    .footer {
      border-top: 1px solid #F0ECE6;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #999999;
      background-color: #FCFBF9;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="header">
        <h1 class="brand-title">AURA</h1>
      </div>
      <div class="content">
        <h2 class="salutation">Welcome, ${name ? name : "valued client"}!</h2>
        <p class="message">
          Thank you for joining AURA. To complete your registration and activate your account, please verify your email address by clicking the button below:
        </p>
        <div class="button-wrap">
          <a href="${verificationUrl}" class="verify-btn" target="_blank" rel="noopener noreferrer">Verify Email Address</a>
        </div>
        <div class="expiry-note">
          <strong>Security Notice:</strong> This verification link is strictly single-use and will expire in ${expirationHours} hours. If you did not create an account with AURA, you can safely ignore this message.
        </div>
        <p class="link-fallback">
          If the button above does not open, copy and paste this URL into your browser:<br>
          <a href="${verificationUrl}" style="color: #384935;">${verificationUrl}</a>
        </p>
      </div>
      <div class="footer">
        &copy; ${new Date().getFullYear()} AURA Luxury Fashion & E-Commerce. All rights reserved.<br>
        This is an automated security transmission. Please do not reply directly to this email.
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Sends an email verification link to a newly registered or unverified customer.
 * If SMTP credentials are not configured, logs a clear warning and returns { delivered: false }.
 */
async function sendVerificationEmail({ to, name, verificationUrl, expirationHours = 24 }) {
  if (!isEmailConfigured()) {
    const missing = getMissingEmailConfig();
    console.warn(
      `\n[AURA Email Service Warning] Email verification requested for ${to}, but SMTP configuration is missing.` +
      `\nRequired environment variables in backend/.env:` +
      `\n  ${missing.join("\n  ")}` +
      `\nEmail was not sent. Delivery status: SMTP_NOT_CONFIGURED.\n`
    );
    return {
      delivered: false,
      reason: "SMTP_NOT_CONFIGURED",
      missingConfig: missing
    };
  }

  try {
    const transporter = createTransporter();
    const from = process.env.EMAIL_FROM || '"AURA Luxury" <noreply@aura.com>';

    console.log(`[AURA Email Service] Initiating verification email delivery to ${maskEmail(to)}...`);

    const info = await transporter.sendMail({
      from,
      to,
      subject: "AURA — Please Verify Your Email Address",
      text: `Hello ${name || "there"},\n\n` +
        `Welcome to AURA! Please verify your email address using the link below (valid for ${expirationHours} hours):\n` +
        `${verificationUrl}\n\n` +
        `If you did not register for an AURA account, you can safely ignore this email.\n\n` +
        `Warm regards,\nThe AURA Team`,
      html: generateVerificationEmailHtml({ name, verificationUrl, expirationHours })
    });

    console.log(`[AURA Email Service] ✓ Verification email delivered to ${maskEmail(to)} (Message ID: ${info.messageId})`);
    return {
      delivered: true,
      messageId: info.messageId
    };
  } catch (err) {
    console.error(`[AURA Email Service Error] Failed to deliver verification email to ${maskEmail(to)}:`, err.message);
    return {
      delivered: false,
      reason: "TRANSPORTER_ERROR",
      error: err.message
    };
  }
}

module.exports = {
  isEmailConfigured,
  getMissingEmailConfig,
  verifySmtpConnection,
  maskEmail,
  sendPasswordResetEmail,
  sendVerificationEmail
};
