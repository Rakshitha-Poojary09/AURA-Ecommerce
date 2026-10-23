require("dotenv").config();
const mongoose = require("mongoose");
const Review = require("./models/Review");
const Product = require("./models/Product");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/aura";

async function seedVideoReviews() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB for video review seeding...");

  // Find target products
  const linenShirt = await Product.findOne({ name: /Linen Shirt/i }) || await Product.findOne();
  const floralDress = await Product.findOne({ name: /Floral Everyday Dress/i }) || await Product.findOne();
  const denimJacket = await Product.findOne({ name: /Denim Utility Jacket/i }) || await Product.findOne();

  console.log("Found products:");
  console.log("1. Linen Shirt:", linenShirt?.name, linenShirt?._id);
  console.log("2. Floral Dress:", floralDress?.name, floralDress?._id);
  console.log("3. Denim Jacket:", denimJacket?.name, denimJacket?._id);

  const sampleVideoReviews = [
    {
      productId: linenShirt._id,
      customerName: "Sanya Malhotra",
      isInfluencer: true,
      influencerHandle: "@sanyastyle",
      isVerifiedPurchase: true,
      rating: 5,
      title: "The drape and linen breathability is unmatched! ✨",
      comment: "Styling this for an effortless brunch and evening resort look. The 100% natural organic linen has substantial weight without being stiff. Fits true to size, sleeves roll up effortlessly. A timeless wardrobe essential!",
      status: "approved",
      video: {
        url: "/uploads/reviews/videos/fashion-tryon-1.mp4",
        thumbnailUrl: "/uploads/reviews/videos/fashion-tryon-1-thumb.jpg",
        filename: "fashion-tryon-1.mp4",
        originalName: "sanya-linen-shirt-tryon.mp4",
        mimeType: "video/mp4",
        size: 677273,
        duration: 15,
        aspectRatio: "9:16"
      }
    },
    {
      productId: linenShirt._id,
      customerName: "Tara Sen",
      isInfluencer: true,
      influencerHandle: "@tarastylefile",
      isVerifiedPurchase: true,
      rating: 5,
      title: "Try-On & Fit Review: Size M on 5'7\" frame 🌿",
      comment: "Obsessed with the shoulder seam precision and French placket. Looks effortlessly chic tucked into high-waist linen trousers or worn open as a light resort overshirt. Zero shrinkage after gentle cold wash.",
      status: "approved",
      video: {
        url: "/uploads/reviews/videos/fashion-tryon-2.mp4",
        thumbnailUrl: "/uploads/reviews/videos/fashion-tryon-2-thumb.jpg",
        filename: "fashion-tryon-2.mp4",
        originalName: "tara-tryon-fit.mp4",
        mimeType: "video/mp4",
        size: 650493,
        duration: 18,
        aspectRatio: "9:16"
      }
    },
    {
      productId: linenShirt._id,
      customerName: "Meera Kapoor",
      isInfluencer: false,
      influencerHandle: "",
      isVerifiedPurchase: true,
      rating: 5,
      title: "Real customer try-on: movement, comfort & texture!",
      comment: "Here's a quick 360 walk-through showing how the fabric moves in natural light. The drape is so flattering and the texture is soft from day one. Really pleased with the stitching quality.",
      status: "approved",
      video: {
        url: "/uploads/reviews/videos/fashion-tryon-3.mp4",
        thumbnailUrl: "/uploads/reviews/videos/fashion-tryon-3-thumb.jpg",
        filename: "fashion-tryon-3.mp4",
        originalName: "meera-walkthrough.mp4",
        mimeType: "video/mp4",
        size: 951688,
        duration: 20,
        aspectRatio: "9:16"
      }
    },
    {
      productId: floralDress ? floralDress._id : linenShirt._id,
      customerName: "Elena Rivera",
      isInfluencer: true,
      influencerHandle: "@elena.minimal",
      isVerifiedPurchase: true,
      rating: 5,
      title: "Styling lookbook: Effortless day-to-night movement ✨",
      comment: "The cut falls gracefully and flatters every angle. Fabric is soft, non-sheer, and floats beautifully while walking. Pair with minimal leather mules and a basket bag for an editorial look.",
      status: "approved",
      video: {
        url: "/uploads/reviews/videos/fashion-tryon-4.mp4",
        thumbnailUrl: "/uploads/reviews/videos/fashion-tryon-4-thumb.jpg",
        filename: "fashion-tryon-4.mp4",
        originalName: "elena-lookbook.mp4",
        mimeType: "video/mp4",
        size: 1244930,
        duration: 16,
        aspectRatio: "9:16"
      }
    }
  ];

  for (const revData of sampleVideoReviews) {
    const existing = await Review.findOne({
      productId: revData.productId,
      customerName: revData.customerName,
      title: revData.title
    });
    if (!existing) {
      await Review.create(revData);
      console.log(`Created video review by "${revData.customerName}" for product ${revData.productId}`);
    } else {
      console.log(`Review by "${revData.customerName}" already exists.`);
    }
  }

  console.log("Video review seeding finished! ✨");
  await mongoose.disconnect();
  process.exit(0);
}

seedVideoReviews().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
