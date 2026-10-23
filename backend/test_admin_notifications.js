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

async function runAdminNotificationsTests() {
  console.log("==================================================================");
  console.log("AURA ADMIN NOTIFICATIONS & ALERTS SYSTEM COMPREHENSIVE TEST SUITE");
  console.log("==================================================================\n");

  const timestamp = Date.now();

  // -------------------------------------------------------------
  // Setup 1: Admin Login
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
  // Setup 2: Register Customer & Place Order to Create Review
  // -------------------------------------------------------------
  console.log("Setup 2: Registering a test customer...");
  const customerEmail = `notif_cust_${timestamp}@aura.com`;
  const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Maya Lin",
      email: customerEmail,
      password: "Password123!",
      confirmPassword: "Password123!"
    })
  });
  assert.strictEqual(regRes.status, 201, "Customer registration must succeed");
  const rawCustomerCookie = parseCookie(regRes.headers.get("set-cookie"), "aura_customer_session");
  const customerCookie = `aura_customer_session=${rawCustomerCookie}`;
  const customerUser = await regRes.json();
  console.log(`✓ Customer registered: Maya Lin (${customerEmail})\n`);

  // -------------------------------------------------------------
  // Setup 3: Create Low Stock Product & Out of Stock Product
  // -------------------------------------------------------------
  console.log("Setup 3: Creating Low Stock and Out of Stock products...");
  const lowStockProductRes = await fetch(`${BACKEND_URL}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie
    },
    body: JSON.stringify({
      name: `Alert Silk Blouse ${timestamp}`,
      description: "Fine luxury silk blouse with limited inventory",
      price: 4999,
      category: "Women",
      image: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3",
      sizes: ["S", "M", "L"],
      sizeStock: { S: 10, M: 3, L: 8 }, // Size M has 3 units -> Low stock alert!
      stock: 21
    })
  });
  assert.strictEqual(lowStockProductRes.status, 201, "Low stock product creation must succeed");
  const lowStockProduct = await lowStockProductRes.json();

  const outOfStockProductRes = await fetch(`${BACKEND_URL}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie
    },
    body: JSON.stringify({
      name: `Sold Out Velvet Blazer ${timestamp}`,
      description: "Sold out velvet evening blazer",
      price: 8999,
      category: "Men",
      image: "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3",
      sizes: ["M", "L"],
      sizeStock: { M: 0, L: 0 }, // Out of stock!
      stock: 0
    })
  });
  assert.strictEqual(outOfStockProductRes.status, 201, "Out of stock product creation must succeed");
  const outOfStockProduct = await outOfStockProductRes.json();
  console.log("✓ Created Low-Stock & Out-of-Stock products.\n");

  // -------------------------------------------------------------
  // Setup 4: Create Pending Order
  // -------------------------------------------------------------
  console.log("Setup 4: Creating a Pending Order...");
  const pendingOrderId = `AUR-NOTIF-ORD-${timestamp}`;
  const pendingOrderRes = await fetch(`${BACKEND_URL}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: customerCookie
    },
    body: JSON.stringify({
      orderId: pendingOrderId,
      customer: {
        fullName: "Maya Lin",
        email: customerEmail,
        phone: "9876543210"
      },
      shippingAddress: {
        address: "42 Park Lane",
        city: "Bangalore",
        state: "Karnataka",
        pinCode: "560001"
      },
      items: [
        {
          productId: lowStockProduct._id,
          name: lowStockProduct.name,
          price: 4999,
          quantity: 1,
          size: "S"
        }
      ],
      subtotal: 4999,
      shipping: 0,
      total: 4999,
      status: "Pending"
    })
  });
  assert.strictEqual(pendingOrderRes.status, 201, "Pending order creation must succeed");
  console.log(`✓ Created Pending Order: ${pendingOrderId}\n`);

  // -------------------------------------------------------------
  // Setup 5: Submit a Review (Customer purchased lowStockProduct)
  // -------------------------------------------------------------
  console.log("Setup 5: Customer submitting review for purchased product...");
  const reviewRes = await fetch(`${BACKEND_URL}/api/products/${lowStockProduct._id}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: customerCookie
    },
    body: JSON.stringify({
      rating: 5,
      title: "Exceptional Silk Craftsmanship",
      comment: "A truly divine luxury garment. The fabric drape and precision stitching are breathtaking."
    })
  });
  assert.strictEqual(reviewRes.status, 201, "Review creation must succeed");
  const reviewData = await reviewRes.json();
  console.log(`✓ Created Customer Review: 5★ for ${lowStockProduct.name}\n`);

  // =============================================================
  // TEST 1: Admin can retrieve notifications
  // =============================================================
  console.log("Test 1: Admin can retrieve notifications...");
  const adminNotifsRes = await fetch(`${BACKEND_URL}/api/admin/notifications`, {
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(adminNotifsRes.status, 200, "Admin must receive 200 OK");
  const notifsPayload = await adminNotifsRes.json();
  assert(notifsPayload.success, "Payload must have success: true");
  assert(Array.isArray(notifsPayload.notifications), "notifications must be an array");
  assert(typeof notifsPayload.unreadCount === "number", "unreadCount must be a number");
  assert(notifsPayload.categoryCounts, "categoryCounts must be an object");
  console.log(`✓ Admin retrieved ${notifsPayload.notifications.length} notifications (${notifsPayload.unreadCount} unread).\n`);

  // =============================================================
  // TEST 2: Guest receives 401
  // =============================================================
  console.log("Test 2: Guest receives 401...");
  const guestNotifsRes = await fetch(`${BACKEND_URL}/api/admin/notifications`);
  assert.strictEqual(guestNotifsRes.status, 401, "Guest must receive 401 Unauthorized");
  console.log("✓ Guest access rejected with 401.\n");

  // =============================================================
  // TEST 3: Customer receives 401
  // =============================================================
  console.log("Test 3: Customer receives 401...");
  const custNotifsRes = await fetch(`${BACKEND_URL}/api/admin/notifications`, {
    headers: { Cookie: customerCookie }
  });
  assert(
    custNotifsRes.status === 401 || custNotifsRes.status === 403,
    `Customer must receive 401 or 403 (got ${custNotifsRes.status})`
  );
  console.log(`✓ Customer access rejected with ${custNotifsRes.status}.\n`);

  // =============================================================
  // TEST 4: Low-stock notification appears correctly
  // =============================================================
  console.log("Test 4: Low-stock notification appears correctly...");
  const lowStockNotif = notifsPayload.notifications.find(
    (n) => n.type === "inventory" && n.referenceId === String(lowStockProduct._id) && n.message.includes("Size M has only 2 left") // 3 - 1 bought = 2
  ) || notifsPayload.notifications.find(
    (n) => n.type === "inventory" && n.referenceId === String(lowStockProduct._id) && n.title.includes("Low Stock")
  );
  assert(lowStockNotif, "Low stock notification must exist for lowStockProduct");
  assert.strictEqual(lowStockNotif.type, "inventory");
  assert.strictEqual(lowStockNotif.targetPage, "Products");
  console.log(`✓ Low-stock alert found: "${lowStockNotif.title}" — "${lowStockNotif.message}"\n`);

  // =============================================================
  // TEST 5: Out-of-stock notification appears correctly
  // =============================================================
  console.log("Test 5: Out-of-stock notification appears correctly...");
  const outOfStockNotif = notifsPayload.notifications.find(
    (n) => n.type === "inventory" && n.referenceId === String(outOfStockProduct._id) && n.title.includes("Out of Stock")
  );
  assert(outOfStockNotif, "Out-of-stock notification must exist for outOfStockProduct");
  assert.strictEqual(outOfStockNotif.type, "inventory");
  assert.strictEqual(outOfStockNotif.targetPage, "Products");
  console.log(`✓ Out-of-stock alert found: "${outOfStockNotif.title}" — "${outOfStockNotif.message}"\n`);

  // =============================================================
  // TEST 6: Pending-order notification appears correctly
  // =============================================================
  console.log("Test 6: Pending-order notification appears correctly...");
  const pendingOrderNotif = notifsPayload.notifications.find(
    (n) => n.type === "orders" && n.referenceId === pendingOrderId
  );
  assert(pendingOrderNotif, "Pending-order notification must exist");
  assert.strictEqual(pendingOrderNotif.type, "orders");
  assert.strictEqual(pendingOrderNotif.targetPage, "Orders");
  console.log(`✓ Pending order alert found: "${pendingOrderNotif.title}" — "${pendingOrderNotif.message}"\n`);

  // =============================================================
  // TEST 7: Customer notification appears correctly
  // =============================================================
  console.log("Test 7: Customer notification appears correctly...");
  const customerNotif = notifsPayload.notifications.find(
    (n) => n.type === "customers" && n.message.includes(customerEmail)
  );
  assert(customerNotif, "Customer registration notification must exist");
  assert.strictEqual(customerNotif.type, "customers");
  assert.strictEqual(customerNotif.targetPage, "Customers");
  console.log(`✓ Customer registration alert found: "${customerNotif.title}" — "${customerNotif.message}"\n`);

  // =============================================================
  // TEST 8: Review notification appears correctly
  // =============================================================
  console.log("Test 8: Review notification appears correctly...");
  const reviewNotif = notifsPayload.notifications.find(
    (n) => n.type === "reviews" && n.referenceId === String(reviewData.review._id)
  );
  assert(reviewNotif, "Review notification must exist");
  assert.strictEqual(reviewNotif.type, "reviews");
  assert.strictEqual(reviewNotif.targetPage, "Reviews");
  console.log(`✓ Customer review alert found: "${reviewNotif.title}" — "${reviewNotif.message}"\n`);

  // =============================================================
  // TEST 9: Notifications contain safe data only
  // =============================================================
  console.log("Test 9: Notifications contain safe data only...");
  const rawString = JSON.stringify(notifsPayload);
  assert(!rawString.includes("$2a$") && !rawString.includes("$2b$"), "Response must not contain bcrypt hashes");
  assert(!rawString.includes(rawCustomerCookie), "Response must not contain customer auth cookie");
  assert(!rawString.includes(rawAdminCookie), "Response must not contain admin auth cookie");

  for (const n of notifsPayload.notifications) {
    assert.strictEqual(n.password, undefined, "Notification object must not contain password");
    assert.strictEqual(n.token, undefined, "Notification object must not contain token");
  }
  console.log("✓ All notification payloads verified clean and safe.\n");

  // =============================================================
  // TEST 10: Mark-as-read works
  // =============================================================
  console.log("Test 10: Mark-as-read works...");
  const targetNotif = pendingOrderNotif;
  const markReadRes = await fetch(`${BACKEND_URL}/api/admin/notifications/${targetNotif._id}/read`, {
    method: "PUT",
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(markReadRes.status, 200, "Mark read must return 200");
  const markReadData = await markReadRes.json();
  assert.strictEqual(markReadData.success, true);
  assert.strictEqual(markReadData.notification.read, true, "read flag must be updated to true");
  console.log(`✓ Single notification ${targetNotif._id} marked as read successfully.\n`);

  // =============================================================
  // TEST 11: Mark-all-as-read works
  // =============================================================
  console.log("Test 11: Mark-all-as-read works...");
  const markAllRes = await fetch(`${BACKEND_URL}/api/admin/notifications/mark-all-read`, {
    method: "PUT",
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(markAllRes.status, 200, "Mark all read must return 200");
  const markAllData = await markAllRes.json();
  assert.strictEqual(markAllData.success, true);
  console.log(`✓ All notifications marked as read (modifiedCount: ${markAllData.modifiedCount}).\n`);

  // =============================================================
  // TEST 12: Read state persists
  // =============================================================
  console.log("Test 12: Read state persists...");
  const recheckRes = await fetch(`${BACKEND_URL}/api/admin/notifications`, {
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(recheckRes.status, 200);
  const recheckPayload = await recheckRes.json();
  assert.strictEqual(recheckPayload.unreadCount, 0, "unreadCount must be 0 after mark-all-read");

  const recheckPending = recheckPayload.notifications.find((n) => n._id === targetNotif._id);
  assert(recheckPending, "Notification must still exist");
  assert.strictEqual(recheckPending.read, true, "Notification read status must persist as true");
  console.log("✓ Read state persisted across subsequent queries.\n");

  // =============================================================
  // TEST 13: Duplicate notifications are not created for the same event
  // =============================================================
  console.log("Test 13: Duplicate notifications are not created for the same event...");
  const countBefore = recheckPayload.notifications.length;

  // Make 2 additional GET calls to trigger sync
  await fetch(`${BACKEND_URL}/api/admin/notifications`, { headers: { Cookie: adminCookie } });
  const finalRes = await fetch(`${BACKEND_URL}/api/admin/notifications`, { headers: { Cookie: adminCookie } });
  const finalPayload = await finalRes.json();
  const countAfter = finalPayload.notifications.length;

  assert.strictEqual(countBefore, countAfter, `Count before (${countBefore}) must match count after (${countAfter})`);
  const eventKeys = finalPayload.notifications.map((n) => n.eventKey);
  const uniqueEventKeys = new Set(eventKeys);
  assert.strictEqual(eventKeys.length, uniqueEventKeys.size, "All eventKeys must be strictly unique");
  console.log("✓ Verified idempotent deduplication: no duplicate notifications created.\n");

  // =============================================================
  // TEST 14: Admin/customer session separation remains intact
  // =============================================================
  console.log("Test 14: Admin/customer session separation remains intact...");
  const adminOnCustMe = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(adminOnCustMe.status, 401, "Admin cookie must receive 401 at /api/auth/me");

  const custOnAdminNotifs = await fetch(`${BACKEND_URL}/api/admin/notifications`, {
    headers: { Cookie: customerCookie }
  });
  assert(custOnAdminNotifs.status === 401 || custOnAdminNotifs.status === 403, "Customer cookie must be rejected");
  console.log("✓ Session isolation between aura_admin_session and aura_customer_session verified.\n");

  // =============================================================
  // TEST 15: Existing admin functionality remains unaffected
  // =============================================================
  console.log("Test 15: Existing admin functionality remains unaffected...");
  const custRes = await fetch(`${BACKEND_URL}/api/admin/customers`, { headers: { Cookie: adminCookie } });
  assert.strictEqual(custRes.status, 200, "Admin customers must return 200");

  const revRes = await fetch(`${BACKEND_URL}/api/admin/reviews`, { headers: { Cookie: adminCookie } });
  assert.strictEqual(revRes.status, 200, "Admin reviews must return 200");

  const ordRes = await fetch(`${BACKEND_URL}/api/orders`, { headers: { Cookie: adminCookie } });
  assert.strictEqual(ordRes.status, 200, "Admin orders must return 200");
  console.log("✓ All existing admin endpoints functioning smoothly.\n");

  console.log("==================================================================");
  console.log("ALL 15 ADMIN NOTIFICATION TESTS PASSED PERFECTLY!");
  console.log("==================================================================");
}

runAdminNotificationsTests().catch((err) => {
  console.error("❌ Notifications Test Suite Failed:", err);
  process.exit(1);
});
