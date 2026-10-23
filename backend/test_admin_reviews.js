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

async function runAdminReviewTests() {
  console.log("==================================================================");
  console.log("AURA ADMIN REVIEW MODERATION SYSTEM COMPREHENSIVE TEST SUITE");
  console.log("==================================================================\n");

  const timestamp = Date.now();

  // Setup Step 1: Admin Login
  console.log("Setup 1: Authenticating Administrator...");
  const adminLoginRes = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@aura.com",
      password: "Admin@Aura2026"
    })
  });
  assert.strictEqual(adminLoginRes.status, 200, "Admin login must succeed");
  const rawAdminCookie = parseCookie(adminLoginRes.headers.get("set-cookie"), "aura_admin_session");
  assert(rawAdminCookie, "Admin login must issue aura_admin_session cookie");
  const adminCookie = `aura_admin_session=${rawAdminCookie}`;
  console.log("✓ Admin successfully authenticated.\n");

  // Setup Step 2: Fetch target product from catalog
  console.log("Setup 2: Fetching target product from catalog...");
  const prodsRes = await fetch(`${BACKEND_URL}/api/products`);
  assert.strictEqual(prodsRes.status, 200, "Must fetch products");
  const products = await prodsRes.json();
  const targetProduct = products.find(p => p.stock > 5 && p.sizeStock && Object.values(p.sizeStock).some(q => Number(q) > 2)) || products[0];
  const targetProductId = targetProduct._id;
  const targetSize = Object.entries(targetProduct.sizeStock || {}).find(([sz, qty]) => Number(qty) > 1)?.[0] || "M";
  console.log(`✓ Target Product: "${targetProduct.name}" (ID: ${targetProductId})\n`);

  // Setup Step 3: Register Customer & Place Order to become Verified Purchaser
  console.log("Setup 3: Registering Customer and creating verified purchase order...");
  const customerEmail = `mod_customer_${timestamp}@aura.com`;
  try {
    const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Ananya Roy",
      email: customerEmail,
      password: "Password123!",
      confirmPassword: "Password123!"
    })
  });
  assert.strictEqual(regRes.status, 201, "Customer registration must succeed");
  const rawCustomerCookie = parseCookie(regRes.headers.get("set-cookie"), "aura_customer_session");
  const customerCookie = `aura_customer_session=${rawCustomerCookie}`;

  // Place order as Customer
  const orderRes = await fetch(`${BACKEND_URL}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: customerCookie
    },
    body: JSON.stringify({
      orderId: `AUR-MOD-${timestamp}`,
      customer: {
        fullName: "Ananya Roy",
        email: customerEmail,
        phone: "9876543210"
      },
      shippingAddress: {
        address: "74 Luxury Boulevard",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400001"
      },
      items: [
        {
          productId: targetProductId,
          name: targetProduct.name,
          price: targetProduct.price,
          quantity: 1,
          selectedSize: targetSize,
          size: targetSize
        }
      ],
      subtotal: targetProduct.price,
      shipping: 0,
      total: targetProduct.price,
      status: "Processing"
    })
  });
  assert.strictEqual(orderRes.status, 201, "Order placement must succeed");
  console.log("✓ Customer verified purchase order placed successfully.\n");

  // Setup Step 4: Customer posts a review (defaults to status 'approved')
  console.log("Setup 4: Customer submits an initial 5-star review...");
  const postReviewRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: customerCookie
    },
    body: JSON.stringify({
      rating: 5,
      title: "Remarkable Craftsmanship & Texture",
      comment: "The drape and stitching on this garment are simply immaculate. Truly luxury quality."
    })
  });
  assert.strictEqual(postReviewRes.status, 201, "Review submission must return 201 Created");
  const postReviewData = await postReviewRes.json();
  const createdReviewId = postReviewData.review._id;
  assert(createdReviewId, "Must return review ID");
  assert.strictEqual(postReviewData.review.status, "approved", "New review must default to 'approved'");
  console.log(`✓ Review created with ID: ${createdReviewId} (Status: approved)\n`);

  // ------------------------------------------------------------------
  // Test 1: Admin can retrieve reviews
  // ------------------------------------------------------------------
  console.log("Test 1: Admin can retrieve reviews via GET /api/admin/reviews");
  const adminGetRes = await fetch(`${BACKEND_URL}/api/admin/reviews`, {
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(adminGetRes.status, 200, "Admin get reviews must return 200 OK");
  const adminGetData = await adminGetRes.json();
  assert(adminGetData.success, "Response must report success");
  assert(Array.isArray(adminGetData.reviews), "Response must contain reviews array");
  assert(adminGetData.stats, "Response must contain stats object");
  const foundAdminRev = adminGetData.reviews.find(r => r._id.toString() === createdReviewId);
  assert(foundAdminRev, "Created review must be present in admin review list");
  assert.strictEqual(foundAdminRev.status, "approved", "Review status must be approved");
  console.log(`✓ Admin retrieved reviews successfully (Total in DB: ${adminGetData.stats.total}).\n`);

  // ------------------------------------------------------------------
  // Test 2: Customer cannot access admin review API
  // ------------------------------------------------------------------
  console.log("Test 2: Customer cannot access admin review API (Blocked)");
  const custAdminGetRes = await fetch(`${BACKEND_URL}/api/admin/reviews`, {
    headers: { Cookie: customerCookie }
  });
  assert([401, 403].includes(custAdminGetRes.status), "Customer must be rejected with 401 or 403");
  console.log(`✓ Customer blocked from admin reviews endpoint (Status: ${custAdminGetRes.status}).\n`);

  // ------------------------------------------------------------------
  // Test 3: Guest cannot access admin review API
  // ------------------------------------------------------------------
  console.log("Test 3: Guest cannot access admin review API (Blocked with 401)");
  const guestAdminGetRes = await fetch(`${BACKEND_URL}/api/admin/reviews`);
  assert.strictEqual(guestAdminGetRes.status, 401, "Guest must be rejected with 401 Unauthorized");
  console.log("✓ Guest blocked with 401 Unauthorized.\n");

  // ------------------------------------------------------------------
  // Test 4: Admin can hide an approved review
  // ------------------------------------------------------------------
  console.log("Test 4: Admin can hide an approved review (PUT /api/admin/reviews/:reviewId/status)");
  const hideRes = await fetch(`${BACKEND_URL}/api/admin/reviews/${createdReviewId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie
    },
    body: JSON.stringify({ status: "hidden" })
  });
  assert.strictEqual(hideRes.status, 200, "Hiding review must return 200 OK");
  const hideData = await hideRes.json();
  assert.strictEqual(hideData.review.status, "hidden", "Review status must now be 'hidden'");
  console.log("✓ Review status successfully changed to 'hidden'.\n");

  // ------------------------------------------------------------------
  // Test 5: Hidden review is NOT visible to customers
  // ------------------------------------------------------------------
  console.log("Test 5: Hidden review is not visible to customers/guests");
  const publicPdpRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`);
  assert.strictEqual(publicPdpRes.status, 200, "Public review endpoint must return 200 OK");
  const publicPdpData = await publicPdpRes.json();
  const hiddenInPublicList = publicPdpData.reviews.some(r => r._id.toString() === createdReviewId);
  assert.strictEqual(hiddenInPublicList, false, "Hidden review must NOT be present in public reviews array");
  console.log("✓ Hidden review successfully excluded from customer-facing review list.\n");

  // ------------------------------------------------------------------
  // Test 6: Hidden review is NOT included in average rating
  // ------------------------------------------------------------------
  console.log("Test 6: Hidden review is not included in average rating");
  // If target product had only this 1 review, average rating must now be 0
  const expectedAvg = publicPdpData.reviews.length === 0 
    ? 0 
    : Math.round((publicPdpData.reviews.reduce((s, r) => s + r.rating, 0) / publicPdpData.reviews.length) * 10) / 10;
  assert.strictEqual(publicPdpData.averageRating, expectedAvg, "Average rating must reflect only approved reviews");
  console.log(`✓ Average rating correctly excludes hidden review (Current public average: ${publicPdpData.averageRating}).\n`);

  // ------------------------------------------------------------------
  // Test 7: Hidden review is NOT included in review count
  // ------------------------------------------------------------------
  console.log("Test 7: Hidden review is not included in review count");
  assert.strictEqual(publicPdpData.totalReviews, publicPdpData.reviews.length, "Total reviews must equal count of approved reviews");
  console.log(`✓ Total review count correctly excludes hidden review (Current public count: ${publicPdpData.totalReviews}).\n`);

  // ------------------------------------------------------------------
  // Test 8: Admin can approve a hidden review
  // ------------------------------------------------------------------
  console.log("Test 8: Admin can approve a hidden review (PUT /api/admin/reviews/:reviewId/status)");
  const approveRes = await fetch(`${BACKEND_URL}/api/admin/reviews/${createdReviewId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie
    },
    body: JSON.stringify({ status: "approved" })
  });
  assert.strictEqual(approveRes.status, 200, "Approving review must return 200 OK");
  const approveData = await approveRes.json();
  assert.strictEqual(approveData.review.status, "approved", "Review status must now be 'approved'");
  console.log("✓ Review status successfully restored to 'approved'.\n");

  // ------------------------------------------------------------------
  // Test 9: Approved review becomes visible again
  // ------------------------------------------------------------------
  console.log("Test 9: Approved review becomes visible again in customer API");
  const reapprovedPdpRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`);
  assert.strictEqual(reapprovedPdpRes.status, 200, "Public review endpoint must return 200 OK");
  const reapprovedPdpData = await reapprovedPdpRes.json();
  const visibleAgain = reapprovedPdpData.reviews.some(r => r._id.toString() === createdReviewId);
  assert.strictEqual(visibleAgain, true, "Approved review must be visible in customer reviews list");
  console.log("✓ Approved review is now visible to customers again.\n");

  // ------------------------------------------------------------------
  // Test 12: Non-admin cannot change review status
  // ------------------------------------------------------------------
  console.log("Test 12: Non-admin cannot change review status (Blocked)");
  const nonAdminModRes = await fetch(`${BACKEND_URL}/api/admin/reviews/${createdReviewId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: customerCookie
    },
    body: JSON.stringify({ status: "hidden" })
  });
  assert([401, 403].includes(nonAdminModRes.status), "Customer must be rejected when attempting to moderate review");
  console.log(`✓ Customer blocked from changing review status (Status: ${nonAdminModRes.status}).\n`);

  // ------------------------------------------------------------------
  // Test 10: Admin can delete a review
  // ------------------------------------------------------------------
  console.log("Test 10: Admin can delete a review (DELETE /api/admin/reviews/:reviewId)");
  const deleteRes = await fetch(`${BACKEND_URL}/api/admin/reviews/${createdReviewId}`, {
    method: "DELETE",
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(deleteRes.status, 200, "Admin delete review must return 200 OK");
  const deleteData = await deleteRes.json();
  assert(deleteData.message, "Response must include confirmation message");
  console.log("✓ Review successfully deleted by administrator.\n");

  // ------------------------------------------------------------------
  // Test 11: Deleted review is permanently removed
  // ------------------------------------------------------------------
  console.log("Test 11: Deleted review is permanently removed from database");
  const checkAdminAfterDel = await fetch(`${BACKEND_URL}/api/admin/reviews`, {
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(checkAdminAfterDel.status, 200, "Admin get reviews must return 200 OK");
  const checkData = await checkAdminAfterDel.json();
  const existsInAdmin = checkData.reviews.some(r => r._id.toString() === createdReviewId);
  assert.strictEqual(existsInAdmin, false, "Deleted review must NOT exist in admin reviews list");

  const checkPdpAfterDel = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`);
  const checkPdpData = await checkPdpAfterDel.json();
  const existsInCustomer = checkPdpData.reviews.some(r => r._id.toString() === createdReviewId);
  assert.strictEqual(existsInCustomer, false, "Deleted review must NOT exist in customer reviews list");
  console.log("✓ Review is permanently removed from both admin and customer views.\n");

  // ------------------------------------------------------------------
  // Test 13: Admin/customer session separation remains intact
  // ------------------------------------------------------------------
  console.log("Test 13: Admin/customer session separation remains intact");
  // Admin cookie cannot access customer profile
  const adminCustCheck = await fetch(`${BACKEND_URL}/api/auth/me`, {
    headers: { Cookie: adminCookie }
  });
  assert.strictEqual(adminCustCheck.status, 401, "Admin cookie must not access /api/auth/me");

  // Customer cookie cannot access admin verification
  const custAdminCheck = await fetch(`${BACKEND_URL}/api/auth/admin/me`, {
    headers: { Cookie: customerCookie }
  });
  assert.strictEqual(custAdminCheck.status, 401, "Customer cookie must not access /api/auth/admin/me");
  console.log("✓ Strict cookie-based session isolation confirmed.\n");

  // ------------------------------------------------------------------
  // Test 14: Existing customer review functionality still works
  // ------------------------------------------------------------------
  console.log("Test 14: Existing customer review functionality still works after moderation actions");
  // Customer can submit a new review now that the previous one was deleted
  const postNewRes = await fetch(`${BACKEND_URL}/api/products/${targetProductId}/reviews`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: customerCookie
    },
    body: JSON.stringify({
      rating: 4,
      title: "Updated Feedback after Repurchase",
      comment: "Still exquisite design and fit. Recommended to fashion connoisseurs."
    })
  });
  assert.strictEqual(postNewRes.status, 201, "Customer must be able to submit review");
  const postNewData = await postNewRes.json();
  const freshReviewId = postNewData.review._id;

  // Customer can edit own review
  const editRes = await fetch(`${BACKEND_URL}/api/reviews/${freshReviewId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: customerCookie
    },
    body: JSON.stringify({
      rating: 5,
      title: "Final Verdict: Absolute Perfection",
      comment: "Wore this to a private gala. Unbelievable compliments on the silhouette."
    })
  });
  assert.strictEqual(editRes.status, 200, "Customer can edit own review");

  // Customer can delete own review
  const custDelRes = await fetch(`${BACKEND_URL}/api/reviews/${freshReviewId}`, {
    method: "DELETE",
    headers: { Cookie: customerCookie }
  });
  assert.strictEqual(custDelRes.status, 200, "Customer can delete own review");
  console.log("✓ Customer review lifecycle (create, edit, delete) operating seamlessly.\n");

  console.log("==================================================================");
  console.log("ALL 14 ADMIN REVIEW MODERATION TESTS PASSED! ✨");
  console.log("==================================================================\n");
  } finally {
    try {
      const mongoose = require("mongoose");
      const conn = await mongoose.createConnection(process.env.TEST_MONGO_URI || "mongodb://localhost:27017/aura");
      await conn.collection("users").deleteOne({ email: customerEmail });
      await conn.collection("orders").deleteOne({ orderId: `AUR-MOD-${timestamp}` });
      await conn.collection("adminnotifications").deleteMany({
        $or: [
          { message: { $regex: new RegExp(customerEmail, "i") } },
          { message: { $regex: new RegExp(`AUR-MOD-${timestamp}`, "i") } }
        ]
      });
      await conn.close();
      console.log("✓ Test cleanup: removed temporary mod_customer test account & order.");
    } catch (e) {
      // Ignore cleanup error
    }
  }
}

runAdminReviewTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
