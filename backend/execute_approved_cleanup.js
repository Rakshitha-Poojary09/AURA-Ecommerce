const mongoose = require('mongoose');

async function executeApprovedCleanup() {
  await mongoose.connect('mongodb://localhost:27017/aura');
  const db = mongoose.connection.db;

  console.log('=== BEFORE CLEANUP COUNTS ===');
  const beforeUsersCount = await db.collection('users').countDocuments();
  const beforeCustomersCount = await db.collection('users').countDocuments({ role: 'customer' });
  const beforeOrdersCount = await db.collection('orders').countDocuments();
  const beforeNotifsCount = await db.collection('adminnotifications').countDocuments();
  const beforeReviewsCount = await db.collection('reviews').countDocuments();
  const beforeReturnsCount = await db.collection('returnrequests').countDocuments();

  console.log(`Users total: ${beforeUsersCount} (Customers: ${beforeCustomersCount}, Admin: ${beforeUsersCount - beforeCustomersCount})`);
  console.log(`Orders total: ${beforeOrdersCount}`);
  console.log(`Notifications total: ${beforeNotifsCount}`);
  console.log(`Reviews total: ${beforeReviewsCount}`);
  console.log(`Returns total: ${beforeReturnsCount}`);

  // The 21 confirmed test customer IDs
  const testUserIds = [
    new mongoose.Types.ObjectId("6accb642b0bc7d996cf4eccf"),
    new mongoose.Types.ObjectId("6accb66cb0bc7d996cf4ecd8"),
    new mongoose.Types.ObjectId("6acf4a88c467673fbc0e43dc"),
    new mongoose.Types.ObjectId("6acf4a89c467673fbc0e43dd"),
    new mongoose.Types.ObjectId("6ad0946bdd006cd2294bfedd"),
    new mongoose.Types.ObjectId("6ad0947bdd006cd2294bfee8"),
    new mongoose.Types.ObjectId("6ad0947bdd006cd2294bfee9"),
    new mongoose.Types.ObjectId("6ad0947bdd006cd2294bfeea"),
    new mongoose.Types.ObjectId("6ad0951fdd006cd2294bfeff"),
    new mongoose.Types.ObjectId("6ad0952cdd006cd2294bff0a"),
    new mongoose.Types.ObjectId("6ad0952ddd006cd2294bff0b"),
    new mongoose.Types.ObjectId("6ad0952ddd006cd2294bff0c"),
    new mongoose.Types.ObjectId("6ad099bedd006cd2294bff79"),
    new mongoose.Types.ObjectId("6ad099c7dd006cd2294bff84"),
    new mongoose.Types.ObjectId("6ad099c8dd006cd2294bff85"),
    new mongoose.Types.ObjectId("6ad099c8dd006cd2294bff86"),
    new mongoose.Types.ObjectId("6ad0a1dc178aed61185a7414"),
    new mongoose.Types.ObjectId("6ad0a1e8178aed61185a741f"),
    new mongoose.Types.ObjectId("6ad0a1e8178aed61185a7420"),
    new mongoose.Types.ObjectId("6ad0a1e8178aed61185a7421"),
    new mongoose.Types.ObjectId("6ad229394bf5e1c69310c4b3"),
  ];

  // The 17 confirmed test order IDs
  const testOrderIds = [
    new mongoose.Types.ObjectId("6accb644b0bc7d996cf4ecd4"),
    new mongoose.Types.ObjectId("6acf4a89c467673fbc0e43de"),
    new mongoose.Types.ObjectId("6acf4a89c467673fbc0e43e0"),
    new mongoose.Types.ObjectId("6ad0946bdd006cd2294bfede"),
    new mongoose.Types.ObjectId("6ad0947bdd006cd2294bfeeb"),
    new mongoose.Types.ObjectId("6ad0947bdd006cd2294bfeed"),
    new mongoose.Types.ObjectId("6ad0951fdd006cd2294bff00"),
    new mongoose.Types.ObjectId("6ad0952ddd006cd2294bff0d"),
    new mongoose.Types.ObjectId("6ad0952ddd006cd2294bff0f"),
    new mongoose.Types.ObjectId("6ad099bedd006cd2294bff7a"),
    new mongoose.Types.ObjectId("6ad099c8dd006cd2294bff87"),
    new mongoose.Types.ObjectId("6ad099c8dd006cd2294bff89"),
    new mongoose.Types.ObjectId("6ad0a1dc178aed61185a7415"),
    new mongoose.Types.ObjectId("6ad0a1e9178aed61185a7422"),
    new mongoose.Types.ObjectId("6ad0a1ea178aed61185a7424"),
    new mongoose.Types.ObjectId("6ad73dd00cbec86900b91921"),
    new mongoose.Types.ObjectId("6ad73dd10cbec86900b91923"),
    new mongoose.Types.ObjectId("6ad742631108a87f6621e836"),
  ];

  const testUserIdStrings = testUserIds.map(id => id.toString());
  const testOrderIdStrings = testOrderIds.map(id => id.toString());

  console.log('\n--- 1. DELETING CONFIRMED TEST CUSTOMER ACCOUNTS ---');
  const userDeleteResult = await db.collection('users').deleteMany({
    _id: { $in: testUserIds },
    role: 'customer' // Extra guard: never delete admin
  });
  console.log(`Deleted test customers count: ${userDeleteResult.deletedCount}`);

  console.log('\n--- 2. DELETING CONFIRMED TEST ORDERS ---');
  const orderDeleteResult = await db.collection('orders').deleteMany({
    _id: { $in: testOrderIds }
  });
  console.log(`Deleted test orders count: ${orderDeleteResult.deletedCount}`);

  console.log('\n--- 3. DELETING ASSOCIATED TEST NOTIFICATIONS ---');
  // Match notifications linked to deleted test users or test orders
  const notifDeleteResult = await db.collection('adminnotifications').deleteMany({
    $or: [
      { referenceId: { $in: [...testUserIdStrings, ...testOrderIdStrings] } },
      { eventKey: { $regex: /^(new_customer|new_order):/ }, referenceId: { $in: [...testUserIdStrings, ...testOrderIdStrings] } },
      { message: { $regex: /(@example\.com|@aura-test\.com|reviewer_|mod_customer_|sep_customer_|AUR-TEST-|AUR-MOD-|AUR-CNCL-|AUR-PURCH-|TEST-ORD-|TEST-RACE-|TEST-ACC-)/i } }
    ]
  });
  console.log(`Deleted test notifications count: ${notifDeleteResult.deletedCount}`);

  console.log('\n=== AFTER CLEANUP COUNTS ===');
  const afterUsersCount = await db.collection('users').countDocuments();
  const afterCustomersCount = await db.collection('users').countDocuments({ role: 'customer' });
  const afterOrdersCount = await db.collection('orders').countDocuments();
  const afterNotifsCount = await db.collection('adminnotifications').countDocuments();
  const afterReviewsCount = await db.collection('reviews').countDocuments();
  const afterReturnsCount = await db.collection('returnrequests').countDocuments();

  console.log(`Users total: ${afterUsersCount} (Customers: ${afterCustomersCount}, Admin: ${afterUsersCount - afterCustomersCount})`);
  console.log(`Orders total: ${afterOrdersCount}`);
  console.log(`Notifications total: ${afterNotifsCount}`);
  console.log(`Reviews total: ${afterReviewsCount}`);
  console.log(`Returns total: ${afterReturnsCount}`);

  // Print remaining users to be 100% transparent
  const remainingUsers = await db.collection('users').find({}).toArray();
  console.log('\nREMAINING USERS IN DATABASE:');
  remainingUsers.forEach((u, i) => {
    console.log(`  ${i+1}. [${u.role.toUpperCase()}] ${u.name} <${u.email}> (_id: ${u._id})`);
  });

  // Print remaining orders to verify genuine orders
  const remainingOrders = await db.collection('orders').find({}).toArray();
  console.log(`\nREMAINING ORDERS IN DATABASE (${remainingOrders.length}):`);
  remainingOrders.forEach((o, i) => {
    console.log(`  ${i+1}. OrderID: ${o.orderId} | Customer: "${o.customer?.fullName || o.customer?.name}" <${o.customer?.email}> | Total: ₹${o.total} | Status: ${o.status}`);
  });

  await mongoose.disconnect();
}

executeApprovedCleanup().catch(console.error);
