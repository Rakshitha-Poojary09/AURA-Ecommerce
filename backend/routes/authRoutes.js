const express = require("express");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../models/User");
const { authenticateCustomer, requireAdmin } = require("../middleware/auth");
const { sendPasswordResetEmail, sendVerificationEmail } = require("../utils/emailService");
const { passwordResetRateLimiter, verificationRateLimiter } = require("../middleware/resetRateLimiter");

const router = express.Router();

/**
 * Helper to generate JWT token
 */
const generateToken = (user) => {
  const secret = process.env.JWT_SECRET || "aura_luxury_fashion_jwt_secret_key_2026_super_secure";
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion || 0
    },
    secret,
    { expiresIn }
  );
};

/**
 * Helper to get secure cookie options
 */
const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true, // Prevents client-side JS access (mitigates XSS)
    secure: isProduction, // HTTPS only in production
    sameSite: isProduction ? "none" : "lax", // 'lax' for local dev, 'none' for cross-domain prod
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  };
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new customer account
 * @access  Public
 */
router.post("/register", async (req, res) => {
  try {
    const { fullName, name, email, password, confirmPassword } = req.body || {};
    const customerName = typeof fullName === "string" ? fullName.trim() : typeof name === "string" ? name.trim() : "";
    const customerEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    // 1. Validation: Required fields
    if (!customerName) {
      return res.status(400).json({
        message: "Full name is required."
      });
    }

    if (!customerEmail) {
      return res.status(400).json({
        message: "Email address is required."
      });
    }

    // 2. Validation: Email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address."
      });
    }

    // 3. Validation: Password rules
    if (!password || typeof password !== "string") {
      return res.status(400).json({
        message: "Password is required."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long."
      });
    }

    if (typeof confirmPassword !== "string" || password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match. Please re-enter."
      });
    }

    // 4. Ensure email is unique
    const existingUser = await User.findOne({ email: customerEmail });
    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists. Please log in."
      });
    }

    // 5. Generate 32-byte cryptographically secure email verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const hashedVerificationToken = crypto.createHash("sha256").update(verificationToken).digest("hex");
    const expirationMs = 24 * 60 * 60 * 1000; // 24 hours

    // 6. Create new User document with isEmailVerified: false
    // Password will be hashed by pre-save hook
    const newUser = new User({
      name: customerName,
      email: customerEmail,
      password,
      isEmailVerified: false,
      emailVerificationToken: hashedVerificationToken,
      emailVerificationExpires: new Date(Date.now() + expirationMs)
    });

    const savedUser = await newUser.save();

    // 7. Dispatch verification email using existing email service
    const baseUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
    const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

    const emailDelivery = await sendVerificationEmail({
      to: savedUser.email,
      name: savedUser.name,
      verificationUrl,
      expirationHours: 24
    });

    // 8. Return response WITHOUT session cookie (account must be verified before login)
    return res.status(201).json({
      message: "Account created successfully! Please check your email to verify your account before logging in.",
      user: savedUser.toJSON(),
      requiresVerification: true,
      emailDelivery: {
        delivered: emailDelivery.delivered,
        reason: emailDelivery.reason || null
      }
    });
  } catch (error) {
    console.error("Error in /api/auth/register:", error);
    return res.status(500).json({
      message: "Could not create account. Please try again later.",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/auth/login
 * @desc    Authenticate customer credentials and start session
 * @access  Public
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const customerEmail = (email || "").trim().toLowerCase();

    // 1. Validation: Required fields
    if (!customerEmail || !password) {
      return res.status(400).json({
        message: "Please provide both email and password."
      });
    }

    // 2. Find user by email (explicitly selecting password field)
    const user = await User.findOne({ email: customerEmail }).select("+password");

    // 3. Secure validation: generic error message to prevent account enumeration
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    // 4. Compare hashed password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    // Role check: Admin accounts must not log in through customer login
    if (user.role === "admin") {
      return res.status(403).json({
        message: "Administrator accounts must sign in via the administrator portal."
      });
    }

    // Email verification check: Only block newly registered unverified accounts (isEmailVerified === false)
    // Legacy grandfathered accounts where isEmailVerified is undefined or true continue to log in seamlessly
    if (user.isEmailVerified === false) {
      return res.status(403).json({
        message: "Please verify your email address before signing in. Check your inbox for the verification link.",
        requiresVerification: true,
        email: user.email
      });
    }

    // 5. Sign JWT and issue HTTP-only customer session cookie
    const token = generateToken(user);
    res.cookie("aura_customer_session", token, getCookieOptions());

    return res.json({
      message: `Welcome back, ${user.name}!`,
      user: user.toJSON()
    });
  } catch (error) {
    console.error("Error in /api/auth/login:", error);
    return res.status(500).json({
      message: "Server error during login. Please try again later.",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/auth/logout
 * @desc    Clear HTTP-only customer authentication cookie (Customer only)
 * @access  Public
 */
router.post("/logout", (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("aura_customer_session", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax"
  });

  return res.json({
    message: "Logged out successfully."
  });
});

/**
 * @route   GET /api/auth/me
 * @desc    Get currently logged in customer's profile
 * @access  Protected
 */
router.get("/me", authenticateCustomer, async (req, res) => {
  try {
    return res.json({
      user: req.user.toJSON()
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error retrieving profile",
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/auth/profile
 * @desc    Update currently logged in customer's profile (name, email)
 * @access  Protected (Customer)
 */
router.put("/profile", authenticateCustomer, async (req, res) => {
  try {
    const { name, fullName, email, phone } = req.body;
    const newName = (fullName || name || "").trim();
    const newEmail = (email || "").trim().toLowerCase();

    // 1. Validate name
    if (!newName) {
      return res.status(400).json({
        message: "Full name is required."
      });
    }
    if (newName.length < 2) {
      return res.status(400).json({
        message: "Full name must be at least 2 characters long."
      });
    }

    req.user.name = newName;

    // 2. Validate phone if provided
    if (phone !== undefined) {
      const cleanPhone = String(phone).trim();
      if (cleanPhone && !/^[0-9+() -]{7,15}$/.test(cleanPhone)) {
        return res.status(400).json({
          message: "Please provide a valid contact phone number."
        });
      }
      req.user.phone = cleanPhone;
    }

    // 3. Validate email if provided and changed
    let emailChanged = false;
    if (newEmail && newEmail !== req.user.email.toLowerCase()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(newEmail)) {
        return res.status(400).json({
          message: "Please provide a valid email address."
        });
      }

      // Check if new email is already used by another user
      const existingUser = await User.findOne({
        email: newEmail,
        _id: { $ne: req.user._id }
      });

      if (existingUser) {
        return res.status(409).json({
          message: "An account with this email address already exists."
        });
      }

      req.user.email = newEmail;
      emailChanged = true;
    }

    const savedUser = await req.user.save();

    // If email changed, issue new JWT token so session stays synchronized
    if (emailChanged) {
      const token = generateToken(savedUser);
      res.cookie("aura_customer_session", token, getCookieOptions());
    }

    return res.json({
      message: "Profile updated successfully! ✨",
      user: savedUser.toJSON()
    });
  } catch (error) {
    console.error("Error updating customer profile:", error);
    return res.status(500).json({
      message: "Error updating profile. Please try again.",
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/auth/change-password
 * @desc    Change logged-in customer's password
 * @access  Protected (Customer)
 */
router.put("/change-password", authenticateCustomer, async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || typeof currentPassword !== "string") {
      return res.status(400).json({
        message: "Current password is required."
      });
    }

    if (!newPassword || typeof newPassword !== "string") {
      return res.status(400).json({
        message: "New password is required."
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters long."
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "New password and confirmation do not match."
      });
    }

    // Retrieve user including hashed password for verification
    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
      return res.status(404).json({
        message: "Customer account not found."
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        message: "Incorrect current password. Please try again."
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "New password cannot be the same as your current password."
      });
    }

    user.password = newPassword;
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Re-issue authenticated customer session token
    const token = generateToken(user);
    res.cookie("aura_customer_session", token, getCookieOptions());

    return res.json({
      message: "Your password has been changed successfully! ✨"
    });
  } catch (error) {
    console.error("Error changing customer password:", error);
    return res.status(500).json({
      message: "Server error changing password. Please try again.",
      error: error.message
    });
  }
});

/**
 * @route   GET /api/auth/addresses
 * @desc    Get logged in customer's saved addresses
 * @access  Protected (Customer)
 */
router.get("/addresses", authenticateCustomer, async (req, res) => {
  try {
    return res.json({
      addresses: req.user.addresses || []
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error retrieving saved addresses.",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/auth/addresses
 * @desc    Add a new delivery address
 * @access  Protected (Customer)
 */
router.post("/addresses", authenticateCustomer, async (req, res) => {
  try {
    const { fullName, phone, address, city, state, pinCode, isDefault } = req.body;

    const trimmedAddress = (address || "").trim();
    const trimmedCity = (city || "").trim();
    const trimmedState = (state || "").trim();
    const trimmedPin = (pinCode || "").trim();
    const trimmedName = (fullName || req.user.name || "").trim();
    const trimmedPhone = (phone || req.user.phone || "").trim();

    if (!trimmedAddress || trimmedAddress.length < 5) {
      return res.status(400).json({ message: "Street address is required (minimum 5 characters)." });
    }
    if (!trimmedCity) {
      return res.status(400).json({ message: "City is required." });
    }
    if (!trimmedState) {
      return res.status(400).json({ message: "State is required." });
    }
    if (!trimmedPin || !/^\d{6}$/.test(trimmedPin)) {
      return res.status(400).json({ message: "A valid 6-digit PIN code is required." });
    }

    if (!req.user.addresses) {
      req.user.addresses = [];
    }

    const shouldBeDefault = Boolean(isDefault) || req.user.addresses.length === 0;

    if (shouldBeDefault) {
      req.user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    const newAddr = {
      fullName: trimmedName,
      phone: trimmedPhone,
      address: trimmedAddress,
      city: trimmedCity,
      state: trimmedState,
      pinCode: trimmedPin,
      isDefault: shouldBeDefault
    };

    req.user.addresses.push(newAddr);
    await req.user.save();

    return res.status(201).json({
      message: "Delivery address added successfully! ✨",
      addresses: req.user.addresses
    });
  } catch (error) {
    console.error("Error adding address:", error);
    return res.status(500).json({
      message: "Failed to add address. Please try again.",
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/auth/addresses/:addressId
 * @desc    Update an existing delivery address
 * @access  Protected (Customer)
 */
router.put("/addresses/:addressId", authenticateCustomer, async (req, res) => {
  try {
    const { addressId } = req.params;
    const { fullName, phone, address, city, state, pinCode, isDefault } = req.body;

    if (!req.user.addresses) {
      return res.status(404).json({ message: "Address not found." });
    }

    const targetAddr = req.user.addresses.id(addressId);
    if (!targetAddr) {
      return res.status(404).json({ message: "Address not found." });
    }

    if (address !== undefined) {
      const trimmedAddress = address.trim();
      if (!trimmedAddress || trimmedAddress.length < 5) {
        return res.status(400).json({ message: "Street address is required (minimum 5 characters)." });
      }
      targetAddr.address = trimmedAddress;
    }

    if (city !== undefined) {
      const trimmedCity = city.trim();
      if (!trimmedCity) {
        return res.status(400).json({ message: "City is required." });
      }
      targetAddr.city = trimmedCity;
    }

    if (state !== undefined) {
      const trimmedState = state.trim();
      if (!trimmedState) {
        return res.status(400).json({ message: "State is required." });
      }
      targetAddr.state = trimmedState;
    }

    if (pinCode !== undefined) {
      const trimmedPin = pinCode.trim();
      if (!trimmedPin || !/^\d{6}$/.test(trimmedPin)) {
        return res.status(400).json({ message: "A valid 6-digit PIN code is required." });
      }
      targetAddr.pinCode = trimmedPin;
    }

    if (fullName !== undefined) {
      targetAddr.fullName = fullName.trim();
    }

    if (phone !== undefined) {
      targetAddr.phone = phone.trim();
    }

    if (isDefault) {
      req.user.addresses.forEach((addr) => {
        addr.isDefault = false;
      });
      targetAddr.isDefault = true;
    }

    await req.user.save();

    return res.json({
      message: "Address updated successfully! ✨",
      addresses: req.user.addresses
    });
  } catch (error) {
    console.error("Error updating address:", error);
    return res.status(500).json({
      message: "Failed to update address. Please try again.",
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/auth/addresses/:addressId
 * @desc    Delete a delivery address
 * @access  Protected (Customer)
 */
router.delete("/addresses/:addressId", authenticateCustomer, async (req, res) => {
  try {
    const { addressId } = req.params;

    if (!req.user.addresses) {
      return res.status(404).json({ message: "Address not found." });
    }

    const targetAddr = req.user.addresses.id(addressId);
    if (!targetAddr) {
      return res.status(404).json({ message: "Address not found." });
    }

    const wasDefault = targetAddr.isDefault;
    targetAddr.deleteOne();

    // If deleted address was default, promote the first remaining address to default
    if (wasDefault && req.user.addresses.length > 0) {
      req.user.addresses[0].isDefault = true;
    }

    await req.user.save();

    return res.json({
      message: "Address removed successfully.",
      addresses: req.user.addresses
    });
  } catch (error) {
    console.error("Error deleting address:", error);
    return res.status(500).json({
      message: "Failed to delete address.",
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/auth/addresses/:addressId/default
 * @desc    Set address as default
 * @access  Protected (Customer)
 */
router.put("/addresses/:addressId/default", authenticateCustomer, async (req, res) => {
  try {
    const { addressId } = req.params;

    if (!req.user.addresses) {
      return res.status(404).json({ message: "Address not found." });
    }

    const targetAddr = req.user.addresses.id(addressId);
    if (!targetAddr) {
      return res.status(404).json({ message: "Address not found." });
    }

    req.user.addresses.forEach((addr) => {
      addr.isDefault = addr._id.toString() === addressId;
    });

    await req.user.save();

    return res.json({
      message: "Default delivery address updated.",
      addresses: req.user.addresses
    });
  } catch (error) {
    console.error("Error setting default address:", error);
    return res.status(500).json({
      message: "Failed to update default address.",
      error: error.message
    });
  }
});

const handleAdminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail = (email || "").trim().toLowerCase();

    // 1. Validation
    if (!adminEmail || !password) {
      return res.status(400).json({
        message: "Please provide both administrator email and password."
      });
    }

    // 2. Find user by email
    const user = await User.findOne({ email: adminEmail }).select("+password");

    if (!user) {
      return res.status(401).json({
        message: "Invalid administrator credentials."
      });
    }

    // 3. Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        message: "Invalid administrator credentials."
      });
    }

    // 4. Strict role check: Rejects regular customer accounts
    if (user.role !== "admin") {
      return res.status(403).json({
        message: "Access denied. This account does not possess administrator privileges."
      });
    }

    // 5. Generate token and issue HTTP-only admin session cookie
    const token = generateToken(user);
    res.cookie("aura_admin_session", token, getCookieOptions());

    return res.json({
      message: `Welcome, Administrator ${user.name}!`,
      user: user.toJSON(),
      token
    });
  } catch (error) {
    console.error("Error in admin login:", error);
    return res.status(500).json({
      message: "Server error during administrator login.",
      error: error.message
    });
  }
};

router.post("/admin-login", handleAdminLogin);
router.post("/admin/login", handleAdminLogin);

/**
 * @route   GET /api/auth/admin/me
 * @desc    Retrieve currently logged in administrator's profile
 * @access  Protected (Admin only)
 */
router.get("/admin/me", requireAdmin, async (req, res) => {
  try {
    return res.json({
      user: req.user.toJSON()
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error retrieving administrator profile.",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/auth/admin/logout (and /api/auth/admin-logout)
 * @desc    Clear HTTP-only admin authentication cookie (Admin only)
 * @access  Public
 */
const clearAdminSessionCookie = (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("aura_admin_session", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/"
  });

  return res.json({
    message: "Administrator logged out successfully."
  });
};

router.post("/admin/logout", clearAdminSessionCookie);
router.post("/admin-logout", clearAdminSessionCookie);

// ====================================================================
// PASSWORD RESET ENDPOINTS (CUSTOMER)
// ====================================================================

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Initiate password reset flow for a customer
 * @access  Public (Rate-limited)
 */
router.post("/forgot-password", passwordResetRateLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    const cleanEmail = (email || "").trim().toLowerCase();

    // 1. Basic validation
    if (!cleanEmail) {
      return res.status(400).json({
        message: "Please provide your registered email address."
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        message: "Please provide a valid email address."
      });
    }

    // 2. Find user in MongoDB
    const user = await User.findOne({ email: cleanEmail });

    let emailDelivery = null;

    // 3. Security: Neutral response to prevent email enumeration
    // Only proceed if user exists and is a customer
    if (user && user.role === "customer") {
      // Generate 32-byte cryptographically secure random token (64 hex characters)
      const resetToken = crypto.randomBytes(32).toString("hex");

      // Store only SHA-256 hash of the token in MongoDB for zero-knowledge storage
      const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

      // Short expiration period: 15 minutes (Requirement 3)
      const expirationMs = 15 * 60 * 1000;
      user.passwordResetToken = hashedToken;
      user.passwordResetExpires = new Date(Date.now() + expirationMs);

      await user.save({ validateBeforeSave: false });

      // Construct reset URL pointing to frontend reset-password route
      const baseUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

      // Dispatch password reset email via real email provider (SMTP)
      const deliveryResult = await sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        expirationMinutes: 15
      });

      emailDelivery = {
        delivered: deliveryResult.delivered,
        reason: deliveryResult.reason || null,
        error: deliveryResult.error || null
      };
    }

    // 4. Return the neutral response with delivery status details
    return res.json({
      message: "If an account exists for this email, password reset instructions will be sent.",
      emailDelivery
    });
  } catch (error) {
    console.error("Error in /api/auth/forgot-password:", error);
    return res.status(500).json({
      message: "An error occurred while processing your request. Please try again later.",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/auth/verify-reset-token
 * @desc    Verify if a password reset token is valid and unexpired
 * @access  Public
 */
router.post("/verify-reset-token", async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        valid: false,
        message: "Reset token is required."
      });
    }

    // Hash token to compare with stored SHA-256 hash
    const hashedToken = crypto.createHash("sha256").update(token.trim()).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        valid: false,
        message: "Password reset link is invalid or has expired. Please request a new one."
      });
    }

    return res.json({
      valid: true,
      message: "Token is valid."
    });
  } catch (error) {
    console.error("Error in /api/auth/verify-reset-token:", error);
    return res.status(500).json({
      valid: false,
      message: "Could not verify reset token.",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/auth/reset-password
 * @desc    Reset customer password using single-use token and revoke previous sessions
 * @access  Public
 */
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body || {};

    if (!token || typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        message: "Password reset token is required."
      });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({
        message: "New password is required."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long."
      });
    }

    if (!confirmPassword || typeof confirmPassword !== "string" || password !== confirmPassword) {
      return res.status(400).json({
        message: "Passwords do not match. Please re-enter."
      });
    }

    // Hash the token to look up user
    const hashedToken = crypto.createHash("sha256").update(token.trim()).digest("hex");

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    }).select("+passwordResetToken +passwordResetExpires");

    // Reject invalid, expired, or already used tokens
    if (!user) {
      return res.status(400).json({
        message: "Password reset token is invalid or has expired. Please request a new reset link."
      });
    }

    // Set new password (pre-save hook will hash it with bcryptjs)
    user.password = password;

    // Invalidate reset token immediately (single-use requirement)
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    // Record password change timestamp and increment tokenVersion for instant session revocation
    user.passwordChangedAt = new Date();
    user.tokenVersion = (user.tokenVersion || 0) + 1;

    await user.save();

    // Clear any existing customer session cookie
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie("aura_customer_session", {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax"
    });

    return res.json({
      message: "Your password has been successfully reset! You can now sign in with your new password."
    });
  } catch (error) {
    console.error("Error in /api/auth/reset-password:", error);
    return res.status(500).json({
      message: "Could not reset password. Please try again later.",
      error: error.message
    });
  }
});

// ====================================================================
// EMAIL VERIFICATION ENDPOINTS (CUSTOMER)
// ====================================================================

/**
 * @route   GET /api/auth/verify-email
 * @desc    Direct browser redirect endpoint if customer clicks link pointing to backend API
 * @access  Public
 */
router.get("/verify-email", (req, res) => {
  const token = req.query.token || "";
  const clientBase = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
  return res.redirect(`${clientBase}/verify-email?token=${encodeURIComponent(token)}`);
});

/**
 * @route   POST /api/auth/verify-email
 * @desc    Verify customer email address using cryptographically secure time-limited token
 * @access  Public
 */
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        verified: false,
        state: "invalid",
        message: "Verification token is required."
      });
    }

    const cleanToken = token.trim();
    const hashedToken = crypto.createHash("sha256").update(cleanToken).digest("hex");

    // 1. Check for pending verification token in MongoDB
    let user = await User.findOne({
      emailVerificationToken: hashedToken
    }).select("+emailVerificationToken +emailVerificationExpires");

    // 2. If not found by active token, check if this token was already used to verify
    if (!user) {
      const alreadyVerifiedUser = await User.findOne({
        lastVerifiedToken: hashedToken
      });

      if (alreadyVerifiedUser) {
        return res.status(200).json({
          verified: true,
          state: "already-verified",
          message: "Your email address is already verified. You can sign in to your account.",
          email: alreadyVerifiedUser.email
        });
      }

      return res.status(400).json({
        verified: false,
        state: "invalid",
        message: "This verification link is invalid or has already been used."
      });
    }

    // 3. Check for expired token
    if (user.emailVerificationExpires && user.emailVerificationExpires.getTime() < Date.now()) {
      return res.status(400).json({
        verified: false,
        state: "expired",
        message: "This verification link has expired. Please request a new verification email.",
        email: user.email
      });
    }

    // 4. Token is valid and unexpired - Confirm verification
    user.isEmailVerified = true;
    user.emailVerifiedAt = new Date();
    user.lastVerifiedToken = hashedToken; // Record single-use token so duplicate clicks can be identified as already-verified
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    return res.status(200).json({
      verified: true,
      state: "success",
      message: "Your email address has been verified successfully! You can now sign in.",
      email: user.email
    });
  } catch (error) {
    console.error("Error in /api/auth/verify-email:", error);
    return res.status(500).json({
      verified: false,
      state: "error",
      message: "An error occurred while verifying your email. Please try again later.",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Resend verification email to an unverified customer
 * @access  Public (Rate-limited, neutral response)
 */
router.post("/resend-verification", verificationRateLimiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    const cleanEmail = (email || "").trim().toLowerCase();

    // Basic validation
    if (!cleanEmail) {
      return res.status(400).json({
        message: "Please provide your registered email address."
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        message: "Please provide a valid email address."
      });
    }

    const user = await User.findOne({ email: cleanEmail }).select("+emailVerificationToken +emailVerificationExpires");

    let emailDelivery = null;

    // Only generate and send a new token if the account exists, is a customer, and is currently unverified
    if (user && user.role === "customer" && user.isEmailVerified === false) {
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const hashedVerificationToken = crypto.createHash("sha256").update(verificationToken).digest("hex");
      const expirationMs = 24 * 60 * 60 * 1000; // 24 hours

      user.emailVerificationToken = hashedVerificationToken;
      user.emailVerificationExpires = new Date(Date.now() + expirationMs);
      await user.save({ validateBeforeSave: false });

      const baseUrl = (process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "");
      const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

      emailDelivery = await sendVerificationEmail({
        to: user.email,
        name: user.name,
        verificationUrl,
        expirationHours: 24
      });
    }

    // Neutral response to avoid email enumeration
    return res.json({
      message: "If an unverified account exists for this email, a new verification link has been sent.",
      emailDelivery: emailDelivery
        ? {
            delivered: emailDelivery.delivered,
            reason: emailDelivery.reason || null
          }
        : null
    });
  } catch (error) {
    console.error("Error in /api/auth/resend-verification:", error);
    return res.status(500).json({
      message: "Could not process verification resend request. Please try again later.",
      error: error.message
    });
  }
});

module.exports = router;
