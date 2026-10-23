const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const http = require('http');
const path = require('path');
const fs = require('fs');

const TEST_DB_URI = 'mongodb://localhost:27017/aura_test_review_photos';
const JWT_SECRET = 'aura_luxury_fashion_jwt_secret_key_2026_super_secure';
const PORT = 5058;

// Models and routes
const Review = require('../models/Review');
const Product = require('../models/Product');
const Order = require('../models/Order');
const User = require('../models/User');
const reviewRoutes = require('../routes/reviewRoutes');
const { REVIEWS_UPLOAD_DIR } = require('../utils/reviewPhotoStorage');

// Helper to construct multipart/form-data payload manually without external libraries
function createMultipartPayload(fields, files = []) {
  const boundary = `----WebKitFormBoundary${Date.now()}${Math.random().toString(36).substring(2, 9)}`;
  const buffers = [];

  // Add text fields
  for (const [key, val] of Object.entries(fields)) {
    buffers.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`));
  }

  // Add files
  for (const f of files) {
    buffers.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${f.fieldname}"; filename="${f.filename}"\r\nContent-Type: ${f.contentType}\r\n\r\n`
      )
    );
    buffers.push(f.buffer);
    buffers.push(Buffer.from('\r\n'));
  }

  buffers.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    contentType: `multipart/form-data; boundary=${boundary}`,
    body: Buffer.concat(buffers)
  };
}

async function runTests() {
  console.log('Connecting to isolated test DB:', TEST_DB_URI);
  await mongoose.connect(TEST_DB_URI);

  // Clear test DB
  await Review.deleteMany({});
  await Product.deleteMany({});
  await Order.deleteMany({});
  await User.deleteMany({ email: { $in: ['verified@aura.com', 'unverified@aura.com', 'cancelled@aura.com', 'admin@aura.com'] } });
  console.log('Isolated test DB cleared.');

  // Express Test Server
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
  app.use('/api', reviewRoutes);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`Test server running at http://localhost:${PORT}`);

  const baseUrl = `http://localhost:${PORT}/api`;

  // Create Users
  const userVerified = await User.create({
    name: 'Verified Patron',
    email: 'verified@aura.com',
    password: 'password123',
    role: 'customer'
  });

  const userUnverified = await User.create({
    name: 'Unverified Shopper',
    email: 'unverified@aura.com',
    password: 'password123',
    role: 'customer'
  });

  const userCancelled = await User.create({
    name: 'Cancelled Order Shopper',
    email: 'cancelled@aura.com',
    password: 'password123',
    role: 'customer'
  });

  const userAdmin = await User.create({
    name: 'Atelier Moderator',
    email: 'admin@aura.com',
    password: 'password123',
    role: 'admin'
  });

  // Create Product
  const product = await Product.create({
    name: 'AURA Silk Trench Coat',
    description: 'A masterpiece in 100% mulberry silk with signature horn buttons.',
    price: 18500,
    mrp: 24000,
    category: 'Outerwear',
    image: 'https://example.com/trench.jpg',
    stock: 12
  });

  const prodId = product._id.toString();

  // Create Orders: 1 Delivered for verified, 1 Cancelled for cancelled
  await Order.create({
    orderId: 'AUR-ORD-PHOTO-01',
    customer: {
      customerId: userVerified._id,
      fullName: userVerified.name,
      name: userVerified.name,
      email: userVerified.email,
      phone: '9876543210'
    },
    shippingAddress: {
      address: '74 Park Avenue, Suite 4B',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400001'
    },
    items: [
      {
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: 1
      }
    ],
    subtotal: product.price,
    total: product.price,
    status: 'Delivered'
  });

  await Order.create({
    orderId: 'AUR-ORD-PHOTO-02',
    customer: {
      customerId: userCancelled._id,
      fullName: userCancelled.name,
      name: userCancelled.name,
      email: userCancelled.email,
      phone: '9876543211'
    },
    shippingAddress: {
      address: '12 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      pinCode: '400020'
    },
    items: [
      {
        productId: product._id,
        name: product.name,
        price: product.price,
        quantity: 1
      }
    ],
    subtotal: product.price,
    total: product.price,
    status: 'Cancelled'
  });

  const tokenVerified = jwt.sign({ id: userVerified._id.toString(), email: userVerified.email, name: userVerified.name }, JWT_SECRET, { expiresIn: '1d' });
  const tokenUnverified = jwt.sign({ id: userUnverified._id.toString(), email: userUnverified.email, name: userUnverified.name }, JWT_SECRET, { expiresIn: '1d' });
  const tokenCancelled = jwt.sign({ id: userCancelled._id.toString(), email: userCancelled.email, name: userCancelled.name }, JWT_SECRET, { expiresIn: '1d' });
  const tokenAdmin = jwt.sign({ id: userAdmin._id.toString(), email: userAdmin.email, role: 'admin', name: userAdmin.name }, JWT_SECRET, { expiresIn: '1d' });

  // Sample real valid image binary buffers
  const validJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x60]);
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  const validWebpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20]);
  const invalidFakeBuffer = Buffer.from('<?php echo "malicious script"; ?> This is an executable text disguised as jpg');

  try {
    console.log('\n--- TEST 1: Reviews Without Photos (Compatibility) ---');
    const resNoPhoto = await fetch(`${baseUrl}/products/${prodId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aura_customer_session=${tokenVerified}`
      },
      body: JSON.stringify({
        rating: 5,
        title: 'Timeless luxury masterpiece',
        comment: 'Drapes exceptionally well and the horn buttons add incredible elegance.'
      })
    });
    if (resNoPhoto.status !== 201) {
      const err = await resNoPhoto.json();
      throw new Error(`Review without photos failed: ${err.message}`);
    }
    const dataNoPhoto = await resNoPhoto.json();
    if (!Array.isArray(dataNoPhoto.review.photos) || dataNoPhoto.review.photos.length !== 0) {
      throw new Error('Expected photos array to be empty array for review without photos!');
    }
    console.log('✓ Verified: Review without photos works seamlessly and saves with photos: [].');

    // Clean up review to test upload flows
    await Review.deleteMany({});

    console.log('\n--- TEST 2: Unverified Purchaser Attempt Blocked & File Cleaned ---');
    const { contentType: ct2, body: b2 } = createMultipartPayload(
      {
        rating: '5',
        title: 'Tried to review without buying',
        comment: 'I did not purchase this but want to leave a review.'
      },
      [
        { fieldname: 'photos', filename: 'unverified.jpg', contentType: 'image/jpeg', buffer: validJpgBuffer }
      ]
    );

    const initialFilesCount = fs.readdirSync(REVIEWS_UPLOAD_DIR).length;

    const resUnverified = await fetch(`${baseUrl}/products/${prodId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': ct2,
        'Cookie': `aura_customer_session=${tokenUnverified}`
      },
      body: b2
    });

    if (resUnverified.status !== 403) {
      throw new Error(`Expected 403 for unverified purchaser, got ${resUnverified.status}`);
    }

    const filesAfterUnverified = fs.readdirSync(REVIEWS_UPLOAD_DIR).length;
    if (filesAfterUnverified !== initialFilesCount) {
      throw new Error('File leak: Uploaded file was not cleaned up after unverified purchaser 403 error!');
    }
    console.log('✓ Verified: Unverified purchaser blocked (403) and uploaded files immediately cleaned up.');

    console.log('\n--- TEST 3: Cancelled Order Purchaser Attempt Blocked & File Cleaned ---');
    const { contentType: ct3, body: b3 } = createMultipartPayload(
      {
        rating: '4',
        title: 'Cancelled order critique',
        comment: 'My order was cancelled but I still tried to review.'
      },
      [
        { fieldname: 'photos', filename: 'cancelled.png', contentType: 'image/png', buffer: validPngBuffer }
      ]
    );

    const resCancelled = await fetch(`${baseUrl}/products/${prodId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': ct3,
        'Cookie': `aura_customer_session=${tokenCancelled}`
      },
      body: b3
    });

    if (resCancelled.status !== 403) {
      throw new Error(`Expected 403 for cancelled order purchaser, got ${resCancelled.status}`);
    }
    const filesAfterCancelled = fs.readdirSync(REVIEWS_UPLOAD_DIR).length;
    if (filesAfterCancelled !== initialFilesCount) {
      throw new Error('File leak: Uploaded file was not cleaned up after cancelled order 403 error!');
    }
    console.log('✓ Verified: Cancelled order purchaser blocked (403) and file cleaned up.');

    console.log('\n--- TEST 4: Fake / Corrupted Image File Rejected by Magic Bytes ---');
    const { contentType: ct4, body: b4 } = createMultipartPayload(
      {
        rating: '5',
        title: 'Fake image upload test',
        comment: 'Testing file content verification.'
      },
      [
        { fieldname: 'photos', filename: 'script.jpg', contentType: 'image/jpeg', buffer: invalidFakeBuffer }
      ]
    );

    const resFake = await fetch(`${baseUrl}/products/${prodId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': ct4,
        'Cookie': `aura_customer_session=${tokenVerified}`
      },
      body: b4
    });

    if (resFake.status !== 400) {
      throw new Error(`Expected 400 for fake image content, got ${resFake.status}`);
    }
    const fakeData = await resFake.json();
    console.log(`Backend rejection message: "${fakeData.message}"`);
    const filesAfterFake = fs.readdirSync(REVIEWS_UPLOAD_DIR).length;
    if (filesAfterFake !== initialFilesCount) {
      throw new Error('File leak: Fake image was not cleaned up after magic byte rejection!');
    }
    console.log('✓ Verified: Fake image detected via magic bytes, rejected with 400, and file cleaned up.');

    console.log('\n--- TEST 4B: Exceeding Maximum Photo Count (> 5 Photos) ---');
    const { contentType: ct4b, body: b4b } = createMultipartPayload(
      {
        rating: '5',
        title: 'Too many photos test',
        comment: 'Uploading 6 photos which exceeds the 5-photo limit.'
      },
      [
        { fieldname: 'photos', filename: 'p1.jpg', contentType: 'image/jpeg', buffer: validJpgBuffer },
        { fieldname: 'photos', filename: 'p2.jpg', contentType: 'image/jpeg', buffer: validJpgBuffer },
        { fieldname: 'photos', filename: 'p3.jpg', contentType: 'image/jpeg', buffer: validJpgBuffer },
        { fieldname: 'photos', filename: 'p4.jpg', contentType: 'image/jpeg', buffer: validJpgBuffer },
        { fieldname: 'photos', filename: 'p5.jpg', contentType: 'image/jpeg', buffer: validJpgBuffer },
        { fieldname: 'photos', filename: 'p6.jpg', contentType: 'image/jpeg', buffer: validJpgBuffer }
      ]
    );

    const resTooMany = await fetch(`${baseUrl}/products/${prodId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': ct4b,
        'Cookie': `aura_customer_session=${tokenVerified}`
      },
      body: b4b
    });

    if (resTooMany.status !== 400) {
      throw new Error(`Expected 400 for exceeding 5 photos, got ${resTooMany.status}`);
    }
    const tooManyData = await resTooMany.json();
    console.log(`Backend rejection message: "${tooManyData.message}"`);
    console.log('✓ Verified: Upload of 6 photos rejected with 400 limit error.');

    console.log('\n--- TEST 4C: Oversized File (> 5MB) Rejected ---');
    // Create oversized JPEG buffer (5.2 MB)
    const oversizedBuffer = Buffer.alloc(5.2 * 1024 * 1024);
    oversizedBuffer[0] = 0xff;
    oversizedBuffer[1] = 0xd8;
    oversizedBuffer[2] = 0xff;

    const { contentType: ct4c, body: b4c } = createMultipartPayload(
      {
        rating: '5',
        title: 'Oversized photo test',
        comment: 'Uploading a 5.2MB photo which exceeds the 5MB limit.'
      },
      [
        { fieldname: 'photos', filename: 'huge.jpg', contentType: 'image/jpeg', buffer: oversizedBuffer }
      ]
    );

    const resOversized = await fetch(`${baseUrl}/products/${prodId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': ct4c,
        'Cookie': `aura_customer_session=${tokenVerified}`
      },
      body: b4c
    });

    if (resOversized.status !== 400) {
      throw new Error(`Expected 400 for oversized file, got ${resOversized.status}`);
    }
    const oversizedData = await resOversized.json();
    console.log(`Backend rejection message: "${oversizedData.message}"`);
    console.log('✓ Verified: File exceeding 5MB rejected with 400 size limit error.');

    console.log('\n--- TEST 5: Valid Multi-Photo Review Upload (JPG + PNG + WebP) ---');
    const { contentType: ct5, body: b5 } = createMultipartPayload(
      {
        rating: '5',
        title: 'Exquisite silk and immaculate tailoring',
        comment: 'Attached are photos showing the collar lapels, lining, and sleeve cuff drape.'
      },
      [
        { fieldname: 'photos', filename: 'lapel.jpg', contentType: 'image/jpeg', buffer: validJpgBuffer },
        { fieldname: 'photos', filename: 'lining.png', contentType: 'image/png', buffer: validPngBuffer },
        { fieldname: 'photos', filename: 'cuff.webp', contentType: 'image/webp', buffer: validWebpBuffer }
      ]
    );

    const resValidMulti = await fetch(`${baseUrl}/products/${prodId}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': ct5,
        'Cookie': `aura_customer_session=${tokenVerified}`
      },
      body: b5
    });

    if (resValidMulti.status !== 201) {
      const err = await resValidMulti.json();
      throw new Error(`Multi-photo upload failed: ${err.message}`);
    }

    const dataMulti = await resValidMulti.json();
    const createdReview = dataMulti.review;
    const reviewId = createdReview._id;

    if (!Array.isArray(createdReview.photos) || createdReview.photos.length !== 3) {
      throw new Error(`Expected 3 photos in saved review, got ${createdReview.photos?.length}`);
    }

    console.log(`✓ Verified: Review created (#${reviewId}) with 3 customer photos.`);

    // Verify all 3 photo files actually exist on disk in REVIEWS_UPLOAD_DIR
    for (const p of createdReview.photos) {
      const filePath = path.join(REVIEWS_UPLOAD_DIR, p.filename);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Expected photo file ${p.filename} to exist on disk!`);
      }
      console.log(`  - File verified on disk: ${p.filename} (${p.mimeType}, size: ${p.size}B)`);
    }

    // Verify static serving of the photo
    const samplePhotoUrl = createdReview.photos[0].url;
    const resStatic = await fetch(`http://localhost:${PORT}${samplePhotoUrl}`);
    if (resStatic.status !== 200) {
      throw new Error(`Static photo fetch failed with status ${resStatic.status}`);
    }
    console.log(`✓ Verified: Static file serving accessible at http://localhost:${PORT}${samplePhotoUrl}`);

    console.log('\n--- TEST 6: Public Storefront API Visibility ---');
    const resPublic = await fetch(`${baseUrl}/products/${prodId}/reviews`);
    if (resPublic.status !== 200) throw new Error('Failed to retrieve public reviews');
    const dataPublic = await resPublic.json();

    if (dataPublic.reviews.length !== 1 || dataPublic.reviews[0].photos.length !== 3) {
      throw new Error('Public review list did not return approved review with photos!');
    }
    console.log('✓ Verified: Public product details API returns approved review with all 3 customer photos.');

    console.log('\n--- TEST 7: Customer Photo Edit & Removal Cleanup ---');
    // Customer retains 1st and 3rd photo, removes 2nd photo, and adds a new photo
    const retainedPhotoIds = [createdReview.photos[0]._id, createdReview.photos[2]._id];
    const removedPhotoFilename = createdReview.photos[1].filename;

    const { contentType: ct7, body: b7 } = createMultipartPayload(
      {
        rating: '5',
        title: 'Exquisite silk and immaculate tailoring (Updated)',
        comment: 'Updated critique with replacement cuff photo.',
        retainedPhotoIds: JSON.stringify(retainedPhotoIds)
      },
      [
        { fieldname: 'photos', filename: 'new-cuff.jpg', contentType: 'image/jpeg', buffer: validJpgBuffer }
      ]
    );

    const resEdit = await fetch(`${baseUrl}/reviews/${reviewId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': ct7,
        'Cookie': `aura_customer_session=${tokenVerified}`
      },
      body: b7
    });

    if (resEdit.status !== 200) {
      const err = await resEdit.json();
      throw new Error(`Review edit failed: ${err.message}`);
    }

    const dataEdit = await resEdit.json();
    const updatedReview = dataEdit.review;

    if (updatedReview.photos.length !== 3) {
      throw new Error(`Expected 3 photos after edit, got ${updatedReview.photos.length}`);
    }

    // Verify removed photo file is DELETED from disk
    const removedFilePath = path.join(REVIEWS_UPLOAD_DIR, removedPhotoFilename);
    if (fs.existsSync(removedFilePath)) {
      throw new Error(`File leak: Removed photo ${removedPhotoFilename} was NOT deleted from disk!`);
    }
    console.log(`✓ Verified: Removed photo (${removedPhotoFilename}) was safely deleted from disk.`);

    // Verify retained photos and new photo exist on disk
    for (const p of updatedReview.photos) {
      const filePath = path.join(REVIEWS_UPLOAD_DIR, p.filename);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Expected photo file ${p.filename} to exist on disk!`);
      }
    }
    console.log('✓ Verified: Retained and newly uploaded photos safely preserved.');

    console.log('\n--- TEST 8: Admin Review Moderation & Public Visibility Isolation ---');
    // Admin views reviews
    const resAdminList = await fetch(`${baseUrl}/admin/reviews`, {
      headers: { 'Cookie': `aura_admin_session=${tokenAdmin}` }
    });
    if (resAdminList.status !== 200) throw new Error('Admin review fetch failed');
    const dataAdminList = await resAdminList.json();
    const adminReview = dataAdminList.reviews.find((r) => String(r._id) === String(reviewId));
    if (!adminReview || adminReview.photos.length !== 3) {
      throw new Error('Admin did not receive review with customer photo thumbnails!');
    }
    console.log('✓ Verified: Admin moderation dashboard receives review with 3 customer photo thumbnails.');

    // Admin hides review
    const resHide = await fetch(`${baseUrl}/admin/reviews/${reviewId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aura_admin_session=${tokenAdmin}`
      },
      body: JSON.stringify({ status: 'hidden' })
    });
    if (resHide.status !== 200) throw new Error('Admin hide review failed');

    // Verify storefront no longer displays hidden review or its photos
    const resPublicAfterHide = await fetch(`${baseUrl}/products/${prodId}/reviews`);
    const dataPublicAfterHide = await resPublicAfterHide.json();
    if (dataPublicAfterHide.reviews.length !== 0) {
      throw new Error('Security Breach: Hidden review photos still visible to public customers!');
    }
    console.log('✓ Verified: Hidden review and its customer photos are completely invisible on storefront.');

    // Admin unhides review
    await fetch(`${baseUrl}/admin/reviews/${reviewId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `aura_admin_session=${tokenAdmin}`
      },
      body: JSON.stringify({ status: 'approved' })
    });

    console.log('\n--- TEST 9: Review Deletion and Disk Photo Cleanup ---');
    const currentFiles = updatedReview.photos.map((p) => p.filename);

    const resDelete = await fetch(`${baseUrl}/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: { 'Cookie': `aura_customer_session=${tokenVerified}` }
    });
    if (resDelete.status !== 200) throw new Error('Review deletion failed');

    // Verify all associated files deleted from disk
    for (const filename of currentFiles) {
      const filePath = path.join(REVIEWS_UPLOAD_DIR, filename);
      if (fs.existsSync(filePath)) {
        throw new Error(`File leak: Photo file ${filename} still exists on disk after review deletion!`);
      }
    }
    console.log('✓ Verified: All associated photos deleted from disk when review is deleted.');

    console.log('\n=================================================================');
    console.log('🎉 ALL 9 REVIEW PHOTO TESTS PASSED ON ISOLATED MONGODB DATABASE!');
    console.log('=================================================================');
  } finally {
    await Review.deleteMany({});
    await Product.deleteMany({});
    await Order.deleteMany({});
    await User.deleteMany({ email: { $in: ['verified@aura.com', 'unverified@aura.com', 'cancelled@aura.com', 'admin@aura.com'] } });
    await mongoose.disconnect();
    server.close();
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
