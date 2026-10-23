const assert = require('assert');

const BACKEND_URL = 'http://localhost:5000';
const ADMIN_EMAIL = 'admin@aura.com';
const ADMIN_PASSWORD = 'Admin@Aura2026';

async function runAnalyticsTests() {
  console.log('================================================================');
  console.log('AURA ADMIN REAL MONGODB ANALYTICS DASHBOARD TEST SUITE');
  console.log('================================================================\n');

  // Test 1: Authenticate Admin
  console.log('Test 1: Authenticate administrator to retrieve bearer token');
  const adminLoginRes = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  assert.strictEqual(adminLoginRes.status, 200, 'Admin login should succeed with 200');
  const adminLoginData = await adminLoginRes.json();
  const adminToken = adminLoginData.token;
  assert(adminToken, 'Admin token must be returned');
  console.log(`✓ Admin authenticated: ${adminLoginData.user.name} (${adminLoginData.user.role})`);

  // Test 2: Unauthenticated Protection on Analytics API (401)
  console.log('\nTest 2: Backend protection — Unauthenticated access to /api/admin/analytics');
  const unauthRes = await fetch(`${BACKEND_URL}/api/admin/analytics`);
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated GET /api/admin/analytics must return 401');
  console.log('✓ Unauthenticated request rejected with 401 Unauthorized');

  // Test 3: Customer Token Rejected from Analytics API (403 Forbidden)
  console.log('\nTest 3: Backend authorization — Customer account calling /api/admin/analytics');
  const customerEmail = `analytics_cust_${Date.now()}@example.com`;
  const custRegRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Analytics Test Patron',
      email: customerEmail,
      password: 'CustomerPass123',
      confirmPassword: 'CustomerPass123',
    }),
  });
  assert(custRegRes.ok, 'Customer registration should succeed');
  const custTokenMatch = custRegRes.headers.get('set-cookie')?.match(/(?:aura_customer_session|token)=([^;]+)/);
  const customerToken = custTokenMatch ? custTokenMatch[1] : '';

  const custAnalyticsRes = await fetch(`${BACKEND_URL}/api/admin/analytics`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert.strictEqual(custAnalyticsRes.status, 403, 'Customer token on /api/admin/analytics must return 403 Forbidden');
  console.log('✓ Customer token rejected with 403 Forbidden');

  // Test 4: Admin Analytics Retrieval with Real MongoDB Data (Default 7d)
  console.log('\nTest 4: Admin retrieves live analytics (Default 7-day period)');
  const analytics7dRes = await fetch(`${BACKEND_URL}/api/admin/analytics?period=7d`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(analytics7dRes.status, 200, 'Admin analytics GET must return 200');
  const data7d = await analytics7dRes.json();

  // Validate Summary Cards Data
  assert(typeof data7d.summary.totalRevenue === 'number', 'summary.totalRevenue must be a number');
  assert(typeof data7d.summary.totalOrders === 'number', 'summary.totalOrders must be a number');
  assert(typeof data7d.summary.totalProducts === 'number', 'summary.totalProducts must be a number');
  assert(typeof data7d.summary.pendingOrders === 'number', 'summary.pendingOrders must be a number');
  assert(typeof data7d.summary.deliveredOrders === 'number', 'summary.deliveredOrders must be a number');
  assert(typeof data7d.summary.lowStockProductsCount === 'number', 'summary.lowStockProductsCount must be a number');
  console.log('✓ Summary Cards verified from MongoDB:');
  console.log(`   - Total Revenue: ₹${data7d.summary.totalRevenue.toLocaleString('en-IN')}`);
  console.log(`   - Total Orders: ${data7d.summary.totalOrders}`);
  console.log(`   - Total Products: ${data7d.summary.totalProducts}`);
  console.log(`   - Pending Orders: ${data7d.summary.pendingOrders}`);
  console.log(`   - Delivered Orders: ${data7d.summary.deliveredOrders}`);
  console.log(`   - Low Stock Products: ${data7d.summary.lowStockProductsCount}`);

  // Test 5: Verify Order Status Distribution Data
  console.log('\nTest 5: Order status distribution verification');
  const statusDist = data7d.statusDistribution;
  assert(typeof statusDist.pending === 'number', 'statusDist.pending must be a number');
  assert(typeof statusDist.processing === 'number', 'statusDist.processing must be a number');
  assert(typeof statusDist.shipped === 'number', 'statusDist.shipped must be a number');
  assert(typeof statusDist.delivered === 'number', 'statusDist.delivered must be a number');
  assert(typeof statusDist.cancelled === 'number', 'statusDist.cancelled must be a number');
  const sumOfStatuses = statusDist.pending + statusDist.processing + statusDist.shipped + statusDist.delivered + statusDist.cancelled;
  assert.strictEqual(sumOfStatuses, data7d.summary.totalOrders, 'Sum of all status counts must equal total orders');
  console.log(`✓ Status counts verified (Total: ${sumOfStatuses}):`);
  console.log(`   - Pending: ${statusDist.pending}, Processing: ${statusDist.processing}, Shipped: ${statusDist.shipped}, Delivered: ${statusDist.delivered}, Cancelled: ${statusDist.cancelled}`);

  // Test 6: Revenue Timeline Date Filters (Today, 7d, 30d, All)
  console.log('\nTest 6: Revenue Timeline Date Filters (Today, 7d, 30d, All Time)');
  
  // 6a: Today
  const todayRes = await fetch(`${BACKEND_URL}/api/admin/analytics?period=today`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(todayRes.status, 200, 'Today filter must return 200');
  const todayData = await todayRes.json();
  assert(Array.isArray(todayData.revenueTimeline), 'Today timeline must be an array');
  assert(todayData.revenueTimeline.length > 0, 'Today timeline must contain intervals');
  console.log(`✓ Today filter: ${todayData.revenueTimeline.length} intervals, Period Revenue: ₹${todayData.summary.periodRevenue}`);

  // 6b: 7 Days
  assert.strictEqual(data7d.revenueTimeline.length, 7, '7-day timeline must have 7 daily points');
  console.log(`✓ 7-Day filter: 7 daily points, Period Revenue: ₹${data7d.summary.periodRevenue}`);

  // 6c: 30 Days
  const res30d = await fetch(`${BACKEND_URL}/api/admin/analytics?period=30d`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(res30d.status, 200, '30d filter must return 200');
  const data30d = await res30d.json();
  assert(data30d.revenueTimeline.length >= 28, '30-day timeline must have daily points');
  console.log(`✓ 30-Day filter: ${data30d.revenueTimeline.length} daily points, Period Revenue: ₹${data30d.summary.periodRevenue}`);

  // 6d: All Time
  const resAll = await fetch(`${BACKEND_URL}/api/admin/analytics?period=all`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.strictEqual(resAll.status, 200, 'All Time filter must return 200');
  const dataAll = await resAll.json();
  assert(Array.isArray(dataAll.revenueTimeline), 'All-time timeline must be an array');
  assert.strictEqual(dataAll.summary.periodRevenue, dataAll.summary.totalRevenue, 'All-time period revenue must equal total revenue');
  console.log(`✓ All Time filter: All-Time Revenue: ₹${dataAll.summary.periodRevenue}`);

  // Test 7: Best-Selling Products Verification
  console.log('\nTest 7: Best-Selling Products based on actual units sold in MongoDB');
  const bestSellers = data7d.bestSellingProducts;
  assert(Array.isArray(bestSellers), 'bestSellingProducts must be an array');
  if (bestSellers.length > 0) {
    const topItem = bestSellers[0];
    assert(topItem.name, 'Top item must have a name');
    assert(typeof topItem.unitsSold === 'number', 'Top item must have unitsSold');
    assert(typeof topItem.revenueGenerated === 'number', 'Top item must have revenueGenerated');
    console.log(`✓ Top selling product: "${topItem.name}" (${topItem.unitsSold} units sold, ₹${topItem.revenueGenerated.toLocaleString('en-IN')} revenue)`);
  } else {
    console.log('✓ Best-sellers list initialized (0 sales currently recorded)');
  }

  // Test 8: Low Stock Alerts (Size-Wise Stock Inspection)
  console.log('\nTest 8: Size-wise Low Stock Alerts from MongoDB catalog');
  const lowStock = data7d.lowStockProducts;
  assert(Array.isArray(lowStock), 'lowStockProducts must be an array');
  assert.strictEqual(lowStock.length, data7d.summary.lowStockProductsCount, 'Low stock array length matches KPI count');
  assert.strictEqual(lowStock.length, data7d.summary.lowStockCount, 'lowStockCount matches lowStockProducts length');
  lowStock.forEach((p) => {
    // Under size-wise inventory: a product is flagged if ANY size has quantity <= 5
    const hasLowOrOutSize = p.hasOutOfStock || p.hasLowStock || (p.sizes && p.sizes.some((s) => s.quantity <= 5));
    assert(hasLowOrOutSize, `Product "${p.name}" must contain at least one size with stock <= 5`);
  });
  console.log(`✓ Size-wise low stock products count: ${lowStock.length} items containing sizes ≤ 5 units`);

  // Test 9: Recent Orders
  console.log('\nTest 9: Recent Orders list');
  const recent = data7d.recentOrders;
  assert(Array.isArray(recent), 'recentOrders must be an array');
  assert(recent.length > 0, 'Recent orders list should contain orders');
  const firstOrder = recent[0];
  assert(firstOrder.orderId, 'Recent order must have orderId');
  assert(firstOrder.customerName, 'Recent order must have customerName');
  assert(firstOrder.total, 'Recent order must have total amount');
  assert(firstOrder.status, 'Recent order must have status');
  console.log(`✓ Latest order: ${firstOrder.orderId} by ${firstOrder.customerName} (₹${firstOrder.total}, Status: ${firstOrder.status})`);

  // Test 10: Real-Time Dynamic Analytics Update after Customer Checkout
  console.log('\nTest 10: Dynamic analytics update after new customer order');
  const prevOrdersCount = data7d.summary.totalOrders;
  const prevRevenue = data7d.summary.totalRevenue;

  // Retrieve an active product to order with available size stock
  const prodsRes = await fetch(`${BACKEND_URL}/api/products`);
  const products = await prodsRes.json();
  const testProduct = products.find(p => p.sizeStock && Object.values(p.sizeStock).some(q => Number(q) > 0)) || products[0];
  const availableSize = Object.entries(testProduct.sizeStock || {}).find(([sz, qty]) => Number(qty) > 0)?.[0] || 'M';

  const newOrderId = `AUR-ANL-${Date.now()}`;
  const checkoutRes = await fetch(`${BACKEND_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId: newOrderId,
      customer: {
        fullName: 'Analytics Patron',
        email: customerEmail,
        phone: '9123456789',
      },
      shippingAddress: {
        address: '55 Ocean Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400001',
      },
      items: [{
        productId: testProduct._id,
        name: testProduct.name,
        price: testProduct.price,
        quantity: 1,
        selectedSize: availableSize,
        selectedColor: 'Navy',
      }],
      subtotal: testProduct.price,
      shipping: 0,
      total: testProduct.price,
      paymentMethod: 'Credit Card',
    }),
  });
  assert.strictEqual(checkoutRes.status, 201, 'Customer checkout must succeed');

  // Re-fetch analytics to confirm dynamic update
  const updatedAnalyticsRes = await fetch(`${BACKEND_URL}/api/admin/analytics?period=7d`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const updatedData = await updatedAnalyticsRes.json();

  assert.strictEqual(updatedData.summary.totalOrders, prevOrdersCount + 1, 'Total orders count must increment by 1');
  assert.strictEqual(updatedData.summary.totalRevenue, prevRevenue + testProduct.price, 'Total revenue must reflect added order total');
  assert.strictEqual(updatedData.statusDistribution.pending, data7d.statusDistribution.pending + 1, 'Pending orders count must increment by 1');
  console.log(`✓ Analytics dynamically updated in MongoDB:`);
  console.log(`   - Orders: ${prevOrdersCount} -> ${updatedData.summary.totalOrders}`);
  console.log(`   - Revenue: ₹${prevRevenue} -> ₹${updatedData.summary.totalRevenue}`);
  console.log(`   - Pending: ${data7d.statusDistribution.pending} -> ${updatedData.statusDistribution.pending}`);

  console.log('\n================================================================');
  console.log('ALL 10 ANALYTICS DASHBOARD TESTS PASSED WITH 100% SUCCESS! ✨');
  console.log('================================================================\n');
}

runAnalyticsTests().catch((err) => {
  console.error('\n❌ Analytics Test Failed:', err);
  process.exit(1);
});
