const mongoose = require('mongoose');

async function inspectReviewsAndNotifs() {
  await mongoose.connect('mongodb://localhost:27017/aura');
  const db = mongoose.connection.db;

  const reviews = await db.collection('reviews').find({}).toArray();
  console.log(`=== REVIEWS (${reviews.length}) ===`);
  reviews.forEach((r, i) => {
    console.log(`${i+1}. ID: ${r._id} | ProductId: ${r.productId} | CustomerId: ${r.customerId} | CustomerName: "${r.customerName}" | Title: "${r.title}" | Status: ${r.status}`);
  });

  const notifs = await db.collection('adminnotifications').find({}).toArray();
  console.log(`\n=== NOTIFICATIONS (${notifs.length}) ===`);
  const notifsByRef = {};
  notifs.forEach(n => {
    const k = n.type || 'other';
    notifsByRef[k] = (notifsByRef[k] || 0) + 1;
  });
  console.log('Notif breakdown by type:', notifsByRef);

  await mongoose.disconnect();
}

inspectReviewsAndNotifs().catch(console.error);
