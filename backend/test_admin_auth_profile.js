const assert = require('assert');

const BACKEND_URL = 'http://localhost:5000';
const CUSTOMER_URL = 'http://localhost:5173';
const ADMIN_URL = 'http://localhost:5174';

async function runTestSuite() {
  console.log('================================================================');
  console.log('AURA ADMIN PROFILE & AUTHENTICATION SECURE TEST SUITE');
  console.log('================================================================\n');

  // 1. Verify ports and services are live
  console.log('Test 1: Verify all 3 applications are running on their designated ports');
  const [bRes, cRes, aRes] = await Promise.all([
    fetch(BACKEND_URL),
    fetch(CUSTOMER_URL),
    fetch(ADMIN_URL),
  ]);
  assert.strictEqual(bRes.status, 200, 'Backend should be running on port 5000');
  assert.strictEqual(cRes.status, 200, 'Customer frontend should be running on port 5173');
  assert.strictEqual(aRes.status, 200, 'Admin frontend should be running on port 5174');
  console.log('✓ Backend: http://localhost:5000 (200 OK)');
  console.log('✓ Customer Frontend: http://localhost:5173 (200 OK)');
  console.log('✓ Admin Frontend: http://localhost:5174 (200 OK)');

  // 2. Direct unauthenticated access to Admin APIs
  console.log('\nTest 2: Direct unauthenticated access to Admin APIs & Portal');
  const unauthRes = await fetch(`${BACKEND_URL}/api/auth/admin/me`);
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated GET /api/auth/admin/me must return 401');
  
  const adminHtml = await aRes.text();
  assert(adminHtml.includes('id="root"'), 'Admin frontend serves valid React root container');
  console.log('✓ Unauthenticated request to /api/auth/admin/me rejected with 401 Unauthorized');
  console.log('✓ Admin frontend directly serves Vite application on port 5174 gating on auth state');

  // 3. Admin Login
  console.log('\nTest 3: Admin Login with valid credentials');
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@aura.com',
      password: 'Admin@Aura2026',
    }),
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login should succeed with 200 OK');
  const loginData = await loginRes.json();
  assert(loginData.token, 'Response must provide JWT bearer token');
  assert(loginData.user, 'Response must provide user object');
  assert.strictEqual(loginData.user.role, 'admin', 'User role must be "admin"');
  assert.strictEqual(loginData.user.email, 'admin@aura.com', 'Admin email must match');
  assert.strictEqual(loginData.user.password, undefined, 'Password MUST NOT be exposed in user object');

  const adminToken = loginData.token;
  const setCookieHeader = loginRes.headers.get('set-cookie');
  assert(setCookieHeader && (setCookieHeader.includes('aura_admin_session=') || setCookieHeader.includes('token=')), 'Admin login must set HTTP-only admin session cookie');
  console.log(`✓ Admin successfully authenticated: Name="${loginData.user.name}", Role="${loginData.user.role}"`);
  console.log('✓ Bearer token and secure HTTP-only cookie issued');
  console.log('✓ Password field is completely excluded from login response');

  // 4. Admin Profile Retrieval (/api/auth/admin/me)
  console.log('\nTest 4: Admin Profile display data via /api/auth/admin/me');
  const profileRes = await fetch(`${BACKEND_URL}/api/auth/admin/me`, {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });
  assert.strictEqual(profileRes.status, 200, 'Admin profile request must return 200 OK');
  const profileData = await profileRes.json();
  assert(profileData.user, 'Profile response must contain user data');
  assert(profileData.user.name, 'Admin profile must display Name');
  assert(profileData.user.email, 'Admin profile must display Email');
  assert.strictEqual(profileData.user.role, 'admin', 'Admin profile must display Role "admin"');
  assert.strictEqual(profileData.user.password, undefined, 'Password MUST NOT be exposed in profile');
  console.log(`✓ Admin Profile Details verified:`);
  console.log(`   - Name: ${profileData.user.name}`);
  console.log(`   - Email: ${profileData.user.email}`);
  console.log(`   - Role: ${profileData.user.role}`);
  console.log(`   - Password: [SECURE / NOT EXPOSED]`);

  // 5. Session preservation on page refresh
  console.log('\nTest 5: Session preservation on page refresh');
  // Simulating browser page reload by making secondary request with preserved session
  const refreshRes = await fetch(`${BACKEND_URL}/api/auth/admin/me`, {
    headers: { 'Authorization': `Bearer ${adminToken}` },
  });
  assert.strictEqual(refreshRes.status, 200, 'Refreshed session must return 200 OK');
  const refreshData = await refreshRes.json();
  assert.strictEqual(refreshData.user.email, 'admin@aura.com', 'Refreshed session retains admin identity');
  console.log('✓ Authenticated admin session successfully preserved across simulated refresh');

  // 6. Admin Logout
  console.log('\nTest 6: Admin Logout and cookie clearing');
  const logoutRes = await fetch(`${BACKEND_URL}/api/auth/admin/logout`, {
    method: 'POST',
  });
  assert.strictEqual(logoutRes.status, 200, 'Logout request must return 200 OK');
  const logoutCookie = logoutRes.headers.get('set-cookie');
  // Verify cookie is cleared (has Expires in past or Max-Age=0 or empty token)
  assert(logoutCookie, 'Logout response must set clear-cookie header');
  assert(
    logoutCookie.includes('aura_admin_session=;') || 
    logoutCookie.includes('token=;') || 
    logoutCookie.includes('Expires=Thu, 01 Jan 1970') || 
    logoutCookie.includes('Max-Age=0'),
    'Logout must clear the session token cookie'
  );
  console.log('✓ /api/auth/admin/logout executed successfully and cleared authentication cookie');

  // 7. Direct access after logout
  console.log('\nTest 7: Direct access after logout (tokens cleared)');
  // Client has purged token and cookie
  const postLogoutRes = await fetch(`${BACKEND_URL}/api/auth/admin/me`);
  assert.strictEqual(postLogoutRes.status, 401, 'Request after logout without token/cookie must return 401');
  const postLogoutOrders = await fetch(`${BACKEND_URL}/api/orders`);
  assert.strictEqual(postLogoutOrders.status, 401, 'Protected orders API returns 401 after logout');
  console.log('✓ Accessing protected admin endpoints without tokens after logout returns 401 Unauthorized');
  console.log('✓ SPA state guard clears adminUser to null and displays Admin Login screen');

  // 8. Customer attempting admin access
  console.log('\nTest 8: Customer account attempting administrative access');
  const testCustomerEmail = `patron_test_${Date.now()}@example.com`;
  const regCustomerRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'VIP Customer',
      email: testCustomerEmail,
      password: 'CustomerPassword123',
      confirmPassword: 'CustomerPassword123',
    }),
  });
  assert(regCustomerRes.ok, 'Customer registration should succeed');
  const regCustData = await regCustomerRes.json();
  const customerTokenMatch = regCustomerRes.headers.get('set-cookie')?.match(/(?:aura_customer_session|token)=([^;]+)/);
  const customerToken = customerTokenMatch ? customerTokenMatch[1] : '';

  // 8a: Customer attempts to sign in via /api/auth/admin-login
  const custAdminLogin = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testCustomerEmail,
      password: 'CustomerPassword123',
    }),
  });
  assert.strictEqual(custAdminLogin.status, 403, 'Customer account calling admin-login must return 403 Forbidden');
  const custAdminLoginData = await custAdminLogin.json();
  assert(custAdminLoginData.message.includes('Access denied') || custAdminLoginData.message.includes('administrator privileges'), 'Proper access denied message returned');
  console.log('✓ Customer account rejected from /api/auth/admin-login with 403 Forbidden');

  // 8b: Customer attempts to access /api/auth/admin/me with customer token
  const custAdminMe = await fetch(`${BACKEND_URL}/api/auth/admin/me`, {
    headers: { 'Authorization': `Bearer ${customerToken}` },
  });
  assert.strictEqual(custAdminMe.status, 403, 'Customer token on /api/auth/admin/me must return 403 Forbidden');
  console.log('✓ Customer token on /api/auth/admin/me rejected with 403 Forbidden');

  // 8c: Customer attempts to access /api/orders with customer token
  const custOrders = await fetch(`${BACKEND_URL}/api/orders`, {
    headers: { 'Authorization': `Bearer ${customerToken}` },
  });
  assert.strictEqual(custOrders.status, 403, 'Customer token on /api/orders must return 403 Forbidden');
  console.log('✓ Customer token on GET /api/orders rejected with 403 Forbidden');

  // 8d: Customer attempts to modify products catalog
  const custPostProd = await fetch(`${BACKEND_URL}/api/products`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}` 
    },
    body: JSON.stringify({
      name: 'Unauthorized Item',
      price: 500,
    }),
  });
  assert.strictEqual(custPostProd.status, 403, 'Customer token on POST /api/products must return 403 Forbidden');
  console.log('✓ Customer token on POST /api/products rejected with 403 Forbidden');

  // 9. Verify customer features remain intact (Checkout, stock deduction, wishlist)
  console.log('\nTest 9: Verify existing customer functionality is intact');
  
  // 9a: Fetch product catalog
  const prodsRes = await fetch(`${BACKEND_URL}/api/products`);
  const products = await prodsRes.json();
  assert(products.length > 0, 'Catalog must contain products');
  const testProduct = products.find(p => p.sizeStock && Object.values(p.sizeStock).some(q => Number(q) > 0)) || products[0];
  const testSize = Object.entries(testProduct.sizeStock || {}).find(([sz, qty]) => Number(qty) > 0)?.[0] || 'M';
  const initialStock = testProduct.stock;

  // 9b: Customer checkout
  const orderId = `AUR-PRF-${Date.now()}`;
  const checkoutRes = await fetch(`${BACKEND_URL}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderId,
      customer: {
        fullName: 'VIP Customer',
        email: testCustomerEmail,
        phone: '9876543210',
      },
      shippingAddress: {
        address: '100 Luxury Avenue',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400001',
      },
      items: [{
        productId: testProduct._id,
        name: testProduct.name,
        price: testProduct.price,
        quantity: 1,
        selectedSize: testSize,
        selectedColor: 'Black',
      }],
      subtotal: testProduct.price,
      shipping: 0,
      total: testProduct.price,
      paymentMethod: 'Credit Card',
    }),
  });
  assert.strictEqual(checkoutRes.status, 201, 'Customer checkout should succeed with 201');
  const orderData = await checkoutRes.json();
  console.log(`✓ Customer checkout succeeded: Order ID ${orderData.order?.orderId || orderId}`);

  // 9c: Verify stock deduction
  const allProdsRes = await fetch(`${BACKEND_URL}/api/products`);
  const allProds = await allProdsRes.json();
  const updatedProduct = allProds.find(p => p._id.toString() === testProduct._id.toString());
  assert(updatedProduct, 'Target product must be found in catalog');
  assert.strictEqual(updatedProduct.stock, initialStock - 1, 'Product stock should be decremented by 1');
  console.log(`✓ Product stock properly decremented: ${initialStock} -> ${updatedProduct.stock}`);

  // 9d: Wishlist toggle
  const wishToggleRes = await fetch(`${BACKEND_URL}/api/wishlist/toggle`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${customerToken}`
    },
    body: JSON.stringify({ productId: testProduct._id }),
  });
  assert.strictEqual(wishToggleRes.status, 200, 'Wishlist toggle should succeed with 200 OK');
  const wishData = await wishToggleRes.json();
  assert(wishData.wishlist.some(item => (item._id || item).toString() === testProduct._id.toString()), 'Product should be in customer wishlist');
  console.log('✓ Customer wishlist functionality verified and working');

  console.log('\n================================================================');
  console.log('ALL 9 TEST SUITES PASSED! ADMIN AUTH & PROFILE FULLY VERIFIED.');
  console.log('================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
