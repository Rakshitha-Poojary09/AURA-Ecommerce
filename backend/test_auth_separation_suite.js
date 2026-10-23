const assert = require("assert");

const BACKEND_URL = "http://localhost:5000";

function parseCookie(setCookieHeader, cookieName) {
  if (!setCookieHeader) return null;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const c of cookies) {
    const match = c.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

function hasClearedCookie(setCookieHeader, cookieName) {
  if (!setCookieHeader) return false;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const c of cookies) {
    if (
      c.includes(`${cookieName}=;`) ||
      (c.includes(cookieName) && (c.includes("Expires=Thu, 01 Jan 1970") || c.includes("Max-Age=0")))
    ) {
      return true;
    }
  }
  return false;
}

async function runAuthSeparationSuite() {
  console.log("====================================================================");
  console.log("AURA AUTHENTICATION SEPARATION & COOKIE ISOLATION TEST SUITE");
  console.log("====================================================================\n");

  const timestamp = Date.now();
  const testCustomerEmail = `sep_customer_${timestamp}@aura.com`;
  const customerPassword = "CustomerPass123!";
  try {
    // 0. Register customer to establish valid customer credentials
  console.log("Setup: Registering a test customer...");
  const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Separation Test User",
      email: testCustomerEmail,
      password: customerPassword,
      confirmPassword: customerPassword
    })
  });
  assert.strictEqual(regRes.status, 201, "Customer registration must succeed with 201");
  const regCookieHeader = regRes.headers.get("set-cookie");
  assert(regCookieHeader.includes("aura_customer_session="), "Customer registration must issue aura_customer_session cookie");
  assert(!regCookieHeader.includes("aura_admin_session="), "Customer registration must NOT issue aura_admin_session cookie");
  console.log("✓ Test customer registered successfully.\n");

  // ====================================================================
  // TEST CASE 1: Admin login → Customer must remain logged out
  // ====================================================================
  console.log("--------------------------------------------------------------------");
  console.log("Case 1: Admin login → Customer must remain logged out");
  console.log("--------------------------------------------------------------------");
  const adminLoginRes = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@aura.com",
      password: "Admin@Aura2026"
    })
  });
  assert.strictEqual(adminLoginRes.status, 200, "Admin login must succeed with 200");
  const adminSetCookie = adminLoginRes.headers.get("set-cookie") || "";
  assert(adminSetCookie.includes("aura_admin_session="), "Admin login must issue aura_admin_session cookie");
  assert(!adminSetCookie.includes("aura_customer_session="), "Admin login must NOT issue aura_customer_session cookie");

  const adminToken = parseCookie(adminSetCookie, "aura_admin_session");
  assert(adminToken, "Extracted aura_admin_session token must be valid");
  const adminCookieHeader = `aura_admin_session=${adminToken}`;

  // Customer auth check /api/auth/me using ONLY admin session cookie
  const customerCheckWithAdminCookie = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: adminCookieHeader }
  });
  assert.strictEqual(
    customerCheckWithAdminCookie.status,
    401,
    "GET /api/auth/me with only aura_admin_session must return 401 Unauthorized"
  );
  console.log("✓ Admin login sets only aura_admin_session.");
  console.log("✓ Customer check /api/auth/me with admin session returned 401 Unauthorized.");
  console.log("✓ Case 1 PASSED: Admin login does NOT log in customer!\n");

  // ====================================================================
  // TEST CASE 2: Customer login → Admin must remain logged out
  // ====================================================================
  console.log("--------------------------------------------------------------------");
  console.log("Case 2: Customer login → Admin must remain logged out");
  console.log("--------------------------------------------------------------------");
  const custLoginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: testCustomerEmail,
      password: customerPassword
    })
  });
  assert.strictEqual(custLoginRes.status, 200, "Customer login must succeed with 200");
  const custSetCookie = custLoginRes.headers.get("set-cookie") || "";
  assert(custSetCookie.includes("aura_customer_session="), "Customer login must issue aura_customer_session cookie");
  assert(!custSetCookie.includes("aura_admin_session="), "Customer login must NOT issue aura_admin_session cookie");

  const customerToken = parseCookie(custSetCookie, "aura_customer_session");
  assert(customerToken, "Extracted aura_customer_session token must be valid");
  const customerCookieHeader = `aura_customer_session=${customerToken}`;

  // Admin auth check /api/auth/admin/me using ONLY customer session cookie
  const adminCheckWithCustCookie = await fetch(`${BACKEND_URL}/api/auth/admin/me`, {
    headers: { Cookie: customerCookieHeader }
  });
  assert.strictEqual(
    adminCheckWithCustCookie.status,
    401,
    "GET /api/auth/admin/me with only aura_customer_session must return 401 Unauthorized"
  );
  console.log("✓ Customer login sets only aura_customer_session.");
  console.log("✓ Admin check /api/auth/admin/me with customer session returned 401 Unauthorized.");
  console.log("✓ Case 2 PASSED: Customer login does NOT log in admin!\n");

  // ====================================================================
  // TEST CASE 3: Admin + Customer can be logged in simultaneously
  // ====================================================================
  console.log("--------------------------------------------------------------------");
  console.log("Case 3: Admin + Customer can be logged in simultaneously");
  console.log("--------------------------------------------------------------------");
  const dualCookies = `${adminCookieHeader}; ${customerCookieHeader}`;

  // Check customer endpoint with dual cookies
  const customerDualRes = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: dualCookies }
  });
  assert.strictEqual(customerDualRes.status, 200, "GET /api/auth/me with dual cookies must return 200");
  const customerDualData = await customerDualRes.json();
  assert.strictEqual(customerDualData.user.email, testCustomerEmail, "Customer session reflects customer identity");
  assert.strictEqual(customerDualData.user.role, "customer", "Customer session role is customer");

  // Check admin endpoint with dual cookies
  const adminDualRes = await fetch(`${BACKEND_URL}/api/auth/admin/me`, {
    headers: { Cookie: dualCookies }
  });
  assert.strictEqual(adminDualRes.status, 200, "GET /api/auth/admin/me with dual cookies must return 200");
  const adminDualData = await adminDualRes.json();
  assert.strictEqual(adminDualData.user.email, "admin@aura.com", "Admin session reflects admin identity");
  assert.strictEqual(adminDualData.user.role, "admin", "Admin session role is admin");

  console.log("✓ Customer session verified on /api/auth/me (Role: customer, Email: " + customerDualData.user.email + ")");
  console.log("✓ Admin session verified on /api/auth/admin/me (Role: admin, Email: " + adminDualData.user.email + ")");
  console.log("✓ Case 3 PASSED: Both sessions coexist simultaneously without interference!\n");

  // ====================================================================
  // TEST CASE 4: Admin logout must NOT log out customer
  // ====================================================================
  console.log("--------------------------------------------------------------------");
  console.log("Case 4: Admin logout must NOT log out customer");
  console.log("--------------------------------------------------------------------");
  const adminLogoutRes = await fetch(`${BACKEND_URL}/api/auth/admin/logout`, {
    method: "POST",
    headers: { Cookie: dualCookies }
  });
  assert.strictEqual(adminLogoutRes.status, 200, "Admin logout must succeed with 200");
  const adminLogoutCookieHeader = adminLogoutRes.headers.get("set-cookie") || "";
  assert(
    hasClearedCookie(adminLogoutCookieHeader, "aura_admin_session"),
    "Admin logout must clear aura_admin_session"
  );
  assert(
    !hasClearedCookie(adminLogoutCookieHeader, "aura_customer_session"),
    "Admin logout must NOT clear aura_customer_session"
  );

  // Customer must STILL be logged in with customer cookie
  const custPostAdminLogout = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: customerCookieHeader }
  });
  assert.strictEqual(custPostAdminLogout.status, 200, "Customer session remains valid after admin logout");
  const postLogoutCustData = await custPostAdminLogout.json();
  assert.strictEqual(postLogoutCustData.user.email, testCustomerEmail);

  // Admin must now be logged out
  const adminPostLogout = await fetch(`${BACKEND_URL}/api/auth/admin/me`, {
    headers: { Cookie: customerCookieHeader } // Admin cookie was cleared
  });
  assert.strictEqual(adminPostLogout.status, 401, "Admin is unauthenticated after admin logout");

  console.log("✓ Admin logout cleared only aura_admin_session.");
  console.log("✓ Customer session on /api/auth/me remains 200 OK.");
  console.log("✓ Admin session on /api/auth/admin/me is 401 Unauthorized.");
  console.log("✓ Case 4 PASSED: Admin logout does NOT log out customer!\n");

  // ====================================================================
  // TEST CASE 5: Customer logout must NOT log out admin
  // ====================================================================
  console.log("--------------------------------------------------------------------");
  console.log("Case 5: Customer logout must NOT log out admin");
  console.log("--------------------------------------------------------------------");
  // Re-login admin to restore dual session state
  const reAdminLogin = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@aura.com", password: "Admin@Aura2026" })
  });
  const newAdminToken = parseCookie(reAdminLogin.headers.get("set-cookie"), "aura_admin_session");
  const freshAdminCookie = `aura_admin_session=${newAdminToken}`;
  const freshDualCookies = `${freshAdminCookie}; ${customerCookieHeader}`;

  // Customer logs out
  const custLogoutRes = await fetch(`${BACKEND_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: freshDualCookies }
  });
  assert.strictEqual(custLogoutRes.status, 200, "Customer logout must succeed with 200");
  const custLogoutCookieHeader = custLogoutRes.headers.get("set-cookie") || "";
  assert(
    hasClearedCookie(custLogoutCookieHeader, "aura_customer_session"),
    "Customer logout must clear aura_customer_session"
  );
  assert(
    !hasClearedCookie(custLogoutCookieHeader, "aura_admin_session"),
    "Customer logout must NOT clear aura_admin_session"
  );

  // Admin must STILL be logged in with admin cookie
  const adminPostCustLogout = await fetch(`${BACKEND_URL}/api/auth/admin/me`, {
    headers: { Cookie: freshAdminCookie }
  });
  assert.strictEqual(adminPostCustLogout.status, 200, "Admin session remains valid after customer logout");
  const postCustLogoutAdminData = await adminPostCustLogout.json();
  assert.strictEqual(postCustLogoutAdminData.user.email, "admin@aura.com");

  // Customer must now be logged out
  const custPostLogout = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: freshAdminCookie } // Customer cookie was cleared
  });
  assert.strictEqual(custPostLogout.status, 401, "Customer is unauthenticated after customer logout");

  console.log("✓ Customer logout cleared only aura_customer_session.");
  console.log("✓ Admin session on /api/auth/admin/me remains 200 OK.");
  console.log("✓ Customer session on /api/auth/me is 401 Unauthorized.");
  console.log("✓ Case 5 PASSED: Customer logout does NOT log out admin!\n");

  // ====================================================================
  // TEST CASE 6: Admin cookie cannot access customer-protected APIs
  // ====================================================================
  console.log("--------------------------------------------------------------------");
  console.log("Case 6: Admin cookie cannot access customer-protected APIs");
  console.log("--------------------------------------------------------------------");
  // 6a: GET /api/auth/me
  const c6_me = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: freshAdminCookie }
  });
  assert.strictEqual(c6_me.status, 401, "Admin cookie on /api/auth/me must return 401");

  // 6b: PUT /api/auth/profile
  const c6_profile = await fetch(`${BACKEND_URL}/api/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: freshAdminCookie
    },
    body: JSON.stringify({ name: "Hacked Profile" })
  });
  assert.strictEqual(c6_profile.status, 401, "Admin cookie on /api/auth/profile must return 401");

  // 6c: GET /api/orders/my-orders
  const c6_orders = await fetch(`${BACKEND_URL}/api/orders/my-orders`, {
    headers: { Cookie: freshAdminCookie }
  });
  assert.strictEqual(c6_orders.status, 401, "Admin cookie on /api/orders/my-orders must return 401");

  // 6d: GET /api/wishlist
  const c6_wishlist = await fetch(`${BACKEND_URL}/api/wishlist`, {
    headers: { Cookie: freshAdminCookie }
  });
  assert.strictEqual(c6_wishlist.status, 401, "Admin cookie on /api/wishlist must return 401");

  // 6e: POST /api/wishlist/toggle
  const c6_wishlistToggle = await fetch(`${BACKEND_URL}/api/wishlist/toggle`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: freshAdminCookie
    },
    body: JSON.stringify({ productId: "65b82193b05f274a10000001" })
  });
  assert.strictEqual(c6_wishlistToggle.status, 401, "Admin cookie on /api/wishlist/toggle must return 401");

  console.log("✓ GET /api/auth/me with admin cookie → 401 Unauthorized");
  console.log("✓ PUT /api/auth/profile with admin cookie → 401 Unauthorized");
  console.log("✓ GET /api/orders/my-orders with admin cookie → 401 Unauthorized");
  console.log("✓ GET /api/wishlist with admin cookie → 401 Unauthorized");
  console.log("✓ POST /api/wishlist/toggle with admin cookie → 401 Unauthorized");
  console.log("✓ Case 6 PASSED: Admin cookie cannot access customer-protected APIs!\n");

  // ====================================================================
  // TEST CASE 7: Customer cookie cannot access admin-protected APIs
  // ====================================================================
  console.log("--------------------------------------------------------------------");
  console.log("Case 7: Customer cookie cannot access admin-protected APIs");
  console.log("--------------------------------------------------------------------");
  // 7a: GET /api/auth/admin/me
  const c7_adminMe = await fetch(`${BACKEND_URL}/api/auth/admin/me`, {
    headers: { Cookie: customerCookieHeader }
  });
  assert.strictEqual(c7_adminMe.status, 401, "Customer cookie on /api/auth/admin/me must return 401");

  // 7b: GET /api/orders (admin all orders)
  const c7_adminOrders = await fetch(`${BACKEND_URL}/api/orders`, {
    headers: { Cookie: customerCookieHeader }
  });
  assert.strictEqual(c7_adminOrders.status, 401, "Customer cookie on GET /api/orders must return 401");

  // 7c: POST /api/products (admin create product)
  const c7_postProduct = await fetch(`${BACKEND_URL}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: customerCookieHeader
    },
    body: JSON.stringify({ name: "Unauthorized Product", price: 100 })
  });
  assert.strictEqual(c7_postProduct.status, 401, "Customer cookie on POST /api/products must return 401");

  // 7d: GET /api/admin/analytics (admin analytics)
  const c7_analytics = await fetch(`${BACKEND_URL}/api/admin/analytics`, {
    headers: { Cookie: customerCookieHeader }
  });
  assert.strictEqual(c7_analytics.status, 401, "Customer cookie on GET /api/admin/analytics must return 401");

  console.log("✓ GET /api/auth/admin/me with customer cookie → 401 Unauthorized");
  console.log("✓ GET /api/orders with customer cookie → 401 Unauthorized");
  console.log("✓ POST /api/products with customer cookie → 401 Unauthorized");
  console.log("✓ GET /api/admin/analytics with customer cookie → 401 Unauthorized");
  console.log("✓ Case 7 PASSED: Customer cookie cannot access admin-protected APIs!\n");

  console.log("====================================================================");
  console.log("ALL 7 MANDATORY AUTHENTICATION SEPARATION CASES PASSED! ✨");
  console.log("====================================================================\n");
  } finally {
    try {
      const mongoose = require("mongoose");
      const conn = await mongoose.createConnection(process.env.TEST_MONGO_URI || "mongodb://localhost:27017/aura");
      if (testCustomerEmail) {
        await conn.collection("users").deleteOne({ email: testCustomerEmail });
        await conn.collection("adminnotifications").deleteMany({ message: { $regex: new RegExp(testCustomerEmail, "i") } });
      }
      await conn.close();
      console.log("✓ Test cleanup: removed temporary sep_customer test account.");
    } catch (e) {}
  }
}

runAuthSeparationSuite().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
