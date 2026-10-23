const BASE_URL = 'http://localhost:5000';

function parseCookie(setCookieHeader, cookieName) {
  if (!setCookieHeader) return null;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const c of cookies) {
    const match = c.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

async function testVideoReviewLifecycle() {
  console.log('--- Testing Admin Video Review Lifecycle ---');

  // 1. Admin login via /api/auth/admin-login
  const loginRes = await fetch(`${BASE_URL}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@aura.com',
      password: 'Admin@Aura2026'
    })
  });
  if (!loginRes.ok) {
    throw new Error(`Admin login failed with status ${loginRes.status}`);
  }
  const rawAdminCookie = parseCookie(loginRes.headers.get('set-cookie'), 'aura_admin_session');
  const adminCookie = `aura_admin_session=${rawAdminCookie}`;
  const loginData = await loginRes.json();
  const token = loginData.token;
  console.log('✓ Admin authenticated successfully');

  // 2. Fetch products to get a valid product ID
  const prodsRes = await fetch(`${BASE_URL}/api/products`);
  const prods = await prodsRes.json();
  const product = prods[0];
  console.log(`✓ Target product: ${product.name || product.title} (${product._id})`);

  // 3. Admin creates an influencer video review
  const addRes = await fetch(`${BASE_URL}/api/admin/reviews`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      productId: product._id,
      customerName: 'Aria Lookbook (Creator)',
      rating: 5,
      title: 'Drape & Fit Try-On',
      comment: 'The 9:16 vertical video demonstrates how it looks walking in natural daylight. Breathable and luxurious!',
      isInfluencer: true,
      influencerHandle: '@aria_aura',
      isVerifiedPurchase: true,
      status: 'approved',
      videoUrl: '/uploads/reviews/videos/fashion-tryon-4.mp4',
      thumbnailUrl: '/uploads/reviews/videos/fashion-tryon-4-thumb.jpg'
    })
  });

  const addData = await addRes.json();
  if (!addRes.ok) {
    throw new Error(`Failed to add review: ${addData.message}`);
  }
  const createdId = addData.review._id;
  console.log(`✓ Admin created video review ID: ${createdId}`);
  if (addData.review.video?.url !== '/uploads/reviews/videos/fashion-tryon-4.mp4') {
    throw new Error('Video URL not preserved');
  }
  if (!addData.review.isInfluencer || addData.review.influencerHandle !== '@aria_aura') {
    throw new Error('Influencer fields not preserved');
  }

  // 4. Verify storefront GET /api/products/:productId/reviews returns the video review with video reel
  const sfRes = await fetch(`${BASE_URL}/api/products/${product._id}/reviews`);
  const sfData = await sfRes.json();
  const foundInStorefront = sfData.reviews.find(r => r._id === createdId);
  if (!foundInStorefront || !foundInStorefront.video?.url) {
    throw new Error('Created review not found in storefront product reviews');
  }
  console.log(`✓ Storefront correctly serves video review (Reel count: ${sfData.videoReel?.length || 0})`);

  // 5. Admin edits the review
  const editRes = await fetch(`${BASE_URL}/api/admin/reviews/${createdId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookie,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      title: 'Updated Drape & Movement Reel',
      rating: 5,
      status: 'approved',
      isInfluencer: true,
      influencerHandle: '@aria_luxury'
    })
  });
  const editData = await editRes.json();
  if (!editRes.ok) {
    throw new Error(`Failed to edit review: ${editData.message}`);
  }
  if (editData.review.title !== 'Updated Drape & Movement Reel' || editData.review.influencerHandle !== '@aria_luxury') {
    throw new Error('Edit review did not persist');
  }
  console.log('✓ Admin edited review successfully');

  // 6. Admin deletes the test review
  const delRes = await fetch(`${BASE_URL}/api/admin/reviews/${createdId}`, {
    method: 'DELETE',
    headers: {
      Cookie: adminCookie,
      Authorization: `Bearer ${token}`
    }
  });
  if (!delRes.ok) {
    throw new Error('Failed to delete review');
  }
  console.log('✓ Admin deleted review successfully');

  console.log('\n--- ALL ADMIN VIDEO REVIEW LIFECYCLE TESTS PASSED! ---');
}

testVideoReviewLifecycle().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
