const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, ".env") });
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const Product = require("./models/Product");
const Order = require("./models/Order");
const User = require("./models/User");
const Coupon = require("./models/Coupon");
const authRoutes = require("./routes/authRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const customerRoutes = require("./routes/customerRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const couponRoutes = require("./routes/couponRoutes");
const returnRoutes = require("./routes/returnRoutes");
const { authenticateCustomer, requireAdmin } = require("./middleware/auth");
const { verifySmtpConnection, isEmailConfigured } = require("./utils/emailService");

const app = express();

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/aura";

// Normalize duplicate consecutive slashes in request paths (e.g. //api/products -> /api/products)
app.use((req, res, next) => {
    if (req.url.startsWith("//")) {
        req.url = req.url.replace(/^\/+/, "/");
    }
    next();
});

// CORS configuration supporting credentials (cookies)
const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    process.env.CLIENT_URL,
    process.env.ADMIN_CLIENT_URL
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, Postman)
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        // Safely allow localhost / 127.0.0.1 dev ports in development mode
        if (process.env.NODE_ENV !== "production" && (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))) {
            return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS policy"));
    },
    credentials: true, // Crucial for HTTP-only cookies
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]
}));

const fs = require("fs");

// Body and Cookie parsers (with 25MB payload limit to prevent PayloadTooLargeError on product images/payloads)
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));
app.use(cookieParser());

// Serve static product images so both frontends and APIs can access /products directly
const frontendProductsDir = path.join(__dirname, "../frontend/public/products");
const adminProductsDir = path.join(__dirname, "../admin-frontend/public/products");
app.use("/products", express.static(frontendProductsDir));
app.use("/products", express.static(adminProductsDir));

// Serve uploaded customer review photos securely
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// Helper to guarantee default administrator exists in MongoDB
const ensureAdminUser = async () => {
    try {
        const adminCount = await User.countDocuments({ role: "admin" });
        if (adminCount === 0) {
            const adminEmail = process.env.ADMIN_EMAIL || "admin@aura.com";
            const adminPassword = process.env.ADMIN_PASSWORD || "Admin@Aura2026";
            const defaultAdmin = new User({
                name: "AURA Executive Admin",
                email: adminEmail,
                password: adminPassword,
                role: "admin"
            });
            await defaultAdmin.save();
            console.log(`[Admin Initialized] Created default administrator: ${adminEmail}`);
        }
    } catch (err) {
        console.error("Error verifying/initializing administrator user:", err);
    }
};

// Connect to MongoDB
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log("MongoDB connected successfully!");
        await ensureAdminUser();
    })
    .catch((error) => {
        console.log("MongoDB connection failed:", error);
    });

// Authentication routes
app.use("/api/auth", authRoutes);

// Wishlist routes
app.use("/api/wishlist", wishlistRoutes);

// Protected Admin Analytics routes (MongoDB aggregation)
app.use("/api/admin/analytics", requireAdmin, analyticsRoutes);

// Product Review & Rating routes
app.use("/api", reviewRoutes);

// Protected Admin Customer Management routes
app.use("/api/admin/customers", requireAdmin, customerRoutes);

// Protected Admin Notifications & Alerts routes
app.use("/api/admin/notifications", requireAdmin, notificationRoutes);

// Protected Admin Coupons Management routes
app.use("/api/admin/coupons", requireAdmin, couponRoutes.adminRouter);

// Customer & Guest Checkout Coupon Validation routes
app.use("/api/coupons", couponRoutes.customerRouter);

// Customer, Guest, and Admin Return & Exchange Management routes
app.use("/api/returns", returnRoutes);

// Root endpoint (returns status object with message for API health checks and browsers)
app.get("/", (req, res) => {
    res.json({
        status: "ok",
        service: "AURA Backend API",
        message: "AURA Backend is running!",
        timestamp: new Date().toISOString()
    });
});

// Dedicated health-check endpoints for automated monitors and frontend status checks
app.get(["/health", "/api/health"], (req, res) => {
    res.status(200).json({
        status: "ok",
        uptime: process.uptime(),
        database: mongoose.connection.readyState === 1 ? "connected" : "connecting/disconnected",
        timestamp: new Date().toISOString(),
        message: "AURA backend server is healthy"
    });
});

// ==========================================
// 1. PRODUCT ROUTES
// ==========================================

// Get all products (supports optional category, search, and sort query parameters)
app.get("/api/products", async (req, res) => {
    try {
        const { category, search, sort } = req.query;
        let filter = {};

        if (category && category !== "All") {
            filter.category = { $regex: new RegExp(`^${category}$`, "i") };
        }

        if (search && search.trim()) {
            const searchRegex = new RegExp(search.trim(), "i");
            filter.$or = [
                { name: searchRegex },
                { description: searchRegex },
                { category: searchRegex }
            ];
        }

        let query = Product.find(filter);

        if (sort === "price-low") {
            query = query.sort({ price: 1 });
        } else if (sort === "price-high") {
            query = query.sort({ price: -1 });
        } else if (sort === "newest") {
            query = query.sort({ createdAt: -1 });
        }

        const products = await query;

        res.json(products);
    } catch (error) {
        res.status(500).json({
            message: "Error fetching products"
        });
    }
});

// Get single product by ID
app.get("/api/products/:id", async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid product ID format" });
        }
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }
        res.json(product);
    } catch (error) {
        res.status(500).json({ message: "Error fetching product", error: error.message });
    }
});

// Get product recommendations / similar styles
app.get(["/api/products/:id/recommendations", "/api/products/:id/similar"], async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid product ID format" });
        }
        const currentProduct = await Product.findById(id);
        if (!currentProduct) {
            return res.status(404).json({ message: "Product not found" });
        }

        const curAudience = (currentProduct.category || "").trim().toLowerCase();
        const curNameNorm = currentProduct.name.trim().toLowerCase();

        // Query candidates strictly within the same audience/category, in-stock, excluding current product
        const query = {
            _id: { $ne: currentProduct._id },
            stock: { $gt: 0 }
        };

        if (currentProduct.category) {
            query.category = { $regex: new RegExp(`^${currentProduct.category.trim()}$`, "i") };
        }

        const candidates = await Product.find(query).lean();

        // Helper to extract garment type tokens
        const garmentPatterns = [
            { type: "dress", regex: /\b(dress|gown|maxi|midi|frock|wrap)\b/i },
            { type: "shirt", regex: /\b(shirt|blouse|oxford|button-down)\b/i },
            { type: "top", regex: /\b(top|tee|t-shirt|tank|knit|crop)\b/i },
            { type: "pants", regex: /\b(pants|pant|trouser|trousers|jeans|bottom)\b/i },
            { type: "jacket", regex: /\b(jacket|blazer|coat|hoodie|outerwear)\b/i },
            { type: "skirt", regex: /\b(skirt|pleated)\b/i },
            { type: "bag", regex: /\b(bag|tote|handbag|clutch)\b/i },
            { type: "set", regex: /\b(set|co-ord|suit|romper)\b/i }
        ];

        const getGarmentType = (text = "") => {
            for (const item of garmentPatterns) {
                if (item.regex.test(text)) return item.type;
            }
            return null;
        };

        const currentGarment = getGarmentType(`${currentProduct.name} ${currentProduct.description || ""}`);
        const currentWords = (`${currentProduct.name} ${currentProduct.description || ""}`)
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter(w => w.length > 3);

        const scored = [];
        for (const candidate of candidates) {
            const candNameNorm = candidate.name.trim().toLowerCase();
            // Avoid recommending duplicate copies of the active product
            if (candNameNorm === curNameNorm) continue;

            let score = 0;
            const candText = `${candidate.name} ${candidate.description || ""}`;
            const candGarment = getGarmentType(candText);

            // 1. Same garment type (same silhouette): highest priority (+100)
            // (e.g. women's shirts with women's shirts, men's shirts with men's shirts, dresses with dresses)
            if (currentGarment && candGarment && currentGarment === candGarment) {
                score += 100;
            }

            // 2. Style / fabric keyword matches (+10 per word)
            const candWords = candText.toLowerCase().split(/[^a-z0-9]+/);
            for (const word of currentWords) {
                if (candWords.includes(word)) {
                    score += 10;
                }
            }

            // 3. Price proximity (+10 if within 30% price range)
            if (currentProduct.price && candidate.price) {
                const diffRatio = Math.abs(currentProduct.price - candidate.price) / currentProduct.price;
                if (diffRatio <= 0.3) score += 10;
                else if (diffRatio <= 0.6) score += 5;
            }

            scored.push({ ...candidate, score });
        }

        // Sort descending by score, then newest
        scored.sort((a, b) => b.score - a.score || new Date(b.createdAt) - new Date(a.createdAt));

        // Deduplicate candidates so no two items share the same normalized name
        const seenNames = new Set();
        const uniqueRecs = [];
        for (const item of scored) {
            const norm = item.name.trim().toLowerCase();
            if (!seenNames.has(norm)) {
                seenNames.add(norm);
                uniqueRecs.push(item);
            }
            if (uniqueRecs.length >= 8) break;
        }

        res.json(uniqueRecs);
    } catch (error) {
        res.status(500).json({ message: "Error fetching recommendations", error: error.message });
    }
});


// Add a new product (Protected: Administrator only)
app.post("/api/products", requireAdmin, async (req, res) => {
    try {
        const { price, mrp } = req.body;
        if (price === undefined || isNaN(price) || Number(price) <= 0) {
            return res.status(400).json({ message: "Selling price must be greater than 0" });
        }
        const numPrice = Number(price);
        req.body.price = numPrice;

        if (mrp !== undefined && mrp !== null && mrp !== '') {
            if (isNaN(mrp) || Number(mrp) <= 0) {
                return res.status(400).json({ message: "MRP must be a valid number greater than 0" });
            }
            const numMrp = Number(mrp);
            if (numMrp < numPrice) {
                return res.status(400).json({ message: "MRP cannot be less than selling price" });
            }
            req.body.mrp = numMrp;
        } else {
            req.body.mrp = null;
        }

        // For Accessories, strictly enforce 'One Size'
        if (req.body.category === "Accessories") {
            req.body.sizes = ["One Size"];
            let oneSizeStock = 0;
            if (Array.isArray(req.body.colorVariants) && req.body.colorVariants.length > 0) {
                oneSizeStock = req.body.colorVariants.reduce((sum, v) => sum + Math.max(0, Math.floor(Number(v.stock) || 0)), 0);
                req.body.colors = req.body.colorVariants.map(v => v.colorCode || v.colorName).filter(Boolean);
            } else if (req.body.sizeStock && typeof req.body.sizeStock === "object") {
                if (req.body.sizeStock["One Size"] !== undefined) {
                    oneSizeStock = Math.max(0, Math.floor(Number(req.body.sizeStock["One Size"]) || 0));
                } else {
                    oneSizeStock = Object.values(req.body.sizeStock).reduce((sum, v) => sum + Math.max(0, Math.floor(Number(v) || 0)), 0);
                }
            } else if (req.body.stock !== undefined) {
                oneSizeStock = Math.max(0, Math.floor(Number(req.body.stock) || 0));
            }
            req.body.sizeStock = { "One Size": oneSizeStock };
            req.body.stock = oneSizeStock;
        } else if (req.body.sizeStock && typeof req.body.sizeStock === "object") {
            // Sync overall stock with sizeStock if sizeStock is provided for clothing categories
            const sizeStockClean = {};
            let total = 0;
            for (const [sz, qty] of Object.entries(req.body.sizeStock)) {
                const val = Math.max(0, Math.floor(Number(qty) || 0));
                sizeStockClean[sz] = val;
                total += val;
            }
            req.body.sizeStock = sizeStockClean;
            req.body.stock = total;
        }

        const newProduct = new Product(req.body);
        const savedProduct = await newProduct.save();

        res.status(201).json(savedProduct);
    } catch (error) {
        res.status(400).json({
            message: "Error adding product",
            error: error.message
        });
    }
});

// Delete a product (Protected: Administrator only)
app.delete("/api/products/:id", requireAdmin, async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);

        if (!deletedProduct) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        res.json({
            message: "Product deleted successfully",
            deletedProduct
        });
    } catch (error) {
        res.status(500).json({
            message: "Error deleting product",
            error: error.message
        });
    }
});

// Update a product (Protected: Administrator only)
app.put("/api/products/:id", requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        // Validate ObjectId format
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                message: "Invalid product ID format"
            });
        }

        const existingProduct = await Product.findById(id);
        if (!existingProduct) {
            return res.status(404).json({
                message: "Product not found"
            });
        }

        // Basic payload validation
        const { name, description, price, mrp, category, image, stock, sizeStock } = req.body;
        if (name !== undefined && !name.trim()) {
            return res.status(400).json({ message: "Product name cannot be empty" });
        }
        if (description !== undefined && !description.trim()) {
            return res.status(400).json({ message: "Product description cannot be empty" });
        }
        if (price !== undefined && (isNaN(price) || Number(price) <= 0)) {
            return res.status(400).json({ message: "Price must be greater than 0" });
        }
        if (stock !== undefined && (isNaN(stock) || Number(stock) < 0)) {
            return res.status(400).json({ message: "Stock quantity cannot be negative" });
        }

        const effectivePrice = price !== undefined ? Number(price) : existingProduct.price;
        let effectiveMrp = existingProduct.mrp;

        if (mrp !== undefined) {
            if (mrp === null || mrp === '') {
                effectiveMrp = null;
                req.body.mrp = null;
            } else {
                if (isNaN(mrp) || Number(mrp) <= 0) {
                    return res.status(400).json({ message: "MRP must be a valid number greater than 0" });
                }
                effectiveMrp = Number(mrp);
                req.body.mrp = effectiveMrp;
            }
        }

        if (effectiveMrp !== null && effectiveMrp !== undefined) {
            if (effectiveMrp < effectivePrice) {
                return res.status(400).json({ message: "MRP cannot be less than selling price" });
            }
        }

        if (price !== undefined) {
            req.body.price = effectivePrice;
        }

        const effectiveCategory = category !== undefined ? category : existingProduct.category;

        // For Accessories, strictly enforce 'One Size'
        if (effectiveCategory === "Accessories") {
            req.body.sizes = ["One Size"];
            let oneSizeStock = 0;
            const cvSource = req.body.colorVariants !== undefined ? req.body.colorVariants : existingProduct.colorVariants;
            if (Array.isArray(cvSource) && cvSource.length > 0) {
                oneSizeStock = cvSource.reduce((sum, v) => sum + Math.max(0, Math.floor(Number(v.stock) || 0)), 0);
                req.body.colors = cvSource.map(v => v.colorCode || v.colorName).filter(Boolean);
            } else if (sizeStock && typeof sizeStock === "object") {
                if (sizeStock["One Size"] !== undefined) {
                    oneSizeStock = Math.max(0, Math.floor(Number(sizeStock["One Size"]) || 0));
                } else {
                    oneSizeStock = Object.values(sizeStock).reduce((s, v) => s + Math.max(0, Math.floor(Number(v) || 0)), 0);
                }
            } else if (stock !== undefined) {
                oneSizeStock = Math.max(0, Math.floor(Number(stock) || 0));
            } else {
                oneSizeStock = existingProduct.stock || 0;
            }
            req.body.sizeStock = { "One Size": oneSizeStock };
            req.body.stock = oneSizeStock;
        } else if (sizeStock && typeof sizeStock === "object") {
            // Sync overall stock with sizeStock if sizeStock is provided for clothing categories
            const sizeStockClean = {};
            let total = 0;
            for (const [sz, qty] of Object.entries(sizeStock)) {
                const val = Math.max(0, Math.floor(Number(qty) || 0));
                sizeStockClean[sz] = val;
                total += val;
            }
            req.body.sizeStock = sizeStockClean;
            req.body.stock = total;
        }

        // Update product in MongoDB
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            req.body,
            { returnDocument: 'after', runValidators: true }
        );

        res.json({
            message: "Product updated successfully",
            product: updatedProduct
        });
    } catch (error) {
        res.status(400).json({
            message: "Error updating product",
            error: error.message
        });
    }
});

// ==========================================
// 2. ORDER ROUTES (MERN Checkout & Admin Orders)
// ==========================================

// POST /api/orders - Save a newly placed order from customer checkout with safe stock validation & reduction
app.post("/api/orders", async (req, res) => {
    try {
        const { orderId, customer, shippingAddress, items, subtotal, shipping, total, couponCode } = req.body;

        // 1. Validation: Verify that required order information exists
        if (!orderId) {
            return res.status(400).json({ message: "orderId is required" });
        }
        if (!customer || !customer.fullName || !customer.email || !customer.phone) {
            return res.status(400).json({
                message: "Customer details (fullName, email, phone) are required"
            });
        }
        if (!shippingAddress || !shippingAddress.address || !shippingAddress.city || !shippingAddress.state || !shippingAddress.pinCode) {
            return res.status(400).json({
                message: "Shipping address (address, city, state, pinCode) is required"
            });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Order must contain at least one item" });
        }
        if (typeof total === "undefined" || total === null) {
            return res.status(400).json({ message: "Order total is required" });
        }

        // Safely identify customer from session cookie / token
        let verifiedCustomerId = null;
        try {
            let token = req.cookies && (req.cookies.aura_customer_session || req.cookies.token);
            if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
                token = req.headers.authorization.split(" ")[1];
            }
            if (token) {
                const secret = process.env.JWT_SECRET || "aura_luxury_fashion_jwt_secret_key_2026_super_secure";
                const decoded = jwt.verify(token, secret);
                if (decoded && decoded.id) {
                    verifiedCustomerId = decoded.id;
                }
            }
        } catch (authErr) {
            // Token invalid or absent: order proceeds as guest checkout
        }

        // 2. Validate item quantities and aggregate requested amounts per product AND per size
        // (to prevent bypass if customer adds multiple lines of the same size/product)
        const productMap = new Map();

        for (const item of items) {
            const qty = Number(item.quantity);
            if (isNaN(qty) || qty <= 0) {
                return res.status(400).json({
                    message: `Invalid quantity for ${item.name || "product"}. Quantity must be greater than 0.`
                });
            }

            const rawId = item.productId || item._id || item.id;
            const lookupKey = rawId ? rawId.toString() : (item.name || "");

            if (!lookupKey) {
                return res.status(400).json({
                    message: `Product identifier is missing for ${item.name || "item"}.`
                });
            }

            const itemSize = (item.size || item.selectedSize || "M").toString().trim();
            const itemColor = (item.color || item.colorName || item.selectedColor || "").toString().trim();

            if (!productMap.has(lookupKey)) {
                productMap.set(lookupKey, {
                    rawId,
                    name: item.name,
                    totalQuantity: 0,
                    sizeDemands: {},
                    colorDemands: {},
                    productDoc: null
                });
            }

            const entry = productMap.get(lookupKey);
            entry.totalQuantity += qty;
            entry.sizeDemands[itemSize] = (entry.sizeDemands[itemSize] || 0) + qty;
            if (itemColor) {
                entry.colorDemands[itemColor] = (entry.colorDemands[itemColor] || 0) + qty;
            }
        }

        // 3. Pre-validate stock for EVERY product & size / color variant and retrieve authoritative docs from MongoDB
        for (const [key, entry] of productMap.entries()) {
            let product = null;

            // Find by MongoDB ObjectId if valid
            if (entry.rawId && mongoose.Types.ObjectId.isValid(entry.rawId)) {
                product = await Product.findById(entry.rawId);
            }

            // Fallback to name search if not found by id
            if (!product && entry.name) {
                product = await Product.findOne({ name: entry.name });
            }

            // If product does not exist
            if (!product) {
                return res.status(400).json({
                    message: `Product ${entry.name || "requested"} is no longer available.`
                });
            }

            entry.productDoc = product;

            // For Accessories, ensure sizeDemands is strictly mapped to 'One Size'
            const isAccessoryProduct = product.category === "Accessories" || (Array.isArray(product.sizes) && product.sizes.length === 1 && product.sizes[0] === "One Size");
            if (isAccessoryProduct) {
                entry.sizeDemands = { "One Size": entry.totalQuantity };
            }

            // Check color variant stock if product has colorVariants
            const hasColorVariants = Array.isArray(product.colorVariants) && product.colorVariants.length > 0;
            if (hasColorVariants && Object.keys(entry.colorDemands).length > 0) {
                for (const [col, neededQty] of Object.entries(entry.colorDemands)) {
                    const variant = product.colorVariants.find(
                        (v) => (v.colorName && v.colorName.toLowerCase() === col.toLowerCase()) ||
                               (v.colorCode && v.colorCode.toLowerCase() === col.toLowerCase())
                    );
                    if (variant) {
                        const variantStock = typeof variant.stock === "number" ? variant.stock : 0;
                        if (variantStock < neededQty) {
                            return res.status(400).json({
                                message: `Insufficient stock for ${product.name} (Colour: ${variant.colorName}). Available stock: ${Math.max(0, variantStock)}, requested: ${neededQty}.`
                            });
                        }
                    }
                }
            }

            // Check size-wise stock if product has sizeStock
            const hasSizeStock = product.sizeStock && typeof product.sizeStock === "object" && Object.keys(product.sizeStock).length > 0;

            if (hasSizeStock) {
                for (const [sz, neededQty] of Object.entries(entry.sizeDemands)) {
                    const sizeAvail = typeof product.sizeStock[sz] === "number" ? product.sizeStock[sz] : 0;
                    if (sizeAvail < neededQty) {
                        return res.status(400).json({
                            message: `Insufficient stock for ${product.name} (Size: ${sz}). Available stock: ${Math.max(0, sizeAvail)}, requested: ${neededQty}.`
                        });
                    }
                }
            } else {
                // Fallback to overall product stock
                const availableStock = typeof product.stock === "number" ? product.stock : 0;
                if (availableStock < entry.totalQuantity) {
                    return res.status(400).json({
                        message: `Insufficient stock for ${product.name}. Available stock: ${Math.max(0, availableStock)}`
                    });
                }
            }
        }

        // Build verified items using authoritative current selling prices & MRPs from MongoDB
        const verifiedItems = items.map((it) => {
            const rawId = it.productId || it._id || it.id;
            const lookupKey = rawId ? rawId.toString() : (it.name || "");
            const entry = productMap.get(lookupKey);
            const doc = entry?.productDoc;
            const authoritativePrice = doc ? Number(doc.price) : (Number(it.price) || 0);
            const authoritativeMrp = doc && doc.mrp !== undefined && doc.mrp !== null ? Number(doc.mrp) : (it.mrp ? Number(it.mrp) : null);
            const isDocAccessory = doc?.category === "Accessories" || (Array.isArray(doc?.sizes) && doc?.sizes.length === 1 && doc?.sizes[0] === "One Size");
            const authoritativeSize = isDocAccessory ? "One Size" : (it.size || it.selectedSize || "M").toString().trim();

            return {
                ...it,
                productId: doc?._id || rawId,
                name: doc?.name || it.name,
                image: it.image || doc?.image || '',
                price: authoritativePrice,
                mrp: authoritativeMrp,
                quantity: Number(it.quantity) || 1,
                size: authoritativeSize,
                color: (it.colorName || it.color || it.selectedColor || "").toString().trim(),
                colorName: (it.colorName || it.color || it.selectedColor || "").toString().trim(),
                colorCode: (it.colorCode || "").toString().trim()
            };
        });

        // Authoritative merchandise subtotal strictly derived from MongoDB selling price
        const serverSubtotal = verifiedItems.reduce(
            (acc, it) => acc + (it.price * it.quantity),
            0
        );
        const serverShipping = serverSubtotal >= 999 || serverSubtotal === 0 ? 0 : 99;

        // Pre-validate coupon before reducing stock (against authoritative serverSubtotal)
        let preValidatedCoupon = null;
        if (couponCode && typeof couponCode === "string" && couponCode.trim()) {
            const rawCode = couponCode.trim().toUpperCase();
            preValidatedCoupon = await Coupon.findOne({ code: rawCode });

            if (!preValidatedCoupon) {
                return res.status(400).json({ message: `Coupon code "${rawCode}" does not exist.` });
            }
            if (!preValidatedCoupon.isActive) {
                return res.status(400).json({ message: `Coupon "${rawCode}" is currently inactive.` });
            }

            const now = new Date();
            if (now < new Date(preValidatedCoupon.startDate)) {
                return res.status(400).json({ message: `Coupon "${rawCode}" is scheduled and not active yet.` });
            }
            if (now > new Date(preValidatedCoupon.expiryDate)) {
                return res.status(400).json({ message: `Coupon "${rawCode}" has expired.` });
            }
            if (preValidatedCoupon.minOrderAmount && serverSubtotal < preValidatedCoupon.minOrderAmount) {
                return res.status(400).json({
                    message: `Minimum order amount of ₹${preValidatedCoupon.minOrderAmount} required for coupon "${rawCode}".`
                });
            }
            if (preValidatedCoupon.usageLimit !== null && preValidatedCoupon.usedCount >= preValidatedCoupon.usageLimit) {
                return res.status(400).json({ message: `Coupon "${rawCode}" has reached its maximum usage limit.` });
            }

            // Customer usage limit verification against non-cancelled orders
            const custMatch = [];
            if (verifiedCustomerId) custMatch.push({ "customer.customerId": verifiedCustomerId });
            if (customer.email) custMatch.push({ "customer.email": customer.email.trim().toLowerCase() });
            if (custMatch.length > 0) {
                const prevUses = await Order.countDocuments({
                    "coupon.code": rawCode,
                    status: { $ne: "Cancelled" },
                    $or: custMatch
                });
                if (prevUses >= (preValidatedCoupon.usageLimitPerCustomer || 1)) {
                    return res.status(400).json({
                        message: `You have already used coupon "${rawCode}" the maximum allowed number of times.`
                    });
                }
            }
        }

        // 4. Safe atomic stock reduction with compensating rollback
        // Uses atomic query conditions to guarantee stock cannot become negative (< 0)
        // Under race conditions, only one concurrent buyer can succeed
        const successfullyReduced = [];
        let stockReductionFailed = false;
        let failedReason = null;

        for (const [key, entry] of productMap.entries()) {
            const product = entry.productDoc;
            const hasSizeStock = product.sizeStock && typeof product.sizeStock === "object" && Object.keys(product.sizeStock).length > 0;
            const hasColorVariants = Array.isArray(product.colorVariants) && product.colorVariants.length > 0;

            if (hasColorVariants && Object.keys(entry.colorDemands).length > 0) {
                for (const [col, neededQty] of Object.entries(entry.colorDemands)) {
                    const variant = product.colorVariants.find(
                        (v) => (v.colorName && v.colorName.toLowerCase() === col.toLowerCase()) ||
                               (v.colorCode && v.colorCode.toLowerCase() === col.toLowerCase())
                    );
                    if (variant) {
                        const updatedProduct = await Product.findOneAndUpdate(
                            {
                                _id: product._id,
                                stock: { $gte: neededQty }
                            },
                            {
                                $inc: {
                                    "colorVariants.$[elem].stock": -neededQty,
                                    stock: -neededQty
                                }
                            },
                            {
                                arrayFilters: [
                                    { "elem.colorName": variant.colorName, "elem.stock": { $gte: neededQty } }
                                ],
                                returnDocument: 'after'
                            }
                        );

                        if (!updatedProduct) {
                            stockReductionFailed = true;
                            failedReason = { name: product.name, color: variant.colorName };
                            break;
                        }

                        successfullyReduced.push({
                            _id: product._id,
                            colorName: variant.colorName,
                            quantity: neededQty,
                            isColorVariant: true
                        });
                    }
                }
            } else if (hasSizeStock) {
                for (const [sz, neededQty] of Object.entries(entry.sizeDemands)) {
                    const updatedProduct = await Product.findOneAndUpdate(
                        {
                            _id: product._id,
                            [`sizeStock.${sz}`]: { $gte: neededQty },
                            stock: { $gte: neededQty }
                        },
                        {
                            $inc: {
                                [`sizeStock.${sz}`]: -neededQty,
                                stock: -neededQty
                            }
                        },
                        { returnDocument: 'after' }
                    );

                    if (!updatedProduct) {
                        stockReductionFailed = true;
                        failedReason = { name: product.name, size: sz };
                        break;
                    }

                    successfullyReduced.push({
                        _id: product._id,
                        size: sz,
                        quantity: neededQty,
                        isSizeStock: true
                    });
                }
            } else {
                const updatedProduct = await Product.findOneAndUpdate(
                    {
                        _id: product._id,
                        stock: { $gte: entry.totalQuantity }
                    },
                    {
                        $inc: { stock: -entry.totalQuantity }
                    },
                    { returnDocument: 'after' }
                );

                if (!updatedProduct) {
                    stockReductionFailed = true;
                    failedReason = { name: product.name, size: null };
                    break;
                }

                successfullyReduced.push({
                    _id: product._id,
                    size: null,
                    quantity: entry.totalQuantity,
                    isSizeStock: false
                });
            }

            if (stockReductionFailed) {
                break;
            }
        }

        // If any product reduction fails: roll back any previous updates in this order to prevent partial updates
        if (stockReductionFailed) {
            for (const item of successfullyReduced) {
                if (item.isColorVariant && item.colorName) {
                    await Product.updateOne(
                        { _id: item._id },
                        {
                            $inc: {
                                "colorVariants.$[elem].stock": item.quantity,
                                stock: item.quantity
                            }
                        },
                        {
                            arrayFilters: [{ "elem.colorName": item.colorName }]
                        }
                    );
                } else if (item.isSizeStock && item.size) {
                    await Product.updateOne(
                        { _id: item._id },
                        {
                            $inc: {
                                [`sizeStock.${item.size}`]: item.quantity,
                                stock: item.quantity
                            }
                        }
                    );
                } else {
                    await Product.updateOne(
                        { _id: item._id },
                        { $inc: { stock: item.quantity } }
                    );
                }
            }

            const detail = failedReason?.color ? ` (Colour: ${failedReason.color})` : (failedReason?.size ? ` (Size: ${failedReason.size})` : "");
            return res.status(400).json({
                message: `Insufficient stock for ${failedReason?.name || "product"}${detail}. Another customer may have just ordered the last available units.`
            });
        }

        // 5. Atomic coupon usage reservation and order creation in MongoDB
        let couponDoc = null;
        let serverDiscount = 0;
        let couponUsageReserved = false;

        if (preValidatedCoupon) {
            const now = new Date();
            const couponCondition = {
                _id: preValidatedCoupon._id,
                isActive: true,
                startDate: { $lte: now },
                expiryDate: { $gte: now }
            };
            if (preValidatedCoupon.usageLimit !== null) {
                couponCondition.usedCount = { $lt: preValidatedCoupon.usageLimit };
            }

            couponDoc = await Coupon.findOneAndUpdate(
                couponCondition,
                { $inc: { usedCount: 1 } },
                { new: true }
            );

            if (!couponDoc) {
                // Roll back stock changes because coupon usage limit was reached concurrently
                for (const item of successfullyReduced) {
                    if (item.isColorVariant && item.colorName) {
                        await Product.updateOne(
                            { _id: item._id },
                            { $inc: { "colorVariants.$[elem].stock": item.quantity, stock: item.quantity } },
                            { arrayFilters: [{ "elem.colorName": item.colorName }] }
                        );
                    } else if (item.isSizeStock && item.size) {
                        await Product.updateOne(
                            { _id: item._id },
                            { $inc: { [`sizeStock.${item.size}`]: item.quantity, stock: item.quantity } }
                        );
                    } else {
                        await Product.updateOne({ _id: item._id }, { $inc: { stock: item.quantity } });
                    }
                }
                return res.status(400).json({
                    message: `Coupon "${preValidatedCoupon.code}" usage limit was just reached or coupon is no longer valid.`
                });
            }

            couponUsageReserved = true;

            // Calculate exact authoritative discount (ignoring any frontend-provided discount value)
            if (couponDoc.discountType === "percentage") {
                serverDiscount = Math.round((serverSubtotal * couponDoc.discountValue) / 100);
                if (couponDoc.maxDiscountAmount && couponDoc.maxDiscountAmount > 0) {
                    serverDiscount = Math.min(serverDiscount, couponDoc.maxDiscountAmount);
                }
            } else if (couponDoc.discountType === "fixed") {
                serverDiscount = Math.round(couponDoc.discountValue);
            }
            serverDiscount = Math.min(serverDiscount, serverSubtotal);
            serverDiscount = Math.max(0, serverDiscount);
        }

        // Authoritative final total computed securely on backend
        const serverFinalTotal = Math.max(0, serverSubtotal - serverDiscount + serverShipping);

        try {
            const customerData = {
                fullName: customer.fullName,
                email: customer.email,
                phone: customer.phone,
                ...(verifiedCustomerId ? { customerId: verifiedCustomerId } : {})
            };

            const newOrder = new Order({
                orderId,
                customer: customerData,
                shippingAddress,
                items: verifiedItems,
                subtotal: serverSubtotal,
                discount: serverDiscount,
                shipping: serverShipping,
                total: serverFinalTotal,
                status: req.body.status || "Pending",
                statusHistory: [{ status: req.body.status || "Pending", timestamp: new Date() }],
                paymentMethod: req.body.paymentMethod || "Cash on Delivery (COD)",
                ...(couponDoc ? {
                    coupon: {
                        couponId: couponDoc._id,
                        code: couponDoc.code,
                        discountType: couponDoc.discountType,
                        discountValue: couponDoc.discountValue,
                        discountAmount: serverDiscount,
                        eligibleSubtotal: serverSubtotal
                    }
                } : {})
            });

            const savedOrder = await newOrder.save();

            return res.status(201).json({
                message: "Order placed successfully",
                order: savedOrder
            });
        } catch (orderSaveError) {
            // If saving order document fails, roll back all stock changes
            for (const item of successfullyReduced) {
                if (item.isSizeStock && item.size) {
                    await Product.updateOne(
                        { _id: item._id },
                        { $inc: { [`sizeStock.${item.size}`]: item.quantity, stock: item.quantity } }
                    );
                } else {
                    await Product.updateOne(
                        { _id: item._id },
                        { $inc: { stock: item.quantity } }
                    );
                }
            }

            // Roll back coupon usage increment if reserved
            if (couponUsageReserved && couponDoc) {
                await Coupon.updateOne({ _id: couponDoc._id }, { $inc: { usedCount: -1 } });
            }

            return res.status(400).json({
                message: "Error saving order to MongoDB. Stock changes rolled back.",
                error: orderSaveError.message
            });
        }
    } catch (error) {
        res.status(400).json({
            message: error.message || "Error saving order to MongoDB",
            error: error.message
        });
    }
});

// GET /api/orders/my-orders - Retrieve authenticated customer's order history
app.get("/api/orders/my-orders", authenticateCustomer, async (req, res) => {
    try {
        const orders = await Order.find({
            $or: [
                { "customer.customerId": req.user._id },
                { "customer.email": req.user.email.toLowerCase() }
            ]
        }).sort({ createdAt: -1 });

        res.json(orders);
    } catch (error) {
        res.status(500).json({
            message: "Error fetching customer order history",
            error: error.message
        });
    }
});

// GET /api/orders/my-orders/:orderId - Retrieve specific order details verifying strict ownership
app.get("/api/orders/my-orders/:orderId", authenticateCustomer, async (req, res) => {
    try {
        const { orderId } = req.params;

        // Query matching both the requested order identifier AND customer identity
        const order = await Order.findOne({
            $and: [
                {
                    $or: [
                        { orderId: orderId },
                        mongoose.Types.ObjectId.isValid(orderId) ? { _id: orderId } : { orderId: orderId }
                    ]
                },
                {
                    $or: [
                        { "customer.customerId": req.user._id },
                        { "customer.email": req.user.email.toLowerCase() }
                    ]
                }
            ]
        });

        if (!order) {
            return res.status(404).json({
                message: "Order not found or you do not have permission to view this order."
            });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({
            message: "Error fetching order details",
            error: error.message
        });
    }
});

// GET /api/orders - Retrieve all orders (Protected: Administrator only)
app.get("/api/orders", requireAdmin, async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);
    } catch (error) {
        res.status(500).json({
            message: "Error fetching orders from MongoDB",
            error: error.message
        });
    }
});

// POST /api/orders/track - Guest order tracking
app.post("/api/orders/track", async (req, res) => {
    try {
        const { orderId, email } = req.body;
        if (!orderId || !email) {
            return res.status(400).json({ message: "Order ID and Email are required." });
        }

        const order = await Order.findOne({
            $or: [
                { orderId: orderId },
                mongoose.Types.ObjectId.isValid(orderId) ? { _id: orderId } : { orderId: orderId }
            ],
            "customer.email": new RegExp(`^${email.trim()}$`, "i")
        });

        if (!order) {
            return res.status(404).json({ message: "Order not found or email does not match." });
        }

        res.json(order);
    } catch (error) {
        res.status(500).json({ message: "Error tracking order", error: error.message });
    }
});

// PUT /api/orders/:id/status - Update order status (Protected: Administrator only)
app.put("/api/orders/:id/status", requireAdmin, async (req, res) => {
    try {
        const { status, trackingNumber, courierName } = req.body;
        const validStatuses = ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"];

        if (!status || !validStatuses.includes(status)) {
            return res.status(400).json({
                message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
            });
        }

        const { id } = req.params;
        let orderDoc = null;

        if (mongoose.Types.ObjectId.isValid(id)) {
            orderDoc = await Order.findById(id);
        }
        if (!orderDoc) {
            orderDoc = await Order.findOne({ orderId: id });
        }

        if (!orderDoc) {
            return res.status(404).json({
                message: "Order not found"
            });
        }

        const prevStatus = orderDoc.status;
        
        if (prevStatus === "Cancelled" && status !== "Cancelled") {
            return res.status(400).json({ message: "Cannot un-cancel an order." });
        }

        if (status === "Cancelled" && prevStatus === "Cancelled") {
            // Already cancelled, do nothing
        } else {
            orderDoc.status = status;
            orderDoc.statusHistory.push({ status, timestamp: new Date() });
        }
        
        if (trackingNumber !== undefined) {
            orderDoc.trackingNumber = trackingNumber;
        }
        if (courierName !== undefined) {
            orderDoc.courierName = courierName;
        }

        const updatedOrder = await orderDoc.save();

        // Adjust coupon usedCount and inventory if order transitions to Cancelled
        if (prevStatus !== "Cancelled" && status === "Cancelled") {
            if (updatedOrder.coupon && updatedOrder.coupon.code) {
                await Coupon.updateOne(
                    { code: updatedOrder.coupon.code, usedCount: { $gt: 0 } },
                    { $inc: { usedCount: -1 } }
                );
            }
            
            // Restore inventory
            for (const item of updatedOrder.items) {
                if (item.productId) {
                    if (item.size) {
                        await Product.updateOne(
                            { _id: item.productId },
                            { $inc: { [`sizeStock.${item.size}`]: item.quantity, stock: item.quantity } }
                        );
                    } else {
                        await Product.updateOne(
                            { _id: item.productId },
                            { $inc: { stock: item.quantity } }
                        );
                    }
                }
            }
        }

        res.json({
            message: "Order status updated successfully",
            order: updatedOrder
        });
    } catch (error) {
        res.status(500).json({
            message: "Error updating order status",
            error: error.message
        });
    }
});

// Catch-all 404 handler for /api routes to guarantee JSON error response (preventing HTML fallbacks)
app.all(/^\/api(\/.*)?$/, (req, res) => {
    res.status(404).json({
        success: false,
        message: `API endpoint not found: ${req.method} ${req.originalUrl}`
    });
});

// Global error-handling middleware for API routes ensuring JSON output
app.use((err, req, res, next) => {
    if (req.originalUrl && req.originalUrl.startsWith("/api")) {
        console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);
        return res.status(err.status || 500).json({
            success: false,
            message: err.message || "An unexpected internal server error occurred.",
            error: process.env.NODE_ENV !== "production" ? err.message : undefined
        });
    }
    next(err);
});

app.listen(PORT, async () => {
    console.log(`AURA Backend running on http://localhost:${PORT}`);
    if (isEmailConfigured()) {
        await verifySmtpConnection();
    } else {
        console.log("[AURA Email Service] SMTP is not configured in backend/.env (live emails disabled).");
    }
});