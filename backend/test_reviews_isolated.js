const mongoose = require("mongoose");
const express = require("express");
const cookieParser = require("cookie-parser");
const http = require("http");
const jwt = require("jsonwebtoken");
const assert = require("assert");

const User = require("./models/User");
const Product = require("./models/Product");
const Order = require("./models/Order");
const Review = require("./models/Review");
const reviewRoutes = require("./routes/reviewRoutes");

const TEST_DB_URI = "mongodb://localhost:27017/aura_test_reviews";
const JWT_SECRET = process.env.JWT_SECRET || "aura_luxury_fashion_jwt_secret_key_2026_super_secure";
const TEST_PORT = 5098;
const BASE_URL = `http://localhost:${TEST_PORT}`;

function createAuthCookie(user, role = "customer") {
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role || role },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
  const cookieName = role === "admin" ? "aura_admin_session" : "aura_customer_session";
  return `${cookieName}=${token}`;
}

async function runTestSuite() {
  console.log("==================================================================");
  console.log("AURA PRODUCT REVIEWS & RATINGS — ISOLATED TEST SUITE");
  console.log(`Database Target: ${TEST_DB_URI} (ISOLATED)`);
  console.log("==================================================================\n");

  // Step 1: Connect to isolated database & reset
  await mongoose.connect(TEST_DB_URI);
  await mongoose.connection.dropDatabase();
  console.log("✓ Connected to isolated test database and cleared test collections.\n");

  // Step 2: Set up Express test server
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api", reviewRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test Express server listening on port ${TEST_PORT}\n`);

  try {
    // Step 3: Seed users
    const customerA = await User.create({
      name: "Pooja Hegde",
      email: "pooja@example.com",
      password: "Password123!",
      role: "customer"
    });

    const customerB = await User.create({
      name: "Dev Patel",
      email: "dev@example.com",
      password: "Password123!",
      role: "customer"
    });

    const customerC = await User.create({
      name: "Sunil Grover",
      email: "sunil@example.com",
      password: "Password123!",
      role: "customer"
    });

    const customerD = await User.create({
      name: "Kavya Maran",
      email: "kavya@example.com",
      password: "Password123!",
      role: "customer"
    });

    const adminUser = await User.create({
      name: "Super Admin",
      email: "admin@aura.test",
      password: "Admin@Password123!",
      role: "admin"
    });

    const cookieA = createAuthCookie(customerA, "customer");
    const cookieB = createAuthCookie(customerB, "customer");
    const cookieC = createAuthCookie(customerC, "customer");
    const cookieD = createAuthCookie(customerD, "customer");
    const adminCookie = createAuthCookie(adminUser, "admin");

    // Step 4: Seed products
    const product1 = await Product.create({
      name: "AURA Mulberry Silk Gown",
      description: "Handcrafted pure mulberry silk evening gown",
      price: 12500,
      mrp: 18500,
      category: "Women",
      image: "/products/gown.jpg",
      sizes: ["S", "M", "L"],
      sizeStock: { S: 5, M: 5, L: 5 },
      stock: 15
    });

    const product2 = await Product.create({
      name: "AURA Cashmere Oversized Wrap",
      description: "Featherlight Grade-A Mongolian cashmere wrap",
      price: 8500,
      mrp: 11000,
      category: "Accessories",
      image: "/products/wrap.jpg",
      sizes: ["One Size"],
      sizeStock: { "One Size": 8 },
      stock: 8
    });

    // Step 5: Seed orders
    const defaultAddress = {
      address: "12 Marine Drive, Nariman Point",
      city: "Mumbai",
      state: "Maharashtra",
      pinCode: "400021"
    };

    // customerA: Delivered order with product1
    await Order.create({
      orderId: "AURA-REV-001",
      customer: {
        customerId: customerA._id,
        fullName: customerA.name,
        name: customerA.name,
        email: customerA.email,
        phone: "+919876543210"
      },
      items: [
        {
          productId: product1._id,
          name: product1.name,
          price: product1.price,
          quantity: 1,
          size: "M"
        }
      ],
      subtotal: 12500,
      total: 12500,
      shippingAddress: defaultAddress,
      status: "Delivered",
      paymentStatus: "Paid"
    });

    // customerB: Cancelled order with product1
    await Order.create({
      orderId: "AURA-REV-002",
      customer: {
        customerId: customerB._id,
        fullName: customerB.name,
        name: customerB.name,
        email: customerB.email,
        phone: "+919876543211"
      },
      items: [
        {
          productId: product1._id,
          name: product1.name,
          price: product1.price,
          quantity: 1,
          size: "S"
        }
      ],
      subtotal: 12500,
      total: 12500,
      shippingAddress: defaultAddress,
      status: "Cancelled",
      paymentStatus: "Refunded"
    });

    // customerD: Processing order with product1
    await Order.create({
      orderId: "AURA-REV-003",
      customer: {
        customerId: customerD._id,
        fullName: customerD.name,
        name: customerD.name,
        email: customerD.email,
        phone: "+919876543212"
      },
      items: [
        {
          productId: product1._id,
          name: product1.name,
          price: product1.price,
          quantity: 1,
          size: "L"
        }
      ],
      subtotal: 12500,
      total: 12500,
      shippingAddress: defaultAddress,
      status: "Processing",
      paymentStatus: "Paid"
    });

    console.log("✓ Test users, products, and verified/cancelled orders seeded successfully.\n");

    // ==================================================================
    // Test 1: Empty state on unrated product (product2)
    // ==================================================================
    console.log("Test 1: Empty review state on unrated product (product2)...");
    const res1 = await fetch(`${BASE_URL}/api/products/${product2._id}/reviews`);
    assert.strictEqual(res1.status, 200);
    const data1 = await res1.json();
    assert.strictEqual(data1.totalReviews, 0, "totalReviews must be 0");
    assert.strictEqual(data1.averageRating, 0, "averageRating must be 0");
    assert.strictEqual(data1.reviews.length, 0, "reviews array must be empty");
    assert.deepStrictEqual(data1.ratingDistribution, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    assert.strictEqual(data1.isVerifiedPurchaser, false);
    assert.strictEqual(data1.userReview, null);
    console.log("✓ Empty review state verified with zero fake counts and zero rating.\n");

    // ==================================================================
    // Test 2: Non-purchaser blocked from submitting review (customerC)
    // ==================================================================
    console.log("Test 2: Non-purchaser blocked from submitting review...");
    const res2 = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieC
      },
      body: JSON.stringify({
        rating: 5,
        title: "I wish I bought this",
        comment: "Looks great in pictures!"
      })
    });
    assert.strictEqual(res2.status, 403, "Non-purchaser must be forbidden (403)");
    const data2 = await res2.json();
    assert(data2.message.includes("Only verified purchasers"), "Must specify verified purchaser requirement");
    console.log("✓ Non-purchaser blocked with 403 Forbidden.\n");

    // ==================================================================
    // Test 3: Customer with cancelled order blocked (customerB)
    // ==================================================================
    console.log("Test 3: Customer with cancelled order blocked from submitting review...");
    const res3 = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookieB
      },
      body: JSON.stringify({
        rating: 1,
        title: "Cancelled my order",
        comment: "I never received it."
      })
    });
    assert.strictEqual(res3.status, 403, "Cancelled order must not qualify (403)");
    console.log("✓ Customer with cancelled order blocked with 403 Forbidden.\n");

    // ==================================================================
    // Test 4: Input validation tests
    // ==================================================================
    console.log("Test 4: Input validation (rating, title length, empty comments)...");
    // Invalid rating: 6
    const res4a = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ rating: 6, title: "Great", comment: "Superb" })
    });
    assert.strictEqual(res4a.status, 400, "Rating > 5 must fail with 400");

    // Invalid rating: 4.5
    const res4b = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ rating: 4.5, title: "Great", comment: "Superb" })
    });
    assert.strictEqual(res4b.status, 400, "Decimal rating must fail with 400");

    // Empty title
    const res4c = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ rating: 5, title: "   ", comment: "Superb" })
    });
    assert.strictEqual(res4c.status, 400, "Empty title must fail with 400");

    // Title too long (> 120 chars)
    const res4d = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({ rating: 5, title: "x".repeat(125), comment: "Superb" })
    });
    assert.strictEqual(res4d.status, 400, "Title > 120 chars must fail with 400");

    console.log("✓ Backend input validation rejected invalid inputs with 400.\n");

    // ==================================================================
    // Test 5: Verified purchaser (customerA) submits review
    // ==================================================================
    console.log("Test 5: Verified purchaser (customerA) submits review...");
    const res5 = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        rating: 5,
        title: "Transcendent Silk Craftsmanship",
        comment: "The drape and luster of this mulberry silk gown are utterly sublime."
      })
    });
    assert.strictEqual(res5.status, 201, "Customer A review submission must return 201");
    const data5 = await res5.json();
    assert.strictEqual(data5.review.rating, 5);
    assert.strictEqual(data5.review.status, "approved");
    const reviewAId = data5.review._id;
    console.log(`✓ Review created successfully (ID: ${reviewAId}, Status: approved).\n`);

    // ==================================================================
    // Test 6: Verified purchaser 2 (customerD) submits review
    // ==================================================================
    console.log("Test 6: Verified purchaser 2 (customerD) submits review...");
    const res6 = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieD },
      body: JSON.stringify({
        rating: 3,
        title: "Elegant silhouette, runs slightly snug",
        comment: "Fit was slightly tighter around the waist than expected, but quality is undeniable."
      })
    });
    assert.strictEqual(res6.status, 201, "Customer D review submission must return 201");
    const data6 = await res6.json();
    const reviewDId = data6.review._id;
    console.log(`✓ Second review created successfully (ID: ${reviewDId}, Status: approved).\n`);

    // ==================================================================
    // Test 7: Duplicate review blocked (one-review-per-customer rule)
    // ==================================================================
    console.log("Test 7: Duplicate review blocked for same customer on same product...");
    const res7 = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        rating: 4,
        title: "Trying again",
        comment: "Second attempt."
      })
    });
    assert.strictEqual(res7.status, 409, "Duplicate review must return 409 Conflict");
    console.log("✓ Duplicate review blocked with 409 Conflict.\n");

    // ==================================================================
    // Test 8: Public review retrieval & rating calculation
    // ==================================================================
    console.log("Test 8: Public retrieval & rating calculation (5 + 3) / 2 = 4.0...");
    const res8 = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`);
    assert.strictEqual(res8.status, 200);
    const data8 = await res8.json();
    assert.strictEqual(data8.totalReviews, 2);
    assert.strictEqual(data8.averageRating, 4.0, "Average rating must be exactly 4.0");
    assert.strictEqual(data8.ratingDistribution[5], 1);
    assert.strictEqual(data8.ratingDistribution[3], 1);
    assert.strictEqual(data8.reviews.length, 2);
    console.log("✓ Public ratings and distribution computed accurately.\n");

    // ==================================================================
    // Test 9: Customer review ownership on edit
    // ==================================================================
    console.log("Test 9: Customer ownership enforcement — customer D cannot edit customer A's review...");
    const res9 = await fetch(`${BASE_URL}/api/reviews/${reviewAId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookieD },
      body: JSON.stringify({
        title: "Malicious edit attempt"
      })
    });
    assert.strictEqual(res9.status, 403, "Editing someone else's review must return 403");
    console.log("✓ Cross-customer edit blocked with 403 Forbidden.\n");

    // ==================================================================
    // Test 10: Customer can edit their own review
    // ==================================================================
    console.log("Test 10: Customer A edits their own review (rating 5 -> 4)...");
    const res10 = await fetch(`${BASE_URL}/api/reviews/${reviewAId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookieA },
      body: JSON.stringify({
        rating: 4,
        title: "Updated: Beautiful Silk Gown",
        comment: "After wearing for a gala, still love it. Giving 4 stars for delicate dry clean requirement."
      })
    });
    assert.strictEqual(res10.status, 200, "Customer A edit must return 200 OK");
    const data10 = await res10.json();
    assert.strictEqual(data10.review.rating, 4);

    // Verify recalculation: (4 + 3) / 2 = 3.5
    const res10Verify = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`);
    const data10Verify = await res10Verify.json();
    assert.strictEqual(data10Verify.averageRating, 3.5, "New average rating must be exactly 3.5");
    console.log("✓ Customer A edited their review; public average updated to 3.5.\n");

    // ==================================================================
    // Test 11: Admin Moderation — fetch reviews and stats
    // ==================================================================
    console.log("Test 11: Admin fetches reviews & moderation stats...");
    const res11 = await fetch(`${BASE_URL}/api/admin/reviews`, {
      headers: { Cookie: adminCookie }
    });
    assert.strictEqual(res11.status, 200);
    const data11 = await res11.json();
    assert.strictEqual(data11.stats.total, 2);
    assert.strictEqual(data11.stats.approved, 2);
    assert.strictEqual(data11.stats.hidden, 0);
    assert.strictEqual(data11.stats.averageRating, 3.5);
    console.log("✓ Admin fetched real MongoDB reviews and accurate statistics.\n");

    // ==================================================================
    // Test 12: Admin hides customer A's review
    // ==================================================================
    console.log("Test 12: Admin hides review A from storefront...");
    const res12 = await fetch(`${BASE_URL}/api/admin/reviews/${reviewAId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({ status: "hidden" })
    });
    assert.strictEqual(res12.status, 200);
    const data12 = await res12.json();
    assert.strictEqual(data12.review.status, "hidden");

    // Verify admin stats reflect hidden review
    const res12Stats = await fetch(`${BASE_URL}/api/admin/reviews`, {
      headers: { Cookie: adminCookie }
    });
    const data12Stats = await res12Stats.json();
    assert.strictEqual(data12Stats.stats.total, 2);
    assert.strictEqual(data12Stats.stats.approved, 1);
    assert.strictEqual(data12Stats.stats.hidden, 1);
    assert.strictEqual(data12Stats.stats.averageRating, 3.0, "Average rating must be derived strictly from 1 approved review (rating 3)");
    console.log("✓ Review hidden; admin stats recomputed average strictly on approved reviews (3.0).\n");

    // ==================================================================
    // Test 13: Storefront immediately excludes hidden review
    // ==================================================================
    console.log("Test 13: Storefront immediately hides review and recalculates rating...");
    const res13 = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`);
    const data13 = await res13.json();
    assert.strictEqual(data13.totalReviews, 1, "Public totalReviews must now be 1");
    assert.strictEqual(data13.averageRating, 3.0, "Public averageRating must now be 3.0");
    assert.strictEqual(data13.reviews.length, 1);
    assert.strictEqual(data13.reviews[0]._id, String(reviewDId));
    assert(!data13.reviews.some((r) => r._id === String(reviewAId)), "Hidden review must NOT appear in public reviews");

    // Authenticated customer A calling storefront sees their userReview with status: hidden
    const res13CustA = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`, {
      headers: { Cookie: cookieA }
    });
    const data13CustA = await res13CustA.json();
    assert(data13CustA.userReview !== null, "Author still receives their userReview");
    assert.strictEqual(data13CustA.userReview.status, "hidden");
    assert.strictEqual(data13CustA.canReview, false, "Author cannot submit second review");
    console.log("✓ Public storefront excluded hidden review while author can view their review status.\n");

    // ==================================================================
    // Test 14: Customer ownership enforcement on delete
    // ==================================================================
    console.log("Test 14: Customer D cannot delete customer A's review...");
    const res14 = await fetch(`${BASE_URL}/api/reviews/${reviewAId}`, {
      method: "DELETE",
      headers: { Cookie: cookieD }
    });
    assert.strictEqual(res14.status, 403, "Non-owner delete must return 403");
    console.log("✓ Non-owner delete blocked with 403 Forbidden.\n");

    // ==================================================================
    // Test 15: Customer A deletes their own review
    // ==================================================================
    console.log("Test 15: Customer A deletes their own review...");
    const res15 = await fetch(`${BASE_URL}/api/reviews/${reviewAId}`, {
      method: "DELETE",
      headers: { Cookie: cookieA }
    });
    assert.strictEqual(res15.status, 200, "Owner delete must return 200 OK");

    // Verify Customer A can now submit a fresh review if they wish
    const res15CustA = await fetch(`${BASE_URL}/api/products/${product1._id}/reviews`, {
      headers: { Cookie: cookieA }
    });
    const data15CustA = await res15CustA.json();
    assert.strictEqual(data15CustA.userReview, null, "userReview is now null");
    assert.strictEqual(data15CustA.canReview, true, "Customer A can now write a review");
    console.log("✓ Customer A successfully deleted review; canReview restored to true.\n");

    // ==================================================================
    // Test 16: Admin moderation handles deleted products gracefully
    // ==================================================================
    console.log("Test 16: Admin handles deleted products gracefully...");
    await Product.findByIdAndDelete(product1._id);

    const res16 = await fetch(`${BASE_URL}/api/admin/reviews`, {
      headers: { Cookie: adminCookie }
    });
    assert.strictEqual(res16.status, 200, "Admin reviews must succeed even if product was deleted");
    const data16 = await res16.json();
    const reviewWithDeletedProd = data16.reviews.find((r) => r._id === String(reviewDId));
    assert(reviewWithDeletedProd, "Review must still exist");
    assert.strictEqual(reviewWithDeletedProd.productId, null, "Populated productId is null for deleted product");
    console.log("✓ Deleted product handled gracefully without server errors.\n");

    console.log("==================================================================");
    console.log("🎉 ALL 16 ISOLATED DATABASE REVIEWS TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================================");
  } finally {
    // Teardown
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await new Promise((resolve) => server.close(resolve));
    console.log("✓ Teardown complete: isolated database dropped, connections closed.\n");
  }
}

runTestSuite().catch((err) => {
  console.error("❌ Isolated Test Suite Failed:", err);
  process.exit(1);
});
