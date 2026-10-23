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

async function runTest() {
  console.log("====================================================================");
  console.log("AURA VIDEO UPLOAD REMOVAL & ADMIN-ONLY SECURITY TEST SUITE");
  console.log("====================================================================\n");

  let testCustomerId = null;
  let customerCookie = null;
  let adminCookie = null;
  let genuineProductId = null;
  let createdVideoId = null;

  try {
    // ------------------------------------------------------------------
    // 1. Verify Customer Public Endpoint & Circular Video-Story Data
    // ------------------------------------------------------------------
    console.log("--- 1. Storefront Public GET /api/videos ---");
    const publicRes = await fetch(`${BACKEND_URL}/api/videos`);
    assert.strictEqual(publicRes.status, 200, "Storefront GET /api/videos must return HTTP 200");
    const publicData = await publicRes.json();
    assert(Array.isArray(publicData.videos), "Response must contain 'videos' array");
    console.log(`✓ Storefront public endpoint returned ${publicData.videos.length} published try-on videos.`);

    for (const vid of publicData.videos) {
      assert(vid.video && vid.video.url, "Every video must have valid video.url");
      assert(vid.productId, "Every video must have an associated MongoDB product");
      assert(vid.productId._id, "Product must have valid _id");
      assert(vid.productId.name || vid.productId.title, "Product must have name/title");
      if (!genuineProductId) {
        genuineProductId = String(vid.productId._id);
      }
    }
    console.log(`✓ All public videos have valid circular-story metadata and link to genuine products.`);
    console.log(`✓ Using genuine MongoDB product ID: ${genuineProductId}\n`);

    // ------------------------------------------------------------------
    // 2. Setup Customer & Attempt Video Upload / Edit / Delete
    // ------------------------------------------------------------------
    console.log("--- 2. Customer Video Upload & Modification Denial Tests ---");
    const mongoose = require("mongoose");
    const User = require("./models/User");
    const jwt = require("jsonwebtoken");
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/aura");
    }

    const custEmail = `cust_vidtest_${Date.now()}@aura.com`;
    const testCust = await User.create({
      name: "Test Customer",
      email: custEmail,
      password: "CustomerPass123!",
      isEmailVerified: true,
      role: "customer"
    });
    testCustomerId = String(testCust._id);

    const secret = process.env.JWT_SECRET || "aura_luxury_fashion_jwt_secret_key_2026_super_secure";
    const custToken = jwt.sign({ id: testCustomerId, role: "customer" }, secret, { expiresIn: "7d" });
    customerCookie = `aura_customer_session=${custToken}`;
    console.log("✓ Authenticated test customer session established.");

    // 2a. Customer attempts to submit review with videoUrl -> Must be rejected with 403
    const custReviewWithVideo = await fetch(`${BACKEND_URL}/api/products/${genuineProductId}/reviews`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerCookie
      },
      body: JSON.stringify({
        rating: 5,
        title: "Customer Video Attempt",
        comment: "Trying to upload a video as a customer...",
        videoUrl: "https://example.com/hacker-video.mp4"
      })
    });
    assert.strictEqual(
      custReviewWithVideo.status,
      403,
      `Customer submitting review with videoUrl must return 403 Forbidden (got ${custReviewWithVideo.status})`
    );
    const errData = await custReviewWithVideo.json();
    console.log(`✓ Customer review with videoUrl correctly rejected with 403: "${errData.message}"`);

    // 2b. Customer attempts to update review with videoUrl -> Must be rejected with 403
    const custPutVideo = await fetch(`${BACKEND_URL}/api/reviews/60c72b2f9b1d8b2bad000000`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerCookie
      },
      body: JSON.stringify({
        videoUrl: "https://example.com/hacker-video.mp4"
      })
    });
    assert.strictEqual(
      custPutVideo.status,
      403,
      `Customer updating review with videoUrl must return 403 Forbidden (got ${custPutVideo.status})`
    );
    console.log("✓ Customer editing review with videoUrl correctly rejected with 403.");

    // 2c. Customer attempts to call admin video APIs directly
    const custAdminVideoPost = await fetch(`${BACKEND_URL}/api/admin/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: customerCookie
      },
      body: JSON.stringify({
        productId: genuineProductId,
        displayName: "Customer Hack",
        videoUrl: "/uploads/reviews/videos/fashion-tryon-1.mp4"
      })
    });
    assert(
      custAdminVideoPost.status === 401 || custAdminVideoPost.status === 403,
      `Customer calling POST /api/admin/videos must return 401 or 403 (got ${custAdminVideoPost.status})`
    );

    const custAdminVideoDelete = await fetch(`${BACKEND_URL}/api/admin/videos/60c72b2f9b1d8b2bad000000`, {
      method: "DELETE",
      headers: { Cookie: customerCookie }
    });
    assert(
      custAdminVideoDelete.status === 401 || custAdminVideoDelete.status === 403,
      `Customer calling DELETE /api/admin/videos/:id must return 401 or 403 (got ${custAdminVideoDelete.status})`
    );
    console.log("✓ Customer directly calling /api/admin/videos endpoints is strictly rejected.\n");

    // ------------------------------------------------------------------
    // 3. Unauthenticated User Blocked from Video APIs
    // ------------------------------------------------------------------
    console.log("--- 3. Unauthenticated User Video Rejection Tests ---");
    const unauthPost = await fetch(`${BACKEND_URL}/api/admin/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productId: genuineProductId,
        displayName: "Anonymous Upload",
        videoUrl: "/uploads/reviews/videos/fashion-tryon-1.mp4"
      })
    });
    assert.strictEqual(unauthPost.status, 401, "Unauthenticated POST /api/admin/videos must return 401");

    const unauthPut = await fetch(`${BACKEND_URL}/api/admin/videos/60c72b2f9b1d8b2bad000000`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Anonymous Edit" })
    });
    assert.strictEqual(unauthPut.status, 401, "Unauthenticated PUT /api/admin/videos/:id must return 401");

    const unauthDel = await fetch(`${BACKEND_URL}/api/admin/videos/60c72b2f9b1d8b2bad000000`, {
      method: "DELETE"
    });
    assert.strictEqual(unauthDel.status, 401, "Unauthenticated DELETE /api/admin/videos/:id must return 401");
    console.log("✓ Unauthenticated callers are strictly blocked (401 Unauthorized) from all video mutations.\n");

    // ------------------------------------------------------------------
    // 4. Authenticated Administrator Video Management (CRUD)
    // ------------------------------------------------------------------
    console.log("--- 4. Authenticated Admin Video Management ---");
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
    console.log("✓ Admin authenticated successfully.");

    // 4a. Admin creates a try-on video showcase
    const createRes = await fetch(`${BACKEND_URL}/api/admin/videos`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie
      },
      body: JSON.stringify({
        productId: genuineProductId,
        displayName: "AURA Resident Stylist",
        title: "Effortless Fall Drapery & Fit",
        comment: "Detailed review on garment flow, waistline contour, and breathable linen weave.",
        rating: 5,
        isInfluencer: true,
        influencerHandle: "@aurapremium",
        status: "approved",
        videoUrl: "/uploads/reviews/videos/fashion-tryon-1.mp4",
        thumbnailUrl: "/uploads/reviews/videos/fashion-tryon-1-thumb.jpg"
      })
    });
    assert.strictEqual(createRes.status, 201, "Admin POST /api/admin/videos must return 201 Created");
    const createData = await createRes.json();
    assert(createData.video && createData.video._id, "Created video must contain _id");
    createdVideoId = String(createData.video._id);
    console.log(`✓ Admin successfully created try-on video (ID: ${createdVideoId}).`);

    // Verify it appears in customer public storefront
    const pubAfterCreate = await fetch(`${BACKEND_URL}/api/videos`);
    const pubAfterCreateData = await pubAfterCreate.json();
    const createdInPub = pubAfterCreateData.videos.find((v) => String(v._id) === createdVideoId);
    assert(createdInPub, "Newly created video must appear in public storefront GET /api/videos");
    assert.strictEqual(createdInPub.customerName, "AURA Resident Stylist");
    console.log("✓ Public storefront immediately reflects the admin-created try-on video.");

    // 4b. Admin edits the video
    const editRes = await fetch(`${BACKEND_URL}/api/admin/videos/${createdVideoId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie
      },
      body: JSON.stringify({
        displayName: "AURA Lead Stylist",
        title: "Updated Fit Notes: True to Size",
        comment: "Revised styling recommendation: pairs elegantly with wide-leg trousers."
      })
    });
    assert.strictEqual(editRes.status, 200, "Admin PUT /api/admin/videos/:id must return 200 OK");
    console.log("✓ Admin successfully updated video details.");

    // Verify public storefront has updated info
    const pubAfterEdit = await fetch(`${BACKEND_URL}/api/videos`);
    const pubAfterEditData = await pubAfterEdit.json();
    const editedInPub = pubAfterEditData.videos.find((v) => String(v._id) === createdVideoId);
    assert.strictEqual(editedInPub.customerName, "AURA Lead Stylist");
    assert.strictEqual(editedInPub.title, "Updated Fit Notes: True to Size");
    console.log("✓ Public storefront reflects the updated video details in real-time.");

    // 4c. Admin deletes the video
    const delRes = await fetch(`${BACKEND_URL}/api/admin/videos/${createdVideoId}`, {
      method: "DELETE",
      headers: { Cookie: adminCookie }
    });
    assert.strictEqual(delRes.status, 200, "Admin DELETE /api/admin/videos/:id must return 200 OK");
    console.log("✓ Admin successfully deleted try-on video.");

    // Verify public storefront no longer has the deleted video
    const pubAfterDel = await fetch(`${BACKEND_URL}/api/videos`);
    const pubAfterDelData = await pubAfterDel.json();
    const deletedInPub = pubAfterDelData.videos.find((v) => String(v._id) === createdVideoId);
    assert(!deletedInPub, "Deleted video must not be present in public storefront");
    console.log("✓ Public storefront confirms deleted video is no longer visible.");
    createdVideoId = null;

    console.log("\n====================================================================");
    console.log("ALL TESTS PASSED SUCCESSFULLY! ✨");
    console.log("====================================================================");
  } finally {
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

runTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ Test Suite Failed:", err);
    process.exit(1);
  });
