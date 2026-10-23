const mongoose = require('mongoose');
const Product = require('./models/Product');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/aura';

async function migrateSizeStock() {
  console.log('================================================================');
  console.log('AURA SIZE-WISE INVENTORY MIGRATION SCRIPT');
  console.log('================================================================\n');

  await mongoose.connect(MONGO_URI);
  console.log('✓ Connected to MongoDB');

  const products = await Product.find();
  console.log(`Found ${products.length} products to evaluate.\n`);

  let migratedCount = 0;
  let alreadyHadSizeStock = 0;

  for (const product of products) {
    const existingTotal = typeof product.stock === 'number' ? Math.max(0, product.stock) : 0;
    
    // Check if valid sizeStock already exists with entries
    if (product.sizeStock && typeof product.sizeStock === 'object' && Object.keys(product.sizeStock).length > 0) {
      console.log(`- Skipping "${product.name}" (already has sizeStock: ${JSON.stringify(product.sizeStock)})`);
      alreadyHadSizeStock++;
      continue;
    }

    // Determine sizes list
    let availableSizes = Array.isArray(product.sizes) && product.sizes.length > 0 ? product.sizes : [];
    if (availableSizes.length === 0) {
      availableSizes = ['One Size'];
    }

    // Distribute existing stock sensibly across available sizes
    const numSizes = availableSizes.length;
    const baseQty = Math.floor(existingTotal / numSizes);
    const remainder = existingTotal % numSizes;

    const newSizeStock = {};
    availableSizes.forEach((size, index) => {
      // Allocate base quantity + 1 for the first 'remainder' sizes so sum exactly equals existing total
      newSizeStock[size] = baseQty + (index < remainder ? 1 : 0);
    });

    // Verify sum
    const verifiedSum = Object.values(newSizeStock).reduce((sum, q) => sum + q, 0);
    if (verifiedSum !== existingTotal) {
      throw new Error(`Integrity check failed for ${product.name}: sum ${verifiedSum} !== existing ${existingTotal}`);
    }

    // Update in MongoDB
    product.sizes = availableSizes;
    product.sizeStock = newSizeStock;
    product.stock = verifiedSum;
    await product.save();

    console.log(`✓ Migrated "${product.name}":`);
    console.log(`   * Total Stock: ${existingTotal}`);
    console.log(`   * Sizes: [${availableSizes.join(', ')}]`);
    console.log(`   * SizeStock: ${JSON.stringify(newSizeStock)} (Sum: ${verifiedSum})`);
    migratedCount++;
  }

  console.log('\n================================================================');
  console.log(`MIGRATION COMPLETE! Migrated: ${migratedCount}, Already configured: ${alreadyHadSizeStock}`);
  console.log('================================================================\n');

  await mongoose.disconnect();
}

migrateSizeStock().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
