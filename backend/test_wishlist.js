const http = require('http');

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data ? JSON.parse(data) : null,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

function extractCookie(headers) {
  const setCookie = headers['set-cookie'];
  if (!setCookie) return null;
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  return cookieStr.split(';')[0];
}

async function runWishlistTests() {
  console.log('=== AURA WISHLIST COMPREHENSIVE AUTOMATED TESTS ===\n');
  const timestamp = Date.now();

  // Step 1: Fetch products from real backend
  console.log('Test 1: Fetching active products from MongoDB...');
  const prodRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/products',
    method: 'GET',
  });

  if (prodRes.statusCode !== 200 || !Array.isArray(prodRes.data) || prodRes.data.length < 2) {
    throw new Error(`Failed to load products: status ${prodRes.statusCode}`);
  }
  const productA = prodRes.data[0];
  const productB = prodRes.data[1];
  console.log(`✓ Retrieved ${prodRes.data.length} products. Selected: "${productA.name}" & "${productB.name}"\n`);

  // Step 2: Register Customer A
  console.log('Test 2: Registering Customer A...');
  const emailA = `customera_${timestamp}@aura-test.com`;
  const emailB = `customerb_${timestamp}@aura-test.com`;

  try {
    const userAData = {
      name: `Customer A ${timestamp}`,
      email: emailA,
      password: 'Password123!',
      confirmPassword: 'Password123!',
    };

  const regARes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    userAData
  );

  if (regARes.statusCode !== 201) {
    throw new Error(`Customer A registration failed: ${JSON.stringify(regARes.data)}`);
  }
  const cookieA = extractCookie(regARes.headers);
  console.log(`✓ Customer A registered successfully. Cookie: ${cookieA ? 'Present' : 'None'}\n`);

  // Step 3: Check Customer A's initial wishlist (should be empty)
  console.log("Test 3: Checking Customer A's empty wishlist...");
  const initWishA = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wishlist',
    method: 'GET',
    headers: { Cookie: cookieA },
  });

  if (initWishA.statusCode !== 200 || initWishA.data.count !== 0) {
    throw new Error(`Customer A initial wishlist not empty: ${JSON.stringify(initWishA.data)}`);
  }
  console.log(`✓ Initial wishlist is empty (count: 0)\n`);

  // Step 4: Toggle productA into Customer A's wishlist
  console.log(`Test 4: Toggling "${productA.name}" into Customer A's wishlist...`);
  const toggleRes1 = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/wishlist/toggle',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
      },
    },
    { productId: productA._id }
  );

  if (toggleRes1.statusCode !== 200 || !toggleRes1.data.isAdded || toggleRes1.data.count !== 1) {
    throw new Error(`Failed to add productA to wishlist: ${JSON.stringify(toggleRes1.data)}`);
  }
  console.log(`✓ Added "${productA.name}" to wishlist. Response count: ${toggleRes1.data.count}\n`);

  // Step 5: Toggle productB into Customer A's wishlist
  console.log(`Test 5: Toggling "${productB.name}" into Customer A's wishlist...`);
  const toggleRes2 = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/wishlist/toggle',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
      },
    },
    { productId: productB._id }
  );

  if (toggleRes2.statusCode !== 200 || !toggleRes2.data.isAdded || toggleRes2.data.count !== 2) {
    throw new Error(`Failed to add productB to wishlist: ${JSON.stringify(toggleRes2.data)}`);
  }
  console.log(`✓ Added "${productB.name}" to wishlist. Response count: ${toggleRes2.data.count}\n`);

  // Step 6: Verify Customer A's GET /api/wishlist returns both populated items
  console.log("Test 6: Retrieving Customer A's populated wishlist...");
  const getWishA = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wishlist',
    method: 'GET',
    headers: { Cookie: cookieA },
  });

  if (getWishA.statusCode !== 200 || getWishA.data.count !== 2) {
    throw new Error(`Customer A wishlist count incorrect: ${JSON.stringify(getWishA.data)}`);
  }
  const itemNames = getWishA.data.wishlist.map((it) => it.name);
  console.log(`✓ Customer A wishlist has: [${itemNames.join(', ')}]\n`);

  // Step 7: Security & Tenant Isolation Check: Register Customer B and verify isolation
  console.log('Test 7: Security check - Registering Customer B and verifying isolation...');
  const userBData = {
    name: `Customer B ${timestamp}`,
    email: emailB,
    password: 'Password123!',
    confirmPassword: 'Password123!',
  };

  const regBRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    userBData
  );

  const cookieB = extractCookie(regBRes.headers);
  const getWishB = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wishlist',
    method: 'GET',
    headers: { Cookie: cookieB },
  });

  if (getWishB.statusCode !== 200 || getWishB.data.count !== 0) {
    throw new Error(`Security breach: Customer B can see Customer A's wishlist! Data: ${JSON.stringify(getWishB.data)}`);
  }
  console.log(`✓ Strict Tenant Isolation verified! Customer B's wishlist count is 0 (cannot access Customer A's items)\n`);

  // Step 8: Guest Wishlist Merge Check (PUT /api/wishlist/merge)
  console.log('Test 8: Testing Guest Wishlist merging into Customer B account...');
  const guestItemIds = [productA._id, productB._id];
  const mergeRes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/wishlist/merge',
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieB,
      },
    },
    { productIds: guestItemIds }
  );

  if (mergeRes.statusCode !== 200 || mergeRes.data.count !== 2) {
    throw new Error(`Merge failed: ${JSON.stringify(mergeRes.data)}`);
  }
  console.log(`✓ Guest items safely merged into Customer B's account (count: ${mergeRes.data.count})\n`);

  // Step 9: Remove an item explicitly via DELETE /api/wishlist/:productId
  console.log(`Test 9: Removing "${productA.name}" from Customer B's wishlist via DELETE...`);
  const delRes = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: `/api/wishlist/${productA._id}`,
    method: 'DELETE',
    headers: { Cookie: cookieB },
  });

  if (delRes.statusCode !== 200 || delRes.data.count !== 1) {
    throw new Error(`Deletion failed: ${JSON.stringify(delRes.data)}`);
  }
  console.log(`✓ Item removed. Remaining count in Customer B's wishlist: ${delRes.data.count}\n`);

  // Step 10: Toggle removal test for Customer A
  console.log(`Test 10: Toggling "${productA.name}" again for Customer A (should remove it)...`);
  const toggleRes3 = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/wishlist/toggle',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieA,
      },
    },
    { productId: productA._id }
  );

  if (toggleRes3.statusCode !== 200 || toggleRes3.data.isAdded || toggleRes3.data.count !== 1) {
    throw new Error(`Toggle removal failed: ${JSON.stringify(toggleRes3.data)}`);
  }
  console.log(`✓ Product safely removed via toggle. Updated count: ${toggleRes3.data.count}\n`);

  // Step 11: Persistence across login/logout
  console.log("Test 11: Verifying wishlist persistence across session logout and re-login...");
  // Re-login Customer A
  const loginARes = await makeRequest(
    {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    {
      email: userAData.email,
      password: userAData.password,
    }
  );

  const newCookieA = extractCookie(loginARes.headers);
  const reGetWishA = await makeRequest({
    hostname: 'localhost',
    port: 5000,
    path: '/api/wishlist',
    method: 'GET',
    headers: { Cookie: newCookieA },
  });

  if (reGetWishA.statusCode !== 200 || reGetWishA.data.count !== 1 || reGetWishA.data.wishlist[0]._id !== productB._id) {
    throw new Error(`Persistence check failed: ${JSON.stringify(reGetWishA.data)}`);
  }
  console.log(`✓ Wishlist persisted perfectly across login/logout! Saved item: "${reGetWishA.data.wishlist[0].name}"\n`);

  console.log('====================================================');
  console.log('ALL 11 AUTOMATED WISHLIST INTEGRATION TESTS PASSED!');
  console.log('====================================================');
  } finally {
    try {
      const mongoose = require('mongoose');
      const conn = await mongoose.createConnection(process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/aura');
      await conn.collection('users').deleteMany({ email: { $in: [emailA, emailB] } });
      await conn.collection('adminnotifications').deleteMany({
        message: { $regex: new RegExp(`(customera_${timestamp}|customerb_${timestamp})`, 'i') }
      });
      await conn.close();
      console.log('✓ Cleaned up test_wishlist test accounts and notifications.');
    } catch (e) {}
  }
}

runWishlistTests().catch((err) => {
  console.error('\n❌ Test Error:', err);
  process.exit(1);
});
