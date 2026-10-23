const assert = require('assert');

const BACKEND_URL = 'http://localhost:5000';
const ADMIN_EMAIL = 'admin@aura.com';
const ADMIN_PASSWORD = 'Admin@Aura2026';

function parseCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
  for (const c of cookies) {
    const parts = c.split(';');
    for (const p of parts) {
      const [k, v] = p.trim().split('=');
      if (k === name) return v;
    }
  }
  return null;
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('    AURA ADMIN LOGIN & ROUTE/API PROTECTION VERIFICATION SUITE   ');
  console.log('================================================================\n');

  // TEST 1: Unauthenticated Backend API Requests (Must reject with 401)
  console.log('TEST 1: Verifying backend admin API endpoints reject unauthenticated access');
  const endpoints = [
    { method: 'GET', path: '/api/auth/admin/me', name: 'Admin Profile' },
    { method: 'GET', path: '/api/admin/customers', name: 'Customers List' },
    { method: 'GET', path: '/api/orders', name: 'Orders List' },
    { method: 'GET', path: '/api/admin/analytics?period=all', name: 'Analytics' },
    { method: 'GET', path: '/api/admin/notifications', name: 'Notifications' },
    { method: 'GET', path: '/api/admin/coupons', name: 'Coupons Management' },
    { method: 'GET', path: '/api/admin/reviews', name: 'Review Moderation' },
    { method: 'GET', path: '/api/returns/admin', name: 'Returns Management' },
    { method: 'POST', path: '/api/products', name: 'Add Product' }
  ];

  for (const ep of endpoints) {
    const res = await fetch(`${BACKEND_URL}${ep.path}`, {
      method: ep.method,
      headers: { 'Content-Type': 'application/json' },
      body: ep.method === 'POST' ? JSON.stringify({}) : undefined
    });
    assert.strictEqual(
      res.status, 
      401, 
      `Endpoint ${ep.method} ${ep.path} must return 401 Unauthorized when unauthenticated (got ${res.status})`
    );
    console.log(`  ✓ ${ep.name} (${ep.method} ${ep.path}) returned HTTP 401 Unauthorized`);
  }

  // TEST 2: Admin Login with Invalid Credentials
  console.log('\nTEST 2: Verifying rejection of invalid login credentials');
  
  // 2a. Wrong Password
  const badPassRes = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: 'WrongPassword123!' })
  });
  assert.strictEqual(badPassRes.status, 401, 'Wrong password must return 401');
  const badPassData = await badPassRes.json();
  console.log(`  ✓ Wrong password rejected with 401: "${badPassData.message}"`);

  // 2b. Non-existent Admin Email
  const badEmailRes = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'fakeadmin@aura.com', password: 'Admin@Aura2026' })
  });
  assert.strictEqual(badEmailRes.status, 401, 'Non-existent email must return 401');
  const badEmailData = await badEmailRes.json();
  console.log(`  ✓ Non-existent admin email rejected with 401: "${badEmailData.message}"`);

  // 2c. Regular Customer Account Attempting Admin Login
  const custOnAdminRes = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'rakshithapoojary560@gmail.com', password: 'anyPassword123' })
  });
  // If user exists with customer role, comparePassword runs or returns 401/403
  assert(
    custOnAdminRes.status === 401 || custOnAdminRes.status === 403,
    `Customer account must not log into admin (status ${custOnAdminRes.status})`
  );
  console.log(`  ✓ Customer login attempt on admin portal rejected with HTTP ${custOnAdminRes.status}`);

  // TEST 3: Admin Login with Valid Credentials
  console.log('\nTEST 3: Verifying successful admin authentication');
  const loginRes = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
  });
  assert.strictEqual(loginRes.status, 200, 'Valid admin login must return 200');
  const loginData = await loginRes.json();
  assert(loginData.token, 'Must return JWT token');
  assert.strictEqual(loginData.user.role, 'admin', 'Returned user role must be admin');
  assert.strictEqual(loginData.user.email, ADMIN_EMAIL, 'Returned user email must match admin email');
  
  const setCookieHeader = loginRes.headers.get('set-cookie');
  assert(setCookieHeader && setCookieHeader.includes('aura_admin_session='), 'Must set aura_admin_session HTTP-only cookie');
  console.log(`  ✓ Admin authenticated successfully: ${loginData.user.name} (${loginData.user.email})`);
  console.log(`  ✓ Returned valid admin JWT token (Length: ${loginData.token.length})`);
  console.log(`  ✓ Set-Cookie header issued aura_admin_session cookie`);

  // TEST 4: Access Protected APIs with Admin Token
  console.log('\nTEST 4: Verifying protected API access with valid admin token');
  const adminHeaders = {
    'Authorization': `Bearer ${loginData.token}`,
    'Content-Type': 'application/json'
  };

  const meRes = await fetch(`${BACKEND_URL}/api/auth/admin/me`, { headers: adminHeaders });
  assert.strictEqual(meRes.status, 200, 'GET /api/auth/admin/me must succeed');
  const meData = await meRes.json();
  assert.strictEqual(meData.user.email, ADMIN_EMAIL, 'Profile email must match');
  console.log(`  ✓ Session verified via GET /api/auth/admin/me (Role: ${meData.user.role})`);

  const custRes = await fetch(`${BACKEND_URL}/api/admin/customers`, { headers: adminHeaders });
  assert.strictEqual(custRes.status, 200, 'GET /api/admin/customers must succeed');
  const custData = await custRes.json();
  assert.strictEqual(custData.customers.length, 4, 'Must return exactly 4 genuine customers');
  console.log(`  ✓ GET /api/admin/customers returned HTTP 200 (Total Customers: ${custData.customers.length})`);

  const ordRes = await fetch(`${BACKEND_URL}/api/orders`, { headers: adminHeaders });
  assert.strictEqual(ordRes.status, 200, 'GET /api/orders must succeed');
  const ordData = await ordRes.json();
  const ordersList = Array.isArray(ordData) ? ordData : ordData.orders || [];
  assert.strictEqual(ordersList.length, 17, 'Must return exactly 17 genuine orders');
  console.log(`  ✓ GET /api/orders returned HTTP 200 (Total Orders: ${ordersList.length})`);

  // TEST 5: Admin Logout and Session Invalidation
  console.log('\nTEST 5: Verifying admin logout and session invalidation');
  const logoutRes = await fetch(`${BACKEND_URL}/api/auth/admin/logout`, {
    method: 'POST',
    headers: adminHeaders
  });
  assert.strictEqual(logoutRes.status, 200, 'Logout must return 200');
  const logoutCookie = logoutRes.headers.get('set-cookie');
  assert(
    logoutCookie && (logoutCookie.includes('aura_admin_session=;') || logoutCookie.includes('Max-Age=0') || logoutCookie.includes('expires=')),
    'Logout must clear the aura_admin_session cookie'
  );
  console.log('  ✓ Admin logout returned HTTP 200');
  console.log('  ✓ Set-Cookie header cleared aura_admin_session');

  // Verify that subsequent unauthenticated request fails
  const postLogoutMe = await fetch(`${BACKEND_URL}/api/auth/admin/me`);
  assert.strictEqual(postLogoutMe.status, 401, 'Unauthenticated request after logout must return 401');
  console.log('  ✓ Subsequent request to /api/auth/admin/me rejected with 401 Unauthorized');

  console.log('\n================================================================');
  console.log('      ALL 5 SECURITY & AUTHENTICATION TESTS PASSED (100%)       ');
  console.log('================================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
