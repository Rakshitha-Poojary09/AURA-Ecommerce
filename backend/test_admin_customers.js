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

async function runAdminCustomersTests() {
  console.log("==================================================================");
  console.log("AURA ADMIN CUSTOMERS MANAGEMENT COMPREHENSIVE TEST SUITE");
  console.log("==================================================================\n");

  const timestamp = Date.now();

  // -------------------------------------------------------------
  // Setup: Authenticate Admin
  // -------------------------------------------------------------
  console.log("Setup 1: Authenticating Administrator...");
  const adminLoginRes = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@aura.com",
      password: "Admin@Aura2026"
    })
  });
  assert.strictEqual(adminLoginRes.status, 200, "Admin login must succeed");
  const rawAdminCookie = parseCookie(adminLoginRes.headers.get("set-cookie"), "aura_admin_session");
  assert(rawAdminCookie, "Admin login must issue aura_admin_session cookie");
  const adminCookie = `aura_admin_session=${rawAdminCookie}`;
  console.log("✓ Admin successfully authenticated.\n");

  // -------------------------------------------------------------
  // Setup: Register Customer A & Customer B
  // -------------------------------------------------------------
  console.log("Setup 2: Registering two test customers (Customer A & Customer B)...");
  const customerAEmail = `cust_a_${timestamp}@aura.com`;
  const regARes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Priya Sharma",
      email: customerAEmail,
      password: "Password123!",
      confirmPassword: "Password123!"
    })
  });
  assert.strictEqual(regARes.status, 201, "Customer A registration must succeed");
  const rawCustomerACookie = parseCookie(regARes.headers.get("set-cookie"), "aura_customer_session");
  const customerACookie = `aura_customer_session=${rawCustomerACookie}`;
  const customerAData = await regARes.json();
  const customerAId = customerAData.user?._id || customerAData.user?.id;

  const customerBEmail = `cust_b_${timestamp}@aura.com`;
  const regBRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Rohan Kapoor",
      email: customerBEmail,
      password: "Password123!",
      confirmPassword: "Password123!"
    })
  });
  assert.strictEqual(regBRes.status, 201, "Customer B registration must succeed");
  const rawCustomerBCookie = parseCookie(regBRes.headers.get("set-cookie"), "aura_customer_session");
  const customerBCookie = `aura_customer_session=${rawCustomerBCookie}`;
  const customerBData = await regBRes.json();
  const customerBId = customerBData.user?._id || customerBData.user?.id;
  console.log(`✓ Registered Customer A (${customerAEmail}) & Customer B (${customerBEmail})\n`);

  // Fetch product for orders
  const prodsRes = await fetch(`${BACKEND_URL}/api/products`);
  const products = await prodsRes.json();
  const targetProduct = products.find(p => p.stock > 5 && p.sizeStock && Object.values(p.sizeStock).some(q => Number(q) > 2)) || products[0];
  const targetSize = Object.entries(targetProduct.sizeStock || {}).find(([sz, qty]) => Number(qty) > 2)?.[0] || "M";

  // -------------------------------------------------------------
  // Setup: Create Orders for Customer A (1 delivered, 1 cancelled)
  // Customer B has 0 orders
  // -------------------------------------------------------------
  console.log("Setup 3: Placing orders for Customer A (Active: ₹1,500, Cancelled: ₹2,000)...");
  const activeOrderRes = await fetch(`${BACKEND_URL}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: customerACookie
    },
    body: JSON.stringify({
      orderId: `AUR-TEST-ACT-${timestamp}`,
      customer: {
        fullName: "Priya Sharma",
        email: customerAEmail,
        phone: "9876543210"
      },
      shippingAddress: {
        address: "123 Marine Drive",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400020"
      },
      items: [
        {
          productId: targetProduct._id,
          name: targetProduct.name,
          price: 1500,
          quantity: 1,
          size: targetSize
        }
      ],
      subtotal: 1500,
      shipping: 0,
      total: 1500,
      status: "Delivered"
    })
  });
  if (activeOrderRes.status !== 201) {
    const errBody = await activeOrderRes.json().catch(() => ({}));
    console.error("activeOrderRes failed:", errBody);
  }
  assert.strictEqual(activeOrderRes.status, 201, "Customer A active order placement must succeed");

  const cancelledOrderRes = await fetch(`${BACKEND_URL}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: customerACookie
    },
    body: JSON.stringify({
      orderId: `AUR-TEST-CNC-${timestamp}`,
      customer: {
        fullName: "Priya Sharma",
        email: customerAEmail,
        phone: "9876543210"
      },
      shippingAddress: {
        address: "123 Marine Drive",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400020"
      },
      items: [
        {
          productId: targetProduct._id,
          name: targetProduct.name,
          price: 2000,
          quantity: 1,
          size: targetSize
        }
      ],
      subtotal: 2000,
      shipping: 0,
      total: 2000,
      status: "Cancelled"
    })
  });
  if (cancelledOrderRes.status !== 201) {
    const errBody = await cancelledOrderRes.json().catch(() => ({}));
    console.error("cancelledOrderRes failed:", errBody);
  }
  assert.strictEqual(cancelledOrderRes.status, 201, "Customer A cancelled order placement must succeed");
  console.log("✓ Customer A placed 2 orders (1 Delivered @ ₹1,500, 1 Cancelled @ ₹2,000).\n");

  // =============================================================
  // TEST 1: Admin can retrieve customers
  // =============================================================
  console.log("Test 1: Admin can retrieve customers...");
  const adminGetCustomersRes = await fetch(`${BACKEND_URL}/api/admin/customers`, {
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(adminGetCustomersRes.status, 200, "Admin must receive 200 OK");
  const customersPayload = await adminGetCustomersRes.json();
  assert(customersPayload.success, "Payload must have success: true");
  assert(Array.isArray(customersPayload.customers), "Payload must contain customers array");
  assert(customersPayload.stats, "Payload must contain stats object");
  console.log(`✓ Admin retrieved ${customersPayload.customers.length} patrons with catalog stats.\n`);

  // =============================================================
  // TEST 2: Guest cannot retrieve customers
  // =============================================================
  console.log("Test 2: Guest cannot retrieve customers...");
  const guestGetCustomersRes = await fetch(`${BACKEND_URL}/api/admin/customers`);
  assert.strictEqual(guestGetCustomersRes.status, 401, "Guest must receive 401 Unauthorized");
  console.log("✓ Guest blocked with 401.\n");

  // =============================================================
  // TEST 3: Customer cannot retrieve customers
  // =============================================================
  console.log("Test 3: Customer cannot retrieve customers...");
  const customerGetCustomersRes = await fetch(`${BACKEND_URL}/api/admin/customers`, {
    headers: { Cookie: customerACookie }
  });
  assert(
    customerGetCustomersRes.status === 401 || customerGetCustomersRes.status === 403,
    `Customer must be blocked with 401 or 403 (got ${customerGetCustomersRes.status})`
  );
  console.log(`✓ Customer blocked with ${customerGetCustomersRes.status}.\n`);

  // =============================================================
  // TEST 4: Admin can retrieve individual customer details
  // =============================================================
  console.log("Test 4: Admin can retrieve individual customer details...");
  const adminGetCustDetailRes = await fetch(`${BACKEND_URL}/api/admin/customers/${customerAId}`, {
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(adminGetCustDetailRes.status, 200, "Admin must receive 200 for customer details");
  const custADetail = await adminGetCustDetailRes.json();
  assert.strictEqual(custADetail.customer.name, "Priya Sharma");
  assert.strictEqual(custADetail.customer.email, customerAEmail);
  assert(Array.isArray(custADetail.customer.orders), "Customer details must include orders array");
  assert.strictEqual(custADetail.customer.orders.length, 2, "Customer A must have exactly 2 orders");
  console.log(`✓ Admin retrieved details and 2 orders for ${custADetail.customer.name}.\n`);

  // =============================================================
  // TEST 5: Customer cannot retrieve admin customer details
  // =============================================================
  console.log("Test 5: Customer cannot retrieve admin customer details...");
  const custGetCustDetailRes = await fetch(`${BACKEND_URL}/api/admin/customers/${customerAId}`, {
    headers: { Cookie: customerACookie }
  });
  assert(
    custGetCustDetailRes.status === 401 || custGetCustDetailRes.status === 403,
    `Customer must receive 401/403 (got ${custGetCustDetailRes.status})`
  );
  console.log(`✓ Customer blocked from viewing admin customer details with ${custGetCustDetailRes.status}.\n`);

  // =============================================================
  // TEST 6: Customer statistics are calculated correctly
  // =============================================================
  console.log("Test 6: Customer statistics are calculated correctly...");
  const foundCustA = customersPayload.customers.find(c => c.email === customerAEmail);
  assert(foundCustA, "Customer A must be in customers list");
  assert.strictEqual(foundCustA.totalOrders, 2, "Customer A totalOrders must be 2");
  assert(foundCustA.lastOrderDate, "Customer A lastOrderDate must be populated");

  const foundCustB = customersPayload.customers.find(c => c.email === customerBEmail);
  assert(foundCustB, "Customer B must be in customers list");
  assert.strictEqual(foundCustB.totalOrders, 0, "Customer B totalOrders must be 0");
  assert.strictEqual(foundCustB.totalSpent, 0, "Customer B totalSpent must be 0");
  assert.strictEqual(foundCustB.lastOrderDate, null, "Customer B lastOrderDate must be null");
  console.log("✓ Customer statistics calculated accurately from MongoDB.\n");

  // =============================================================
  // TEST 7: Cancelled orders are excluded from total spending
  // =============================================================
  console.log("Test 7: Cancelled orders are excluded from total spending...");
  // Customer A placed: 1 Delivered order of ₹1,500, and 1 Cancelled order of ₹2,000.
  // totalSpent must be ₹1,500, NOT ₹3,500!
  assert.strictEqual(
    foundCustA.totalSpent,
    1500,
    `Customer A totalSpent must be 1500 (excluding 2000 cancelled), got ${foundCustA.totalSpent}`
  );
  assert.strictEqual(
    custADetail.customer.totalSpent,
    1500,
    `Customer A detail totalSpent must be 1500, got ${custADetail.customer.totalSpent}`
  );
  console.log("✓ Cancelled orders strictly excluded from total spending calculation (totalSpent: ₹1,500).\n");

  // =============================================================
  // TEST 8: Customer order history belongs to the correct customer
  // =============================================================
  console.log("Test 8: Customer order history belongs to the correct customer...");
  const adminGetCustBDetailRes = await fetch(`${BACKEND_URL}/api/admin/customers/${customerBId}`, {
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(adminGetCustBDetailRes.status, 200);
  const custBDetail = await adminGetCustBDetailRes.json();
  assert.strictEqual(custBDetail.customer.orders.length, 0, "Customer B must have 0 orders");

  for (const o of custADetail.customer.orders) {
    assert(
      o.orderId.startsWith("AUR-TEST-"),
      `Order ${o.orderId} must belong to Customer A`
    );
  }
  console.log("✓ Order histories accurately isolated per customer without cross-contamination.\n");

  // =============================================================
  // TEST 9: Password hashes are never returned
  // =============================================================
  console.log("Test 9: Password hashes are never returned...");
  assert.strictEqual(foundCustA.password, undefined, "List: password field must not exist");
  assert.strictEqual(custADetail.customer.password, undefined, "Detail: password field must not exist");

  const rawListString = JSON.stringify(customersPayload);
  const rawDetailString = JSON.stringify(custADetail);
  assert(!rawListString.includes("$2a$") && !rawListString.includes("$2b$"), "List response must not contain bcrypt hashes");
  assert(!rawDetailString.includes("$2a$") && !rawDetailString.includes("$2b$"), "Detail response must not contain bcrypt hashes");
  console.log("✓ Password and bcrypt hashes never exposed in any customer response.\n");

  // =============================================================
  // TEST 10: Authentication tokens are never returned
  // =============================================================
  console.log("Test 10: Authentication tokens are never returned...");
  assert.strictEqual(foundCustA.token, undefined, "List: token field must not exist");
  assert.strictEqual(custADetail.customer.token, undefined, "Detail: token field must not exist");
  assert(!rawListString.includes(rawCustomerACookie), "List response must not contain customer auth cookie");
  assert(!rawDetailString.includes(rawCustomerACookie), "Detail response must not contain customer auth cookie");
  assert(!rawListString.includes(rawAdminCookie), "List response must not contain admin auth cookie");
  console.log("✓ Authentication tokens and cookies never exposed.\n");

  // =============================================================
  // TEST 11: Admin/customer session separation remains intact
  // =============================================================
  console.log("Test 11: Admin/customer session separation remains intact...");
  // Admin cookie cannot access customer auth endpoint
  const adminOnCustomerMe = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(adminOnCustomerMe.status, 401, "Admin cookie must receive 401 at /api/auth/me");

  // Customer cookie cannot access admin auth endpoint
  const customerOnAdminMe = await fetch(`${BACKEND_URL}/api/auth/admin/me`, {
    headers: { Cookie: customerACookie }
  });
  assert(
    customerOnAdminMe.status === 401 || customerOnAdminMe.status === 403,
    "Customer cookie must receive 401/403 at /api/auth/admin/me"
  );
  console.log("✓ Session isolation between aura_admin_session and aura_customer_session verified.\n");

  // =============================================================
  // TEST 12: Existing order and review functionality remains unaffected
  // =============================================================
  console.log("Test 12: Existing order and review functionality remains unaffected...");
  // Customer can still fetch their own orders
  const myOrdersRes = await fetch(`${BACKEND_URL}/api/orders/my-orders`, {
    headers: { Cookie: customerACookie }
  });
  assert.strictEqual(myOrdersRes.status, 200, "Customer /api/orders/my-orders must return 200");
  const myOrders = await myOrdersRes.json();
  assert(Array.isArray(myOrders) && myOrders.length >= 2, "Customer must see their orders");

  // Reviews endpoint for product remains unaffected
  const reviewsRes = await fetch(`${BACKEND_URL}/api/products/${targetProduct._id}/reviews`, {
    headers: { Cookie: customerACookie }
  });
  assert.strictEqual(reviewsRes.status, 200, "Product reviews endpoint must return 200");
  const reviewsData = await reviewsRes.json();
  assert(Array.isArray(reviewsData.reviews), "Reviews array must be present");
  console.log("✓ Orders and review functionality completely intact.\n");

  console.log("==================================================================");
  console.log("ALL 12 CUSTOMER MANAGEMENT TESTS PASSED PERFECTLY!");
  console.log("==================================================================");
}

runAdminCustomersTests().catch((err) => {
  console.error("❌ Customer Management Test Suite Failed:", err);
  process.exit(1);
});
