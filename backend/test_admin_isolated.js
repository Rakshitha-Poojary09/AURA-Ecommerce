const http = require('http');
const { spawn } = require('child_process');
const mongoose = require('mongoose');

const TEST_PORT = 5099;
const TEST_MONGO_URI = 'mongodb://localhost:27017/aura_test';
const REAL_MONGO_URI = 'mongodb://localhost:27017/aura';

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {
          json = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          raw: data,
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runVerification() {
  console.log('====================================================');
  console.log(' STARTING ISOLATED ADMIN ADD PRODUCT VERIFICATION  ');
  console.log('====================================================');

  // 1. Check real aura DB count to ensure zero pollution
  const realConn = await mongoose.createConnection(REAL_MONGO_URI).asPromise();
  const initialRealCount = await realConn.collection('products').countDocuments();
  console.log(`[Real Database Check] Real 'aura' products count before tests: ${initialRealCount}`);
  await realConn.close();

  // 2. Clean isolated aura_test DB before starting
  const testConn = await mongoose.createConnection(TEST_MONGO_URI).asPromise();
  await testConn.dropDatabase();
  console.log("[Isolated DB Check] Dropped and cleaned 'aura_test' database.");
  await testConn.close();

  // 3. Start isolated backend process on TEST_PORT pointing to aura_test
  console.log(`[Spawn Server] Starting isolated backend on port ${TEST_PORT} with DB: aura_test...`);
  const serverProcess = spawn('node', ['server.js'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: TEST_PORT.toString(),
      MONGO_URI: TEST_MONGO_URI,
      ADMIN_EMAIL: 'testadmin@aura.com',
      ADMIN_PASSWORD: 'TestAdminPass2026!',
      JWT_SECRET: 'isolated_test_jwt_secret_9999',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout.on('data', (d) => {
    // console.log(`[Isolated Server STDOUT]: ${d}`);
  });
  serverProcess.stderr.on('data', (d) => {
    console.error(`[Isolated Server STDERR]: ${d}`);
  });

  // 4. Wait for server and MongoDB connection to become ready
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await wait(500);
    try {
      const res = await request(`http://localhost:${TEST_PORT}/health`);
      if (res.statusCode === 200 && res.data && res.data.status === 'ok' && res.data.database === 'connected') {
        ready = true;
        break;
      }
    } catch (e) {
      // not ready yet
    }
  }

  if (!ready) {
    serverProcess.kill();
    throw new Error('Isolated server failed to start within timeout');
  }
  console.log(`[Server Ready] Isolated backend is healthy at http://localhost:${TEST_PORT}\n`);

  let testsPassed = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    } else {
      testsPassed++;
      console.log(`✅ PASSED: ${message}`);
    }
  }

  try {
    // TEST 1: Health check endpoint
    const healthRes = await request(`http://localhost:${TEST_PORT}/health`);
    assert(healthRes.statusCode === 200, 'Health endpoint /health returns status 200');
    assert(healthRes.data.status === 'ok', 'Health endpoint status is "ok"');
    assert(healthRes.data.database === 'connected', 'Health endpoint reports database connected');

    // TEST 2: Root endpoint
    const rootRes = await request(`http://localhost:${TEST_PORT}/`);
    assert(rootRes.statusCode === 200, 'Root endpoint / returns status 200');
    assert(rootRes.data.status === 'ok', 'Root endpoint returns JSON with status "ok"');

    // TEST 3: URL normalizer for double slashes (e.g. //api/products)
    const doubleSlashRes = await request(`http://localhost:${TEST_PORT}//api/products`);
    assert(doubleSlashRes.statusCode === 200, 'Double-slash path //api/products normalized and returns 200 (not 404)');

    // TEST 4: CORS preflight from Admin frontend origin (http://localhost:5174)
    const corsRes = await request(`http://localhost:${TEST_PORT}/api/products`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5174',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, Authorization, X-Requested-With, Accept',
      },
    });
    assert(corsRes.statusCode === 204, 'CORS preflight for http://localhost:5174 returns 204 No Content');
    assert(
      corsRes.headers['access-control-allow-origin'] === 'http://localhost:5174',
      'CORS returns Access-Control-Allow-Origin matching admin frontend'
    );
    assert(
      corsRes.headers['access-control-allow-credentials'] === 'true',
      'CORS returns Access-Control-Allow-Credentials: true'
    );

    // TEST 5: requireAdmin security check (unauthenticated POST rejected)
    const unauthPostRes = await request(`http://localhost:${TEST_PORT}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { name: 'Unauthorized Product', price: 999 },
    });
    assert(unauthPostRes.statusCode === 401, 'Unauthenticated POST /api/products rejected with 401 Unauthorized');

    // TEST 6: Admin login authentication
    const loginRes = await request(`http://localhost:${TEST_PORT}/api/auth/admin-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: {
        email: 'testadmin@aura.com',
        password: 'TestAdminPass2026!',
      },
    });
    console.log('[DEBUG Login Response]', loginRes.statusCode, loginRes.data);
    assert(loginRes.statusCode === 200, 'Admin login returns 200 OK');
    assert(Boolean(loginRes.data.token), 'Admin login returns JWT token');
    const adminToken = loginRes.data.token;
    const cookieHeader = loginRes.headers['set-cookie'];
    assert(Array.isArray(cookieHeader) && cookieHeader.some(c => c.includes('aura_admin_session')), 'Admin login sets aura_admin_session cookie');

    // TEST 7: Fetch products (AdminProducts.fetchProducts)
    const fetchRes = await request(`http://localhost:${TEST_PORT}/api/products`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert(fetchRes.statusCode === 200, 'Fetch products returns 200 OK');
    assert(Array.isArray(fetchRes.data), 'Fetch products returns an array');
    const initialProductCount = fetchRes.data.length;

    // TEST 8: Submit new product (Admin → Add Product)
    const newProductPayload = {
      name: 'Isolated Silk Evening Dress',
      description: 'Exclusive handcrafted evening gown in pure mulberry silk.',
      price: 6499,
      mrp: 8999,
      category: 'Women',
      image: '/products/silk_dress.jpg',
      sizes: ['S', 'M', 'L'],
      sizeStock: { S: 5, M: 8, L: 12 },
      stock: 25,
    };

    const addProductRes = await request(`http://localhost:${TEST_PORT}/api/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: newProductPayload,
    });
    assert(addProductRes.statusCode === 201, 'Admin Add Product returns 201 Created');
    assert(addProductRes.data && Boolean(addProductRes.data._id), 'Created product has MongoDB _id');
    assert(addProductRes.data.name === 'Isolated Silk Evening Dress', 'Created product has matching name');
    assert(addProductRes.data.price === 6499, 'Created product has matching price');
    assert(addProductRes.data.stock === 25, 'Created product has computed stock of 25');

    const createdProductId = addProductRes.data._id;

    // TEST 9: Verify product in catalog list after adding
    const fetchAfterRes = await request(`http://localhost:${TEST_PORT}/api/products`, {
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    assert(fetchAfterRes.statusCode === 200, 'Fetch products after add returns 200 OK');
    assert(fetchAfterRes.data.length === initialProductCount + 1, 'Product catalog count increased by 1');
    const foundProduct = fetchAfterRes.data.find(p => p._id === createdProductId);
    assert(Boolean(foundProduct), 'Newly created product is found in catalog listing');

    // TEST 10: Verify Database Isolation
    const finalRealConn = await mongoose.createConnection(REAL_MONGO_URI).asPromise();
    const finalRealCount = await finalRealConn.collection('products').countDocuments();
    assert(finalRealCount === initialRealCount, `Real 'aura' database count is completely unchanged (${initialRealCount} === ${finalRealCount})`);
    await finalRealConn.close();

    console.log('\n====================================================');
    console.log(` ALL ${testsPassed}/${totalTests} TESTS PASSED SUCCESSFULLY! `);
    console.log('====================================================');

  } finally {
    // Cleanup server and test database
    serverProcess.kill('SIGTERM');
    await wait(500);
    const cleanupConn = await mongoose.createConnection(TEST_MONGO_URI).asPromise();
    await cleanupConn.dropDatabase();
    await cleanupConn.close();
    console.log('[Cleanup] Test server terminated and aura_test database dropped.');
  }
}

runVerification()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test verification failed:', err);
    process.exit(1);
  });
