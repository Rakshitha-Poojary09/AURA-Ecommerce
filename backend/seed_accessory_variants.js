const mongoose = require("mongoose");
const Product = require("./models/Product");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/aura";

async function seedAccessoryVariants() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB for accessory color variants seeding...");

  const handbagData = {
    name: "Classic Structured Leather Handbag",
    description: "An exquisite leather handbag designed for effortless everyday sophistication. Features a structured silhouette, dual rolled handles, detachable shoulder strap, and polished gold-tone hardware. Crafted with premium full-grain leather.",
    price: 2499,
    mrp: 3499,
    category: "Accessories",
    sizes: ["One Size"],
    sizeStock: { "One Size": 35 },
    stock: 35,
    colors: ["#b91c1c", "#1c1c1c", "#6e473b"],
    image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80",
    images: [
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80",
      "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=700&q=80"
    ],
    colorVariants: [
      {
        colorName: "Red",
        colorCode: "#b91c1c",
        image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80",
        images: [
          "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80",
          "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=700&q=80"
        ],
        stock: 12
      },
      {
        colorName: "Black",
        colorCode: "#1c1c1c",
        image: "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=700&q=80",
        images: [
          "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=700&q=80",
          "https://images.unsplash.com/photo-1524498250077-390f9e378fc0?auto=format&fit=crop&w=700&q=80"
        ],
        stock: 15
      },
      {
        colorName: "Brown",
        colorCode: "#6e473b",
        image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=700&q=80",
        images: [
          "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=700&q=80",
          "https://images.unsplash.com/photo-1591348278900-019a8a2a8b1d?auto=format&fit=crop&w=700&q=80"
        ],
        stock: 8
      }
    ]
  };

  const updated = await Product.findOneAndUpdate(
    { name: handbagData.name },
    { $set: handbagData },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  console.log("Successfully seeded/updated accessory handbag in MongoDB:", updated.name, "ID:", updated._id);
  console.log("Color variants configured:", updated.colorVariants.map(cv => `${cv.colorName} (${cv.colorCode}, stock: ${cv.stock})`));

  process.exit(0);
}

seedAccessoryVariants().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
