const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const mongoose = require("mongoose");
const express = require("express");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
const assert = require("assert");
const nodemailer = require("nodemailer");

const User = require("./models/User");
const authRoutes = require("./routes/authRoutes");
const emailService = require("./utils/emailService");
const { clearRateLimits } = require("./middleware/resetRateLimiter");

const ISOLATED_DB_URI = "mongodb://localhost:27017/aura_test_email_verification_isolated";
const TEST_PORT = 5098;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

// The accessible email inbox configured in environment
const ACCESSIBLE_INBOX = process.env.SMTP_USER || "rakshithapoojary527@gmail.com";
// Use plus-addressing so it delivers to the accessible inbox without colliding
const TEST_CUSTOMER_EMAIL = ACCESSIBLE_INBOX.includes("@")
  ? ACCESSIBLE_INBOX.replace("@", "+verifytest@")
  : "rakshithapoojary527+verifytest@gmail.com";

let server;
const capturedEmails = [];
const originalCreateTransport = nodemailer.createTransport;

/**
 * Setup nodemailer interception:
 * - Allows real SMTP delivery ONLY for the designated accessible test inbox
 * - Prevents tests from sending unintended emails to fake or arbitrary addresses
 */
function setupNodemailerInterception() {
  nodemailer.createTransport = function (...args) {
    const transporter = originalCreateTransport.apply(this, args);
    const originalSendMail = transporter.sendMail.bind(transporter);

    transporter.sendMail = async function (mailOptions) {
      capturedEmails.push(mailOptions);
      const to = (mailOptions.to || "").toLowerCase();
      const isIntended = to.includes("rakshithapoojary527") || to === TEST_CUSTOMER_EMAIL.toLowerCase();

      if (isIntended) {
        console.log(`[Safe-Transport] Delivering INTENDED email to accessible inbox: ${mailOptions.to}`);
        return await originalSendMail(mailOptions);
      } else {
        console.log(`[Safe-Transport] Intercepting test email to "${mailOptions.to}" to PREVENT unintended outbound emails.`);
        return {
          messageId: `<mock-test-safe-${Date.now()}@aura-isolated.test>`
        };
      }
    };

    return transporter;
  };
}

function restoreNodemailer() {
  nodemailer.createTransport = originalCreateTransport;
}

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
  console.log("AURA EMAIL VERIFICATION SECURITY & FUNCTIONALITY AUDIT");
  console.log("Database: aura_test_email_verification_isolated (Strictly Isolated)");
  console.log(`Accessible Inbox: ${ACCESSIBLE_INBOX}`);
  console.log(`Test Customer Email: ${TEST_CUSTOMER_EMAIL}`);
  console.log("==================================================================\n");

  setupNodemailerInterception();

  // Connect exclusively to isolated test database
  await mongoose.connect(ISOLATED_DB_URI);
  console.log("✓ Connected to isolated test MongoDB database.");

  // Clean out any leftover test documents in isolated DB
  await User.deleteMany({});
  clearRateLimits();

  await setupIsolatedServer();
  console.log(`✓ Isolated test server listening on ${TEST_BASE_URL}\n`);

  try {
    // -------------------------------------------------------------
    // Test 1: Register test customer with accessible email inbox
    // -------------------------------------------------------------
    console.log("Test 1: Registering new test customer with accessible inbox...");
    const customerPassword = "AuraCustomerPass2026!";
    const customerFullName = "AURA Audit Customer";

    const regRes = await fetch(`${TEST_BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: customerFullName,
        email: TEST_CUSTOMER_EMAIL,
        password: customerPassword,
        confirmPassword: customerPassword
      })
    });

    assert.strictEqual(regRes.status, 201, "Registration must return 201 Created");
    const regData = await regRes.json();
    assert.strictEqual(regData.requiresVerification, true, "Response must signal requiresVerification: true");

    // Check that NO customer session cookie was set
    const setCookieHeader = regRes.headers.get("set-cookie") || "";
    assert(
      !setCookieHeader.includes("aura_customer_session"),
      "Must NOT issue customer session cookie upon registration before verification"
    );

    // Verify DB user record in isolated database
    const dbUser = await User.findOne({ email: TEST_CUSTOMER_EMAIL }).select("+emailVerificationToken +emailVerificationExpires");
    assert(dbUser, "User must exist in isolated MongoDB");
    assert.strictEqual(dbUser.isEmailVerified, false, "isEmailVerified must be false for newly registered user");
    assert(dbUser.emailVerificationToken, "emailVerificationToken hash must exist in MongoDB");
    assert.strictEqual(dbUser.emailVerificationToken.length, 64, "Token hash in DB must be 64-char SHA-256 hex string");
    assert(dbUser.emailVerificationExpires > new Date(), "emailVerificationExpires must be in future");

    console.log("✓ New customer registered in isolated DB with isEmailVerified: false, secure SHA-256 token hash, and no session cookie.\n");

    // -------------------------------------------------------------
    // Test 2: Verify verification email was sent to customer's registered email
    // -------------------------------------------------------------
    console.log("Test 2: Verifying verification email delivery to registered address...");
    assert(capturedEmails.length >= 1, "At least one verification email must have been generated");
    const sentEmail = capturedEmails.find((e) => (e.to || "").toLowerCase() === TEST_CUSTOMER_EMAIL.toLowerCase());
    assert(sentEmail, `Verification email must be addressed to customer's registered email (${TEST_CUSTOMER_EMAIL})`);
    assert(sentEmail.text || sentEmail.html, "Email must have body content");

    // Verify SMTP delivery status reported by API
    assert(regData.emailDelivery, "emailDelivery object must be present in response");
    assert.strictEqual(regData.emailDelivery.delivered, true, "emailDelivery.delivered must be true when SMTP is active");

    // Extract raw verification token from the sent link in email text
    const urlMatch = sentEmail.text.match(/http[s]?:\/\/[^\s]+/);
    assert(urlMatch, "Email text must contain a valid verification URL");
    const verificationUrl = urlMatch[0];
    assert(verificationUrl.includes("/verify-email?token="), "verificationUrl must contain /verify-email?token=");

    const verificationUrlObj = new URL(verificationUrl);
    const rawVerificationToken = verificationUrlObj.searchParams.get("token");
    assert(rawVerificationToken, "Raw verification token must be extractable from the email link");
    assert.strictEqual(rawVerificationToken.length, 64, "Raw token must be 64-character hex string (32 bytes)");

    // Confirm the raw token matches the SHA-256 hash stored in DB
    const expectedHash = crypto.createHash("sha256").update(rawVerificationToken).digest("hex");
    assert.strictEqual(dbUser.emailVerificationToken, expectedHash, "Hashed verification token in DB must match hash of emailed token");

    console.log(`✓ Verification email delivered to registered customer (${sentEmail.to}) with valid verification link.\n`);

    // -------------------------------------------------------------
    // Test 3: Unverified customer login blocked
    // -------------------------------------------------------------
    console.log("Test 3: Checking that unverified customer cannot log in...");
    const unverifiedLoginRes = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: TEST_CUSTOMER_EMAIL,
        password: customerPassword
      })
    });

    assert.strictEqual(unverifiedLoginRes.status, 403, "Unverified customer login must return 403 Forbidden");
    const unverifiedLoginData = await unverifiedLoginRes.json();
    assert.strictEqual(unverifiedLoginData.requiresVerification, true, "Must flag requiresVerification: true");
    const unverifiedCookie = unverifiedLoginRes.headers.get("set-cookie") || "";
    assert(!unverifiedCookie.includes("aura_customer_session"), "Unverified customer must NOT receive session cookie");
    console.log("✓ Unverified customer login successfully blocked with HTTP 403.\n");

    // -------------------------------------------------------------
    // Test 4: Invalid and Expired Token Rejection
    // -------------------------------------------------------------
    console.log("Test 4: Testing invalid and expired verification token rejection...");

    // 4a. Invalid token
    const invalidVerifyRes = await fetch(`${TEST_BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: "invalid_hex_token_0000000000000000000000000000000000000000000000000000" })
    });
    assert.strictEqual(invalidVerifyRes.status, 400, "Invalid token must return 400 Bad Request");
    const invalidVerifyData = await invalidVerifyRes.json();
    assert.strictEqual(invalidVerifyData.verified, false, "Must return verified: false");
    assert.strictEqual(invalidVerifyData.state, "invalid", "Must return state: invalid");

    // 4b. Expired token
    const expiredRawToken = crypto.randomBytes(32).toString("hex");
    const expiredHashedToken = crypto.createHash("sha256").update(expiredRawToken).digest("hex");
    const expiredUser = new User({
      name: "Expired Customer",
      email: "expired.customer@aura-isolated.test",
      password: "Password123!",
      isEmailVerified: false,
      emailVerificationToken: expiredHashedToken,
      emailVerificationExpires: new Date(Date.now() - 3600000) // 1 hour ago
    });
    await expiredUser.save();

    const expiredVerifyRes = await fetch(`${TEST_BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: expiredRawToken })
    });
    assert.strictEqual(expiredVerifyRes.status, 400, "Expired token must return 400 Bad Request");
    const expiredVerifyData = await expiredVerifyRes.json();
    assert.strictEqual(expiredVerifyData.verified, false, "Must return verified: false");
    assert.strictEqual(expiredVerifyData.state, "expired", "Must return state: expired");

    const checkExpiredUser = await User.findOne({ email: "expired.customer@aura-isolated.test" });
    assert.strictEqual(checkExpiredUser.isEmailVerified, false, "Account with expired token must remain unverified");
    console.log("✓ Invalid and expired verification tokens correctly rejected with HTTP 400.\n");

    // -------------------------------------------------------------
    // Test 5: Confirm verification link works and marks account verified
    // -------------------------------------------------------------
    console.log("Test 5: Verifying account using the emailed verification token...");
    const verifyRes = await fetch(`${TEST_BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawVerificationToken })
    });

    assert.strictEqual(verifyRes.status, 200, "Valid verification token must return 200 OK");
    const verifyData = await verifyRes.json();
    assert.strictEqual(verifyData.verified, true, "Must return verified: true");
    assert.strictEqual(verifyData.state, "success", "Must return state: success");

    // Confirm database state
    const verifiedDbUser = await User.findOne({ email: TEST_CUSTOMER_EMAIL }).select(
      "+emailVerificationToken +emailVerificationExpires +lastVerifiedToken"
    );
    assert.strictEqual(verifiedDbUser.isEmailVerified, true, "isEmailVerified must be set to true");
    assert(verifiedDbUser.emailVerifiedAt, "emailVerifiedAt timestamp must be recorded");
    assert.strictEqual(verifiedDbUser.emailVerificationToken, undefined, "Pending verification token must be removed");
    assert.strictEqual(verifiedDbUser.emailVerificationExpires, undefined, "Pending expiration must be removed");
    assert.strictEqual(
      verifiedDbUser.lastVerifiedToken,
      expectedHash,
      "lastVerifiedToken must store the hash for duplicate click detection"
    );

    console.log("✓ Verification link successfully verified account; isEmailVerified set to true in MongoDB.\n");

    // -------------------------------------------------------------
    // Test 6: Already-used verification token handling
    // -------------------------------------------------------------
    console.log("Test 6: Testing reuse of already-used verification token...");
    const reusedVerifyRes = await fetch(`${TEST_BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawVerificationToken })
    });

    assert.strictEqual(reusedVerifyRes.status, 200, "Already-used token must return 200 OK");
    const reusedData = await reusedVerifyRes.json();
    assert.strictEqual(reusedData.verified, true, "Must return verified: true");
    assert.strictEqual(reusedData.state, "already-verified", "Must return state: already-verified");

    // Test a completely unknown/random token cannot claim already-verified
    const randomVerifyRes = await fetch(`${TEST_BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: crypto.randomBytes(32).toString("hex") })
    });
    assert.strictEqual(randomVerifyRes.status, 400, "Random unknown token must return 400 Bad Request");

    console.log("✓ Reused verification token gracefully recognized as already-verified without error.\n");

    // -------------------------------------------------------------
    // Test 7: Verified customer login succeeds
    // -------------------------------------------------------------
    console.log("Test 7: Logging in with now-verified customer credentials...");
    const verifiedLoginRes = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: TEST_CUSTOMER_EMAIL,
        password: customerPassword
      })
    });

    assert.strictEqual(verifiedLoginRes.status, 200, "Verified customer login must succeed with 200 OK");
    const verifiedLoginData = await verifiedLoginRes.json();
    assert.strictEqual(verifiedLoginData.user.email, TEST_CUSTOMER_EMAIL, "Logged-in user email must match");
    const verifiedCookie = verifiedLoginRes.headers.get("set-cookie") || "";
    assert(verifiedCookie.includes("aura_customer_session"), "Verified customer must receive aura_customer_session cookie");
    console.log("✓ Verified customer logs in successfully with HTTP 200 and session cookie.\n");

    // -------------------------------------------------------------
    // Test 8: Legacy accounts continue to work without lockout
    // -------------------------------------------------------------
    console.log("Test 8: Checking legacy accounts (isEmailVerified: undefined) continue to work...");
    const legacyEmail = "legacy.patron@aura-isolated.test";
    const legacyPass = "LegacySecretPass2026!";

    const legacyCustomer = new User({
      name: "Legacy Patron",
      email: legacyEmail,
      password: legacyPass,
      role: "customer"
      // isEmailVerified is intentionally undefined
    });
    await legacyCustomer.save();

    const rawLegacyUser = await User.findOne({ email: legacyEmail });
    assert.strictEqual(rawLegacyUser.isEmailVerified, undefined, "Legacy account must have isEmailVerified as undefined");

    const legacyLoginRes = await fetch(`${TEST_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: legacyEmail,
        password: legacyPass
      })
    });

    assert.strictEqual(legacyLoginRes.status, 200, "Legacy customer login must succeed with 200 OK");
    const legacyCookie = legacyLoginRes.headers.get("set-cookie") || "";
    assert(legacyCookie.includes("aura_customer_session"), "Legacy customer must receive session cookie");
    console.log("✓ Existing legacy customer accounts are grandfathered and log in seamlessly.\n");

    // -------------------------------------------------------------
    // Test 9: Sensitive data exposure audit (tokens & passwords)
    // -------------------------------------------------------------
    console.log("Test 9: Verifying tokens and passwords are never exposed in logs or API responses...");

    // 9a. Registration API response
    assert(!regData.token, "Registration response must not contain 'token'");
    assert(!regData.verificationToken, "Registration response must not contain 'verificationToken'");
    assert(!regData.emailVerificationToken, "Registration response must not contain 'emailVerificationToken'");
    assert(!regData.user.password, "User object in registration response must not contain 'password'");
    assert(!regData.user.emailVerificationToken, "User object must not contain 'emailVerificationToken'");
    assert(!regData.user.emailVerificationExpires, "User object must not contain 'emailVerificationExpires'");
    assert(!regData.user.lastVerifiedToken, "User object must not contain 'lastVerifiedToken'");

    // 9b. Verify Email API response
    assert(!verifyData.token, "Verify response must not contain 'token'");
    assert(!verifyData.password, "Verify response must not contain 'password'");
    assert(!verifyData.user, "Verify response must not expose entire user model");

    // 9c. Login API response
    assert(!verifiedLoginData.user.password, "Login user object must not contain 'password'");
    assert(!verifiedLoginData.user.emailVerificationToken, "Login user object must not contain 'emailVerificationToken'");
    assert(!verifiedLoginData.user.lastVerifiedToken, "Login user object must not contain 'lastVerifiedToken'");

    // 9d. User model toJSON() serialization
    const freshUser = await User.findOne({ email: TEST_CUSTOMER_EMAIL }).select(
      "+password +emailVerificationToken +emailVerificationExpires +lastVerifiedToken +passwordResetToken +passwordResetExpires"
    );
    const serialized = freshUser.toJSON();
    assert.strictEqual(serialized.password, undefined, "toJSON() must strip password");
    assert.strictEqual(serialized.emailVerificationToken, undefined, "toJSON() must strip emailVerificationToken");
    assert.strictEqual(serialized.emailVerificationExpires, undefined, "toJSON() must strip emailVerificationExpires");
    assert.strictEqual(serialized.lastVerifiedToken, undefined, "toJSON() must strip lastVerifiedToken");
    assert.strictEqual(serialized.passwordResetToken, undefined, "toJSON() must strip passwordResetToken");
    assert.strictEqual(serialized.passwordResetExpires, undefined, "toJSON() must strip passwordResetExpires");

    console.log("✓ Zero exposure: passwords and verification tokens are never exposed in API responses or serialized JSON.\n");

    // -------------------------------------------------------------
    // Test 10: Prevention of unintended emails & rate limiting
    // -------------------------------------------------------------
    console.log("Test 10: Testing resend rate limiting while preventing unintended emails...");
    clearRateLimits();

    const testResendEmail = "unverified.ratecheck@aura-isolated.test";
    const rateCheckUser = new User({
      name: "Rate Check User",
      email: testResendEmail,
      password: "Password123!",
      isEmailVerified: false,
      emailVerificationToken: "initial_test_hash_00000000000000000000000000000000000000000000000000",
      emailVerificationExpires: new Date(Date.now() + 3600000)
    });
    await rateCheckUser.save();

    // 5 attempts allowed within 15 minutes window
    for (let i = 0; i < 5; i++) {
      const resendRes = await fetch(`${TEST_BASE_URL}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: testResendEmail })
      });
      assert.strictEqual(resendRes.status, 200, `Resend request ${i + 1} must return 200`);
    }

    // 6th attempt should be blocked by rate limiter
    const rateLimitedRes = await fetch(`${TEST_BASE_URL}/api/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testResendEmail })
    });
    assert.strictEqual(rateLimitedRes.status, 429, "6th resend request must return 429 Too Many Requests");
    assert(rateLimitedRes.headers.get("retry-after"), "Must include Retry-After header");

    console.log("✓ Rate limiting actively protects resend endpoint, and all unintended test emails were safely intercepted.\n");

    console.log("==================================================================");
    console.log("ALL 10 EMAIL VERIFICATION AUDIT TESTS PASSED SUCCESSFULLY! ✨");
    console.log("==================================================================");

  } finally {
    restoreNodemailer();

    // Teardown: Drop isolated test database so zero artifacts remain
    console.log("\n[Teardown] Dropping isolated test database 'aura_test_email_verification_isolated'...");
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    if (server) {
      server.close();
    }
    console.log("✓ Isolated test database dropped cleanly.");
  }
}

runTests().catch((err) => {
  console.error("\n❌ Test Suite Failed:", err);
  process.exit(1);
});
