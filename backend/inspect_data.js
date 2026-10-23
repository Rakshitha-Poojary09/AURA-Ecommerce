const mongoose = require('mongoose');
const Product = require('./models/Product');
const Order = require('./models/Order');

async function inspect() {
  await mongoose.connect('mongodb://localhost:27017/aura');
  const orders = await Order.find().sort({ createdAt: -1 }).limit(10);
  console.log('Total orders in MongoDB:', await Order.countDocuments());
  orders.forEach((o, i) => {
    console.log(`Order ${i + 1}: ${o.orderId}, Status: ${o.status}`);
    console.log(`   Customer: ${o.customer?.fullName}, email: "${o.customer?.email}", customerId: ${o.customer?.customerId}`);
    o.items.forEach(it => {
      console.log(`   Item: name="${it.name}", productId=${it.productId} (type: ${typeof it.productId})`);
    });
  });
  const products = await Product.find().select('name _id');
  console.log('Sample Products:');
  products.slice(0, 5).forEach(p => console.log(`   Product: name="${p.name}", _id=${p._id}`));
  process.exit(0);
}
inspect().catch(e => { console.error(e); process.exit(1); });
