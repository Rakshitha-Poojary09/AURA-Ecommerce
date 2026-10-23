const assert = require("assert");

const BACKEND_URL = "http://localhost:5000";

async function testCustomerAccount() {
  console.log("=================================================================");
  console.log("AURA CUSTOMER MY ACCOUNT & ORDERS COMPREHENSIVE TEST SUITE");
  console.log("=================================================================\n");

  const timestamp = Date.now();
  const customerA_email = `patron_a_${timestamp}@example.com`;
  const customerB_email = `patron_b_${timestamp}@example.com`;
  const updatedEmailA = `ananya_updated_${timestamp}@example.com`;
  try {

  // 1. Guest access to /api/auth/me should return 401 Unauthorized
  console.log("Test 1: Guest access to /api/auth/me rejected with 401");
  const guestMeRes = await fetch(`${BACKEND_URL}/api/auth/me`);
  assert.strictEqual(guestMeRes.status, 401, "Guest access to /api/auth/me must return 401");
  console.log("✓ Guest access blocked with 401 Unauthorized");

  // 2. Guest access to /api/orders/my-orders should return 401 Unauthorized
  console.log("\nTest 2: Guest access to /api/orders/my-orders rejected with 401");
  const guestOrdersRes = await fetch(`${BACKEND_URL}/api/orders/my-orders`);
  assert.strictEqual(guestOrdersRes.status, 401, "Guest access to /api/orders/my-orders must return 401");
  console.log("✓ Guest orders access blocked with 401 Unauthorized");

  // 3. Register Customer A
  console.log("\nTest 3: Register Customer A and verify session");
  const regARes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Ananya Roy",
      email: customerA_email,
      password: "Password123",
      confirmPassword: "Password123"
    })
  });
  assert.strictEqual(regARes.status, 201, "Customer A registration must succeed");
  const cookieA = regARes.headers.get("set-cookie") || "";
  const matchA = cookieA.match(/(?:aura_customer_session|token)=([^;]+)/);
  const tokenA = matchA ? matchA[1] : "";
  assert(tokenA, "Token for Customer A must be issued");

  const meARes = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(meARes.status, 200, "Customer A can access /api/auth/me");
  const meA = await meARes.json();
  assert.strictEqual(meA.user.name, "Ananya Roy");
  assert.strictEqual(meA.user.email, customerA_email);
  assert.strictEqual(meA.user.password, undefined, "Password must not be exposed");
  console.log(`✓ Customer A authenticated: ${meA.user.name} (${meA.user.email})`);

  // 4. Update Profile Information via PUT /api/auth/profile
  console.log("\nTest 4: Customer updates profile (Name & Email) via PUT /api/auth/profile");
  const updatedEmailA = `ananya_updated_${timestamp}@example.com`;
  const updateRes = await fetch(`${BACKEND_URL}/api/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      fullName: "Ananya Roy Sharma",
      email: updatedEmailA
    })
  });
  assert.strictEqual(updateRes.status, 200, "Profile update should return 200");
  const updateData = await updateRes.json();
  assert.strictEqual(updateData.user.name, "Ananya Roy Sharma", "Name must be updated");
  assert.strictEqual(updateData.user.email, updatedEmailA, "Email must be updated");
  assert.strictEqual(updateData.user.password, undefined, "Password must not be exposed");
  console.log(`✓ Profile updated successfully: ${updateData.user.name} (${updateData.user.email})`);

  // 5. Test Profile Update validation: Duplicate Email Conflict (409)
  console.log("\nTest 5: Register Customer B and test duplicate email collision");
  const regBRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Vikram Mehta",
      email: customerB_email,
      password: "Password123",
      confirmPassword: "Password123"
    })
  });
  assert.strictEqual(regBRes.status, 201, "Customer B registration must succeed");
  const cookieB = regBRes.headers.get("set-cookie") || "";
  const matchB = cookieB.match(/(?:aura_customer_session|token)=([^;]+)/);
  const tokenB = matchB ? matchB[1] : "";

  // Customer B tries to change email to Customer A's email
  const duplicateEmailRes = await fetch(`${BACKEND_URL}/api/auth/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenB}`
    },
    body: JSON.stringify({
      fullName: "Vikram Mehta",
      email: updatedEmailA // already taken by Customer A
    })
  });
  assert.strictEqual(duplicateEmailRes.status, 409, "Duplicate email must be rejected with 409 Conflict");
  console.log("✓ Duplicate email update blocked with 409 Conflict");

  // 6. Customer Order Isolation: Customer A places Order A, Customer B places Order B
  console.log("\nTest 6: Customer Order Placement & Strict Tenant Isolation");
  const prodsRes = await fetch(`${BACKEND_URL}/api/products`);
  const products = await prodsRes.json();
  const testProduct = products.find(p => p.sizeStock && Object.values(p.sizeStock).some(q => Number(q) > 0)) || products[0];
  const testSize = Object.entries(testProduct.sizeStock || {}).find(([sz, qty]) => Number(qty) > 0)?.[0] || "M";

  // Customer A places Order A
  const orderA_Id = `AUR-CUST-A-${timestamp}`;
  const checkoutARes = await fetch(`${BACKEND_URL}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenA}`
    },
    body: JSON.stringify({
      orderId: orderA_Id,
      customer: {
        fullName: "Ananya Roy Sharma",
        email: updatedEmailA,
        phone: "9876543210"
      },
      shippingAddress: {
        address: '10 Palm Grove',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400050'
      },
      items: [{
        productId: testProduct._id,
        name: testProduct.name,
        price: testProduct.price,
        quantity: 1,
        selectedSize: testSize,
        size: testSize,
        image: testProduct.image
      }],
      subtotal: testProduct.price,
      shipping: 0,
      total: testProduct.price,
      status: "Processing"
    })
  });
  assert.strictEqual(checkoutARes.status, 201, "Customer A checkout must succeed");
  console.log(`✓ Customer A placed order: ${orderA_Id}`);

  // Customer B places Order B
  const orderB_Id = `AUR-CUST-B-${timestamp}`;
  const checkoutBRes = await fetch(`${BACKEND_URL}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenB}`
    },
    body: JSON.stringify({
      orderId: orderB_Id,
      customer: {
        fullName: "Vikram Mehta",
        email: customerB_email,
        phone: "9123456789"
      },
      shippingAddress: {
        address: '22 Marine Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400020'
      },
      items: [{
        productId: testProduct._id,
        name: testProduct.name,
        price: testProduct.price,
        quantity: 1,
        selectedSize: testSize,
        size: testSize,
        image: testProduct.image
      }],
      subtotal: testProduct.price,
      shipping: 0,
      total: testProduct.price,
      status: "Delivered"
    })
  });
  if (checkoutBRes.status !== 201) {
    const errData = await checkoutBRes.json();
    console.error("Customer B Checkout Failed Error:", errData);
  }
  assert.strictEqual(checkoutBRes.status, 201, "Customer B checkout must succeed");
  console.log(`✓ Customer B placed order: ${orderB_Id}`);

  // 7. Verify Customer A sees ONLY Order A
  console.log("\nTest 7: Verify customer sees ONLY their own orders in GET /api/orders/my-orders");
  const ordersARes = await fetch(`${BACKEND_URL}/api/orders/my-orders`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(ordersARes.status, 200);
  const ordersA = await ordersARes.json();
  const orderAIds = ordersA.map(o => o.orderId);
  assert(orderAIds.includes(orderA_Id), "Customer A orders must include Order A");
  assert(!orderAIds.includes(orderB_Id), "Customer A orders must NOT include Customer B's order");
  console.log(`✓ Customer A orders verified (${ordersA.length} orders; Customer B order strictly excluded)`);

  // Verify Customer B sees ONLY Order B
  const ordersBRes = await fetch(`${BACKEND_URL}/api/orders/my-orders`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert.strictEqual(ordersBRes.status, 200);
  const ordersB = await ordersBRes.json();
  const orderBIds = ordersB.map(o => o.orderId);
  assert(orderBIds.includes(orderB_Id), "Customer B orders must include Order B");
  assert(!orderBIds.includes(orderA_Id), "Customer B orders must NOT include Customer A's order");
  console.log(`✓ Customer B orders verified (${ordersB.length} orders; Customer A order strictly excluded)`);

  // 8. Security: Customer A cannot access Customer B's order by ID
  console.log("\nTest 8: Cross-customer order tampering prevention (GET /api/orders/my-orders/:orderId)");
  const crossAccessRes = await fetch(`${BACKEND_URL}/api/orders/my-orders/${orderB_Id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(crossAccessRes.status, 404, "Accessing another customer's order ID must return 404 Not Found / Forbidden");
  console.log("✓ Cross-customer access rejected with 404 (ID spoofing impossible)");

  // 9. Order Details verification: Selected size, quantity, price, subtotal, total, status
  console.log("\nTest 9: Verify order details and size preservation");
  const detailRes = await fetch(`${BACKEND_URL}/api/orders/my-orders/${orderA_Id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert.strictEqual(detailRes.status, 200);
  const detailData = await detailRes.json();
  assert.strictEqual(detailData.orderId, orderA_Id);
  assert.strictEqual(detailData.items[0].size, testSize, `Selected size must be preserved (${testSize})`);
  assert.strictEqual(detailData.items[0].quantity, 1);
  assert.strictEqual(detailData.total, testProduct.price);
  assert.strictEqual(detailData.status, "Processing");
  console.log(`✓ Order detail verified: Item "${detailData.items[0].name}" in Size "${detailData.items[0].size}", Total ₹${detailData.total}, Status "${detailData.status}"`);

  // 10. Logout Endpoint
  console.log("\nTest 10: Customer logout clears authentication cookie");
  const logoutRes = await fetch(`${BACKEND_URL}/api/auth/logout`, {
    method: "POST"
  });
  assert.strictEqual(logoutRes.status, 200, "Logout should succeed with 200");
  const logoutCookie = logoutRes.headers.get("set-cookie") || "";
  assert(logoutCookie.includes("aura_customer_session=;") || logoutCookie.includes("token=;"), "Logout must clear customer session cookie");
  console.log("✓ Logout successfully cleared authentication session");

  console.log("\n=================================================================");
  console.log("ALL 10 CUSTOMER MY ACCOUNT & ORDERS TESTS PASSED WITH 100% SUCCESS! ✨");
  console.log("=================================================================\n");
  } finally {
    try {
      const mongoose = require("mongoose");
      const conn = await mongoose.createConnection(process.env.TEST_MONGO_URI || "mongodb://localhost:27017/aura");
      await conn.collection("users").deleteMany({ email: { $in: [customerA_email, customerB_email, updatedEmailA] } });
      await conn.collection("orders").deleteMany({ orderId: { $in: [`AUR-CUST-A-${timestamp}`, `AUR-CUST-B-${timestamp}`] } });
      await conn.collection("adminnotifications").deleteMany({
        $or: [
          { message: { $regex: new RegExp(`(patron_a_${timestamp}|patron_b_${timestamp}|ananya_updated_${timestamp})`, "i") } },
          { message: { $regex: new RegExp(`(AUR-CUST-A-${timestamp}|AUR-CUST-B-${timestamp})`, "i") } }
        ]
      });
      await conn.close();
      console.log("✓ Test cleanup: removed temporary patron_ accounts and orders.");
    } catch (e) {}
  }
}

testCustomerAccount().catch((err) => {
  console.error("\n❌ Customer Account Test Failed:", err);
  process.exit(1);
});
