const mongoose = require("mongoose");
const path = require("path");
const { pathToFileURL } = require("url");
const Product = require("./models/Product");

const MONGO_URI = "mongodb://localhost:27017/aura";

async function runMigration() {
  console.log("========================================");
  console.log("Starting AURA Products Migration to MongoDB");
  console.log("========================================\n");

  try {
    // 1. Connect to MongoDB
    console.log("Connecting to MongoDB at:", MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB successfully.\n");

    // 2. Load mock SHOP_PRODUCTS from frontend/src/data/mockData.js
    const mockDataPath = path.resolve(__dirname, "..", "frontend", "src", "data", "mockData.js");
    console.log("Reading mock products from:", mockDataPath);
    
    const mockModule = await import(pathToFileURL(mockDataPath).href);
    const { SHOP_PRODUCTS } = mockModule;

    if (!Array.isArray(SHOP_PRODUCTS) || SHOP_PRODUCTS.length === 0) {
      throw new Error("Could not find or load SHOP_PRODUCTS array from mockData.js");
    }

    console.log(`Found ${SHOP_PRODUCTS.length} products in mockData.js.\n`);

    // 3. Track migration statistics
    let skippedCount = 0;
    let insertedCount = 0;

    // 4. Iterate over each product in SHOP_PRODUCTS
    for (const item of SHOP_PRODUCTS) {
      const productName = item.name.trim();

      // Check if product with the exact name already exists in MongoDB
      const existing = await Product.findOne({ name: productName });

      if (existing) {
        console.log(`[SKIPPED]  "${productName}" already exists in MongoDB.`);
        skippedCount++;
      } else {
        // Determine sizes (sensible defaults: Accessories -> ['One Size'], Clothing -> ['S', 'M', 'L', 'XL'])
        let sizes = ["S", "M", "L", "XL"];
        if (Array.isArray(item.sizes) && item.sizes.length > 0) {
          sizes = item.sizes;
        } else if (item.category === "Accessories") {
          sizes = ["One Size"];
        }

        // Generate clean description if missing in mock data
        const description = item.description || 
          `Crafted for timeless style, the ${productName} offers effortless elegance and premium comfort.`;

        // Default stock: 20 if not specified
        const stock = typeof item.stock === "number" ? item.stock : 20;

        // Map supported fields only to match the existing MongoDB Product schema
        const newProduct = new Product({
          name: productName,
          description: description,
          price: Number(item.price) || 0,
          category: item.category || "Women",
          image: item.image,
          sizes: sizes,
          stock: stock
        });

        await newProduct.save();
        console.log(`[INSERTED] "${productName}" (${item.category} • ₹${item.price} • Stock: ${stock})`);
        insertedCount++;
      }
    }

    // 5. Query final total count in MongoDB
    const totalProducts = await Product.countDocuments();

    console.log("\n========================================");
    console.log("AURA PRODUCT MIGRATION SUMMARY");
    console.log("========================================");
    console.log(`Existing products skipped : ${skippedCount}`);
    console.log(`New products inserted     : ${insertedCount}`);
    console.log(`Total MongoDB products    : ${totalProducts}`);
    console.log("========================================\n");

  } catch (error) {
    console.error("Migration failed with error:", error);
  } finally {
    await mongoose.connection.close();
    console.log("MongoDB connection closed.");
  }
}

runMigration();
