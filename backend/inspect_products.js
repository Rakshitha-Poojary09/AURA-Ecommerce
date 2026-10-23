const mongoose = require('mongoose');
const Product = require('./models/Product');

async function inspect() {
  await mongoose.connect('mongodb://localhost:27017/aura');
  const products = await Product.find().lean();
  console.log('Total products in MongoDB:', products.length);
  products.forEach((p, idx) => {
    const imgPreview = p.image ? (p.image.startsWith('data:') ? 'data:image/... (' + p.image.length + ' chars)' : p.image) : 'none';
    console.log((idx + 1) + '. [' + p.category + '] ' + p.name + ' (ID: ' + p._id + ') | Price: ₹' + p.price + ' | Stock: ' + p.stock + ' | Sizes: ' + JSON.stringify(p.sizes) + ' | Image: ' + imgPreview);
    if (p.colors || p.colorVariants || p.variants) {
      console.log('   Colors:', p.colors, 'colorVariants:', p.colorVariants, 'variants:', p.variants);
    }
  });
  process.exit(0);
}
inspect().catch(e => { console.error(e); process.exit(1); });
