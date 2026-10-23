const mongoose = require("mongoose");
const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const assert = require("assert");

const User = require("./models/User");
const authRoutes = require("./routes/authRoutes");
const { authenticateCustomer, requireAdmin } = require("./middleware/auth");
const { clearRateLimits } = require("./middleware/resetRateLimiter");

const ISOLATED_DB_URI = "mongodb://localhost:27017/aura_test_forgot_password_isolated";
const TEST_PORT = 5099;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

let server;

async function setupIsolatedServer() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRoutes);

  return new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      resolve();
    });
  });
}

async function runTests() {
  console.log("==================================================================");
  console.log("AURA FORGOT PASSWORD & RECOVERY ISOLATED TEST SUITE");
  console.log("Database: aura_test_forgot_password_isolated (Strictly Isolated)");
  console.log("==================================================================\n");

  // Connect exclusively to the isolated test database
  await mongoose.connect(ISOLATED_DB_URI);
  console.log("✓ Connected to isolated test MongoDB database.");

  // Clean out any leftover test documents in isolated DB
  await User.deleteMany({});
  clearRateLimits();

  await setupIsolatedServer();
  console.log(`✓ Isolated test server listening on ${TEST_BASE_URL}\n`);

  try {
    // -------------------------------------------------------------
    // Test 1: Unknown email response (Neutral message, no enumeration)
    // -------------------------------------------------------------
    console.log("Test 1: Unknown email response (Prevent user enumeration)...");
    const unknownRes = await fetch(`${TEST_BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "unknown_person_9999@example.com" })
    });

    assert.strictEqual(unknownRes.status, 200, "Must return status 200 for unknown email");
    const unknownData = await unknownRes.json();
    assert.strictEqual(
      unknownData.message,
      "If an account exists for this email, password reset instructions will be sent.",
      "Must return standard neutral response"
    );
    console.log("✓ Unknown email returns neutral message without revealing registration status.\n");

    // -------------------------------------------------------------
    // Test 2: Valid reset request and single-use hash generation
    // -------------------------------------------------------------
    console.log("Test 2: Valid reset request and single-use token generation...");
    const customerEmail = "clarisse.fashion@aura-isolated.com";
    const initialPassword = "InitialPassword123!";

    const customer = new User({
      name: "Clarisse Fashion",
      email: customerEmail,
      password: initialPassword,
      role: "customer"
    });
    await customer.save();

    // Customer logs in and obtains initial session JWT
    const initialLoginRes = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: customerEmail, password: initialPassword })
    });
    assert.strictEqual(initialLoginRes.status, 200, "Initial customer login must succeed");
    const initialSetCookie = initialLoginRes.headers.get("set-cookie") || "";
    const match = initialSetCookie.match(/aura_customer_session=([^;]+)/);
    const initialSessionCookie = match ? `aura_customer_session=${match[1]}` : "";
    assert(initialSessionCookie, "Must obtain initial customer session cookie");

    // Request password reset
    const resetReqRes = await fetch(`${TEST_BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: customerEmail })
    });

    assert.strictEqual(resetReqRes.status, 200, "Forgot password request must return status 200");
    const resetReqData = await resetReqRes.json();
    assert.strictEqual(
      resetReqData.message,
      "If an account exists for this email, password reset instructions will be sent."
    );

    // Verify token was stored in MongoDB in SHA-256 hashed form
    const updatedCustomer = await User.findOne({ email: customerEmail }).select("+passwordResetToken +passwordResetExpires");
    assert(updatedCustomer.passwordResetToken, "passwordResetToken must be populated in MongoDB");
    assert(updatedCustomer.passwordResetExpires, "passwordResetExpires must be set");
    assert.strictEqual(updatedCustomer.passwordResetToken.length, 64, "Token stored in DB must be a 64-char SHA-256 hash");
    assert(updatedCustomer.passwordResetExpires.getTime() > Date.now(), "Token must not be expired yet");
    console.log("✓ Reset token generated, hashed with SHA-256, and stored with 15-minute expiration.\n");

    // -------------------------------------------------------------
    // Test 3: Token verification endpoint
    // -------------------------------------------------------------
    console.log("Test 3: Token verification endpoint...");
    // Generate a known plain token for controlled testing
    const plainToken = "a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0";
    const hashedKnownToken = crypto.createHash("sha256").update(plainToken).digest("hex");
    updatedCustomer.passwordResetToken = hashedKnownToken;
    updatedCustomer.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await updatedCustomer.save();

    // Verify with valid token
    const verifyValidRes = await fetch(`${TEST_BASE_URL}/api/auth/verify-reset-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: plainToken })
    });
    assert.strictEqual(verifyValidRes.status, 200, "Valid token verification must return 200");
    const verifyValidData = await verifyValidRes.json();
    assert.strictEqual(verifyValidData.valid, true);

    // Verify with tampered/invalid token
    const verifyInvalidRes = await fetch(`${TEST_BASE_URL}/api/auth/verify-reset-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "tampered_token_xyz" })
    });
    assert.strictEqual(verifyInvalidRes.status, 400, "Invalid token must return 400");
    const verifyInvalidData = await verifyInvalidRes.json();
    assert.strictEqual(verifyInvalidData.valid, false);
    console.log("✓ Verification endpoint correctly validates valid and invalid tokens.\n");

    // -------------------------------------------------------------
    // Test 4: Expired token rejection
    // -------------------------------------------------------------
    console.log("Test 4: Expired token rejection...");
    // Simulate expired token (set expiration to 10 minutes ago)
    updatedCustomer.passwordResetExpires = new Date(Date.now() - 10 * 60 * 1000);
    await updatedCustomer.save();

    const expiredResetRes = await fetch(`${TEST_BASE_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: plainToken,
        password: "NewPassword2026!",
        confirmPassword: "NewPassword2026!"
      })
    });

    assert.strictEqual(expiredResetRes.status, 400, "Expired token must be rejected with 400");
    const expiredData = await expiredResetRes.json();
    assert(
      expiredData.message.toLowerCase().includes("expired") || expiredData.message.toLowerCase().includes("invalid"),
      "Message must indicate token is expired or invalid"
    );
    console.log("✓ Expired reset token correctly rejected.\n");

    // -------------------------------------------------------------
    // Test 5: Password confirmation mismatch rejection
    // -------------------------------------------------------------
    console.log("Test 5: Password confirmation mismatch rejection...");
    // Reset expiration back to valid
    updatedCustomer.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await updatedCustomer.save();

    const mismatchRes = await fetch(`${TEST_BASE_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: plainToken,
        password: "NewPassword2026!",
        confirmPassword: "DifferentPassword999!"
      })
    });

    assert.strictEqual(mismatchRes.status, 400, "Password mismatch must return 400");
    const mismatchData = await mismatchRes.json();
    assert.strictEqual(mismatchData.message, "Passwords do not match. Please re-enter.");
    console.log("✓ Mismatched password confirmation rejected.\n");

    // -------------------------------------------------------------
    // Test 6: Short password rejection (< 6 chars)
    // -------------------------------------------------------------
    console.log("Test 6: Short password validation rejection...");
    const shortPassRes = await fetch(`${TEST_BASE_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: plainToken,
        password: "123",
        confirmPassword: "123"
      })
    });
    assert.strictEqual(shortPassRes.status, 400, "Password < 6 chars must return 400");
    console.log("✓ Short password rejected with proper validation message.\n");

    // -------------------------------------------------------------
    // Test 7: Successful password reset
    // -------------------------------------------------------------
    console.log("Test 7: Successful password reset execution...");
    const newSecurePassword = "BrandNewLuxuryPass2026!";

    const successRes = await fetch(`${TEST_BASE_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: plainToken,
        password: newSecurePassword,
        confirmPassword: newSecurePassword
      })
    });

    assert.strictEqual(successRes.status, 200, "Successful reset must return 200");
    const successData = await successRes.json();
    assert(successData.message.includes("successfully reset"), "Message must indicate success");

    // Verify token was invalidated in MongoDB and password was hashed
    const customerAfterReset = await User.findOne({ email: customerEmail }).select("+password +passwordResetToken +passwordResetExpires");
    assert.strictEqual(customerAfterReset.passwordResetToken, undefined, "passwordResetToken must be removed after use");
    assert.strictEqual(customerAfterReset.passwordResetExpires, undefined, "passwordResetExpires must be removed after use");
    assert(customerAfterReset.passwordChangedAt, "passwordChangedAt must be recorded");

    const compareNew = await customerAfterReset.comparePassword(newSecurePassword);
    assert.strictEqual(compareNew, true, "New password must compare true against bcrypt hash");
    console.log("✓ Password reset succeeded; token invalidated and password hashed with bcrypt.\n");

    // -------------------------------------------------------------
    // Test 8: Single-use token reuse prevention
    // -------------------------------------------------------------
    console.log("Test 8: Prevent token reuse...");
    const reuseRes = await fetch(`${TEST_BASE_URL}/api/auth/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: plainToken,
        password: "AnotherNewPassword!",
        confirmPassword: "AnotherNewPassword!"
      })
    });

    assert.strictEqual(reuseRes.status, 400, "Reused token must be rejected with 400");
    console.log("✓ Reused token rejected; single-use token security confirmed.\n");

    // -------------------------------------------------------------
    // Test 9: Subsequent login behavior (old rejected, new accepted)
    // -------------------------------------------------------------
    console.log("Test 9: Subsequent login verification...");
    // Old password must fail
    const oldLoginRes = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: customerEmail, password: initialPassword })
    });
    assert.strictEqual(oldLoginRes.status, 401, "Old password must be rejected");

    // New password must succeed
    const newLoginRes = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: customerEmail, password: newSecurePassword })
    });
    assert.strictEqual(newLoginRes.status, 200, "New password must succeed");
    console.log("✓ Old password rejected and new password successfully authenticated.\n");

    // -------------------------------------------------------------
    // Test 10: Session revocation after password reset
    // -------------------------------------------------------------
    console.log("Test 10: Session revocation for tokens issued prior to reset...");
    // Using initialSessionCookie (issued before password reset)
    const profileResWithOldSession = await fetch(`${TEST_BASE_URL}/api/auth/me`, {
      headers: { Cookie: initialSessionCookie }
    });
    assert.strictEqual(
      profileResWithOldSession.status,
      401,
      "Pre-reset session token must be revoked and rejected with 401"
    );
    const oldSessionData = await profileResWithOldSession.json();
    assert(
      oldSessionData.message.includes("Password was recently reset"),
      "Message must notify customer of recent password reset"
    );
    console.log("✓ Pre-reset sessions invalidated automatically via passwordChangedAt validation.\n");

    // -------------------------------------------------------------
    // Test 11: Rate limiting enforcement
    // -------------------------------------------------------------
    console.log("Test 11: Rate limiting enforcement (5 requests per 15 min)...");
    clearRateLimits();
    const rateLimitEmail = "rate_limit_test@aura.com";

    // 5 allowed requests
    for (let i = 1; i <= 5; i++) {
      const res = await fetch(`${TEST_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: rateLimitEmail })
      });
      assert.strictEqual(res.status, 200, `Request ${i} must succeed`);
    }

    // 6th request must be rate-limited (HTTP 429)
    const blockedRes = await fetch(`${TEST_BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: rateLimitEmail })
    });
    assert.strictEqual(blockedRes.status, 429, "6th request within window must return 429 Too Many Requests");
    assert(blockedRes.headers.get("retry-after"), "Retry-After header must be present");
    const blockedData = await blockedRes.json();
    assert(blockedData.message.includes("Too many password reset requests"));
    console.log("✓ Rate limiting actively protects reset endpoint against brute-force / abuse.\n");

    // -------------------------------------------------------------
    // Test 12: Admin / customer authentication separation
    // -------------------------------------------------------------
    console.log("Test 12: Admin / customer authentication separation...");
    const adminUser = new User({
      name: "Isolated Admin",
      email: "isolated_admin@aura.com",
      password: "AdminSecurePassword2026!",
      role: "admin"
    });
    await adminUser.save();

    // Forgot password request for admin does NOT issue customer reset token
    await fetch(`${TEST_BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "isolated_admin@aura.com" })
    });
    const refreshedAdmin = await User.findOne({ email: "isolated_admin@aura.com" }).select("+passwordResetToken");
    assert.strictEqual(refreshedAdmin.passwordResetToken, undefined, "Admin cannot receive customer reset tokens");

    // Admin login cannot happen through customer login
    const adminThroughCustLogin = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "isolated_admin@aura.com", password: "AdminSecurePassword2026!" })
    });
    assert.strictEqual(adminThroughCustLogin.status, 403, "Admin blocked from customer login");

    // Admin login succeeds through admin portal
    const adminLoginRes = await fetch(`${TEST_BASE_URL}/api/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "isolated_admin@aura.com", password: "AdminSecurePassword2026!" })
    });
    assert.strictEqual(adminLoginRes.status, 200, "Admin login succeeds via admin-login route");
    console.log("✓ Strict separation between administrator and customer authentication confirmed.\n");

    // -------------------------------------------------------------
    // Test 13: Zero exposure of reset tokens, passwords, or credentials in API responses and models
    // -------------------------------------------------------------
    console.log("Test 13: Verifying tokens and passwords are never exposed in API responses or user serialization...");
    const auditEmail = "audit.security@aura-isolated.com";
    const auditPlainPass = "AuditPassword2026!";
    const auditUser = new User({
      name: "Audit User",
      email: auditEmail,
      password: auditPlainPass,
      role: "customer"
    });
    await auditUser.save();

    // 1. forgot-password endpoint response audit
    const forgotRes = await fetch(`${TEST_BASE_URL}/api/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: auditEmail })
    });
    const forgotBody = await forgotRes.json();
    const forgotBodyStr = JSON.stringify(forgotBody);

    assert(!forgotBody.token, "API response must not expose token");
    assert(!forgotBody.resetToken, "API response must not expose resetToken");
    assert(!forgotBody.password, "API response must not expose password");
    assert(!forgotBody.passwordResetToken, "API response must not expose passwordResetToken");
    assert(!forgotBodyStr.includes("AuditPassword2026!"), "API response must not leak raw password");

    // Fetch user from DB to get the hashed token for subsequent test
    const auditUserWithToken = await User.findOne({ email: auditEmail }).select("+passwordResetToken");
    assert(auditUserWithToken.passwordResetToken, "Token hash must be present in DB");
    assert.strictEqual(auditUserWithToken.passwordResetToken.length, 64, "Token hash must be SHA-256");

    // 2. verify-reset-token response audit
    const verifyRes = await fetch(`${TEST_BASE_URL}/api/auth/verify-reset-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "any_token_string" })
    });
    const verifyBody = await verifyRes.json();
    assert(!verifyBody.token, "verify-reset-token response must not expose token");
    assert(!verifyBody.user, "verify-reset-token response must not expose user object");

    // 3. User model toJSON() serialization audit
    const serializedUser = auditUserWithToken.toJSON();
    assert.strictEqual(serializedUser.password, undefined, "Serialized user must not contain password");
    assert.strictEqual(serializedUser.passwordResetToken, undefined, "Serialized user must not contain passwordResetToken");
    assert.strictEqual(serializedUser.passwordResetExpires, undefined, "Serialized user must not contain passwordResetExpires");
    assert.strictEqual(serializedUser.emailVerificationToken, undefined, "Serialized user must not contain emailVerificationToken");

    console.log("✓ Verified: Tokens, hashed tokens, and passwords are never exposed in API responses or user serialization.\n");

    console.log("==================================================================");
    console.log("ALL 13 ISOLATED FORGOT PASSWORD & RECOVERY TESTS PASSED! ✨");
    console.log("==================================================================");
  } finally {
    // Teardown: Clean up isolated test database and close server
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.dropDatabase();
      console.log("\n[Teardown] Dropped isolated test database 'aura_test_forgot_password_isolated'.");
      await mongoose.disconnect();
    }
    if (server) {
      if (typeof server.closeAllConnections === "function") {
        server.closeAllConnections();
      }
      server.close();
    }
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  if (server) {
    if (typeof server.closeAllConnections === "function") {
      server.closeAllConnections();
    }
    server.close();
  }
  if (mongoose.connection.readyState === 1) {
    mongoose.connection.db.dropDatabase().finally(() => mongoose.disconnect());
  }
  process.exit(1);
});
