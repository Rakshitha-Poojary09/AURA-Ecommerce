const mongoose = require('mongoose');

const KEEP_USER_EMAILS = [
  'admin@aura.com',
  'rakshithapoojary560@gmail.com',
  'kriti@gmail.com',
  'ashi@gmail.com'
];

const KEEP_ORDER_IDS = [
  'AUR-ORD-488634',
  'AUR-ORD-210084',
  'AUR-ORD-320056',
  'AUR-ORD-452211',
  'AUR-ORD-774806',
  'AUR-ORD-878566',
  'AUR-ORD-660710',
  'AUR-ORD-308195',
  'AUR-ORD-608633',
  'AUR-ORD-180710',
  'AUR-ORD-112233'
];

const TEST_PRODUCT_NAMES = [
  'Alert Silk Blouse 1791458508997',
  'Sold Out Velvet Blazer 1791458508997',
  'Alert Silk Blouse 1791459128418',
  'Sold Out Velvet Blazer 1791459128418'
];

async function runCleanup() {
  console.log('==================================================================');
  console.log('AURA DATABASE SURGICAL CLEANUP');
  console.log('==================================================================\n');

  await mongoose.connect('mongodb://localhost:27017/aura');
  const db = mongoose.connection.db;

  // -------------------------------------------------------------
  // 1. CLEANUP PRODUCTS
  // -------------------------------------------------------------
  console.log('1. Cleaning test products...');
  const prodDeleteResult = await db.collection('products').deleteMany({
    name: { $in: TEST_PRODUCT_NAMES }
  });
  console.log(`✓ Removed ${prodDeleteResult.deletedCount} test products.`);

  const remainingProducts = await db.collection('products').find({}).toArray();
  console.log(`Remaining products in MongoDB: ${remainingProducts.length}`);
  if (remainingProducts.length !== 19) {
    console.warn(`⚠️ Warning: Expected 19 products, found ${remainingProducts.length}`);
  }

  // -------------------------------------------------------------
  // 2. CLEANUP REVIEWS
  // -------------------------------------------------------------
  console.log('\n2. Cleaning test reviews...');
  const revDeleteResult = await db.collection('reviews').deleteMany({
    $or: [
      { title: 'Exceptional Silk Craftsmanship' },
      { customerName: 'Maya Lin' }
    ]
  });
  console.log(`✓ Removed ${revDeleteResult.deletedCount} test reviews.`);

  const remainingReviews = await db.collection('reviews').find({}).toArray();
  console.log(`Remaining reviews in MongoDB: ${remainingReviews.length}`);
  remainingReviews.forEach(r => {
    console.log(` - Kept review: "${r.title}" by ${r.customerName} (${r.rating}★)`);
  });

  // -------------------------------------------------------------
  // 3. CLEANUP ORDERS
  // -------------------------------------------------------------
  console.log('\n3. Cleaning test orders...');
  const orderDeleteResult = await db.collection('orders').deleteMany({
    orderId: { $nin: KEEP_ORDER_IDS }
  });
  console.log(`✓ Removed ${orderDeleteResult.deletedCount} test orders.`);

  const remainingOrders = await db.collection('orders').find({}).toArray();
  console.log(`Remaining orders in MongoDB: ${remainingOrders.length}`);
  remainingOrders.forEach(o => {
    console.log(` - Kept order: ${o.orderId} | ${o.customer?.fullName} (${o.customer?.email}) | ₹${o.total} | ${o.status}`);
  });

  // -------------------------------------------------------------
  // 4. CLEANUP USERS
  // -------------------------------------------------------------
  console.log('\n4. Cleaning test users...');
  const userDeleteResult = await db.collection('users').deleteMany({
    email: { $nin: KEEP_USER_EMAILS }
  });
  console.log(`✓ Removed ${userDeleteResult.deletedCount} test users.`);

  const remainingUsers = await db.collection('users').find({}).toArray();
  console.log(`Remaining users in MongoDB: ${remainingUsers.length}`);
  remainingUsers.forEach(u => {
    console.log(` - Kept user: [${u.role}] ${u.name} <${u.email}> (ID: ${u._id})`);
  });

  // -------------------------------------------------------------
  // 5. CLEANUP NOTIFICATIONS
  // -------------------------------------------------------------
  console.log('\n5. Resetting admin notifications to reflect real data only...');
  await db.collection('adminnotifications').deleteMany({});
  console.log('✓ Purged old notifications referencing test entities.');

  console.log('\n==================================================================');
  console.log('SURGICAL CLEANUP COMPLETE!');
  console.log('==================================================================\n');

  await mongoose.disconnect();
}

runCleanup().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
