const assert = require("assert");

const BACKEND_URL = "http://localhost:5000";

function parseCookie(setCookieHeader, cookieName) {
  if (!setCookieHeader) return null;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const c of cookies) {
    const match = c.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

async function runReviewTests() {
  console.log("==================================================================");
  console.log("AURA PRODUCT REVIEWS & RATINGS SYSTEM COMPREHENSIVE TEST SUITE");
  console.log("==================================================================\n");

  const timestamp = Date.now();
  const cust1Email = `reviewer_one_${timestamp}@aura.com`;
  const cust2Email = `reviewer_two_${timestamp}@aura.com`;
  const cust3Email = `reviewer_three_${timestamp}@aura.com`;

  try {

  // Step 0: Get available products
  console.log("Setup: Fetching a test product from catalog...");
  const prodsRes = await fetch(`${BACKEND_URL}/api/products`);
  assert.strictEqual(prodsRes.status, 200, "Must fetch products");
  const products = await prodsRes.json();
  assert(products.length >= 2, "Must have at least 2 products in DB");
  const targetProduct = products.find(p => p.stock > 5 && p.sizeStock && Object.values(p.sizeStock).some(q => Number(q) > 2)) || products[0];
  const secondProduct = products.find(p => p._id.toString() !== targetProduct._id.toString()) || products[1];
  const targetProductId = targetProduct._id;
  const secondProductId = secondProduct._id;
  const targetSize = Object.entries(targetProduct.sizeStock || {}).find(([sz, qty]) => Number(qty) > 1)?.[0] || "M";
  console.log(`✓ Target Product selected: "${targetProduct.name}" (ID: ${targetProductId}, Stock: ${targetProduct.stock}, Size: ${targetSize})`);
  console.log(`✓ Second Product selected: "${secondProduct.name}" (ID: ${secondProductId})\n`);

  // Step 0b: Register Customer 1 (Purchaser)
  const reg1Res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Kavita Verma",
      email: cust1Email,
      password: "Password123!",
      confirmPassword: "Password123!"
    })
  });
  assert.strictEqual(reg1Res.status, 201, "Customer 1 registration must succeed");
  const cust1Cookie = `aura_customer_session=${parseCookie(reg1Res.headers.get("set-cookie"), "aura_customer_session")}`;

  // Step 0c: Register Customer 2 (Non-Purchaser / Other Customer)
  const reg2Res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Arjun Kapoor",
      email: cust2Email,
      password: "Password123!",
      confirmPassword: "Password123!"
    })
  });
  assert.strictEqual(reg2Res.status, 201, "Customer 2 registration must succeed");
  const cust2Cookie = `aura_customer_session=${parseCookie(reg2Res.headers.get("set-cookie"), "aura_customer_session")}`;

  // Step 0d: Register Customer 3 (Cancelled Order Customer)
  const reg3Res = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Meera Nair",
      email: cust3Email,
      password: "Password123!",
      confirmPassword: "Password123!"
    })
  });
  assert.strictEqual(reg3Res.status, 201, "Customer 3 registration must succeed");
  const cust3Cookie = `aura_customer_session=${parseCookie(reg3Res.headers.get("set-cookie"), "aura_customer_session")}`;

  // ------------------------------------------------------------------
  // Test 1: Guest can read reviews
  // ------------------------------------------------------------------
  console.log("Test 1: Guest can read reviews from GET /api/products/:productId/reviews");
  const guestReadRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`);
  assert.strictEqual(guestReadRes.status, 200, "Guest read must return 200 OK");
  const guestReadData = await guestReadRes.json();
  assert(Array.isArray(guestReadData.reviews), "Response must include reviews array");
  assert.strictEqual(typeof guestReadData.averageRating, "number", "Response must include averageRating number");
  assert.strictEqual(typeof guestReadData.totalReviews, "number", "Response must include totalReviews number");
  assert(guestReadData.ratingDistribution, "Response must include ratingDistribution");
  assert.strictEqual(guestReadData.isVerifiedPurchaser, false, "Guest is not verified purchaser");
  assert.strictEqual(guestReadData.userReview, null, "Guest has no user review");
  assert.strictEqual(guestReadData.canReview, false, "Guest cannot submit reviews");
  console.log("✓ Guest successfully read reviews without authentication.\n");

  // ------------------------------------------------------------------
  // Test 2: Guest cannot create review (401 Unauthorized)
  // ------------------------------------------------------------------
  console.log("Test 2: Guest cannot create review (Blocked with 401 Unauthorized)");
  const guestCreateRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      rating: 5,
      title: "Great product",
      comment: "Unauthenticated guest comment."
    })
  });
  assert.strictEqual(guestCreateRes.status, 401, "Unauthenticated request must return 401");
  console.log("✓ Guest review submission blocked with 401 Unauthorized.\n");

  // ------------------------------------------------------------------
  // Test 4: Customer who did NOT purchase product cannot review (403 Forbidden)
  // ------------------------------------------------------------------
  console.log("Test 4: Customer who did not purchase product cannot review (403 Forbidden)");
  const unpurchasedReviewRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cust2Cookie
    },
    body: JSON.stringify({
      rating: 5,
      title: "Looks lovely",
      comment: "I have not bought this yet but love the photos."
    })
  });
  assert.strictEqual(unpurchasedReviewRes.status, 403, "Non-purchaser must be rejected with 403 Forbidden");
  const unpurchasedErr = await unpurchasedReviewRes.json();
  assert(unpurchasedErr.message.includes("verified purchasers"), "Error message must specify verified purchaser requirement");
  console.log(`✓ Non-purchaser rejected with 403: "${unpurchasedErr.message}".\n`);

  // ------------------------------------------------------------------
  // Test 5: Cancelled order does NOT qualify as verified purchase
  // ------------------------------------------------------------------
  console.log("Test 5: Cancelled order does NOT qualify as verified purchase");
  // Place an order for Customer 3, but with status: "Cancelled"
  const cancelledOrderRes = await fetch(`${BACKEND_URL}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cust3Cookie
    },
    body: JSON.stringify({
      orderId: `AUR-CNCL-${timestamp}`,
      customer: {
        fullName: "Meera Nair",
        email: cust3Email,
        phone: "9876543210"
      },
      shippingAddress: {
        address: "77 Heritage Court",
        city: "Bengaluru",
        state: "Karnataka",
        pinCode: "560001"
      },
      items: [{
        productId: targetProductId,
        name: targetProduct.name,
        price: targetProduct.price,
        quantity: 1,
        selectedSize: targetSize,
        size: targetSize
      }],
      subtotal: targetProduct.price,
      shipping: 0,
      total: targetProduct.price,
      status: "Cancelled" // Explicitly Cancelled order
    })
  });
  assert.strictEqual(cancelledOrderRes.status, 201, "Cancelled order test fixture created");

  const cancelledCustReviewRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cust3Cookie
    },
    body: JSON.stringify({
      rating: 4,
      title: "Cancelled order review",
      comment: "My order was cancelled so I should not be able to review."
    })
  });
  assert.strictEqual(cancelledCustReviewRes.status, 403, "Customer with only cancelled orders must return 403");
  console.log("✓ Customer with only cancelled orders correctly blocked with 403 Forbidden.\n");

  // ------------------------------------------------------------------
  // Test 3: Logged-in customer who purchased product CAN review
  // ------------------------------------------------------------------
  console.log("Test 3: Logged-in customer who purchased product can review (201 Created)");
  // Place valid order for Customer 1
  const validOrderRes = await fetch(`${BACKEND_URL}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cust1Cookie
    },
    body: JSON.stringify({
      orderId: `AUR-PURCH-${timestamp}`,
      customer: {
        fullName: "Kavita Verma",
        email: cust1Email,
        phone: "9876543211"
      },
      shippingAddress: {
        address: "12 Marine Vista",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400021"
      },
      items: [{
        productId: targetProductId,
        name: targetProduct.name,
        price: targetProduct.price,
        quantity: 1,
        selectedSize: targetSize,
        size: targetSize
      }],
      subtotal: targetProduct.price,
      shipping: 0,
      total: targetProduct.price,
      status: "Delivered" // Valid fulfilled order
    })
  });
  assert.strictEqual(validOrderRes.status, 201, "Purchaser order must succeed");

  // Customer 1 checks review eligibility on targetProduct
  const checkEligibilityRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`, {
    headers: { Cookie: cust1Cookie }
  });
  assert.strictEqual(checkEligibilityRes.status, 200, "Eligibility check must return 200 OK");
  const eligibilityData = await checkEligibilityRes.json();
  assert.strictEqual(eligibilityData.isVerifiedPurchaser, true, "Customer who purchased must be verified purchaser");
  assert.strictEqual(eligibilityData.canReview, true, "Customer who purchased and has not reviewed can review");

  // Customer 1 reviews targetProduct
  const validReviewRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cust1Cookie
    },
    body: JSON.stringify({
      rating: 5,
      title: "Exquisite craftsmanship & fit!",
      comment: "The linen drape is breathtaking. Unrivalled luxury and breathable elegance."
    })
  });
  assert.strictEqual(validReviewRes.status, 201, "Verified purchaser review must return 201 Created");
  const reviewData = await validReviewRes.json();
  assert(reviewData.review, "Response must contain saved review");
  assert.strictEqual(reviewData.review.rating, 5);
  assert.strictEqual(reviewData.review.customerName, "Kavita Verma");
  assert.strictEqual(reviewData.review.title, "Exquisite craftsmanship & fit!");
  const reviewId1 = reviewData.review._id;
  console.log(`✓ Verified purchaser successfully submitted review (Review ID: ${reviewId1}, Rating: 5 stars).\n`);

  // ------------------------------------------------------------------
  // Test 6: Customer cannot create duplicate review (409 Conflict)
  // ------------------------------------------------------------------
  console.log("Test 6: Customer cannot create duplicate review for the same product (409 Conflict)");
  const duplicateReviewRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: cust1Cookie
    },
    body: JSON.stringify({
      rating: 4,
      title: "Trying to submit second review",
      comment: "Should be rejected because I already reviewed this garment."
    })
  });
  assert.strictEqual(duplicateReviewRes.status, 409, "Duplicate review must return 409 Conflict");
  const dupErr = await duplicateReviewRes.json();
  assert(dupErr.message.includes("already reviewed"), "Error message must state already reviewed");
  console.log(`✓ Duplicate review prevented: "${dupErr.message}".\n`);

  // ------------------------------------------------------------------
  // Test 7: Customer can edit own review (PUT /api/reviews/:reviewId)
  // ------------------------------------------------------------------
  console.log("Test 7: Customer can edit own review (PUT /api/reviews/:reviewId)");
  const editReviewRes = await fetch(`${BACKEND_URL}/api/reviews/${reviewId1}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cust1Cookie
    },
    body: JSON.stringify({
      rating: 4,
      title: "Updated: Beautiful linen garment",
      comment: "Wore it multiple times now and fabric holds up wonderfully."
    })
  });
  assert.strictEqual(editReviewRes.status, 200, "Review edit must return 200 OK");
  const editData = await editReviewRes.json();
  assert.strictEqual(editData.review.rating, 4, "Rating updated to 4");
  assert.strictEqual(editData.review.title, "Updated: Beautiful linen garment");
  console.log("✓ Customer 1 successfully edited own review (Rating updated to 4 stars).\n");

  // ------------------------------------------------------------------
  // Test 8: Customer cannot edit another customer's review (403 Forbidden)
  // ------------------------------------------------------------------
  console.log("Test 8: Customer cannot edit another customer's review (403 Forbidden)");
  const hackEditRes = await fetch(`${BACKEND_URL}/api/reviews/${reviewId1}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cust2Cookie // Customer 2 attempts to edit Customer 1's review
    },
    body: JSON.stringify({
      rating: 1,
      title: "Hacked title",
      comment: "Attempting unauthorized edit."
    })
  });
  assert.strictEqual(hackEditRes.status, 403, "Editing someone else's review must return 403 Forbidden");
  console.log("✓ Unauthorized edit attempt blocked with 403 Forbidden.\n");

  // ------------------------------------------------------------------
  // Test 10: Customer cannot delete another customer's review (403 Forbidden)
  // ------------------------------------------------------------------
  console.log("Test 10: Customer cannot delete another customer's review (403 Forbidden)");
  const hackDeleteRes = await fetch(`${BACKEND_URL}/api/reviews/${reviewId1}`, {
    method: "DELETE",
    headers: { Cookie: cust2Cookie } // Customer 2 attempts to delete Customer 1's review
  });
  assert.strictEqual(hackDeleteRes.status, 403, "Deleting someone else's review must return 403 Forbidden");
  console.log("✓ Unauthorized delete attempt blocked with 403 Forbidden.\n");

  // ------------------------------------------------------------------
  // Test 11: Rating validation works (must be integer 1 to 5)
  // ------------------------------------------------------------------
  console.log("Test 11: Rating validation works (bounds and types)");
  // Rating = 0
  const zeroRatingRes = await fetch(`${BACKEND_URL}/api/reviews/${reviewId1}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cust1Cookie },
    body: JSON.stringify({ rating: 0 })
  });
  assert.strictEqual(zeroRatingRes.status, 400, "Rating 0 must return 400 Bad Request");

  // Rating = 6
  const sixRatingRes = await fetch(`${BACKEND_URL}/api/reviews/${reviewId1}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cust1Cookie },
    body: JSON.stringify({ rating: 6 })
  });
  assert.strictEqual(sixRatingRes.status, 400, "Rating 6 must return 400 Bad Request");

  // Rating = 3.5 (non-integer)
  const floatRatingRes = await fetch(`${BACKEND_URL}/api/reviews/${reviewId1}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cust1Cookie },
    body: JSON.stringify({ rating: 3.5 })
  });
  assert.strictEqual(floatRatingRes.status, 400, "Non-integer rating must return 400 Bad Request");
  console.log("✓ Rating validation correctly rejects 0, 6, and float ratings.\n");

  // ------------------------------------------------------------------
  // Test 12: Review belongs to correct product
  // ------------------------------------------------------------------
  console.log("Test 12: Review belongs to correct product");
  const prod1ReviewsRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`);
  const prod1Data = await prod1ReviewsRes.json();
  const belongsToProd1 = prod1Data.reviews.some(r => r._id === reviewId1);
  assert(belongsToProd1, "Review 1 must belong to targetProduct");

  const prod2ReviewsRes = await fetch(`${BACKEND_URL}/api/products/${secondProductId}/reviews`);
  const prod2Data = await prod2ReviewsRes.json();
  const belongsToProd2 = prod2Data.reviews.some(r => r._id === reviewId1);
  assert(!belongsToProd2, "Review 1 must NOT appear on secondProduct");
  console.log("✓ Review strictly associated with targetProduct and isolated from secondProduct.\n");

  // ------------------------------------------------------------------
  // Test 13: Admin/customer session separation remains intact
  // ------------------------------------------------------------------
  console.log("Test 13: Admin/customer session separation remains intact");
  // Admin logs in
  const adminLoginRes = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@aura.com", password: "Admin@Aura2026" })
  });
  const adminCookie = `aura_admin_session=${parseCookie(adminLoginRes.headers.get("set-cookie"), "aura_admin_session")}`;

  // Admin cookie cannot submit a customer review (rejected with 401 Unauthorized or 403)
  const adminPostReviewRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({ rating: 5, title: "Admin Review", comment: "Admin trying to review" })
  });
  assert([401, 403].includes(adminPostReviewRes.status), "Admin cookie cannot submit customer review");

  // Customer cookie cannot access admin APIs
  const custOnAdminApiRes = await fetch(`${BACKEND_URL}/api/auth/admin/me`, {
    headers: { Cookie: cust1Cookie }
  });
  assert([401, 403].includes(custOnAdminApiRes.status), "Customer cookie cannot access admin APIs");
  console.log("✓ Admin cookie cannot review products; Customer cookie cannot access admin APIs.\n");

  // ------------------------------------------------------------------
  // Test 9: Customer can delete own review (DELETE /api/reviews/:reviewId)
  // ------------------------------------------------------------------
  console.log("Test 9: Customer can delete own review (DELETE /api/reviews/:reviewId)");
  const deleteOwnRes = await fetch(`${BACKEND_URL}/api/reviews/${reviewId1}`, {
    method: "DELETE",
    headers: { Cookie: cust1Cookie }
  });
  assert.strictEqual(deleteOwnRes.status, 200, "Deleting own review must return 200 OK");

  // Verify review is removed from product reviews
  const postDeleteReviewsRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`);
  const postDeleteData = await postDeleteReviewsRes.json();
  const stillExists = postDeleteData.reviews.some(r => r._id === reviewId1);
  assert(!stillExists, "Deleted review must no longer exist in product reviews");
  console.log("✓ Customer 1 successfully deleted own review and it is removed from catalog.\n");

  console.log("==================================================================");
  console.log("ALL 13 PRODUCT REVIEWS & RATINGS SYSTEM TESTS PASSED! ✨");
  console.log("==================================================================\n");
  } finally {
    try {
      const mongoose = require("mongoose");
      const conn = await mongoose.createConnection(process.env.TEST_MONGO_URI || "mongodb://localhost:27017/aura");
      await conn.collection("users").deleteMany({ email: { $in: [cust1Email, cust2Email, cust3Email] } });
      await conn.collection("orders").deleteMany({ orderId: { $in: [`AUR-PURCH-${timestamp}`, `AUR-CNCL-${timestamp}`] } });
      await conn.collection("adminnotifications").deleteMany({
        $or: [
          { message: { $regex: new RegExp(`(reviewer_one_${timestamp}|reviewer_two_${timestamp}|reviewer_three_${timestamp})`, "i") } },
          { message: { $regex: new RegExp(`(AUR-PURCH-${timestamp}|AUR-CNCL-${timestamp})`, "i") } }
        ]
      });
      await conn.close();
      console.log("✓ Test cleanup: removed temporary reviewer_ accounts and orders.");
    } catch (e) {
      // Ignore cleanup error
    }
  }
}

runReviewTests().catch(err => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
