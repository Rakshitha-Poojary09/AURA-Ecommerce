/**
 * In-memory sliding-window rate limiter for password reset endpoints
 * Prevents automated brute-force, email enumeration, and denial-of-service attempts.
 */

const resetAttempts = new Map();
const verificationAttempts = new Map();

// Configuration: max 5 requests per 15-minute window per IP / identifier
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// Periodic cleanup of expired window buckets every 10 minutes (unref so it doesn't block process exit)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of resetAttempts.entries()) {
    if (now - record.startTime > WINDOW_MS) {
      resetAttempts.delete(key);
    }
  }
  for (const [key, record] of verificationAttempts.entries()) {
    if (now - record.startTime > WINDOW_MS) {
      verificationAttempts.delete(key);
    }
  }
}, 10 * 60 * 1000);
cleanupInterval.unref();

/**
 * Middleware to enforce rate limiting on password reset requests
 */
function passwordResetRateLimiter(req, res, next) {
  const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown_ip";
  const email = (req.body?.email || "").trim().toLowerCase();
  const key = `${ip}_${email}`;

  const now = Date.now();
  const record = resetAttempts.get(key) || { count: 0, startTime: now };

  // If window has passed, reset counter
  if (now - record.startTime > WINDOW_MS) {
    record.count = 1;
    record.startTime = now;
  } else {
    record.count += 1;
  }

  resetAttempts.set(key, record);

  if (record.count > MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((record.startTime + WINDOW_MS - now) / 1000);
    res.set("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      message: "Too many password reset requests. Please wait a few minutes before trying again."
    });
  }

  next();
}

/**
 * Middleware to enforce rate limiting on email verification resend requests
 */
function verificationRateLimiter(req, res, next) {
  const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown_ip";
  const email = (req.body?.email || "").trim().toLowerCase();
  const key = `${ip}_${email}`;

  const now = Date.now();
  const record = verificationAttempts.get(key) || { count: 0, startTime: now };

  // If window has passed, reset counter
  if (now - record.startTime > WINDOW_MS) {
    record.count = 1;
    record.startTime = now;
  } else {
    record.count += 1;
  }

  verificationAttempts.set(key, record);

  if (record.count > MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((record.startTime + WINDOW_MS - now) / 1000);
    res.set("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      message: "Too many verification email requests. Please wait a few minutes before trying again."
    });
  }

  next();
}

/**
 * Helper to reset rate limits during testing
 */
function clearRateLimits() {
  resetAttempts.clear();
  verificationAttempts.clear();
}

module.exports = {
  passwordResetRateLimiter,
  verificationRateLimiter,
  clearRateLimits
};
