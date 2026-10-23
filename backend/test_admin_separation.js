const assert = require('assert');

const BACKEND_URL = 'http://localhost:5000';
const CUSTOMER_URL = 'http://localhost:5173';
const ADMIN_URL = 'http://localhost:5174';

async function runSeparationTests() {
  console.log('===============================================================');
  console.log('RUNNING SEPARATE FRONTEND ARCHITECTURE & SECURITY TEST SUITE');
  console.log('===============================================================\n');

  // Test 1: Both Frontends & Backend are live on separate ports
  console.log('Test 1: Verify all 3 applications are running on separate ports');
  const [backRes, custRes, adminRes] = await Promise.all([
    fetch(BACKEND_URL),
    fetch(CUSTOMER_URL),
    fetch(ADMIN_URL),
  ]);
  assert.strictEqual(backRes.status, 200, 'Backend on port 5000 should be 200 OK');
  assert.strictEqual(custRes.status, 200, 'Customer frontend on port 5173 should be 200 OK');
  assert.strictEqual(adminRes.status, 200, 'Admin frontend on port 5174 should be 200 OK');
  console.log('✓ Backend running on http://localhost:5000');
  console.log('✓ Customer website running on http://localhost:5173');
  console.log('✓ Separate Admin application running on http://localhost:5174');

  let customerEmail = null;
  let orderId = null;
  let targetProduct = null;
  let initialStock = undefined;

  try {

  // Test 2: Unauthenticated protection on Admin APIs
  console.log('\nTest 2: Backend protection — Unauthenticated access rejected');
  const unauthOrders = await fetch(`${BACKEND_URL}/api/orders`);
  assert.strictEqual(unauthOrders.status, 401, 'GET /api/orders must return 401 for unauthenticated request');
  const unauthPostProd = await fetch(`${BACKEND_URL}/api/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Hacker Item', price: 999 }),
  });
  assert.strictEqual(unauthPostProd.status, 401, 'POST /api/products must return 401 for unauthenticated request');
  console.log('✓ Unauthenticated requests to Admin APIs are rejected with 401 Unauthorized.');

  // Test 3: Customer Account cannot access Admin APIs (403 Forbidden)
  console.log('\nTest 3: Backend authorization — Customer account cannot access Admin APIs');
  // Register or log in a customer
  customerEmail = `customer_test_${Date.now()}@example.com`;
  const custRegRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Test Customer',
      email: customerEmail,
      password: 'Password123',
      confirmPassword: 'Password123'
    })
  });
  assert(custRegRes.ok, 'Customer registration should succeed');
  const custRegData = await custRegRes.json();
  const customerCookie = custRegRes.headers.get('set-cookie');
  // Extract token from cookie
  const customerTokenMatch = customerCookie ? customerCookie.match(/(?:aura_customer_session|token)=([^;]+)/) : null;
  const customerToken = customerTokenMatch ? customerTokenMatch[1] : '';

  // Customer tries to call admin login -> must fail with 403 Forbidden
  const custAdminLogin = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: customerEmail,
      password: 'Password123'
    })
  });
  assert.strictEqual(custAdminLogin.status, 403, 'Customer account calling /api/auth/admin-login must be rejected with 403 Forbidden');
  console.log('✓ Customer account rejected from /api/auth/admin-login with 403 Forbidden.');

  // Customer tries to call GET /api/orders with their customer token
  const custAccessOrders = await fetch(`${BACKEND_URL}/api/orders`, {
    headers: { 'Authorization': `Bearer ${customerToken}` }
  });
  assert.strictEqual(custAccessOrders.status, 403, 'Customer token on GET /api/orders must return 403 Forbidden');
  console.log('✓ Customer token on Admin API GET /api/orders returned 403 Forbidden.');

  // Test 4: Admin Login
  console.log('\nTest 4: Administrator authentication on port 5000');
  const adminLoginRes = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@aura.com',
      password: 'Admin@Aura2026'
    })
  });
  assert.strictEqual(adminLoginRes.status, 200, 'Admin login must return 200 OK');
  const adminLoginData = await adminLoginRes.json();
  assert(adminLoginData.token, 'Admin login response must include JWT token');
  assert.strictEqual(adminLoginData.user.role, 'admin', 'Logged in user role must be admin');
  const adminToken = adminLoginData.token;
  console.log(`✓ Admin successfully authenticated as: ${adminLoginData.user.name} (${adminLoginData.user.email}, role: ${adminLoginData.user.role})`);

  // Test 5: Admin retrieves order list
  console.log('\nTest 5: Administrator accesses GET /api/orders');
  const adminOrdersRes = await fetch(`${BACKEND_URL}/api/orders`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(adminOrdersRes.status, 200, 'Admin GET /api/orders should return 200 OK');
  const ordersList = await adminOrdersRes.json();
  assert(Array.isArray(ordersList), 'Orders response must be an array');
  console.log(`✓ Admin retrieved orders list (${ordersList.length} orders in MongoDB).`);

  // Test 6: Admin creates, updates, and deletes a product
  console.log('\nTest 6: Admin Product Management (Add, Edit, Delete)');
  const newProductPayload = {
    name: `AURA Test Product ${Date.now()}`,
    description: 'A luxurious test garment for automated separation verification.',
    price: 3499,
    category: 'Women',
    image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=80',
    sizes: ['S', 'M', 'L'],
    stock: 15
  };

  const createProdRes = await fetch(`${BACKEND_URL}/api/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify(newProductPayload)
  });
  assert.strictEqual(createProdRes.status, 201, 'POST /api/products with admin token must return 201 Created');
  const createdProd = await createProdRes.json();
  console.log(`✓ Admin created product: "${createdProd.name}" (ID: ${createdProd._id}, Stock: ${createdProd.stock})`);

  // Edit product
  const updateProdRes = await fetch(`${BACKEND_URL}/api/products/${createdProd._id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ stock: 22, price: 3999 })
  });
  assert.strictEqual(updateProdRes.status, 200, 'PUT /api/products/:id must return 200 OK');
  const updatedProd = await updateProdRes.json();
  assert.strictEqual(updatedProd.product.stock, 22, 'Stock must update to 22');
  console.log(`✓ Admin updated product stock to 22 and price to ₹3,999.`);

  // Delete product
  const deleteProdRes = await fetch(`${BACKEND_URL}/api/products/${createdProd._id}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  assert.strictEqual(deleteProdRes.status, 200, 'DELETE /api/products/:id must return 200 OK');
  console.log(`✓ Admin deleted product "${createdProd.name}".`);

  // Test 7: Customer Checkout & Admin Order Status Management
  console.log('\nTest 7: Customer Checkout & Admin Order Status Flow');
  // 1. Fetch live product to purchase
  const prodListRes = await fetch(`${BACKEND_URL}/api/products`);
  const products = await prodListRes.json();
  targetProduct = products.find(p => p.sizeStock && Object.values(p.sizeStock).some(q => Number(q) > 0)) || products[0];
  const targetSize = Object.entries(targetProduct.sizeStock || {}).find(([sz, qty]) => Number(qty) > 0)?.[0] || 'M';
  initialStock = targetProduct.stock;

  // 2. Customer places order
  orderId = `AUR-TEST-${Date.now()}`;
  const checkoutRes = await fetch(`${BACKEND_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      customer: {
        fullName: 'Test Customer',
        email: customerEmail,
        phone: '9876543210'
      },
      shippingAddress: {
        address: '123 Luxury Lane',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400001'
      },
      items: [
        {
          productId: targetProduct._id,
          name: targetProduct.name,
          quantity: 1,
          price: targetProduct.price,
          selectedSize: targetSize
        }
      ],
      subtotal: targetProduct.price,
      shipping: 0,
      total: targetProduct.price,
      status: 'Pending'
    })
  });
  assert.strictEqual(checkoutRes.status, 201, 'Customer checkout must return 201 Created');
  const checkoutData = await checkoutRes.json();
  console.log(`✓ Customer placed order ${orderId} (Total: ₹${targetProduct.price})`);

  // 3. Verify stock deduction
  const verifyProdRes = await fetch(`${BACKEND_URL}/api/products`);
  const updatedProducts = await verifyProdRes.json();
  const refreshedTarget = updatedProducts.find(p => p._id === targetProduct._id);
  assert.strictEqual(refreshedTarget.stock, initialStock - 1, 'Product stock must decrement by 1');
  console.log(`✓ Stock successfully deducted: ${initialStock} -> ${refreshedTarget.stock}`);

  // 4. Admin updates order status
  const updateStatusRes = await fetch(`${BACKEND_URL}/api/orders/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ status: 'Processing' })
  });
  assert.strictEqual(updateStatusRes.status, 200, 'Admin updating order status must return 200 OK');
  const statusData = await updateStatusRes.json();
  assert.strictEqual(statusData.order.status, 'Processing', 'Order status must be Processing');
  console.log(`✓ Admin updated order status to: "${statusData.order.status}"`);

  console.log('\n===============================================================');
  console.log('ALL SEPARATION ARCHITECTURE & SECURITY TESTS PASSED! ✨');
  console.log('===============================================================');
  } finally {
    try {
      const mongoose = require('mongoose');
      const conn = await mongoose.createConnection(process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/aura');
      if (customerEmail) {
        await conn.collection('users').deleteOne({ email: customerEmail });
        await conn.collection('adminnotifications').deleteMany({ message: { $regex: new RegExp(customerEmail, 'i') } });
      }
      if (orderId) {
        await conn.collection('orders').deleteOne({ orderId });
        await conn.collection('adminnotifications').deleteMany({ message: { $regex: new RegExp(orderId, 'i') } });
      }
      if (targetProduct && targetProduct._id && initialStock !== undefined) {
        await conn.collection('products').updateOne({ _id: new mongoose.Types.ObjectId(targetProduct._id) }, { $set: { stock: initialStock } });
      }
      await conn.close();
      console.log('✓ Cleaned up test_admin_separation customer, order, and restored stock.');
    } catch (e) {}
  }
}

runSeparationTests().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
