const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Customer Authentication Middleware
 * Validates JWT exclusively from HTTP-only aura_customer_session cookie or Authorization header.
 * Attaches verified customer to req.user.
 * Admin cookies (aura_admin_session) are never inspected here.
 */
const authenticateCustomer = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check HTTP-only customer session cookie exclusively
    if (req.cookies && req.cookies.aura_customer_session) {
      token = req.cookies.aura_customer_session;
    } 
    // 2. Fallback to Authorization: Bearer <token> header
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "Authentication required. Please log in to your account."
      });
    }

    const secret = process.env.JWT_SECRET || "aura_luxury_fashion_jwt_secret_key_2026_super_secure";

    // Verify token signature and expiration
    const decoded = jwt.verify(token, secret);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        message: "Invalid session token. Please log in again."
      });
    }

    // Retrieve user from database (password excluded by schema default)
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        message: "Account no longer exists. Please register or log in."
      });
    }

    // Prevent admin accounts from impersonating customers on customer-protected routes
    if (user.role === "admin") {
      return res.status(403).json({
        message: "Access denied. Administrator accounts cannot access customer resources."
      });
    }

    // Revoke previous sessions if password was reset after token was issued
    if (decoded.tokenVersion !== undefined && user.tokenVersion !== undefined) {
      if (decoded.tokenVersion !== user.tokenVersion) {
        return res.status(401).json({
          message: "Password was recently reset. Please log in again with your new password."
        });
      }
    } else if (decoded.iat && user.passwordChangedAt) {
      const changedTimestamp = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < changedTimestamp) {
        return res.status(401).json({
          message: "Password was recently reset. Please log in again with your new password."
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Your session has expired. Please log in again."
      });
    }

    return res.status(401).json({
      message: "Authentication failed. Invalid session."
    });
  }
};

/**
 * Admin Authorization Middleware
 * Validates JWT exclusively from HTTP-only aura_admin_session cookie or Authorization header
 * and verifies that req.user has role === 'admin'.
 * Rejects regular customer accounts with 403 Forbidden.
 * Customer cookies (aura_customer_session) are never inspected here.
 */
const requireAdmin = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check HTTP-only admin session cookie exclusively
    if (req.cookies && req.cookies.aura_admin_session) {
      token = req.cookies.aura_admin_session;
    } 
    // 2. Fallback to Authorization: Bearer <token> header
    else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "Admin authentication required. Please sign in to the administrator portal."
      });
    }

    const secret = process.env.JWT_SECRET || "aura_luxury_fashion_jwt_secret_key_2026_super_secure";
    const decoded = jwt.verify(token, secret);

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        message: "Invalid session token. Please sign in again."
      });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        message: "Administrator account not found."
      });
    }

    // Strict role check: customer accounts MUST NOT have access to admin APIs
    if (user.role !== "admin") {
      return res.status(403).json({
        message: "Access denied. Administrator privileges are required to access this resource."
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Administrator session has expired. Please sign in again."
      });
    }

    return res.status(401).json({
      message: "Authentication failed. Invalid session."
    });
  }
};

module.exports = {
  authenticateCustomer,
  requireAdmin
};

