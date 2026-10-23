const mongoose = require('mongoose');

async function verify() {
  await mongoose.connect('mongodb://localhost:27017/aura');
  const db = mongoose.connection.db;
  
  const userCount = await db.collection('users').countDocuments();
  const customerCount = await db.collection('users').countDocuments({ role: { $ne: 'admin' } });
  const adminCount = await db.collection('users').countDocuments({ role: 'admin' });
  const orderCount = await db.collection('orders').countDocuments();
  const notifCount = await db.collection('adminnotifications').countDocuments();
  const reviewCount = await db.collection('reviews').countDocuments();
  const returnCount = await db.collection('returnrequests').countDocuments();
  
  console.log('=== CURRENT MONGODB AURA COUNTS ===');
  console.log('Total Users:', userCount);
  console.log('Admins:', adminCount);
  console.log('Customers:', customerCount);
  console.log('Total Orders:', orderCount);
  console.log('Admin Notifications:', notifCount);
  console.log('Reviews:', reviewCount);
  console.log('Return Requests:', returnCount);

  const users = await db.collection('users').find({}, { projection: { name: 1, email: 1, role: 1 } }).toArray();
  console.log('\n=== REMAINING USERS IN DB ===');
  users.forEach(u => console.log(`- [${u._id}] ${u.role}: ${u.name} <${u.email}>`));

  const orders = await db.collection('orders').find({}, { projection: { orderId: 1, 'customer.fullName': 1, 'customer.email': 1, total: 1, status: 1, createdAt: 1 } }).toArray();
  console.log(`\n=== REMAINING ORDERS IN DB (${orders.length}) ===`);
  orders.forEach(o => console.log(`- [${o.orderId}] ${o.customer?.fullName} (${o.customer?.email}) - Rs ${o.total} | Status: ${o.status}`));

  await mongoose.disconnect();
}

verify().catch(console.error);
