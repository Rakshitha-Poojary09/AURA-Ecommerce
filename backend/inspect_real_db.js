const mongoose = require('mongoose');

async function inspectDb() {
  await mongoose.connect('mongodb://localhost:27017/aura');
  const db = mongoose.connection.db;

  const users = await db.collection('users').find({}).sort({ createdAt: 1 }).toArray();
  const orders = await db.collection('orders').find({}).toArray();
  const reviews = await db.collection('reviews').find({}).toArray();
  const returns = await db.collection('returnrequests').find({}).toArray();
  const notifs = await db.collection('adminnotifications').find({}).toArray();

  console.log(`TOTAL USERS IN DB: ${users.length}`);
  console.log(`TOTAL ORDERS IN DB: ${orders.length}`);
  console.log(`TOTAL REVIEWS IN DB: ${reviews.length}`);
  console.log(`TOTAL RETURNS IN DB: ${returns.length}`);
  console.log(`TOTAL NOTIFS IN DB: ${notifs.length}`);

  const userReport = users.map((u, idx) => {
    const userIdStr = u._id.toString();
    const userEmail = (u.email || '').toLowerCase().trim();

    // Check linked orders
    const linkedOrders = orders.filter(o => {
      const custId = o.customer?.customerId ? o.customer.customerId.toString() : '';
      const custEmail = (o.customer?.email || '').toLowerCase().trim();
      return custId === userIdStr || custEmail === userEmail;
    }).map(o => ({
      _id: o._id.toString(),
      orderId: o.orderId,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt
    }));

    // Check linked reviews
    const linkedReviews = reviews.filter(r => {
      const custId = r.customerId ? r.customerId.toString() : '';
      const custName = (r.customerName || '').toLowerCase().trim();
      return custId === userIdStr || (userEmail && r.comment && r.comment.includes(userEmail));
    }).map(r => ({
      _id: r._id.toString(),
      rating: r.rating,
      title: r.title,
      customerName: r.customerName,
      createdAt: r.createdAt
    }));

    // Check linked returns
    const linkedReturns = returns.filter(ret => {
      const custEmail = (ret.customer?.email || '').toLowerCase().trim();
      return custEmail === userEmail;
    }).map(ret => ({
      _id: ret._id.toString(),
      requestId: ret.requestId,
      status: ret.status,
      createdAt: ret.createdAt
    }));

    // Check linked notifications
    const linkedNotifs = notifs.filter(n => {
      return (n.referenceId === userIdStr) || (n.message && n.message.includes(userEmail));
    }).map(n => ({
      _id: n._id.toString(),
      title: n.title,
      type: n.type
    }));

    return {
      index: idx + 1,
      _id: userIdStr,
      name: u.name,
      email: u.email,
      role: u.role,
      isVerified: u.isVerified,
      createdAt: u.createdAt,
      ordersCount: linkedOrders.length,
      orders: linkedOrders,
      reviewsCount: linkedReviews.length,
      reviews: linkedReviews,
      returnsCount: linkedReturns.length,
      returns: linkedReturns,
      notifsCount: linkedNotifs.length,
      notifs: linkedNotifs
    };
  });

  const fs = require('fs');
  fs.writeFileSync('c:/Users/LENOVO/Desktop/AURA-Ecommerce/backend/db_user_audit.json', JSON.stringify(userReport, null, 2));
  console.log('Successfully wrote user audit to backend/db_user_audit.json');

  await mongoose.disconnect();
}

inspectDb().catch(console.error);
