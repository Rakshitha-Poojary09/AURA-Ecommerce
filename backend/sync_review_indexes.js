const mongoose = require("mongoose");
const Review = require("./models/Review");

mongoose.connect("mongodb://localhost:27017/aura").then(async () => {
  try {
    await mongoose.connection.collection("reviews").dropIndex("productId_1_customerId_1");
    console.log("Dropped old index");
  } catch (e) {
    console.log("Drop error or not exists:", e.message);
  }
  await Review.syncIndexes();
  console.log("Indexes synchronized successfully!");
  process.exit(0);
});
