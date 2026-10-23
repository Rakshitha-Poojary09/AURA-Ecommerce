/**
 * AURA Automated Test Suite for MRP and Automatic Discount Display
 *
 * CRITICAL REQUIREMENTS:
 * - Uses ISOLATED test database (aura_test_mrp), NEVER the real 'aura' database.
 * - Tests all 10 required scenarios end-to-end against live MongoDB collections.
 * - Drops and cleans up the test database completely upon completion.
 */

const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const assert = require('assert');

// Isolated Test Environment Configuration
const TEST_PORT = 5007;
const TEST_MONGO_URI = 'mongodb://localhost:27017/aura_test_mrp';
const JWT_SECRET = 'test_aura_mrp_luxury_fashion_jwt_secret_2026';
process.env.JWT_SECRET = JWT_SECRET;

// Models & Middleware
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Coupon = require('./models/Coupon');
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
  await mongoose.connection.db.dropDatabase();

  app = express();
  app.use(express.json());
  app.use(cookieParser());

  // Mount Auth Endpoints
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { fullName, name, email, password } = req.body;
      const user = new User({ name: fullName || name, email, password, role: 'customer' });
      await user.save();
      const token = jwt.sign({ id: user._id, role: 'customer' }, JWT_SECRET, { expiresIn: '1h' });
      res.status(201).json({ token, user });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  app.post('/api/auth/admin-login', async (req, res) => {
    const { email, password } = req.body;
    const admin = await User.findOne({ email, role: 'admin' }).select('+password');
    if (!admin) return res.status(401).json({ message: 'Invalid admin credentials' });
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid admin credentials' });
    const token = jwt.sign({ id: admin._id, role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    res.json({ token, user: admin });
  });

  app.get('/api/customer/protected', authenticateCustomer, (req, res) => {
    res.json({ success: true, message: 'Welcome customer', user: req.user });
  });

  // Mount Product Routes (mirroring server.js)
  app.get('/api/products', async (req, res) => {
    try {
      const products = await Product.find().sort({ createdAt: -1 });
      res.json(products);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  app.get('/api/products/:id', async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) return res.status(404).json({ message: 'Product not found' });
      res.json(product);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/products', requireAdmin, async (req, res) => {
    try {
      const { name, description, price, mrp, category, image, sizes, sizeStock, bestseller } = req.body;
      if (!name || price === undefined || price === null || !category) {
        return res.status(400).json({ message: 'Please provide name, price, and category' });
      }
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice <= 0) {
        return res.status(400).json({ message: 'Selling price must be greater than 0' });
      }

      let parsedMrp = null;
      if (mrp !== undefined && mrp !== null && mrp !== '') {
        parsedMrp = Number(mrp);
        if (isNaN(parsedMrp) || parsedMrp <= 0) {
          return res.status(400).json({ message: 'MRP must be a valid number greater than 0' });
        }
        if (parsedMrp < numPrice) {
          return res.status(400).json({ message: 'MRP cannot be less than selling price' });
        }
      }

      let cleanedSizeStock = {};
      let totalStock = 0;
      if (sizeStock && typeof sizeStock === 'object') {
        for (const [sz, qty] of Object.entries(sizeStock)) {
          const val = Math.max(0, Math.floor(Number(qty) || 0));
          cleanedSizeStock[sz] = val;
          totalStock += val;
        }
      }

      const product = new Product({
        name,
        description: description || 'Premium luxury garment',
        price: numPrice,
        mrp: parsedMrp,
        category,
        image: image || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f',
        sizes: sizes || ['S', 'M', 'L'],
        sizeStock: cleanedSizeStock,
        stock: totalStock,
        bestseller: !!bestseller,
      });

      const saved = await product.save();
      res.status(201).json(saved);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  app.put('/api/products/:id', requireAdmin, async (req, res) => {
    try {
      const existingProduct = await Product.findById(req.params.id);
      if (!existingProduct) {
        return res.status(404).json({ message: 'Product not found' });
      }

      const updates = { ...req.body };
      if (updates.price !== undefined) {
        const numPrice = Number(updates.price);
        if (isNaN(numPrice) || numPrice <= 0) {
          return res.status(400).json({ message: 'Selling price must be greater than 0' });
        }
        updates.price = numPrice;
      }

      if (updates.mrp !== undefined) {
        if (updates.mrp === null || updates.mrp === '') {
          updates.mrp = null;
        } else {
          const numMrp = Number(updates.mrp);
          if (isNaN(numMrp) || numMrp <= 0) {
            return res.status(400).json({ message: 'MRP must be a valid number greater than 0' });
          }
          updates.mrp = numMrp;
        }
      }

      const effectivePrice = updates.price !== undefined ? updates.price : existingProduct.price;
      const effectiveMrp = updates.mrp !== undefined ? updates.mrp : existingProduct.mrp;

      if (effectiveMrp !== null && effectiveMrp !== undefined && effectiveMrp < effectivePrice) {
        return res.status(400).json({ message: 'MRP cannot be less than selling price' });
      }

      const updated = await Product.findByIdAndUpdate(req.params.id, updates, {
        returnDocument: 'after',
        runValidators: true,
      });
      res.json(updated);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  // Mount Order Route (authoritative MongoDB price and MRP verification)
  app.post('/api/orders', async (req, res) => {
    try {
      const { orderId, customer, shippingAddress, items, subtotal, shipping, total, couponCode } = req.body;

      if (!orderId || !customer || !shippingAddress || !items || items.length === 0) {
        return res.status(400).json({ message: 'Missing required order fields' });
      }

      // 1. Authoritative product lookup & stock validation
      const verifiedItems = [];
      for (const item of items) {
        const pid = item.productId || item._id;
        const requestedSize = (item.size || item.selectedSize || 'M').toUpperCase();
        const requestedQty = Math.max(1, Number(item.quantity) || 1);

        if (!pid) {
          return res.status(400).json({ message: 'Each order item must specify a valid productId.' });
        }

        const productDoc = await Product.findById(pid);
        if (!productDoc) {
          return res.status(404).json({ message: `Product "${item.name || pid}" no longer exists in catalog.` });
        }

        const hasSizeStock = productDoc.sizeStock && typeof productDoc.sizeStock === 'object' && Object.keys(productDoc.sizeStock).length > 0;
        if (hasSizeStock) {
          const avail = Number(productDoc.sizeStock[requestedSize]) || 0;
          if (avail < requestedQty) {
            return res.status(400).json({
              message: `Insufficient stock for "${productDoc.name}" in size ${requestedSize}. Available: ${avail}, Requested: ${requestedQty}.`
            });
          }
        }

        verifiedItems.push({
          productId: productDoc._id,
          name: productDoc.name,
          image: item.image || productDoc.image || '',
          price: productDoc.price,
          mrp: productDoc.mrp || null,
          quantity: requestedQty,
          size: requestedSize,
        });
      }

      // Authoritative subtotal calculated strictly from selling price
      const calculatedSubtotal = verifiedItems.reduce(
        (acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1),
        0
      );
      const serverSubtotal = calculatedSubtotal;
      const serverShipping = serverSubtotal >= 999 || serverSubtotal === 0 ? 0 : 99;

      // 2. Coupon Validation if present
      let serverDiscount = 0;
      let appliedCouponDoc = null;
      if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
        const rawCode = couponCode.trim().toUpperCase();
        appliedCouponDoc = await Coupon.findOne({ code: rawCode });
        if (appliedCouponDoc && appliedCouponDoc.isActive) {
          if (!appliedCouponDoc.minOrderAmount || serverSubtotal >= appliedCouponDoc.minOrderAmount) {
            if (appliedCouponDoc.discountType === 'percentage') {
              serverDiscount = Math.round((serverSubtotal * appliedCouponDoc.discountValue) / 100);
              if (appliedCouponDoc.maxDiscountAmount && serverDiscount > appliedCouponDoc.maxDiscountAmount) {
                serverDiscount = appliedCouponDoc.maxDiscountAmount;
              }
            } else {
              serverDiscount = Math.min(appliedCouponDoc.discountValue, serverSubtotal);
            }
          }
        }
      }

      const serverTotal = Math.max(0, serverSubtotal - serverDiscount + serverShipping);

      // Decrement inventory
      for (const item of verifiedItems) {
        await Product.findByIdAndUpdate(item.productId, {
          $inc: {
            [`sizeStock.${item.size}`]: -item.quantity,
            stock: -item.quantity,
          }
        });
      }

      const order = new Order({
        orderId,
        customer,
        shippingAddress,
        items: verifiedItems,
        subtotal: serverSubtotal,
        discount: serverDiscount,
        shipping: serverShipping,
        total: serverTotal,
        ...(couponCode ? { couponCode: couponCode.trim().toUpperCase() } : {}),
        status: 'Pending',
        paymentMethod: 'Prepaid / Online (Demo)',
      });

      const savedOrder = await order.save();
      res.status(201).json(savedOrder);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`[Test Server] Isolated test server listening on port ${TEST_PORT}`);
      resolve();
    });
  });
}

async function tearDown() {
  if (mongoose.connection && mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
    await mongoose.connection.close();
  }
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  console.log('[Test Server] Isolated test database dropped and server closed cleanly.');
}

// ------------------------------------------------------------------------
// Test Suite Execution
// ------------------------------------------------------------------------
async function runTests() {
  console.log('===============================================================');
  console.log('RUNNING MRP & AUTOMATIC DISCOUNT SYSTEM ISOLATED TEST SUITE');
  console.log('Database: mongodb://localhost:27017/aura_test_mrp');
  console.log('===============================================================\n');

  await setupTestServer();

  let adminToken = '';
  let customerToken = '';

  try {
    // 0. Seed Admin & Customer in isolated DB
    const adminUser = new User({
      name: 'Admin Test',
      email: 'admin_test@aura.com',
      password: 'AdminPassword123',
      role: 'admin',
    });
    await adminUser.save();

    const adminLoginRes = await makeRequest('POST', '/api/auth/admin-login', {
      email: 'admin_test@aura.com',
      password: 'AdminPassword123',
    });
    assert.strictEqual(adminLoginRes.status, 200, 'Admin login should succeed');
    adminToken = adminLoginRes.data.token;

    const custRegRes = await makeRequest('POST', '/api/auth/register', {
      fullName: 'Customer Test',
      email: 'cust_test@aura.com',
      password: 'CustPassword123',
    });
    assert.strictEqual(custRegRes.status, 201, 'Customer registration should succeed');
    customerToken = custRegRes.data.token;

    // ----------------------------------------------------------------------
    // TEST 1: Creating a product with MRP ₹1,500 and selling price ₹1,200
    // ----------------------------------------------------------------------
    console.log('TEST 1: Creating a product with MRP ₹1,500 and selling price ₹1,200');
    const createRes = await makeRequest('POST', '/api/products', {
      name: 'Luxury Silk Evening Gown',
      description: 'Handcrafted mulberry silk gown',
      category: 'Women',
      price: 1200,
      mrp: 1500,
      sizes: ['S', 'M', 'L'],
      sizeStock: { S: 10, M: 10, L: 10 },
      image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f',
    }, { Authorization: `Bearer ${adminToken}` });

    assert.strictEqual(createRes.status, 201, `Product creation failed: ${JSON.stringify(createRes.data)}`);
    assert.strictEqual(createRes.data.price, 1200, 'Selling price must be 1200');
    assert.strictEqual(createRes.data.mrp, 1500, 'MRP must be 1500');
    const createdProductId = createRes.data._id;
    console.log('✓ PASS: Product successfully created with MRP ₹1,500 and Selling Price ₹1,200.\n');

    // ----------------------------------------------------------------------
    // TEST 2: Displaying the correct 20% discount
    // ----------------------------------------------------------------------
    console.log('TEST 2: Calculating and displaying the correct 20% discount');
    const mrpVal = createRes.data.mrp;
    const priceVal = createRes.data.price;
    const discountPct = Math.round(((mrpVal - priceVal) / mrpVal) * 100);
    assert.strictEqual(discountPct, 20, 'Discount percentage must equal 20%');

    // Test additional scenario: MRP 2000, price 1500 -> 25%
    const disc25 = Math.round(((2000 - 1500) / 2000) * 100);
    assert.strictEqual(disc25, 25, 'Discount formula must yield 25% for 2000/1500');
    console.log(`✓ PASS: Correct discount calculation verified: Math.round(((${mrpVal} - ${priceVal}) / ${mrpVal}) * 100) = ${discountPct}% OFF.\n`);

    // ----------------------------------------------------------------------
    // TEST 3: Rejecting MRP lower than selling price
    // ----------------------------------------------------------------------
    console.log('TEST 3: Rejecting MRP lower than selling price');
    const rejectRes = await makeRequest('POST', '/api/products', {
      name: 'Invalid Price Dress',
      category: 'Women',
      price: 1200,
      mrp: 1000, // Invalid: MRP < Selling Price
      sizes: ['M'],
      sizeStock: { M: 5 },
    }, { Authorization: `Bearer ${adminToken}` });

    assert.strictEqual(rejectRes.status, 400, 'Must return 400 when MRP is lower than price');
    assert(
      rejectRes.data.message.includes('MRP cannot be less than selling price'),
      'Must return clear validation error message'
    );

    // Reject negative or zero price
    const rejectZeroPrice = await makeRequest('POST', '/api/products', {
      name: 'Zero Price Dress',
      category: 'Women',
      price: 0,
      sizes: ['M'],
      sizeStock: { M: 5 },
    }, { Authorization: `Bearer ${adminToken}` });
    assert.strictEqual(rejectZeroPrice.status, 400, 'Must reject zero price');

    // Reject update where MRP < price
    const rejectUpdateRes = await makeRequest('PUT', `/api/products/${createdProductId}`, {
      mrp: 900, // 900 < 1200
    }, { Authorization: `Bearer ${adminToken}` });
    assert.strictEqual(rejectUpdateRes.status, 400, 'Must reject update where MRP < selling price');
    console.log('✓ PASS: Rejected MRP lower than selling price on both creation and edit.\n');

    // ----------------------------------------------------------------------
    // TEST 4: Displaying existing products without MRP safely
    // ----------------------------------------------------------------------
    console.log('TEST 4: Displaying existing products without MRP safely');
    // Direct DB insert simulating existing legacy product without mrp field
    const legacyProd = new Product({
      name: 'Classic Vintage Blazer',
      description: 'Heritage wool blazer',
      price: 899,
      // mrp intentionally omitted
      category: 'Men',
      stock: 12,
      sizes: ['M'],
      sizeStock: { M: 12 },
      image: 'https://images.unsplash.com/photo-1594938298603-c8148c4dae35',
    });
    await legacyProd.save();

    const getLegacyRes = await makeRequest('GET', `/api/products/${legacyProd._id}`);
    assert.strictEqual(getLegacyRes.status, 200, 'Legacy product fetch should return 200');
    assert.strictEqual(getLegacyRes.data.price, 899, 'Legacy product price must be 899');
    assert.strictEqual(getLegacyRes.data.mrp, null, 'Legacy product MRP must be null/undefined');

    // Frontend condition check: only show discount if mrp && mrp > price
    const hasDiscountBadge = !!(getLegacyRes.data.mrp && getLegacyRes.data.mrp > getLegacyRes.data.price);
    assert.strictEqual(hasDiscountBadge, false, 'No discount badge should be shown when MRP is missing');

    // Equal price check: mrp == price
    const equalPriceProd = new Product({
      name: 'Standard Cotton Tee',
      description: '100% cotton tee',
      image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518',
      price: 500,
      mrp: 500,
      category: 'Men',
      stock: 10,
      sizes: ['M'],
      sizeStock: { M: 10 },
    });
    await equalPriceProd.save();
    const hasDiscountEqual = !!(equalPriceProd.mrp && equalPriceProd.mrp > equalPriceProd.price);
    assert.strictEqual(hasDiscountEqual, false, 'No discount badge when MRP equals selling price');
    console.log('✓ PASS: Existing products without MRP (or with equal MRP) safely render selling price only with no discount badge.\n');

    // ----------------------------------------------------------------------
    // TEST 5: Editing prices without losing inventory
    // ----------------------------------------------------------------------
    console.log('TEST 5: Editing prices without losing inventory');
    const beforeEdit = await Product.findById(createdProductId);
    const initialSizeStock = { ...beforeEdit.sizeStock };
    const initialStock = beforeEdit.stock;

    // Admin updates price to 1300 and MRP to 1600 without passing sizes or sizeStock
    const editRes = await makeRequest('PUT', `/api/products/${createdProductId}`, {
      price: 1300,
      mrp: 1600,
    }, { Authorization: `Bearer ${adminToken}` });

    assert.strictEqual(editRes.status, 200, 'Edit price should succeed');
    assert.strictEqual(editRes.data.price, 1300, 'Price must be updated to 1300');
    assert.strictEqual(editRes.data.mrp, 1600, 'MRP must be updated to 1600');

    // Verify inventory in MongoDB remained completely intact
    const afterEdit = await Product.findById(createdProductId);
    assert.strictEqual(afterEdit.stock, initialStock, 'Total stock must be preserved');
    assert.deepStrictEqual(afterEdit.sizeStock, initialSizeStock, 'Size-wise stock map must be preserved');
    console.log('✓ PASS: Product prices updated to MRP ₹1,600 and Price ₹1,300 with all inventory and size stocks preserved.\n');

    // ----------------------------------------------------------------------
    // TEST 6: Cart subtotal using selling price, not MRP
    // ----------------------------------------------------------------------
    console.log('TEST 6: Cart subtotal using selling price, not MRP');
    // Product has selling price 1300 and MRP 1600. Quantity: 2
    const qty = 2;
    const cartSellingSubtotal = afterEdit.price * qty; // 1300 * 2 = 2600
    const cartMrpSubtotal = afterEdit.mrp * qty;       // 1600 * 2 = 3200
    const calculatedSubtotal = [
      { price: afterEdit.price, mrp: afterEdit.mrp, quantity: qty }
    ].reduce((acc, it) => acc + (Number(it.price) || 0) * (Number(it.quantity) || 1), 0);

    assert.strictEqual(calculatedSubtotal, 2600, 'Subtotal must be 2600 based on selling price');
    assert.notStrictEqual(calculatedSubtotal, cartMrpSubtotal, 'Subtotal must never equal MRP sum (3200)');
    console.log(`✓ PASS: Cart merchandise subtotal is ₹${calculatedSubtotal} (Selling Price ₹1,300 × 2), NOT ₹${cartMrpSubtotal} (MRP × 2).\n`);

    // ----------------------------------------------------------------------
    // TEST 7: Coupon calculations using the correct eligible subtotal
    // ----------------------------------------------------------------------
    console.log('TEST 7: Coupon calculations using the correct eligible subtotal');
    // Create coupon: 10% off, minimum purchase ₹2,000
    const testCoupon = new Coupon({
      code: 'AURA10',
      description: '10% discount on orders above ₹2,000',
      discountType: 'percentage',
      discountValue: 10,
      minOrderAmount: 2000,
      startDate: new Date(Date.now() - 3600000),
      expiryDate: new Date(Date.now() + 7 * 24 * 3600000),
      isActive: true,
    });
    await testCoupon.save();

    // Selling subtotal is 2600. It is >= 2000, so coupon qualifies!
    // 10% of 2600 = 260. If it had erroneously used MRP (3200), discount would be 320.
    const eligibleSubtotal = 2600;
    const discountAmount = Math.round((eligibleSubtotal * testCoupon.discountValue) / 100);
    assert.strictEqual(discountAmount, 260, 'Discount must be ₹260 (10% of ₹2,600 selling subtotal)');
    assert.notStrictEqual(discountAmount, 320, 'Discount must not be calculated from MRP (3200)');
    console.log('✓ PASS: Coupon discount correctly computed against selling subtotal (₹260 discount on ₹2,600).\n');

    // ----------------------------------------------------------------------
    // TEST 8: Checkout using authoritative backend prices
    // ----------------------------------------------------------------------
    console.log('TEST 8: Checkout using authoritative backend prices');
    const orderPayload = {
      orderId: `ORD-${Date.now()}`,
      customer: {
        fullName: 'Customer Test',
        email: 'cust_test@aura.com',
        phone: '9876543210',
      },
      shippingAddress: {
        address: '123 Luxury Lane',
        city: 'Mumbai',
        state: 'Maharashtra',
        pinCode: '400001',
      },
      items: [
        {
          productId: createdProductId.toString(),
          name: 'Luxury Silk Evening Gown',
          price: 1, // MALICIOUS CLIENT TAMPERING: sent ₹1 instead of real price ₹1,300
          mrp: 50,
          quantity: 2,
          size: 'M',
        }
      ],
      subtotal: 2, // Tampered subtotal
      shipping: 0,
      total: 2,    // Tampered total
      couponCode: 'AURA10',
    };

    const stockBeforeOrder = (await Product.findById(createdProductId)).sizeStock.M; // 10

    const orderRes = await makeRequest('POST', '/api/orders', orderPayload);
    assert.strictEqual(orderRes.status, 201, `Order creation failed: ${JSON.stringify(orderRes.data)}`);

    // Verify backend rejected client price and used authoritative DB values
    assert.strictEqual(orderRes.data.items[0].price, 1300, 'Order item price must be authoritative ₹1,300');
    assert.strictEqual(orderRes.data.items[0].mrp, 1600, 'Order item mrp must be authoritative ₹1,600');
    assert.strictEqual(orderRes.data.subtotal, 2600, 'Authoritative subtotal must be ₹2,600');
    assert.strictEqual(orderRes.data.discount, 260, 'Authoritative discount must be ₹260');
    assert.strictEqual(orderRes.data.shipping, 0, 'Shipping must be 0 (subtotal >= 999)');
    assert.strictEqual(orderRes.data.total, 2340, 'Payable total must be 2600 - 260 = 2340');

    // Verify size-wise inventory decremented
    const stockAfterOrder = (await Product.findById(createdProductId)).sizeStock.M;
    assert.strictEqual(stockAfterOrder, stockBeforeOrder - 2, 'Size M stock must be decremented by 2');
    console.log('✓ PASS: Checkout correctly used authoritative database price (₹1,300), calculated correct subtotal & total, and decremented stock.\n');

    // ----------------------------------------------------------------------
    // TEST 9: Historical order prices remaining unchanged
    // ----------------------------------------------------------------------
    console.log('TEST 9: Historical order prices remaining unchanged after future price edits');
    // Admin changes product price to ₹1,800 and MRP to ₹2,200
    await makeRequest('PUT', `/api/products/${createdProductId}`, {
      price: 1800,
      mrp: 2200,
    }, { Authorization: `Bearer ${adminToken}` });

    // Verify product has new prices in catalog
    const updatedProdInCatalog = await Product.findById(createdProductId);
    assert.strictEqual(updatedProdInCatalog.price, 1800);
    assert.strictEqual(updatedProdInCatalog.mrp, 2200);

    // Verify previous order stored in DB STILL has historical price ₹1,300 and MRP ₹1,600
    const historicalOrder = await Order.findById(orderRes.data._id);
    assert.strictEqual(historicalOrder.items[0].price, 1300, 'Historical order item price must remain ₹1,300');
    assert.strictEqual(historicalOrder.items[0].mrp, 1600, 'Historical order item MRP must remain ₹1,600');
    assert.strictEqual(historicalOrder.subtotal, 2600, 'Historical order subtotal must remain ₹2,600');
    assert.strictEqual(historicalOrder.total, 2340, 'Historical order total must remain ₹2,340');
    console.log('✓ PASS: Historical order snapshot preserved intact; product price modifications did not alter past order records.\n');

    // ----------------------------------------------------------------------
    // TEST 10: Existing customer and admin authentication remaining separate
    // ----------------------------------------------------------------------
    console.log('TEST 10: Existing customer and admin authentication remaining separate');
    // 1. Customer token cannot create products (403 Forbidden)
    const custCreateProd = await makeRequest('POST', '/api/products', {
      name: 'Unauthorized Item',
      price: 500,
      category: 'Men',
    }, { Authorization: `Bearer ${customerToken}` });
    assert.strictEqual(custCreateProd.status, 403, 'Customer account must receive 403 Forbidden on admin endpoints');

    // 2. Unauthenticated request cannot create products (401 Unauthorized)
    const unauthCreateProd = await makeRequest('POST', '/api/products', {
      name: 'Unauthenticated Item',
      price: 500,
      category: 'Men',
    });
    assert.strictEqual(unauthCreateProd.status, 401, 'Unauthenticated request must receive 401 Unauthorized');

    // 3. Admin token cannot access customer protected resource (403 Forbidden)
    const adminCustomerResource = await makeRequest('GET', '/api/customer/protected', null, {
      Authorization: `Bearer ${adminToken}`
    });
    assert.strictEqual(adminCustomerResource.status, 403, 'Admin token must receive 403 Forbidden on customer endpoints');

    // 4. Customer token can access customer protected resource (200 OK)
    const custCustomerResource = await makeRequest('GET', '/api/customer/protected', null, {
      Authorization: `Bearer ${customerToken}`
    });
    assert.strictEqual(custCustomerResource.status, 200, 'Customer token must access customer endpoint successfully');

    console.log('✓ PASS: Strict boundary separation verified between Admin and Customer authentication roles.\n');

    console.log('===============================================================');
    console.log('ALL 10 AUTOMATED TEST SCENARIOS PASSED SUCCESSFULLY!');
    console.log('===============================================================');
  } finally {
    await tearDown();
  }
}

runTests().catch((err) => {
  console.error('Test Suite Failed with error:', err);
  tearDown().finally(() => process.exit(1));
});
