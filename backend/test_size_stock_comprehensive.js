const http = require('http');

const BASE_URL = 'http://localhost:5000';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({ status: res.statusCode, data: json, headers: res.headers });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING SIZE-WISE STOCK COMPREHENSIVE TESTS ===\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Admin login to get token
    console.log('--- Step 1: Admin Authentication ---');
    const adminLoginRes = await makeRequest('POST', '/api/auth/admin-login', {
      email: 'admin@aura.com',
      password: 'Admin@Aura2026',
    });
    assert(adminLoginRes.status === 200 && adminLoginRes.data.token, 'Admin login succeeds and returns JWT');
    const adminToken = adminLoginRes.data.token;
    const adminHeaders = { Authorization: `Bearer ${adminToken}` };

    // 2. Create a test product with size-wise stock: S: 0, M: 5, L: 3, XL: 0
    console.log('\n--- Step 2: Create Test Product with SizeStock ---');
    const createProdRes = await makeRequest(
      'POST',
      '/api/products',
      {
        name: 'Test Aura Size-Wise Dress',
        description: 'An elegant test dress for size inventory testing.',
        price: 2999,
        category: 'Women',
        image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=80',
        sizes: ['S', 'M', 'L', 'XL'],
        sizeStock: {
          S: 0,
          M: 5,
          L: 3,
          XL: 0,
        },
      },
      adminHeaders
    );
    assert(createProdRes.status === 201, 'Admin can create product with sizeStock');
    const testProduct = createProdRes.data;
    assert(testProduct.stock === 8, `Overall product stock correctly computed as 8 (sum of 0+5+3+0), got ${testProduct.stock}`);
    assert(testProduct.sizeStock && testProduct.sizeStock.S === 0, 'Size S stock is 0 (out of stock)');
    assert(testProduct.sizeStock && testProduct.sizeStock.M === 5, 'Size M stock is 5 (available)');

    // 3. Admin can update/edit stock for each size
    console.log('\n--- Step 3: Admin Can Edit Stock for Each Size ---');
    const editProdRes = await makeRequest(
      'PUT',
      `/api/products/${testProduct._id}`,
      {
        sizeStock: {
          S: 0,
          M: 6,
          L: 3,
          XL: 0,
        },
      },
      adminHeaders
    );
    assert(editProdRes.status === 200, 'Admin can update product sizeStock');
    assert(editProdRes.data.product.sizeStock.M === 6, 'Size M updated to 6');
    assert(editProdRes.data.product.stock === 9, 'Total stock recalculated to 9');

    // Reset M back to 5 for remaining test cases
    await makeRequest(
      'PUT',
      `/api/products/${testProduct._id}`,
      {
        sizeStock: {
          S: 0,
          M: 5,
          L: 3,
          XL: 0,
        },
      },
      adminHeaders
    );

    // 4. Test: Order with size S (stock 0) must be rejected
    console.log('\n--- Step 4: Purchase Attempt on Out-of-Stock Size (S=0) ---');
    const orderS_Res = await makeRequest('POST', '/api/orders', {
      orderId: `TEST-ORD-S-${Date.now()}`,
      customer: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '9876543210',
      },
      shippingAddress: {
        address: '123 Marine Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400020',
      },
      items: [
        {
          productId: testProduct._id,
          name: testProduct.name,
          quantity: 1,
          size: 'S',
          price: testProduct.price,
        },
      ],
      subtotal: testProduct.price,
      shipping: 0,
      total: testProduct.price,
    });
    assert(orderS_Res.status === 400, 'Order for Size S is rejected with HTTP 400');
    assert(
      orderS_Res.data.message && orderS_Res.data.message.toLowerCase().includes('insufficient stock'),
      `Rejection message clearly mentions insufficient stock: "${orderS_Res.data.message}"`
    );

    // 5. Test: Quantity cannot exceed selected size stock (Request 7 of M when only 5 exist)
    console.log('\n--- Step 5: Quantity Exceeding Size Stock (M=5, request=7) ---');
    const orderM_ExcessRes = await makeRequest('POST', '/api/orders', {
      orderId: `TEST-ORD-EXCESS-${Date.now()}`,
      customer: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '9876543210',
      },
      shippingAddress: {
        address: '123 Marine Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400020',
      },
      items: [
        {
          productId: testProduct._id,
          name: testProduct.name,
          quantity: 7,
          size: 'M',
          price: testProduct.price,
        },
      ],
      subtotal: testProduct.price * 7,
      shipping: 0,
      total: testProduct.price * 7,
    });
    assert(orderM_ExcessRes.status === 400, 'Ordering 7 units of M (stock 5) is rejected with HTTP 400');

    // 6. Test: Buying M reduces only M stock, does NOT reduce S, L, or XL
    console.log('\n--- Step 6: Buying M Reduces Only M Stock ---');
    const orderM_ValidRes = await makeRequest('POST', '/api/orders', {
      orderId: `TEST-ORD-VALID-M-${Date.now()}`,
      customer: {
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '9876543210',
      },
      shippingAddress: {
        address: '123 Marine Drive',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400020',
      },
      items: [
        {
          productId: testProduct._id,
          name: testProduct.name,
          quantity: 2,
          size: 'M',
          price: testProduct.price,
        },
      ],
      subtotal: testProduct.price * 2,
      shipping: 0,
      total: testProduct.price * 2,
    });
    assert(orderM_ValidRes.status === 201, 'Valid purchase of 2 units of Size M succeeds (201)');

    // Verify stock in MongoDB
    const verifyProdRes = await makeRequest('GET', `/api/products/${testProduct._id}`);
    const updatedProd = verifyProdRes.data;
    assert(updatedProd.sizeStock.M === 3, `Size M reduced from 5 to 3, got ${updatedProd.sizeStock.M}`);
    assert(updatedProd.sizeStock.S === 0, `Size S remained untouched at 0, got ${updatedProd.sizeStock.S}`);
    assert(updatedProd.sizeStock.L === 3, `Size L remained untouched at 3, got ${updatedProd.sizeStock.L}`);
    assert(updatedProd.sizeStock.XL === 0, `Size XL remained untouched at 0, got ${updatedProd.sizeStock.XL}`);
    assert(updatedProd.stock === 6, `Total stock reduced from 8 to 6, got ${updatedProd.stock}`);

    // 7. Test: Concurrency / Race Condition Protection (prevent two customers from overselling)
    console.log('\n--- Step 7: Atomic Concurrency Protection (Oversell Prevention) ---');
    // Currently M has 3 units. Customer 1 attempts 2 units, Customer 2 attempts 2 units in parallel.
    // Total requested = 4, but stock is only 3. Exactly one must succeed and one must fail.
    const concurrent1 = makeRequest('POST', '/api/orders', {
      orderId: `TEST-RACE-1-${Date.now()}`,
      customer: { fullName: 'Buyer 1', email: 'buyer1@test.com', phone: '9999999991' },
      shippingAddress: { address: 'Addr 1', city: 'City', state: 'State', pinCode: '110001' },
      items: [{ productId: testProduct._id, name: testProduct.name, quantity: 2, size: 'M', price: testProduct.price }],
      subtotal: testProduct.price * 2,
      shipping: 0,
      total: testProduct.price * 2,
    });

    const concurrent2 = makeRequest('POST', '/api/orders', {
      orderId: `TEST-RACE-2-${Date.now()}`,
      customer: { fullName: 'Buyer 2', email: 'buyer2@test.com', phone: '9999999992' },
      shippingAddress: { address: 'Addr 2', city: 'City', state: 'State', pinCode: '110001' },
      items: [{ productId: testProduct._id, name: testProduct.name, quantity: 2, size: 'M', price: testProduct.price }],
      subtotal: testProduct.price * 2,
      shipping: 0,
      total: testProduct.price * 2,
    });

    const [race1, race2] = await Promise.all([concurrent1, concurrent2]);
    const oneSucceeded = (race1.status === 201 && race2.status === 400) || (race2.status === 201 && race1.status === 400);
    assert(oneSucceeded, `Concurrency protection: One order succeeded (201) and one rejected (400) - race1: ${race1.status}, race2: ${race2.status}`);

    const postRaceProd = (await makeRequest('GET', `/api/products/${testProduct._id}`)).data;
    assert(postRaceProd.sizeStock.M === 1, `Size M stock atomically reduced to exactly 1 (never negative), got ${postRaceProd.sizeStock.M}`);

    // 8. Test: Product becomes completely out of stock only when ALL sizes reach 0
    console.log('\n--- Step 8: Out of Stock When ALL Sizes Reach 0 ---');
    // Set M to 0, but L is still 3 -> product should NOT be out of stock (stock > 0)
    await makeRequest('PUT', `/api/products/${testProduct._id}`, {
      sizeStock: { S: 0, M: 0, L: 3, XL: 0 }
    }, adminHeaders);
    let checkPartial = (await makeRequest('GET', `/api/products/${testProduct._id}`)).data;
    assert(checkPartial.stock === 3, 'When L has 3, product stock is 3 (not completely out of stock)');

    // Now set all sizes to 0
    await makeRequest('PUT', `/api/products/${testProduct._id}`, {
      sizeStock: { S: 0, M: 0, L: 0, XL: 0 }
    }, adminHeaders);
    let checkAllZero = (await makeRequest('GET', `/api/products/${testProduct._id}`)).data;
    assert(checkAllZero.stock === 0, 'When all sizes are 0, product stock is 0 (completely out of stock)');

    // 9. Clean up test product
    console.log('\n--- Step 9: Cleanup Test Product ---');
    const deleteRes = await makeRequest('DELETE', `/api/products/${testProduct._id}`, null, adminHeaders);
    assert(deleteRes.status === 200, 'Test product deleted cleanly');

    // 10. Verify existing orders still work and display sizes
    console.log('\n--- Step 10: Existing Orders Integrity Check ---');
    const ordersRes = await makeRequest('GET', '/api/orders', null, adminHeaders);
    assert(ordersRes.status === 200 && Array.isArray(ordersRes.data), 'Existing orders endpoint returns orders array');
    const hasItemsWithSize = ordersRes.data.some(o => Array.isArray(o.items) && o.items.some(i => i.size));
    assert(hasItemsWithSize, 'Orders continue displaying item sizes');

    // 11. Admin analytics endpoint handles size stock
    console.log('\n--- Step 11: Admin Analytics with Size Inventory ---');
    const analyticsRes = await makeRequest('GET', '/api/admin/analytics?period=7d', null, adminHeaders);
    assert(analyticsRes.status === 200, 'Admin analytics returns 200');
    assert(analyticsRes.data.summary && typeof analyticsRes.data.summary.lowStockProductsCount === 'number', 'Analytics summary provides lowStockProductsCount');
    if (analyticsRes.data.lowStockProducts.length > 0) {
      assert(analyticsRes.data.lowStockProducts[0].sizeStock !== undefined, 'Low stock product details include sizeStock breakdown');
    }

  } catch (error) {
    console.error('Unexpected error during testing:', error);
    failed++;
  }

  console.log(`\n========================================`);
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log(`========================================`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
