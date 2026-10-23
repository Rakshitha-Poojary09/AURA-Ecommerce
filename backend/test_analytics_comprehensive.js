const assert = require("assert");

const BACKEND_URL = "http://localhost:5000";
const ADMIN_EMAIL = "admin@aura.com";
const ADMIN_PASSWORD = "Admin@Aura2026";

async function testComprehensiveAnalytics() {
  console.log("=================================================================");
  console.log("AURA ADMIN ANALYTICS COMPREHENSIVE REQUIREMENTS VERIFICATION");
  console.log("=================================================================\n");

  // 1. Admin Authentication
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  assert.strictEqual(loginRes.status, 200, "Admin login must succeed");
  const { token: adminToken } = await loginRes.json();
  assert(adminToken, "Admin token must be present");
  console.log("1. Admin authenticated successfully");

  // 2. Unauthenticated check (401)
  const unauthRes = await fetch(`${BACKEND_URL}/api/admin/analytics`);
  assert.strictEqual(unauthRes.status, 401, "Unauthenticated request must return 401");
  console.log("2. Unauthenticated access correctly blocked (401 Unauthorized)");

  // 3. Customer token check (403)
  const custReg = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Analytics Check Customer",
      email: `cust_${Date.now()}@example.com`,
      password: "CustPassword123",
      confirmPassword: "CustPassword123"
    })
  });
  const cookieHeader = custReg.headers.get("set-cookie") || "";
  const match = cookieHeader.match(/(?:aura_customer_session|token)=([^;]+)/);
  const custToken = match ? match[1] : "";
  const custRes = await fetch(`${BACKEND_URL}/api/admin/analytics`, {
    headers: { Authorization: `Bearer ${custToken}` }
  });
  assert.strictEqual(custRes.status, 403, "Customer user must return 403 Forbidden");
  console.log("3. Customer account access blocked (403 Forbidden)");

  // 4. Test Date Filters: 7d, 30d, 90d, all
  const periods = ["7d", "30d", "90d", "all"];
  for (const p of periods) {
    const res = await fetch(`${BACKEND_URL}/api/admin/analytics?period=${p}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(res.status, 200, `Period ${p} must return 200`);
    const data = await res.json();
    assert(data.summary, `data.summary must exist for period ${p}`);
    assert(Array.isArray(data.revenueByDate), `revenueByDate must be array for period ${p}`);
    assert(Array.isArray(data.ordersByStatus), `ordersByStatus must be array for period ${p}`);
    assert(Array.isArray(data.bestSellingProducts), `bestSellingProducts must be array for period ${p}`);
    assert(Array.isArray(data.lowStockItems), `lowStockItems must be array for period ${p}`);
    assert(Array.isArray(data.recentOrders), `recentOrders must be array for period ${p}`);
    console.log(`4. Period filter '${p}' returned valid data (${data.revenueByDate.length} timeline buckets)`);
  }

  // 5. Test Exact Response Structure and Types
  const mainRes = await fetch(`${BACKEND_URL}/api/admin/analytics?period=7d`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const data = await mainRes.json();

  const summary = data.summary;
  assert(typeof summary.totalRevenue === "number", "summary.totalRevenue must be number");
  assert(typeof summary.totalOrders === "number", "summary.totalOrders must be number");
  assert(typeof summary.totalProducts === "number", "summary.totalProducts must be number");
  assert(typeof summary.totalCustomers === "number", "summary.totalCustomers must be number");
  assert(typeof summary.pendingOrders === "number", "summary.pendingOrders must be number");
  assert(typeof summary.deliveredOrders === "number", "summary.deliveredOrders must be number");
  assert(typeof summary.lowStockCount === "number", "summary.lowStockCount must be number");

  console.log("5. KPI Cards Verified from live MongoDB:");
  console.log(`   - Total Revenue: ₹${summary.totalRevenue.toLocaleString("en-IN")}`);
  console.log(`   - Total Orders: ${summary.totalOrders}`);
  console.log(`   - Total Products: ${summary.totalProducts}`);
  console.log(`   - Total Customers: ${summary.totalCustomers}`);
  console.log(`   - Pending Orders: ${summary.pendingOrders}`);
  console.log(`   - Delivered Orders: ${summary.deliveredOrders}`);
  console.log(`   - Low Stock Items: ${summary.lowStockCount}`);

  // 6. Verify Cancelled Orders are NOT counted in revenue
  const ordersRes = await fetch(`${BACKEND_URL}/api/orders`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const allOrders = await ordersRes.json();
  const manualNonCancelledRevenue = allOrders
    .filter((o) => (o.status || "").toLowerCase() !== "cancelled")
    .reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  assert.strictEqual(
    summary.totalRevenue,
    manualNonCancelledRevenue,
    "totalRevenue must match sum of non-cancelled orders"
  );
  console.log(`6. Cancelled order revenue exclusion verified: ₹${summary.totalRevenue} (Matches non-cancelled orders sum)`);

  // 7. Verify Order Status Summary breakdown
  const statusSummary = data.ordersByStatus;
  const statusKeys = statusSummary.map((s) => s.status);
  ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"].forEach((s) => {
    assert(statusKeys.includes(s), `ordersByStatus must include ${s}`);
  });
  const statusSum = statusSummary.reduce((acc, s) => acc + s.count, 0);
  assert.strictEqual(statusSum, summary.totalOrders, "Sum of ordersByStatus counts must equal totalOrders");
  console.log("7. Order Status visual breakdown verified (All 5 statuses present and sum matches totalOrders)");

  // 8. Verify Best-Selling Products (Top 5)
  assert(data.bestSellingProducts.length <= 5, "Best sellers must be at most 5");
  data.bestSellingProducts.forEach((item) => {
    assert(item.name, "Best selling item must have name");
    assert(typeof item.quantitySold === "number", "Best selling item must have quantitySold");
    assert(typeof item.revenueGenerated === "number", "Best selling item must have revenueGenerated");
  });
  console.log(`8. Best-Selling Products verified (${data.bestSellingProducts.length} items returned with name, quantitySold, revenueGenerated)`);

  // 9. Verify Size-Wise Stock Handling
  assert(Array.isArray(data.lowStockItems), "lowStockItems must be array");
  data.lowStockItems.forEach((item) => {
    assert(item.name, "Item must have name");
    assert(Array.isArray(item.sizes), "Item must have sizes array");
    assert(item.sizes.length > 0, "Item must have size details");
    // Verify each size individually
    item.sizes.forEach((s) => {
      assert(typeof s.size === "string", "Size must have label (S, M, etc.)");
      assert(typeof s.quantity === "number", "Size must have quantity");
      if (s.quantity === 0) {
        assert.strictEqual(s.status, "Out of Stock", "0 quantity must be 'Out of Stock'");
        assert.strictEqual(s.level, "out");
      } else if (s.quantity <= 5) {
        assert.strictEqual(s.status, "Low Stock", "1-5 quantity must be 'Low Stock'");
        assert.strictEqual(s.level, "low");
      } else {
        assert.strictEqual(s.status, "Available", ">5 quantity must be 'Available'");
        assert.strictEqual(s.level, "available");
      }
    });
  });
  console.log(`9. Size-Wise Stock verified: ${data.lowStockItems.length} products with sizes classified into Out of Stock (0), Low Stock (1-5), and Available (>5)`);

  // 10. Verify Recent Orders format
  assert(Array.isArray(data.recentOrders), "recentOrders must be array");
  if (data.recentOrders.length > 0) {
    const ro = data.recentOrders[0];
    assert(ro.orderId, "recent order must have orderId");
    assert(ro.customer, "recent order must have customer");
    assert(ro.date, "recent order must have date");
    assert(typeof ro.amount === "number", "recent order must have amount");
    assert(ro.status, "recent order must have status");
    console.log(`10. Recent Orders verified (Latest: ${ro.orderId} by ${ro.customer}, ₹${ro.amount}, Status: ${ro.status})`);
  }

  console.log("\n=================================================================");
  console.log("ALL COMPREHENSIVE BACKEND ANALYTICS CHECKS PASSED SUCCESSFULLY! ✨");
  console.log("=================================================================\n");
}

testComprehensiveAnalytics().catch((err) => {
  console.error("\n❌ Analytics Comprehensive Test Failed:", err);
  process.exit(1);
});
