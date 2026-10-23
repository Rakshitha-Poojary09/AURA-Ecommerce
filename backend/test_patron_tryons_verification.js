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

async function runTryOnVerificationSuite() {
  console.log("====================================================================");
  console.log("AURA PATRON & INFLUENCER TRY-ONS VERIFICATION SUITE");
  console.log("====================================================================\n");

  let testCustomerId = null;
  let testCustomerCookie = null;
  let adminCookie = null;
  let createdVideoId = null;
  let genuineProductId = null;

  try {
    // ------------------------------------------------------------------
    // STEP 1: Verify Customer Public Endpoint & Existing Genuine Videos
    // ------------------------------------------------------------------
    console.log("--- Step 1: Customer Storefront GET /api/videos ---");
    const publicRes = await fetch(`${BACKEND_URL}/api/videos`);
    assert.strictEqual(publicRes.status, 200, "GET /api/videos must return HTTP 200");
    const publicData = await publicRes.json();
    assert(Array.isArray(publicData.videos), "Response must contain 'videos' array");
    console.log(`✓ GET /api/videos returned ${publicData.videos.length} approved try-on videos.`);

    // Check structure of each returned video
    for (const vid of publicData.videos) {
      assert(vid.video && vid.video.url, "Video must have valid video.url");
      assert(vid.customerName, "Video must have a creator/patron name");
      assert(vid.productId, "Video must have a linked product");
      assert(vid.productId._id, "Linked product must have MongoDB _id");
      assert(vid.productId.name || vid.productId.title, "Linked product must have name/title");
      assert(typeof vid.productId.price === "number", "Linked product must have numeric price");
      if (!genuineProductId) {
        genuineProductId = String(vid.productId._id);
      }
    }
    console.log(`✓ All existing try-on videos correctly associate with genuine MongoDB products.`);
    console.log(`✓ Using genuine product ID for admin test: ${genuineProductId}\n`);

    // ------------------------------------------------------------------
    // STEP 2: Verify Security & Route Protection (Unauthenticated / Customer)
    // ------------------------------------------------------------------
    console.log("--- Step 2: Route Protection on Video Management APIs ---");

    // 2a. Unauthenticated attempts
    const unauthPost = await fetch(`${BACKEND_URL}/api/admin/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: genuineProductId,
        displayName: "Hacker Try-On",
        videoUrl: "/uploads/reviews/videos/fashion-tryon-1.mp4"
      })
    });
    assert.strictEqual(unauthPost.status, 401, "Unauthenticated POST /api/admin/videos must return 401");

    const unauthPut = await fetch(`${BACKEND_URL}/api/admin/videos/60c72b2f9b1d8b2bad000000`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Hacker Edited Name" })
    });
    assert.strictEqual(unauthPut.status, 401, "Unauthenticated PUT /api/admin/videos/:id must return 401");

    const unauthDel = await fetch(`${BACKEND_URL}/api/admin/videos/60c72b2f9b1d8b2bad000000`, {
      method: "DELETE"
    });
    assert.strictEqual(unauthDel.status, 401, "Unauthenticated DELETE /api/admin/videos/:id must return 401");
    console.log("✓ Unauthenticated callers are strictly blocked (401 Unauthorized) from adding, editing, or deleting videos.");

    // 2b. Customer attempt (non-admin registered user)
    const custEmail = `tryon_customer_${Date.now()}@aura.com`;
    const custRegRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: "Regular Shopper",
        email: custEmail,
        password: "CustomerPass123!",
        confirmPassword: "CustomerPass123!"
      })
    });
    assert.strictEqual(custRegRes.status, 201, "Customer registration should succeed");
    const custRegData = await custRegRes.json();
    testCustomerId = custRegData.user?.id || custRegData.user?._id;
    const custCookieHeader = custRegRes.headers.get("set-cookie");
    const custToken = parseCookie(custCookieHeader, "aura_customer_session");
    testCustomerCookie = `aura_customer_session=${custToken}`;

    const custPost = await fetch(`${BACKEND_URL}/api/admin/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: testCustomerCookie
      },
      body: JSON.stringify({
        productId: genuineProductId,
        displayName: "Customer Adding Video",
        videoUrl: "/uploads/reviews/videos/fashion-tryon-1.mp4"
      })
    });
    assert(
      custPost.status === 401 || custPost.status === 403,
      `Customer calling POST /api/admin/videos must be rejected with 401/403 (got ${custPost.status})`
    );

    const custDel = await fetch(`${BACKEND_URL}/api/admin/videos/60c72b2f9b1d8b2bad000000`, {
      method: "DELETE",
      headers: { Cookie: testCustomerCookie }
    });
    assert(
      custDel.status === 401 || custDel.status === 403,
      `Customer calling DELETE /api/admin/videos/:id must be rejected with 401/403 (got ${custDel.status})`
    );
    console.log("✓ Authenticated regular customers are strictly blocked from admin video management APIs.\n");

    // ------------------------------------------------------------------
    // STEP 3: Admin Video Management CRUD Flow
    // ------------------------------------------------------------------
    console.log("--- Step 3: Admin Video Management (Add, Edit, Delete) ---");

    // 3a. Admin Login
    const adminLoginRes = await fetch(`${BACKEND_URL}/api/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@aura.com",
        password: "Admin@Aura2026"
      })
    });
    assert.strictEqual(adminLoginRes.status, 200, "Admin login must succeed");
    const adminSetCookie = adminLoginRes.headers.get("set-cookie");
    const adminToken = parseCookie(adminSetCookie, "aura_admin_session");
    assert(adminToken, "Extracted aura_admin_session token must be valid");
    adminCookie = `aura_admin_session=${adminToken}`;
    console.log("✓ Admin successfully authenticated.");

    // 3b. Admin creates a new try-on video showcase
    const createRes = await fetch(`${BACKEND_URL}/api/admin/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie
      },
      body: JSON.stringify({
        productId: genuineProductId,
        displayName: "AURA Senior Stylist",
        title: "Drape & Fit Analysis",
        comment: "Exceptional tailored fit across shoulders and clean silhouette.",
        rating: 5,
        isInfluencer: true,
        influencerHandle: "@aurastyle",
        status: "approved",
        videoUrl: "/uploads/reviews/videos/fashion-tryon-1.mp4",
        thumbnailUrl: "/uploads/reviews/videos/fashion-tryon-1-thumb.jpg"
      })
    });
    assert.strictEqual(createRes.status, 201, "Admin POST /api/admin/videos must return 201 Created");
    const createData = await createRes.json();
    assert(createData.video && createData.video._id, "Created video must contain _id");
    createdVideoId = String(createData.video._id);
    console.log(`✓ Admin successfully created showcase video: ${createdVideoId}`);

    // Verify it appears in customer storefront GET /api/videos
    const afterCreateRes = await fetch(`${BACKEND_URL}/api/videos`);
    const afterCreateData = await afterCreateRes.json();
    const createdFound = afterCreateData.videos.find((v) => String(v._id) === createdVideoId);
    assert(createdFound, "New showcase video must be visible in public GET /api/videos");
    assert.strictEqual(createdFound.customerName, "AURA Senior Stylist");
    assert.strictEqual(createdFound.isInfluencer, true);
    assert.strictEqual(createdFound.influencerHandle, "@aurastyle");
    console.log("✓ Public storefront GET /api/videos confirms new video is published with correct metadata.");

    // 3c. Admin edits the video details
    const editRes = await fetch(`${BACKEND_URL}/api/admin/videos/${createdVideoId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie
      },
      body: JSON.stringify({
        displayName: "AURA Head of Styling",
        title: "Updated Fit & Texture Analysis",
        comment: "Updated notes: fits true to size with luxurious drape.",
        status: "approved"
      })
    });
    assert.strictEqual(editRes.status, 200, "Admin PUT /api/admin/videos/:id must return 200 OK");
    const editData = await editRes.json();
    assert.strictEqual(editData.video.customerName, "AURA Head of Styling");
    assert.strictEqual(editData.video.title, "Updated Fit & Texture Analysis");
    console.log("✓ Admin successfully edited video details.");

    // Verify storefront shows updated information
    const afterEditRes = await fetch(`${BACKEND_URL}/api/videos`);
    const afterEditData = await afterEditRes.json();
    const editedFound = afterEditData.videos.find((v) => String(v._id) === createdVideoId);
    assert(editedFound, "Edited video must exist in public storefront");
    assert.strictEqual(editedFound.customerName, "AURA Head of Styling");
    assert.strictEqual(editedFound.title, "Updated Fit & Texture Analysis");
    console.log("✓ Public storefront reflects edited video details in real-time.");

    // 3d. Admin deletes the video
    const delRes = await fetch(`${BACKEND_URL}/api/admin/videos/${createdVideoId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie }
    });
    assert.strictEqual(delRes.status, 200, "Admin DELETE /api/admin/videos/:id must return 200 OK");
    console.log("✓ Admin successfully deleted video.");

    // Verify storefront no longer contains the deleted video
    const afterDelRes = await fetch(`${BACKEND_URL}/api/videos`);
    const afterDelData = await afterDelRes.json();
    const deletedCheck = afterDelData.videos.find((v) => String(v._id) === createdVideoId);
    assert(!deletedCheck, "Deleted video must NO LONGER appear in public GET /api/videos");
    console.log("✓ Public storefront confirms video has been completely removed.");
    createdVideoId = null; // Successfully cleaned up

    // ------------------------------------------------------------------
    // STEP 4: AdminReviews UI Endpoints Equivalence (/api/admin/reviews)
    // ------------------------------------------------------------------
    console.log("\n--- Step 4: AdminReviews API Integration Validation ---");
    const adminReviewsRes = await fetch(`${BACKEND_URL}/api/admin/reviews?status=video`, {
      headers: { Cookie: adminCookie }
    });
    assert.strictEqual(adminReviewsRes.status, 200, "GET /api/admin/reviews must return 200");
    const adminReviewsData = await adminReviewsRes.json();
    assert(Array.isArray(adminReviewsData.reviews), "Admin reviews response must contain 'reviews'");
    console.log(`✓ Admin portal reviews list retrieved ${adminReviewsData.reviews.length} video reviews.`);

    console.log("\n====================================================================");
    console.log("ALL TESTS PASSED SUCCESSFULLY! ✨");
    console.log("====================================================================");
  } finally {
    // Cleanup any created records
    if (createdVideoId && adminCookie) {
      await fetch(`${BACKEND_URL}/api/admin/videos/${createdVideoId}`, {
        method: "DELETE",
        headers: { Cookie: adminCookie }
      }).catch(() => {});
    }
    if (testCustomerId) {
      const mongoose = require("mongoose");
      const User = require("./models/User");
      if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/aura");
      }
      await User.findByIdAndDelete(testCustomerId).catch(() => {});
      if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
      }
    }
  }
}

runTryOnVerificationSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Test Suite Failed:", err);
    process.exit(1);
  });
