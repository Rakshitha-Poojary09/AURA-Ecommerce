const mongoose = require('mongoose');

async function inspectOrders() {
  await mongoose.connect('mongodb://localhost:27017/aura');
  const db = mongoose.connection.db;

  const orders = await db.collection('orders').find({}).sort({ createdAt: 1 }).toArray();
  console.log(`TOTAL ORDERS: ${orders.length}`);

  const orderSummary = orders.map((o, idx) => ({
    index: idx + 1,
    _id: o._id.toString(),
    orderId: o.orderId,
    customerName: o.customer?.fullName || o.customer?.name,
    customerEmail: o.customer?.email,
    customerId: o.customer?.customerId ? o.customer.customerId.toString() : null,
    total: o.total,
    status: o.status,
    createdAt: o.createdAt
  }));

  const fs = require('fs');
  fs.writeFileSync('c:/Users/LENOVO/Desktop/AURA-Ecommerce/backend/db_order_audit.json', JSON.stringify(orderSummary, null, 2));
  console.log('Successfully wrote order audit to backend/db_order_audit.json');

  await mongoose.disconnect();
}

inspectOrders().catch(console.error);
