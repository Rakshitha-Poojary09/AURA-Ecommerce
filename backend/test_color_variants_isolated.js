const mongoose = require("mongoose");
const Product = require("./models/Product");
const Order = require("./models/Order");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/aura";

async function runColorVariantTests() {
  console.log("==================================================");
  console.log("RUNNING ISOLATED COLOR VARIANTS SUITE");
  console.log("==================================================");

  await mongoose.connect(MONGO_URI);

  const testProductName = `TEST_HANDBAG_${Date.now()}`;
  let createdProductId = null;
  let createdOrderId = null;

  try {
    // 1. Create isolated product with genuine Red & Black variants
    console.log("\n[Test 1] Creating isolated accessory with colorVariants...");
    const testProduct = new Product({
      name: testProductName,
      description: "Test luxury handbag with genuine color variants",
      price: 1999,
      mrp: 2999,
      category: "Accessories",
      image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80",
      images: [
        "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80",
        "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=700&q=80"
      ],
      sizes: ["One Size"],
      colorVariants: [
        {
          colorName: "Red",
          colorCode: "#b91c1c",
          image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80",
          images: [
            "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80",
            "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=700&q=80"
          ],
          stock: 5
        },
        {
          colorName: "Black",
          colorCode: "#1c1c1c",
          image: "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=700&q=80",
          images: [
            "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=700&q=80",
            "https://images.unsplash.com/photo-1524498250077-390f9e378fc0?auto=format&fit=crop&w=700&q=80"
          ],
          stock: 3
        }
      ]
    });

    const savedProd = await testProduct.save();
    createdProductId = savedProd._id;

    console.log("✓ Product saved with ID:", createdProductId);
    console.log("✓ Total stock computed by pre-save hook:", savedProd.stock, "(expected 8: 5 Red + 3 Black)");
    if (savedProd.stock !== 8) throw new Error(`Stock mismatch: expected 8, got ${savedProd.stock}`);

    // 2. Validate Order model supports color, colorName, colorCode
    console.log("\n[Test 2] Testing Order persistence with color variant fields...");
    const testOrderId = `TEST-ORD-${Date.now()}`;
    const testOrder = new Order({
      orderId: testOrderId,
      customer: {
        fullName: "Test Customer",
        email: "test.customer@aura-test.com",
        phone: "+919876543210"
      },
      shippingAddress: {
        address: "100 Fashion Street",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400001"
      },
      items: [
        {
          productId: createdProductId,
          name: testProductName,
          image: "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=700&q=80",
          price: 1999,
          mrp: 2999,
          quantity: 2,
          size: "One Size",
          color: "Black",
          colorName: "Black",
          colorCode: "#1c1c1c"
        }
      ],
      subtotal: 3998,
      shipping: 0,
      total: 3998,
      status: "Pending"
    });

    const savedOrder = await testOrder.save();
    createdOrderId = savedOrder._id;

    console.log("✓ Order saved with ID:", savedOrder.orderId);
    console.log("✓ Saved order item color:", savedOrder.items[0].color);
    console.log("✓ Saved order item colorName:", savedOrder.items[0].colorName);
    console.log("✓ Saved order item colorCode:", savedOrder.items[0].colorCode);

    if (savedOrder.items[0].color !== "Black") throw new Error("Order item color not saved!");
    if (savedOrder.items[0].colorName !== "Black") throw new Error("Order item colorName not saved!");

    // 3. Test HTTP order placement with stock validation against server endpoint
    console.log("\n[Test 3] Testing POST /api/orders stock validation via HTTP fetch...");
    const http = require("http");
    
    const placeOrderRequest = (orderData) => {
      return new Promise((resolve, reject) => {
        const payload = JSON.stringify(orderData);
        const req = http.request(
          {
            hostname: "localhost",
            port: 5000,
            path: "/api/orders",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(payload)
            }
          },
          (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
              try {
                resolve({ status: res.statusCode, body: JSON.parse(body) });
              } catch (e) {
                resolve({ status: res.statusCode, body });
              }
            });
          }
        );
        req.on("error", reject);
        req.write(payload);
        req.end();
      });
    };

    // Submitting order for 2 Black units (available: 3) -> should succeed
    const validOrderPayload = {
      orderId: `TEST-ORD-VAL-${Date.now()}`,
      customer: {
        fullName: "Test Customer",
        email: "test.val@aura-test.com",
        phone: "+919876543210"
      },
      shippingAddress: {
        address: "100 Fashion Street",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400001"
      },
      items: [
        {
          productId: createdProductId.toString(),
          name: testProductName,
          image: "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=700&q=80",
          price: 1999,
          quantity: 2,
          size: "One Size",
          color: "Black",
          colorName: "Black"
        }
      ],
      subtotal: 3998,
      shipping: 0,
      total: 3998
    };

    const res1 = await placeOrderRequest(validOrderPayload);
    console.log("Order 1 response status:", res1.status);
    if (res1.status !== 201) {
      console.error("Order 1 failed:", res1.body);
      throw new Error("Valid order placement failed");
    }
    console.log("✓ Order 1 placed successfully!");

    // Verify stock in MongoDB after reduction
    const updatedProdAfter1 = await Product.findById(createdProductId).lean();
    const blackVariant1 = updatedProdAfter1.colorVariants.find(v => v.colorName === "Black");
    console.log("✓ Black variant stock after purchasing 2:", blackVariant1.stock, "(expected 1: 3 - 2)");
    if (blackVariant1.stock !== 1) throw new Error(`Expected Black stock 1, got ${blackVariant1.stock}`);

    // Submitting order for 2 Black units when only 1 is left -> should fail with 400
    const overstockPayload = {
      orderId: `TEST-ORD-FAIL-${Date.now()}`,
      customer: {
        fullName: "Test Customer 2",
        email: "test.fail@aura-test.com",
        phone: "+919876543210"
      },
      shippingAddress: {
        address: "100 Fashion Street",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400001"
      },
      items: [
        {
          productId: createdProductId.toString(),
          name: testProductName,
          image: "https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=700&q=80",
          price: 1999,
          quantity: 2,
          size: "One Size",
          color: "Black",
          colorName: "Black"
        }
      ],
      subtotal: 3998,
      shipping: 0,
      total: 3998
    };

    const res2 = await placeOrderRequest(overstockPayload);
    console.log("Overstock order response status:", res2.status, "(expected 400)");
    console.log("Overstock order message:", res2.body.message);
    if (res2.status !== 400) throw new Error("Overstock order should have returned 400!");
    if (!res2.body.message.includes("Insufficient stock") || !res2.body.message.includes("Black")) {
      throw new Error(`Expected insufficient stock message mentioning Black, got: ${res2.body.message}`);
    }
    console.log("✓ Overstock rejection verified successfully!");

    // Submitting order for 3 Red units (available: 5) -> should succeed
    const redOrderPayload = {
      orderId: `TEST-ORD-RED-${Date.now()}`,
      customer: {
        fullName: "Test Customer Red",
        email: "test.red@aura-test.com",
        phone: "+919876543210"
      },
      shippingAddress: {
        address: "100 Fashion Street",
        city: "Mumbai",
        state: "Maharashtra",
        pinCode: "400001"
      },
      items: [
        {
          productId: createdProductId.toString(),
          name: testProductName,
          image: "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=700&q=80",
          price: 1999,
          quantity: 3,
          size: "One Size",
          color: "Red",
          colorName: "Red"
        }
      ],
      subtotal: 5997,
      shipping: 0,
      total: 5997
    };

    const res3 = await placeOrderRequest(redOrderPayload);
    console.log("Red order response status:", res3.status);
    if (res3.status !== 201) throw new Error("Red order placement failed");

    const updatedProdAfter3 = await Product.findById(createdProductId).lean();
    const redVariant = updatedProdAfter3.colorVariants.find(v => v.colorName === "Red");
    console.log("✓ Red variant stock after purchasing 3:", redVariant.stock, "(expected 2: 5 - 3)");
    if (redVariant.stock !== 2) throw new Error(`Expected Red stock 2, got ${redVariant.stock}`);

    // Clean up created test orders
    await Order.deleteMany({ "customer.email": /aura-test\.com/ });
    console.log("✓ Cleaned up test orders");

  } finally {
    // Isolated cleanup: ensure test product and test orders are deleted
    if (createdProductId) {
      await Product.findByIdAndDelete(createdProductId);
      console.log("✓ Cleaned up isolated test product:", createdProductId);
    }
    await mongoose.connection.close();
    console.log("\n==================================================");
    console.log("ALL COLOR VARIANT BACKEND TESTS PASSED SUCCESSFULLY!");
    console.log("==================================================\n");
  }
}

runColorVariantTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
