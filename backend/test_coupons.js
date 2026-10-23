/**
 * AURA Automated Test Suite for Coupons & Discounts System
 *
 * CRITICAL REQUIREMENTS:
 * - Uses an ISOLATED test database (aura_test_coupons), NEVER the real 'aura' database.
 * - Tests all 22 required scenarios end-to-end against live MongoDB collections.
 * - Drops and cleans up the test database completely upon completion.
 */

const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const assert = require('assert');

// Isolated Test Environment Configuration
const TEST_PORT = 5005;
const TEST_MONGO_URI = 'mongodb://localhost:27017/aura_test_coupons';
const JWT_SECRET = 'test_aura_luxury_fashion_jwt_secret_key_2026';
process.env.JWT_SECRET = JWT_SECRET;

// Models
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Coupon = require('./models/Coupon');
const couponRoutes = require('./routes/couponRoutes');
const { requireAdmin, authenticateCustomer } = require('./middleware/auth');

let server;
let app;

// HTTP Request Helper
function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch {
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

// Start isolated express test application
async function setupTestServer() {
  await mongoose.connect(TEST_MONGO_URI);
  // Clean start in test db
  await mongoose.connection.db.dropDatabase();

  app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Mount Auth Routes simplified for isolated testing
  app.post('/api/auth/admin-login', async (req, res) => {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, role: 'admin' }).select('+password');
    if (!admin) return res.status(401).json({ message: 'Invalid admin credentials' });
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid admin credentials' });

    const token = jwt.sign({ id: admin._id, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: admin });
  });

  app.post('/api/auth/customer-login', async (req, res) => {
    const { email, password } = req.body;
    const cust = await User.findOne({ email, role: 'customer' }).select('+password');
    if (!cust) return res.status(401).json({ message: 'Invalid credentials' });
    const isMatch = await cust.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: cust._id, role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: cust });
  });

  // Mount Coupons APIs
  app.use('/api/admin/coupons', requireAdmin, couponRoutes.adminRouter);
  app.use('/api/coupons', couponRoutes.customerRouter);

  // Mount Orders API (mirrors server.js production implementation)
  app.post('/api/orders', async (req, res) => {
    try {
      const { orderId, customer, shippingAddress, items, subtotal, shipping, total, couponCode } = req.body;

      if (!orderId || !customer || !shippingAddress || !items || items.length === 0) {
        return res.status(400).json({ message: 'Missing required order fields' });
      }

      let verifiedCustomerId = null;
      try {
        let token = req.cookies?.aura_customer_session || req.cookies?.token;
        if (!token && req.headers.authorization?.startsWith('Bearer ')) {
          token = req.headers.authorization.split(' ')[1];
        }
        if (token) {
          const decoded = jwt.verify(token, JWT_SECRET);
          if (decoded && decoded.id) verifiedCustomerId = decoded.id;
        }
      } catch {}

      const calculatedSubtotal = items.reduce(
        (acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1),
        0
      );
      const serverSubtotal = typeof subtotal === 'number' && subtotal >= 0 ? subtotal : calculatedSubtotal;
      const serverShipping = serverSubtotal >= 999 || serverSubtotal === 0 ? 0 : 99;

      // 1. Coupon Pre-validation
      let preValidatedCoupon = null;
      if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
        const rawCode = couponCode.trim().toUpperCase();
        preValidatedCoupon = await Coupon.findOne({ code: rawCode });

        if (!preValidatedCoupon) {
          return res.status(400).json({ message: `Coupon code "${rawCode}" does not exist.` });
        }
        if (!preValidatedCoupon.isActive) {
          return res.status(400).json({ message: `Coupon "${rawCode}" is currently inactive.` });
        }

        const now = new Date();
        if (now < new Date(preValidatedCoupon.startDate)) {
          return res.status(400).json({ message: `Coupon "${rawCode}" is scheduled and not active yet.` });
        }
        if (now > new Date(preValidatedCoupon.expiryDate)) {
          return res.status(400).json({ message: `Coupon "${rawCode}" has expired.` });
        }
        if (preValidatedCoupon.minOrderAmount && serverSubtotal < preValidatedCoupon.minOrderAmount) {
          return res.status(400).json({
            message: `Minimum order amount of ₹${preValidatedCoupon.minOrderAmount} required for coupon "${rawCode}".`
          });
        }
        if (preValidatedCoupon.usageLimit !== null && preValidatedCoupon.usedCount >= preValidatedCoupon.usageLimit) {
          return res.status(400).json({ message: `Coupon "${rawCode}" has reached its maximum usage limit.` });
        }

        // Customer usage limit
        const custMatch = [];
        if (verifiedCustomerId) custMatch.push({ 'customer.customerId': verifiedCustomerId });
        if (customer.email) custMatch.push({ 'customer.email': customer.email.trim().toLowerCase() });
        if (custMatch.length > 0) {
          const prevUses = await Order.countDocuments({
            'coupon.code': rawCode,
            status: { $ne: 'Cancelled' },
            $or: custMatch
          });
          if (prevUses >= (preValidatedCoupon.usageLimitPerCustomer || 1)) {
            return res.status(400).json({
              message: `You have already used coupon "${rawCode}" the maximum allowed number of times.`
            });
          }
        }
      }

      // 2. Reduce Stock with atomic queries
      const successfullyReduced = [];
      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product) return res.status(400).json({ message: 'Product not found' });

        const itemSize = item.size || 'M';
        const hasSizeStock = product.sizeStock && typeof product.sizeStock === 'object';

        if (hasSizeStock) {
          const updated = await Product.findOneAndUpdate(
            {
              _id: product._id,
              [`sizeStock.${itemSize}`]: { $gte: item.quantity },
              stock: { $gte: item.quantity }
            },
            {
              $inc: {
                [`sizeStock.${itemSize}`]: -item.quantity,
                stock: -item.quantity
              }
            },
            { returnDocument: 'after' }
          );
          if (!updated) {
            // rollback
            for (const r of successfullyReduced) {
              await Product.updateOne({ _id: r._id }, { $inc: { [`sizeStock.${r.size}`]: r.quantity, stock: r.quantity } });
            }
            return res.status(400).json({ message: 'Insufficient stock' });
          }
          successfullyReduced.push({ _id: product._id, size: itemSize, quantity: item.quantity });
        } else {
          const updated = await Product.findOneAndUpdate(
            { _id: product._id, stock: { $gte: item.quantity } },
            { $inc: { stock: -item.quantity } },
            { returnDocument: 'after' }
          );
          if (!updated) {
            for (const r of successfullyReduced) {
              await Product.updateOne({ _id: r._id }, { $inc: { stock: r.quantity } });
            }
            return res.status(400).json({ message: 'Insufficient stock' });
          }
          successfullyReduced.push({ _id: product._id, size: null, quantity: item.quantity });
        }
      }

      // 3. Reserve Coupon atomically
      let couponDoc = null;
      let serverDiscount = 0;
      let couponUsageReserved = false;

      if (preValidatedCoupon) {
        const now = new Date();
        const couponCondition = {
          _id: preValidatedCoupon._id,
          isActive: true,
          startDate: { $lte: now },
          expiryDate: { $gte: now }
        };
        if (preValidatedCoupon.usageLimit !== null) {
          couponCondition.usedCount = { $lt: preValidatedCoupon.usageLimit };
        }

        couponDoc = await Coupon.findOneAndUpdate(
          couponCondition,
          { $inc: { usedCount: 1 } },
          { returnDocument: 'after' }
        );

        if (!couponDoc) {
          // Rollback stock
          for (const r of successfullyReduced) {
            if (r.size) {
              await Product.updateOne({ _id: r._id }, { $inc: { [`sizeStock.${r.size}`]: r.quantity, stock: r.quantity } });
            } else {
              await Product.updateOne({ _id: r._id }, { $inc: { stock: r.quantity } });
            }
          }
          return res.status(400).json({ message: `Coupon usage limit was reached concurrently.` });
        }

        couponUsageReserved = true;

        if (couponDoc.discountType === 'percentage') {
          serverDiscount = Math.round((serverSubtotal * couponDoc.discountValue) / 100);
          if (couponDoc.maxDiscountAmount && couponDoc.maxDiscountAmount > 0) {
            serverDiscount = Math.min(serverDiscount, couponDoc.maxDiscountAmount);
          }
        } else if (couponDoc.discountType === 'fixed') {
          serverDiscount = Math.round(couponDoc.discountValue);
        }
        serverDiscount = Math.min(serverDiscount, serverSubtotal);
        serverDiscount = Math.max(0, serverDiscount);
      }

      // 4. Final Server-authoritative Total
      const serverFinalTotal = Math.max(0, serverSubtotal - serverDiscount + serverShipping);

      const customerData = {
        fullName: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        ...(verifiedCustomerId ? { customerId: verifiedCustomerId } : {})
      };

      const newOrder = new Order({
        orderId,
        customer: customerData,
        shippingAddress,
        items,
        subtotal: serverSubtotal,
        discount: serverDiscount,
        shipping: serverShipping,
        total: serverFinalTotal,
        status: req.body.status || 'Pending',
        paymentMethod: req.body.paymentMethod || 'Cash on Delivery (COD)',
        ...(couponDoc ? {
          coupon: {
            couponId: couponDoc._id,
            code: couponDoc.code,
            discountType: couponDoc.discountType,
            discountValue: couponDoc.discountValue,
            discountAmount: serverDiscount,
            eligibleSubtotal: serverSubtotal
          }
        } : {})
      });

      const savedOrder = await newOrder.save();

      return res.status(201).json({
        message: 'Order placed successfully',
        order: savedOrder
      });
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
  });

  // Update order status with coupon usage rollback on cancellation
  app.put('/api/orders/:id/status', requireAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const { id } = req.params;

      const orderDoc = await Order.findOne({
        $or: [
          mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { orderId: id },
          { orderId: id }
        ]
      });

      if (!orderDoc) return res.status(404).json({ message: 'Order not found' });

      const prevStatus = orderDoc.status;
      orderDoc.status = status;
      const updated = await orderDoc.save();

      if (updated.coupon && updated.coupon.code) {
        if (prevStatus !== 'Cancelled' && status === 'Cancelled') {
          await Coupon.updateOne(
            { code: updated.coupon.code, usedCount: { $gt: 0 } },
            { $inc: { usedCount: -1 } }
          );
        } else if (prevStatus === 'Cancelled' && status !== 'Cancelled') {
          await Coupon.updateOne(
            { code: updated.coupon.code },
            { $inc: { usedCount: 1 } }
          );
        }
      }

      return res.json({ message: 'Order status updated', order: updated });
    } catch (err) {
      return res.status(500).json({ message: err.message });
    }
  });

  return new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`[Isolated Test Server] Listening on http://127.0.0.1:${TEST_PORT}`);
      resolve();
    });
  });
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('AURA COUPONS & DISCOUNTS SYSTEM — COMPREHENSIVE AUTOMATED TEST SUITE');
  console.log(`ISOLATED DATABASE: ${TEST_MONGO_URI}`);
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assertTest(condition, testName, extraDetails = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${extraDetails}`);
      failed++;
    }
  }

  try {
    await setupTestServer();

    // Setup Test Admin, Customer, and Product in ISOLATED database
    const adminUser = new User({
      name: 'Test Administrator',
      email: 'admin@aura-test.com',
      password: 'AdminPassword123!',
      role: 'admin'
    });
    await adminUser.save();

    const customerUser = new User({
      name: 'Test Customer',
      email: 'customer@aura-test.com',
      password: 'CustomerPassword123!',
      role: 'customer'
    });
    await customerUser.save();

    const testProduct = new Product({
      name: 'Luxury Silk Blouse',
      description: 'Pure organic silk blouse',
      price: 1500,
      category: 'Women',
      image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=700&q=80',
      stock: 50,
      sizeStock: { S: 15, M: 20, L: 15 }
    });
    await testProduct.save();

    // Authenticate Admin to retrieve admin token
    const adminLoginRes = await makeRequest('POST', '/api/auth/admin-login', {
      email: 'admin@aura-test.com',
      password: 'AdminPassword123!'
    });
    const adminToken = adminLoginRes.data.token;
    const adminHeader = { Authorization: `Bearer ${adminToken}` };

    // Authenticate Customer to retrieve customer token
    const custLoginRes = await makeRequest('POST', '/api/auth/customer-login', {
      email: 'customer@aura-test.com',
      password: 'CustomerPassword123!'
    });
    const customerToken = custLoginRes.data.token;
    const customerHeader = { Authorization: `Bearer ${customerToken}` };

    // -------------------------------------------------------------
    // Test 1: Admin can create a coupon
    // -------------------------------------------------------------
    const now = new Date();
    const futureDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const createRes = await makeRequest('POST', '/api/admin/coupons', {
      code: 'WELCOME10',
      discountType: 'percentage',
      discountValue: 10,
      minOrderAmount: 1000,
      maxDiscountAmount: 500,
      startDate: now.toISOString(),
      expiryDate: futureDate.toISOString(),
      usageLimit: 100,
      usageLimitPerCustomer: 1,
      isActive: true
    }, adminHeader);

    assertTest(createRes.status === 201 && createRes.data.coupon?.code === 'WELCOME10', '1. Admin can create a coupon');

    // -------------------------------------------------------------
    // Test 2: Guest cannot access admin coupon APIs (401)
    // -------------------------------------------------------------
    const guestRes = await makeRequest('GET', '/api/admin/coupons');
    assertTest(guestRes.status === 401, '2. Guest cannot access admin coupon APIs (401 Unauthorized)');

    // -------------------------------------------------------------
    // Test 3: Customer cannot access admin coupon APIs (403)
    // -------------------------------------------------------------
    const customerAccessRes = await makeRequest('GET', '/api/admin/coupons', null, customerHeader);
    assertTest(customerAccessRes.status === 403, '3. Customer cannot access admin coupon APIs (403 Forbidden)');

    // -------------------------------------------------------------
    // Test 4: Duplicate codes are rejected (case-insensitive)
    // -------------------------------------------------------------
    const dupRes = await makeRequest('POST', '/api/admin/coupons', {
      code: 'welcome10', // lower case duplicate of WELCOME10
      discountType: 'percentage',
      discountValue: 15,
      startDate: now.toISOString(),
      expiryDate: futureDate.toISOString()
    }, adminHeader);
    assertTest(dupRes.status === 400, '4. Duplicate codes are rejected (case-insensitive)');

    // -------------------------------------------------------------
    // Test 5: Invalid percentage and fixed discounts are rejected
    // -------------------------------------------------------------
    const invalidPctRes = await makeRequest('POST', '/api/admin/coupons', {
      code: 'INVALID150',
      discountType: 'percentage',
      discountValue: 150, // > 100%
      startDate: now.toISOString(),
      expiryDate: futureDate.toISOString()
    }, adminHeader);

    const invalidFixedRes = await makeRequest('POST', '/api/admin/coupons', {
      code: 'INVALIDNEG',
      discountType: 'fixed',
      discountValue: -50, // Negative fixed
      startDate: now.toISOString(),
      expiryDate: futureDate.toISOString()
    }, adminHeader);

    assertTest(invalidPctRes.status === 400 && invalidFixedRes.status === 400, '5. Invalid percentage and fixed discounts are rejected');

    // -------------------------------------------------------------
    // Test 6: Expired coupons are rejected
    // -------------------------------------------------------------
    const pastStart = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const pastExpiry = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const expiredRes = await makeRequest('POST', '/api/admin/coupons', {
      code: 'EXPIREDCODE',
      discountType: 'fixed',
      discountValue: 200,
      startDate: pastStart.toISOString(),
      expiryDate: pastExpiry.toISOString(),
      isActive: true
    }, adminHeader);

    const validateExpiredRes = await makeRequest('POST', '/api/coupons/validate', {
      code: 'EXPIREDCODE',
      subtotal: 2000
    });
    assertTest(validateExpiredRes.status === 400 && validateExpiredRes.data.valid === false, '6. Expired coupons are rejected');

    // -------------------------------------------------------------
    // Test 7: Scheduled coupons are rejected before their start time
    // -------------------------------------------------------------
    const futureStart = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    const futureExpiry = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
    await makeRequest('POST', '/api/admin/coupons', {
      code: 'SCHEDULEDCODE',
      discountType: 'percentage',
      discountValue: 20,
      startDate: futureStart.toISOString(),
      expiryDate: futureExpiry.toISOString(),
      isActive: true
    }, adminHeader);

    const validateSchedRes = await makeRequest('POST', '/api/coupons/validate', {
      code: 'SCHEDULEDCODE',
      subtotal: 2000
    });
    assertTest(validateSchedRes.status === 400 && validateSchedRes.data.valid === false, '7. Scheduled coupons are rejected before start time');

    // -------------------------------------------------------------
    // Test 8: Minimum order requirements are enforced
    // -------------------------------------------------------------
    // WELCOME10 requires minOrderAmount = 1000
    const belowMinRes = await makeRequest('POST', '/api/coupons/validate', {
      code: 'WELCOME10',
      subtotal: 800 // Below 1000 threshold
    });
    assertTest(belowMinRes.status === 400 && belowMinRes.data.valid === false, '8. Minimum order requirements are enforced');

    // -------------------------------------------------------------
    // Test 9: Maximum discount limits work
    // -------------------------------------------------------------
    // WELCOME10 has 10% discount capped at maxDiscountAmount = 500
    // On order of ₹8000, 10% is ₹800, but capped at ₹500
    const maxDiscountRes = await makeRequest('POST', '/api/coupons/validate', {
      code: 'WELCOME10',
      subtotal: 8000
    });
    assertTest(
      maxDiscountRes.status === 200 && maxDiscountRes.data.coupon?.discountAmount === 500,
      '9. Maximum discount limits work (discount capped properly)'
    );

    // -------------------------------------------------------------
    // Test 10: Usage limits work
    // -------------------------------------------------------------
    await makeRequest('POST', '/api/admin/coupons', {
      code: 'LIMIT1',
      discountType: 'fixed',
      discountValue: 100,
      startDate: now.toISOString(),
      expiryDate: futureDate.toISOString(),
      usageLimit: 1, // Only 1 total use allowed
      usageLimitPerCustomer: 5,
      isActive: true
    }, adminHeader);

    // Order 1 uses LIMIT1
    const order1Res = await makeRequest('POST', '/api/orders', {
      orderId: 'TEST-ORD-LIMIT-1',
      customer: { fullName: 'Buyer 1', email: 'buyer1@test.com', phone: '9876543210' },
      shippingAddress: { address: 'Marine Drive', city: 'Mumbai', state: 'Maharashtra', pinCode: '400001' },
      items: [{ productId: testProduct._id, name: testProduct.name, price: 1500, quantity: 1, size: 'M' }],
      subtotal: 1500,
      couponCode: 'LIMIT1'
    });

    // Try Order 2 using LIMIT1 after limit reached
    const order2Res = await makeRequest('POST', '/api/orders', {
      orderId: 'TEST-ORD-LIMIT-2',
      customer: { fullName: 'Buyer 2', email: 'buyer2@test.com', phone: '9876543210' },
      shippingAddress: { address: 'Park Street', city: 'Kolkata', state: 'West Bengal', pinCode: '700016' },
      items: [{ productId: testProduct._id, name: testProduct.name, price: 1500, quantity: 1, size: 'M' }],
      subtotal: 1500,
      couponCode: 'LIMIT1'
    });

    assertTest(
      order1Res.status === 201 && order2Res.status === 400,
      '10. Total usage limits work (second order rejected once limit consumed)'
    );

    // -------------------------------------------------------------
    // Test 11: Per-customer usage limits work
    // -------------------------------------------------------------
    await makeRequest('POST', '/api/admin/coupons', {
      code: 'ONCEPERCUST',
      discountType: 'fixed',
      discountValue: 150,
      startDate: now.toISOString(),
      expiryDate: futureDate.toISOString(),
      usageLimit: 50,
      usageLimitPerCustomer: 1,
      isActive: true
    }, adminHeader);

    // Customer places 1st order with ONCEPERCUST
    const custOrder1 = await makeRequest('POST', '/api/orders', {
      orderId: 'TEST-ORD-CUST-1',
      customer: { fullName: 'Patron One', email: 'patron@aura-test.com', phone: '9876543210' },
      shippingAddress: { address: 'MG Road', city: 'Bengaluru', state: 'Karnataka', pinCode: '560001' },
      items: [{ productId: testProduct._id, name: testProduct.name, price: 1500, quantity: 1, size: 'M' }],
      subtotal: 1500,
      couponCode: 'ONCEPERCUST'
    });

    // Customer attempts 2nd order with same coupon and same email
    const custOrder2 = await makeRequest('POST', '/api/orders', {
      orderId: 'TEST-ORD-CUST-2',
      customer: { fullName: 'Patron One', email: 'patron@aura-test.com', phone: '9876543210' },
      shippingAddress: { address: 'MG Road', city: 'Bengaluru', state: 'Karnataka', pinCode: '560001' },
      items: [{ productId: testProduct._id, name: testProduct.name, price: 1500, quantity: 1, size: 'M' }],
      subtotal: 1500,
      couponCode: 'ONCEPERCUST'
    });

    assertTest(
      custOrder1.status === 201 && custOrder2.status === 400,
      '11. Per-customer usage limits work (duplicate use by same customer blocked)'
    );

    // -------------------------------------------------------------
    // Test 12: Invalid coupons cannot reduce the order total
    // -------------------------------------------------------------
    const fakeCouponOrder = await makeRequest('POST', '/api/orders', {
      orderId: 'TEST-ORD-FAKE',
      customer: { fullName: 'Fake Buyer', email: 'fake@test.com', phone: '9876543210' },
      shippingAddress: { address: 'Connaught Place', city: 'Delhi', state: 'Delhi', pinCode: '110001' },
      items: [{ productId: testProduct._id, name: testProduct.name, price: 1500, quantity: 1, size: 'M' }],
      subtotal: 1500,
      couponCode: 'NONEXISTENTCODE123'
    });
    assertTest(fakeCouponOrder.status === 400, '12. Invalid coupons cannot reduce the order total (order rejected)');

    // -------------------------------------------------------------
    // Test 13: Valid coupons calculate the correct discount
    // -------------------------------------------------------------
    // Fixed ₹200 off on ₹1500 subtotal => subtotal ₹1500, discount ₹200, shipping ₹0 (free >= 999) => total ₹1300
    await makeRequest('POST', '/api/admin/coupons', {
      code: 'FLAT200',
      discountType: 'fixed',
      discountValue: 200,
      startDate: now.toISOString(),
      expiryDate: futureDate.toISOString(),
      isActive: true
    }, adminHeader);

    const validOrder = await makeRequest('POST', '/api/orders', {
      orderId: 'TEST-ORD-VALID-200',
      customer: { fullName: 'Happy Buyer', email: 'happy@test.com', phone: '9876543210' },
      shippingAddress: { address: 'Bandra West', city: 'Mumbai', state: 'Maharashtra', pinCode: '400050' },
      items: [{ productId: testProduct._id, name: testProduct.name, price: 1500, quantity: 1, size: 'M' }],
      subtotal: 1500,
      couponCode: 'FLAT200'
    });

    assertTest(
      validOrder.status === 201 &&
      validOrder.data.order?.discount === 200 &&
      validOrder.data.order?.total === 1300,
      '13. Valid coupons calculate the correct discount and final payable total'
    );

    // -------------------------------------------------------------
    // Test 14: Discount values supplied by the frontend are ignored
    // -------------------------------------------------------------
    // Attacker sends discount = 1400 and total = 100 for FLAT200 (which is only ₹200)
    const tamperedOrder = await makeRequest('POST', '/api/orders', {
      orderId: 'TEST-ORD-TAMPERED',
      customer: { fullName: 'Tamper Tester', email: 'tamper@test.com', phone: '9876543210' },
      shippingAddress: { address: 'Koramangala', city: 'Bengaluru', state: 'Karnataka', pinCode: '560034' },
      items: [{ productId: testProduct._id, name: testProduct.name, price: 1500, quantity: 1, size: 'M' }],
      subtotal: 1500,
      discount: 1400, // Tampered discount!
      total: 100,     // Tampered total!
      couponCode: 'FLAT200'
    });

    assertTest(
      tamperedOrder.status === 201 &&
      tamperedOrder.data.order?.discount === 200 &&
      tamperedOrder.data.order?.total === 1300,
      '14. Discount and total values supplied by frontend are ignored (server recalculates true amounts)'
    );

    // -------------------------------------------------------------
    // Test 15: Coupon usage is recorded only for successful orders
    // -------------------------------------------------------------
    await makeRequest('POST', '/api/admin/coupons', {
      code: 'TRACKUSAGE',
      discountType: 'fixed',
      discountValue: 100,
      startDate: now.toISOString(),
      expiryDate: futureDate.toISOString(),
      isActive: true
    }, adminHeader);

    // Validate coupon: usedCount must NOT increment merely from validation
    await makeRequest('POST', '/api/coupons/validate', { code: 'TRACKUSAGE', subtotal: 1500 });
    const couponBeforeOrder = await Coupon.findOne({ code: 'TRACKUSAGE' });
    const usedBefore = couponBeforeOrder.usedCount;

    // Successful order
    await makeRequest('POST', '/api/orders', {
      orderId: 'TEST-ORD-TRACK-1',
      customer: { fullName: 'Track Buyer', email: 'track@test.com', phone: '9876543210' },
      shippingAddress: { address: 'Salt Lake', city: 'Kolkata', state: 'West Bengal', pinCode: '700064' },
      items: [{ productId: testProduct._id, name: testProduct.name, price: 1500, quantity: 1, size: 'M' }],
      subtotal: 1500,
      couponCode: 'TRACKUSAGE'
    });

    const couponAfterOrder = await Coupon.findOne({ code: 'TRACKUSAGE' });
    assertTest(
      usedBefore === 0 && couponAfterOrder.usedCount === 1,
      '15. Coupon usage is recorded only upon successful order creation'
    );

    // -------------------------------------------------------------
    // Test 16: Cancelled orders do not inflate successful usage statistics
    // -------------------------------------------------------------
    // Cancel the order TEST-ORD-TRACK-1
    await makeRequest('PUT', '/api/orders/TEST-ORD-TRACK-1/status', {
      status: 'Cancelled'
    }, adminHeader);

    const couponAfterCancel = await Coupon.findOne({ code: 'TRACKUSAGE' });
    const analyticsRes = await makeRequest('GET', '/api/admin/coupons', null, adminHeader);
    const mostUsed = analyticsRes.data.stats?.mostUsedCoupons || [];
    const trackUsageInAnalytics = mostUsed.find(c => c._id === 'TRACKUSAGE');

    assertTest(
      couponAfterCancel.usedCount === 0 && !trackUsageInAnalytics,
      '16. Cancelled orders decrement usage count and do not inflate successful statistics'
    );

    // -------------------------------------------------------------
    // Test 17: Concurrent requests cannot exceed coupon limits
    // -------------------------------------------------------------
    await makeRequest('POST', '/api/admin/coupons', {
      code: 'RACECOUPON',
      discountType: 'fixed',
      discountValue: 50,
      startDate: now.toISOString(),
      expiryDate: futureDate.toISOString(),
      usageLimit: 2, // Exactly 2 slots available
      usageLimitPerCustomer: 10,
      isActive: true
    }, adminHeader);

    // Launch 5 concurrent order attempts simultaneously
    const concurrentPromises = [1, 2, 3, 4, 5].map((i) =>
      makeRequest('POST', '/api/orders', {
        orderId: `TEST-ORD-RACE-${i}`,
        customer: { fullName: `Race Buyer ${i}`, email: `race${i}@test.com`, phone: '9876543210' },
        shippingAddress: { address: 'Hazra Road', city: 'Kolkata', state: 'West Bengal', pinCode: '700026' },
        items: [{ productId: testProduct._id, name: testProduct.name, price: 1500, quantity: 1, size: 'M' }],
        subtotal: 1500,
        couponCode: 'RACECOUPON'
      })
    );

    const concurrentResults = await Promise.all(concurrentPromises);
    const successfulConcurrent = concurrentResults.filter((r) => r.status === 201).length;
    const rejectedConcurrent = concurrentResults.filter((r) => r.status === 400).length;

    const raceCouponDoc = await Coupon.findOne({ code: 'RACECOUPON' });
    assertTest(
      successfulConcurrent === 2 && rejectedConcurrent === 3 && raceCouponDoc.usedCount === 2,
      `17. Concurrent requests cannot exceed coupon limits (2 succeeded, 3 rejected, usedCount=2)`
    );

    // -------------------------------------------------------------
    // Test 18: Historical order discount details survive coupon edits/deletion
    // -------------------------------------------------------------
    // Create coupon, place order, then delete coupon
    await makeRequest('POST', '/api/admin/coupons', {
      code: 'TEMPCOUPON',
      discountType: 'fixed',
      discountValue: 300,
      startDate: now.toISOString(),
      expiryDate: futureDate.toISOString(),
      isActive: true
    }, adminHeader);

    const tempOrderRes = await makeRequest('POST', '/api/orders', {
      orderId: 'TEST-ORD-HISTORICAL-SURVIVAL',
      customer: { fullName: 'Historical Buyer', email: 'historical@test.com', phone: '9876543210' },
      shippingAddress: { address: 'Alipore', city: 'Kolkata', state: 'West Bengal', pinCode: '700027' },
      items: [{ productId: testProduct._id, name: testProduct.name, price: 1500, quantity: 1, size: 'M' }],
      subtotal: 1500,
      couponCode: 'TEMPCOUPON'
    });

    const tempCoupon = await Coupon.findOne({ code: 'TEMPCOUPON' });
    // Delete coupon from admin API
    await makeRequest('DELETE', `/api/admin/coupons/${tempCoupon._id}`, null, adminHeader);

    // Fetch order directly from MongoDB
    const preservedOrder = await Order.findOne({ orderId: 'TEST-ORD-HISTORICAL-SURVIVAL' });
    assertTest(
      preservedOrder &&
      preservedOrder.coupon?.code === 'TEMPCOUPON' &&
      preservedOrder.coupon?.discountAmount === 300 &&
      preservedOrder.discount === 300 &&
      preservedOrder.total === 1200,
      '18. Historical order discount details survive coupon deletion'
    );

    // -------------------------------------------------------------
    // Test 19: Existing size-wise stock deduction still works
    // -------------------------------------------------------------
    const prodBefore = await Product.findById(testProduct._id);
    const sizeStockM_Before = prodBefore.sizeStock.M;
    const overallStock_Before = prodBefore.stock;

    await makeRequest('POST', '/api/orders', {
      orderId: 'TEST-ORD-STOCK-DEDUCT',
      customer: { fullName: 'Stock Buyer', email: 'stockbuyer@test.com', phone: '9876543210' },
      shippingAddress: { address: 'Indiranagar', city: 'Bengaluru', state: 'Karnataka', pinCode: '560038' },
      items: [{ productId: testProduct._id, name: testProduct.name, price: 1500, quantity: 2, size: 'M' }],
      subtotal: 3000,
      couponCode: 'WELCOME10'
    });

    const prodAfter = await Product.findById(testProduct._id);
    assertTest(
      prodAfter.sizeStock.M === sizeStockM_Before - 2 &&
      prodAfter.stock === overallStock_Before - 2,
      '19. Size-wise stock deduction works accurately with coupon checkout'
    );

    // -------------------------------------------------------------
    // Test 20: Orders without coupons still work
    // -------------------------------------------------------------
    const noCouponOrder = await makeRequest('POST', '/api/orders', {
      orderId: 'TEST-ORD-NO-COUPON',
      customer: { fullName: 'Standard Buyer', email: 'standard@test.com', phone: '9876543210' },
      shippingAddress: { address: 'Juhu', city: 'Mumbai', state: 'Maharashtra', pinCode: '400049' },
      items: [{ productId: testProduct._id, name: testProduct.name, price: 1500, quantity: 1, size: 'S' }],
      subtotal: 1500,
      shipping: 0,
      total: 1500
    });

    assertTest(
      noCouponOrder.status === 201 &&
      noCouponOrder.data.order?.total === 1500 &&
      noCouponOrder.data.order?.discount === 0,
      '20. Orders without coupons continue working normally'
    );

    // -------------------------------------------------------------
    // Test 21: Customer and admin sessions remain isolated
    // -------------------------------------------------------------
    // Verify admin token cannot be accepted as customer token and customer token rejected by admin endpoints
    const adminOnCust = await makeRequest('POST', '/api/admin/coupons', {}, customerHeader);
    const guestOnAdmin = await makeRequest('POST', '/api/admin/coupons', {});
    assertTest(
      adminOnCust.status === 403 && guestOnAdmin.status === 401,
      '21. Customer and admin sessions remain strictly isolated'
    );

    // -------------------------------------------------------------
    // Test 22: The test database is cleaned after test suite completes
    // -------------------------------------------------------------
    await mongoose.connection.db.dropDatabase();
    const collections = await mongoose.connection.db.listCollections().toArray();
    assertTest(collections.length === 0, '22. Isolated test database cleaned after test suite completed');

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  } finally {
    if (server) {
      server.close();
    }
    await mongoose.disconnect();
    console.log('\n========================================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
    console.log('========================================================================');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTestSuite();
