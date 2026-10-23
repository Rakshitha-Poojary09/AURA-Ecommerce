const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Coupon = require("../models/Coupon");
const Order = require("../models/Order");
const { requireAdmin } = require("../middleware/auth");

const adminRouter = express.Router();
const customerRouter = express.Router();

// Helper to determine customer identity from request (cookies, header, or payload)
const resolveCustomerIdentity = (req) => {
  let customerId = null;
  let customerEmail = null;

  try {
    let token = req.cookies?.aura_customer_session || req.cookies?.token;
    if (!token && req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (token) {
      const secret = process.env.JWT_SECRET || "aura_luxury_fashion_jwt_secret_key_2026_super_secure";
      const decoded = jwt.verify(token, secret);
      if (decoded && decoded.id) {
        customerId = decoded.id;
      }
    }
  } catch (err) {
    // Guest or unauthenticated request
  }

  if (req.body.customerId && !customerId && mongoose.Types.ObjectId.isValid(req.body.customerId)) {
    customerId = req.body.customerId;
  }

  if (req.body.customerEmail && typeof req.body.customerEmail === "string") {
    customerEmail = req.body.customerEmail.trim().toLowerCase();
  } else if (req.body.customer?.email && typeof req.body.customer.email === "string") {
    customerEmail = req.body.customer.email.trim().toLowerCase();
  }

  return { customerId, customerEmail };
};

// ====================================================================
// ADMIN COUPON ROUTES (All protected with requireAdmin)
// ====================================================================

/**
 * GET /api/admin/coupons
 * Retrieve coupons with filtering, search, sorting, and aggregate statistics
 */
adminRouter.get("/", async (req, res) => {
  try {
    const { search, status, sort } = req.query;
    const now = new Date();

    let filter = {};

    // 1. Search by Coupon Code (case-insensitive)
    if (search && search.trim()) {
      filter.code = { $regex: new RegExp(search.trim(), "i") };
    }

    // 2. Status Filter
    if (status && status !== "all") {
      const s = status.toLowerCase();
      if (s === "active") {
        filter.isActive = true;
        filter.startDate = { $lte: now };
        filter.expiryDate = { $gte: now };
      } else if (s === "inactive") {
        filter.isActive = false;
      } else if (s === "expired") {
        filter.expiryDate = { $lt: now };
      } else if (s === "scheduled") {
        filter.startDate = { $gt: now };
      }
    }

    // 3. Sorting Options
    let sortOption = { createdAt: -1 };
    if (sort === "expiry") {
      sortOption = { expiryDate: 1 };
    } else if (sort === "usage") {
      sortOption = { usedCount: -1 };
    } else if (sort === "newest") {
      sortOption = { createdAt: -1 };
    }

    // 4. Fetch Coupons from MongoDB
    const coupons = await Coupon.find(filter).sort(sortOption);

    // 5. Aggregate Real Statistics from MongoDB Collections
    const [totalCoupons, activeCoupons, expiredCoupons, scheduledCoupons, inactiveCoupons] =
      await Promise.all([
        Coupon.countDocuments(),
        Coupon.countDocuments({
          isActive: true,
          startDate: { $lte: now },
          expiryDate: { $gte: now }
        }),
        Coupon.countDocuments({ expiryDate: { $lt: now } }),
        Coupon.countDocuments({ startDate: { $gt: now } }),
        Coupon.countDocuments({ isActive: false })
      ]);

    // 6. Aggregate Total Discount Given from real non-cancelled orders
    const discountAgg = await Order.aggregate([
      {
        $match: {
          "coupon.code": { $exists: true, $ne: null },
          status: { $ne: "Cancelled" }
        }
      },
      {
        $group: {
          _id: null,
          totalDiscount: { $sum: { $ifNull: ["$coupon.discountAmount", "$discount", 0] } },
          successfulUses: { $sum: 1 }
        }
      }
    ]);

    const totalDiscountGiven = discountAgg[0]?.totalDiscount || 0;
    const totalSuccessfulUses = discountAgg[0]?.successfulUses || 0;

    // 7. Most-used coupons breakdown from non-cancelled orders
    const mostUsedCoupons = await Order.aggregate([
      {
        $match: {
          "coupon.code": { $exists: true, $ne: null },
          status: { $ne: "Cancelled" }
        }
      },
      {
        $group: {
          _id: "$coupon.code",
          timesUsed: { $sum: 1 },
          totalDiscountGranted: { $sum: { $ifNull: ["$coupon.discountAmount", "$discount", 0] } }
        }
      },
      { $sort: { timesUsed: -1 } },
      { $limit: 5 }
    ]);

    return res.json({
      coupons,
      stats: {
        totalCoupons,
        activeCoupons,
        expiredCoupons,
        scheduledCoupons,
        inactiveCoupons,
        totalDiscountGiven: Math.round(totalDiscountGiven),
        totalSuccessfulUses,
        mostUsedCoupons
      }
    });
  } catch (error) {
    console.error("Error retrieving admin coupons:", error);
    return res.status(500).json({
      message: "Error fetching coupons from MongoDB",
      error: error.message
    });
  }
});

/**
 * GET /api/admin/coupons/analytics
 * Retrieve dedicated coupon usage analytics calculated from real successful orders
 */
adminRouter.get("/analytics", async (req, res) => {
  try {
    const couponAnalytics = await Order.aggregate([
      {
        $match: {
          "coupon.code": { $exists: true, $ne: null },
          status: { $ne: "Cancelled" }
        }
      },
      {
        $group: {
          _id: "$coupon.code",
          timesUsed: { $sum: 1 },
          totalDiscount: { $sum: { $ifNull: ["$coupon.discountAmount", "$discount", 0] } },
          totalOrderValue: { $sum: "$total" }
        }
      },
      { $sort: { timesUsed: -1 } }
    ]);

    const totalStats = await Order.aggregate([
      {
        $match: {
          "coupon.code": { $exists: true, $ne: null },
          status: { $ne: "Cancelled" }
        }
      },
      {
        $group: {
          _id: null,
          totalDiscount: { $sum: { $ifNull: ["$coupon.discountAmount", "$discount", 0] } },
          successfulUses: { $sum: 1 }
        }
      }
    ]);

    return res.json({
      totalDiscountGranted: Math.round(totalStats[0]?.totalDiscount || 0),
      totalSuccessfulUses: totalStats[0]?.successfulUses || 0,
      couponsUsage: couponAnalytics
    });
  } catch (error) {
    console.error("Error retrieving coupon analytics:", error);
    return res.status(500).json({
      message: "Error generating coupon analytics",
      error: error.message
    });
  }
});

/**
 * POST /api/admin/coupons
 * Create a new coupon with strict backend validation
 */
adminRouter.post("/", async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      startDate,
      expiryDate,
      usageLimit,
      usageLimitPerCustomer,
      isActive
    } = req.body;

    // 1. Coupon Code Validation
    if (!code || typeof code !== "string" || !code.trim()) {
      return res.status(400).json({ message: "Coupon code is required" });
    }
    const normalizedCode = code.trim().toUpperCase();
    if (normalizedCode.length < 2 || normalizedCode.length > 30) {
      return res.status(400).json({ message: "Coupon code must be between 2 and 30 characters" });
    }

    // 2. Prevent duplicate codes (case-insensitive check)
    const existing = await Coupon.findOne({
      code: { $regex: new RegExp(`^${normalizedCode}$`, "i") }
    });
    if (existing) {
      return res.status(400).json({
        message: `Coupon with code "${normalizedCode}" already exists. Coupon codes must be unique.`
      });
    }

    // 3. Discount Type & Value Validation
    const dType = (discountType || "percentage").toLowerCase();
    if (!["percentage", "fixed"].includes(dType)) {
      return res.status(400).json({ message: "Discount type must be either 'percentage' or 'fixed'" });
    }

    const dVal = Number(discountValue);
    if (isNaN(dVal) || dVal <= 0) {
      return res.status(400).json({ message: "Discount value must be a positive number greater than 0" });
    }

    if (dType === "percentage" && dVal > 100) {
      return res.status(400).json({ message: "Percentage discount cannot exceed 100%" });
    }

    // 4. Financial Constraints
    const minOrder = minOrderAmount !== undefined && minOrderAmount !== "" ? Number(minOrderAmount) : 0;
    if (isNaN(minOrder) || minOrder < 0) {
      return res.status(400).json({ message: "Minimum order amount cannot be negative" });
    }

    let maxDiscount = null;
    if (maxDiscountAmount !== undefined && maxDiscountAmount !== null && maxDiscountAmount !== "") {
      maxDiscount = Number(maxDiscountAmount);
      if (isNaN(maxDiscount) || maxDiscount < 0) {
        return res.status(400).json({ message: "Maximum discount amount cannot be negative" });
      }
    }

    // 5. Date Validation
    if (!startDate || !expiryDate) {
      return res.status(400).json({ message: "Both start date and expiry date are required" });
    }

    const start = new Date(startDate);
    const expiry = new Date(expiryDate);

    if (isNaN(start.getTime()) || isNaN(expiry.getTime())) {
      return res.status(400).json({ message: "Invalid date format provided for start or expiry date" });
    }

    if (expiry <= start) {
      return res.status(400).json({ message: "Expiry date and time must be after the start date and time" });
    }

    // 6. Usage Limits
    let limit = null;
    if (usageLimit !== undefined && usageLimit !== null && usageLimit !== "") {
      limit = Math.floor(Number(usageLimit));
      if (isNaN(limit) || limit < 1) {
        return res.status(400).json({ message: "Total usage limit must be at least 1 if specified" });
      }
    }

    let perCustomer = 1;
    if (usageLimitPerCustomer !== undefined && usageLimitPerCustomer !== null && usageLimitPerCustomer !== "") {
      perCustomer = Math.floor(Number(usageLimitPerCustomer));
      if (isNaN(perCustomer) || perCustomer < 1) {
        return res.status(400).json({ message: "Per-customer usage limit must be at least 1" });
      }
    }

    // 7. Save Coupon
    const newCoupon = new Coupon({
      code: normalizedCode,
      discountType: dType,
      discountValue: dVal,
      minOrderAmount: minOrder,
      maxDiscountAmount: maxDiscount,
      startDate: start,
      expiryDate: expiry,
      usageLimit: limit,
      usageLimitPerCustomer: perCustomer,
      usedCount: 0,
      isActive: typeof isActive === "boolean" ? isActive : true
    });

    const savedCoupon = await newCoupon.save();

    return res.status(201).json({
      message: `Coupon "${savedCoupon.code}" created successfully!`,
      coupon: savedCoupon
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "A coupon with this code already exists." });
    }
    console.error("Error creating coupon:", error);
    return res.status(400).json({
      message: error.message || "Failed to create coupon",
      error: error.message
    });
  }
});

/**
 * GET /api/admin/coupons/:id
 * Retrieve a single coupon by ID
 */
adminRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid coupon ID format" });
    }

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    return res.json(coupon);
  } catch (error) {
    return res.status(500).json({ message: "Error fetching coupon", error: error.message });
  }
});

/**
 * PUT /api/admin/coupons/:id
 * Update an existing coupon with validation
 */
adminRouter.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid coupon ID format" });
    }

    const existingCoupon = await Coupon.findById(id);
    if (!existingCoupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    const {
      code,
      discountType,
      discountValue,
      minOrderAmount,
      maxDiscountAmount,
      startDate,
      expiryDate,
      usageLimit,
      usageLimitPerCustomer,
      isActive
    } = req.body;

    const updates = {};

    // 1. Code update
    if (code !== undefined) {
      if (!code.trim()) {
        return res.status(400).json({ message: "Coupon code cannot be empty" });
      }
      const normalizedCode = code.trim().toUpperCase();
      // Check if duplicate on other coupon
      const duplicate = await Coupon.findOne({
        _id: { $ne: id },
        code: { $regex: new RegExp(`^${normalizedCode}$`, "i") }
      });
      if (duplicate) {
        return res.status(400).json({
          message: `Another coupon with code "${normalizedCode}" already exists.`
        });
      }
      updates.code = normalizedCode;
    }

    // 2. Discount Type & Value
    const dType = discountType ? discountType.toLowerCase() : existingCoupon.discountType;
    if (discountType !== undefined) {
      if (!["percentage", "fixed"].includes(dType)) {
        return res.status(400).json({ message: "Discount type must be either 'percentage' or 'fixed'" });
      }
      updates.discountType = dType;
    }

    const dVal = discountValue !== undefined ? Number(discountValue) : existingCoupon.discountValue;
    if (discountValue !== undefined) {
      if (isNaN(dVal) || dVal <= 0) {
        return res.status(400).json({ message: "Discount value must be greater than 0" });
      }
      if (dType === "percentage" && dVal > 100) {
        return res.status(400).json({ message: "Percentage discount cannot exceed 100%" });
      }
      updates.discountValue = dVal;
    }

    // 3. Min / Max amounts
    if (minOrderAmount !== undefined) {
      const min = Number(minOrderAmount);
      if (isNaN(min) || min < 0) {
        return res.status(400).json({ message: "Minimum order amount cannot be negative" });
      }
      updates.minOrderAmount = min;
    }

    if (maxDiscountAmount !== undefined) {
      if (maxDiscountAmount === null || maxDiscountAmount === "") {
        updates.maxDiscountAmount = null;
      } else {
        const max = Number(maxDiscountAmount);
        if (isNaN(max) || max < 0) {
          return res.status(400).json({ message: "Maximum discount amount cannot be negative" });
        }
        updates.maxDiscountAmount = max;
      }
    }

    // 4. Dates
    const start = startDate ? new Date(startDate) : new Date(existingCoupon.startDate);
    const expiry = expiryDate ? new Date(expiryDate) : new Date(existingCoupon.expiryDate);

    if (isNaN(start.getTime()) || isNaN(expiry.getTime())) {
      return res.status(400).json({ message: "Invalid date format provided" });
    }
    if (expiry <= start) {
      return res.status(400).json({ message: "Expiry date must be after start date" });
    }

    if (startDate !== undefined) updates.startDate = start;
    if (expiryDate !== undefined) updates.expiryDate = expiry;

    // 5. Limits
    if (usageLimit !== undefined) {
      if (usageLimit === null || usageLimit === "") {
        updates.usageLimit = null;
      } else {
        const lim = Math.floor(Number(usageLimit));
        if (isNaN(lim) || lim < 1) {
          return res.status(400).json({ message: "Usage limit must be at least 1" });
        }
        updates.usageLimit = lim;
      }
    }

    if (usageLimitPerCustomer !== undefined) {
      const perCust = Math.floor(Number(usageLimitPerCustomer));
      if (isNaN(perCust) || perCust < 1) {
        return res.status(400).json({ message: "Per-customer usage limit must be at least 1" });
      }
      updates.usageLimitPerCustomer = perCust;
    }

    if (isActive !== undefined) {
      updates.isActive = Boolean(isActive);
    }

    const updatedCoupon = await Coupon.findByIdAndUpdate(id, updates, {
      returnDocument: 'after',
      runValidators: true
    });

    return res.json({
      message: `Coupon "${updatedCoupon.code}" updated successfully!`,
      coupon: updatedCoupon
    });
  } catch (error) {
    console.error("Error updating coupon:", error);
    return res.status(400).json({
      message: error.message || "Failed to update coupon",
      error: error.message
    });
  }
});

/**
 * PUT /api/admin/coupons/:id/status
 * Toggle or set active/inactive status
 */
adminRouter.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid coupon ID format" });
    }

    const coupon = await Coupon.findById(id);
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    let newStatus;
    if (req.body.isActive !== undefined) {
      newStatus = Boolean(req.body.isActive);
    } else {
      newStatus = !coupon.isActive;
    }

    coupon.isActive = newStatus;
    await coupon.save();

    return res.json({
      message: `Coupon "${coupon.code}" is now ${newStatus ? "active" : "inactive"}.`,
      coupon
    });
  } catch (error) {
    return res.status(500).json({ message: "Error changing coupon status", error: error.message });
  }
});

/**
 * DELETE /api/admin/coupons/:id
 * Delete coupon. Historical orders remain untouched.
 */
adminRouter.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid coupon ID format" });
    }

    const deleted = await Coupon.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    return res.json({
      message: `Coupon "${deleted.code}" deleted successfully. Historical orders retain their recorded discounts.`,
      deleted
    });
  } catch (error) {
    return res.status(500).json({ message: "Error deleting coupon", error: error.message });
  }
});

// ====================================================================
// CUSTOMER COUPON VALIDATION & DISCOVERY ROUTES (Public/Customer)
// ====================================================================

/**
 * GET /api/coupons and GET /api/coupons/active
 * Retrieve all currently active, non-expired coupons for customer discovery
 */
customerRouter.get(["/", "/active"], async (req, res) => {
  try {
    const now = new Date();
    const query = {
      isActive: true,
      startDate: { $lte: now },
      expiryDate: { $gte: now },
      $or: [
        { usageLimit: null },
        { usageLimit: { $exists: false } },
        { $expr: { $lt: ["$usedCount", "$usageLimit"] } }
      ]
    };

    const activeCoupons = await Coupon.find(query)
      .sort({ createdAt: -1 })
      .select("code discountType discountValue minOrderAmount maxDiscountAmount startDate expiryDate usageLimit usedCount")
      .lean();

    return res.json({
      success: true,
      count: activeCoupons.length,
      coupons: activeCoupons
    });
  } catch (error) {
    console.error("Error fetching active coupons for customers:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving available coupons",
      error: error.message
    });
  }
});

/**
 * POST /api/coupons/validate
 * Securely validate coupon against current MongoDB state and calculate authoritative discount
 */
customerRouter.post("/validate", async (req, res) => {
  try {
    const { code, subtotal } = req.body;

    if (!code || typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        valid: false,
        message: "Please enter a coupon code."
      });
    }

    const normalizedCode = code.trim().toUpperCase();

    // 1. Verify coupon exists in MongoDB
    const coupon = await Coupon.findOne({ code: normalizedCode });
    if (!coupon) {
      return res.status(400).json({
        valid: false,
        message: `Coupon code "${normalizedCode}" is invalid.`
      });
    }

    // 2. Check if coupon is active
    if (!coupon.isActive) {
      return res.status(400).json({
        valid: false,
        message: `Coupon "${normalizedCode}" is currently inactive.`
      });
    }

    // 3. Check validity period
    const now = new Date();
    if (now < new Date(coupon.startDate)) {
      return res.status(400).json({
        valid: false,
        message: `Coupon "${normalizedCode}" is scheduled and will become active on ${new Date(coupon.startDate).toLocaleDateString("en-IN")}.`
      });
    }

    if (now > new Date(coupon.expiryDate)) {
      return res.status(400).json({
        valid: false,
        message: `Coupon "${normalizedCode}" expired on ${new Date(coupon.expiryDate).toLocaleDateString("en-IN")}.`
      });
    }

    // 4. Check eligible merchandise subtotal
    const numSubtotal = Number(subtotal);
    if (isNaN(numSubtotal) || numSubtotal <= 0) {
      return res.status(400).json({
        valid: false,
        message: "Your shopping bag has an invalid subtotal."
      });
    }

    // Check minimum order amount requirement
    if (coupon.minOrderAmount && coupon.minOrderAmount > 0) {
      if (numSubtotal < coupon.minOrderAmount) {
        return res.status(400).json({
          valid: false,
          message: `Minimum order amount of ₹${coupon.minOrderAmount.toLocaleString("en-IN")} required for coupon "${normalizedCode}". Add ₹${(coupon.minOrderAmount - numSubtotal).toLocaleString("en-IN")} more to qualify.`
        });
      }
    }

    // 5. Check total usage limit
    if (coupon.usageLimit !== null && coupon.usageLimit !== undefined) {
      if (coupon.usedCount >= coupon.usageLimit) {
        return res.status(400).json({
          valid: false,
          message: `Coupon "${normalizedCode}" has reached its maximum total usage limit.`
        });
      }
    }

    // 6. Check customer-specific usage limit (from non-cancelled orders)
    const { customerId, customerEmail } = resolveCustomerIdentity(req);
    const customerMatchConditions = [];
    if (customerId) {
      customerMatchConditions.push({ "customer.customerId": customerId });
    }
    if (customerEmail) {
      customerMatchConditions.push({ "customer.email": customerEmail });
    }

    if (customerMatchConditions.length > 0) {
      const customerOrdersCount = await Order.countDocuments({
        "coupon.code": normalizedCode,
        status: { $ne: "Cancelled" },
        $or: customerMatchConditions
      });

      const allowedPerCustomer = coupon.usageLimitPerCustomer || 1;
      if (customerOrdersCount >= allowedPerCustomer) {
        return res.status(400).json({
          valid: false,
          message: `You have already used coupon "${normalizedCode}" the maximum allowed number of times (${allowedPerCustomer}).`
        });
      }
    }

    // 7. Authoritative Backend Discount Calculation
    let calculatedDiscount = 0;
    if (coupon.discountType === "percentage") {
      calculatedDiscount = Math.round((numSubtotal * coupon.discountValue) / 100);
      if (coupon.maxDiscountAmount && coupon.maxDiscountAmount > 0) {
        calculatedDiscount = Math.min(calculatedDiscount, coupon.maxDiscountAmount);
      }
    } else if (coupon.discountType === "fixed") {
      calculatedDiscount = Math.round(coupon.discountValue);
    }

    // Cap discount so it cannot exceed the merchandise subtotal
    calculatedDiscount = Math.min(calculatedDiscount, numSubtotal);
    calculatedDiscount = Math.max(0, calculatedDiscount);

    const finalPayable = Math.max(0, numSubtotal - calculatedDiscount);

    return res.json({
      valid: true,
      message: `Coupon "${normalizedCode}" applied successfully! You saved ₹${calculatedDiscount.toLocaleString("en-IN")}.`,
      coupon: {
        id: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        discountAmount: calculatedDiscount,
        minOrderAmount: coupon.minOrderAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        eligibleSubtotal: numSubtotal,
        finalPayable
      }
    });
  } catch (error) {
    console.error("Error validating coupon:", error);
    return res.status(500).json({
      valid: false,
      message: "An error occurred while validating your coupon.",
      error: error.message
    });
  }
});

module.exports = {
  adminRouter,
  customerRouter
};
