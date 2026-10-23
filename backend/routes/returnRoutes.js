const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ReturnRequest = require("../models/ReturnRequest");
const { authenticateCustomer, requireAdmin } = require("../middleware/auth");
const {
  getVariantKey,
  getReturnWindowDays,
  checkOrderReturnWindow,
  calculateItemUnitRefund,
  evaluateOrderReturnEligibility
} = require("../utils/returnPolicy");

// Valid reasons whitelist
const VALID_REASONS = [
  "Wrong item received",
  "Damaged or defective item",
  "Size or fit issue",
  "Product differs from description",
  "Received the wrong size or color",
  "Other"
];

// Helper to generate unique human-readable reference
const generateRequestId = (type) => {
  const prefix = type === "Exchange" ? "EXC" : "RET";
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  const timestampPart = Date.now().toString().slice(-6);
  return `${prefix}-${timestampPart}${randomPart}`;
};

// In-process order-level mutex to serialize concurrent submissions and prevent over-reservation
const orderLocks = new Map();
const withOrderLock = async (orderId, fn) => {
  const key = (orderId || "").toString().trim();
  while (orderLocks.has(key)) {
    await orderLocks.get(key);
  }
  let resolveLock;
  const lockPromise = new Promise((resolve) => {
    resolveLock = resolve;
  });
  orderLocks.set(key, lockPromise);
  try {
    return await fn();
  } finally {
    orderLocks.delete(key);
    resolveLock();
  }
};

// =========================================================================
// 1. PUBLIC POLICY ENDPOINT
// =========================================================================

/**
 * GET /api/returns/policy
 * Returns the active return/exchange policy configuration.
 */
router.get("/policy", (req, res) => {
  const windowDays = getReturnWindowDays();
  res.json({
    returnWindowDays: windowDays,
    reasons: VALID_REASONS,
    supportedTypes: ["Return", "Exchange"],
    policyNotice: "14-day complimentary doorstep return and exchange service for unworn garments with tags attached."
  });
});

// =========================================================================
// 2. CUSTOMER AUTHENTICATED ENDPOINTS
// =========================================================================

/**
 * GET /api/returns/eligibility/:orderId
 * Check return/exchange eligibility and remaining quantities for an authenticated customer's order.
 */
router.get("/eligibility/:orderId", authenticateCustomer, async (req, res) => {
  try {
    const { orderId } = req.params;

    // Strict ownership verification
    const order = await Order.findOne({
      $and: [
        {
          $or: [
            { orderId },
            mongoose.Types.ObjectId.isValid(orderId) ? { _id: orderId } : { orderId }
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
        message: "Order not found or you do not have permission to access it."
      });
    }

    const evaluation = await evaluateOrderReturnEligibility(order);
    res.json(evaluation);
  } catch (error) {
    res.status(500).json({
      message: "Error evaluating return eligibility",
      error: error.message
    });
  }
});

/**
 * POST /api/returns
 * Create a new return or exchange request for an authenticated customer.
 */
router.post("/", authenticateCustomer, async (req, res) => {
  try {
    const { orderId, requestType, items, reason, comments, evidenceImages } = req.body;

    if (!orderId) {
      return res.status(400).json({ message: "Order ID is required." });
    }
    if (!requestType || !["Return", "Exchange"].includes(requestType)) {
      return res.status(400).json({ message: 'Request type must be "Return" or "Exchange".' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one item must be selected." });
    }
    if (!reason || !VALID_REASONS.includes(reason)) {
      return res.status(400).json({ message: `A valid reason is required. Options: ${VALID_REASONS.join(", ")}` });
    }

    // Verify order ownership
    const order = await Order.findOne({
      $and: [
        {
          $or: [
            { orderId },
            mongoose.Types.ObjectId.isValid(orderId) ? { _id: orderId } : { orderId }
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
        message: "Order not found or you do not have permission to submit requests for it."
      });
    }

    // Check overall order return window
    const windowCheck = checkOrderReturnWindow(order);
    if (!windowCheck.isWithinWindow) {
      return res.status(400).json({ message: windowCheck.reason });
    }

    // Serialize concurrent reservations for the same order to prevent over-reservation
    const result = await withOrderLock(order.orderId, async () => {
      // Re-evaluate remaining eligible quantities freshly from DB inside lock
      const eligibility = await evaluateOrderReturnEligibility(order);
      if (!eligibility.isOrderEligible) {
        return {
          status: 400,
          error: eligibility.ineligibilityReason || "All purchased quantities for this order have already been returned or requested."
        };
      }

      // Aggregate payload items by variant to prevent multi-line quantity bypass
      const aggregatedPayloadItems = new Map();
      for (const reqItem of items) {
        const pId = (reqItem.productId || "").toString();
        const sz = (reqItem.size || "Standard").toString().trim();
        const vKey = getVariantKey(pId, sz);
        const qty = parseInt(reqItem.quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          return { status: 400, error: `Quantity for "${reqItem.name || pId}" must be at least 1.` };
        }
        if (aggregatedPayloadItems.has(vKey)) {
          const existing = aggregatedPayloadItems.get(vKey);
          existing.quantity += qty;
        } else {
          aggregatedPayloadItems.set(vKey, {
            ...reqItem,
            productId: pId,
            size: sz,
            quantity: qty
          });
        }
      }

      // Check for rapid duplicate submission within last 5 seconds
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      const recentDuplicate = await ReturnRequest.findOne({
        orderId: order.orderId,
        createdAt: { $gte: fiveSecondsAgo },
        status: "Requested"
      });
      if (recentDuplicate) {
        return {
          status: 409,
          error: `A return/exchange request (#${recentDuplicate.requestId}) was just submitted for this order. Please wait for concierge verification.`
        };
      }

      const verifiedReturnItems = [];
      let calculatedTotalRefund = 0;

      for (const [vKey, reqItem] of aggregatedPayloadItems) {
        const match = eligibility.items.find(
          (it) => getVariantKey(it.productId, it.size) === vKey
        );

        if (!match) {
          return {
            status: 400,
            error: `Item "${reqItem.name || reqItem.productId}" (Size: ${reqItem.size}) was not purchased in this order.`
          };
        }

        if (reqItem.quantity > match.remainingQuantity) {
          return {
            status: 400,
            error: `Requested quantity (${reqItem.quantity}) exceeds remaining eligible quantity (${match.remainingQuantity}) for ${match.name} (Size: ${match.size}).`
          };
        }

        let replacementSize = null;
        if (requestType === "Exchange") {
          if (!reqItem.replacementSize || typeof reqItem.replacementSize !== "string") {
            return {
              status: 400,
              error: `Please select a replacement size for ${match.name}.`
            };
          }
          replacementSize = reqItem.replacementSize.trim();
          if (replacementSize.toUpperCase() === match.size.toString().trim().toUpperCase()) {
            return {
              status: 400,
              error: `Replacement size for ${match.name} cannot be identical to the original size (${match.size}).`
            };
          }

          const sizeOption = match.exchangeSizes.find(
            (s) => s.size.toString().trim().toUpperCase() === replacementSize.toUpperCase()
          );
          if (!sizeOption || !sizeOption.inStock) {
            return {
              status: 400,
              error: `Replacement size "${replacementSize}" for ${match.name} is currently out of stock.`
            };
          }
        }

        const itemAllocatedDiscount = match.unitDiscount * reqItem.quantity;
        const itemEligibleRefund = match.netUnitRefund * reqItem.quantity;
        calculatedTotalRefund += itemEligibleRefund;

        verifiedReturnItems.push({
          productId: match.productId,
          name: match.name,
          image: match.image,
          originalPrice: match.originalPrice,
          originalMrp: match.originalMrp,
          size: match.size,
          quantity: reqItem.quantity,
          reason: reqItem.reason && VALID_REASONS.includes(reqItem.reason) ? reqItem.reason : reason,
          customerComments: reqItem.customerComments || "",
          replacementSize,
          allocatedDiscount: itemAllocatedDiscount,
          eligibleRefundAmount: itemEligibleRefund
        });
      }

      const newRequestId = generateRequestId(requestType);

      const newRequest = new ReturnRequest({
        requestId: newRequestId,
        orderId: order.orderId,
        orderRef: order._id,
        customer: {
          customerId: req.user._id,
          fullName: req.user.name || order.customer.fullName,
          email: req.user.email.toLowerCase(),
          phone: order.customer.phone,
          isGuest: false
        },
        requestType,
        items: verifiedReturnItems,
        reason,
        comments: comments || "",
        evidenceImages: Array.isArray(evidenceImages) ? evidenceImages.slice(0, 5) : [],
        status: "Requested",
        refundStatus: requestType === "Return" ? "Pending" : "None",
        refundAmount: requestType === "Return" ? calculatedTotalRefund : 0,
        statusHistory: [
          {
            status: "Requested",
            timestamp: new Date(),
            message: `Customer initiated ${requestType.toLowerCase()} request for ${verifiedReturnItems.length} item(s).`,
            updatedBy: req.user.name || "Customer"
          }
        ]
      });

      const savedRequest = await newRequest.save();
      return { status: 201, savedRequest };
    });

    if (result.error) {
      return res.status(result.status || 400).json({ message: result.error });
    }

    res.status(201).json({
      message: `${requestType} request submitted successfully.`,
      request: result.savedRequest
    });
  } catch (error) {
    res.status(500).json({
      message: "Error submitting return/exchange request",
      error: error.message
    });
  }
});

/**
 * GET /api/returns/my-requests
 * Retrieve all return and exchange requests for the authenticated customer.
 */
router.get("/my-requests", authenticateCustomer, async (req, res) => {
  try {
    const userEmail = (req.user?.email || "").trim().toLowerCase();
    const userId = req.user?._id;

    const queryConditions = [];
    if (userId) {
      queryConditions.push({ "customer.customerId": userId });
    }
    if (userEmail) {
      queryConditions.push({ "customer.email": userEmail });
      queryConditions.push({ "customer.email": new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });
    }

    if (queryConditions.length === 0) {
      return res.json({
        success: true,
        count: 0,
        total: 0,
        requests: []
      });
    }

    const requests = await ReturnRequest.find({
      $or: queryConditions
    })
      .sort({ createdAt: -1 })
      .populate("orderRef");

    res.json({
      success: true,
      count: requests.length,
      total: requests.length,
      requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching return requests",
      error: error.message
    });
  }
});

/**
 * GET /api/returns/my-requests/:requestId
 * Retrieve single request details for authenticated customer with strict ownership.
 */
const getMySingleRequestHandler = async (req, res) => {
  try {
    const rawParamId = Array.isArray(req.params.requestId) ? req.params.requestId.join('/') : req.params.requestId;
    const reqId = rawParamId ? decodeURIComponent(rawParamId).trim() : '';
    const userEmail = (req.user?.email || "").trim().toLowerCase();
    const userId = req.user?._id;

    const ownershipConditions = [];
    if (userId) ownershipConditions.push({ "customer.customerId": userId });
    if (userEmail) ownershipConditions.push({ "customer.email": new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });

    const searchConditions = [];
    if (mongoose.Types.ObjectId.isValid(reqId)) searchConditions.push({ _id: reqId });
    if (reqId) {
      searchConditions.push({ requestId: reqId });
      const cleanNoSlash = reqId.replace(/\//g, '');
      if (cleanNoSlash !== reqId) searchConditions.push({ requestId: cleanNoSlash });
    }

    const request = await ReturnRequest.findOne({
      $and: [
        { $or: searchConditions },
        { $or: ownershipConditions }
      ]
    }).populate("orderRef");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Return request not found or access denied."
      });
    }

    res.json({
      success: true,
      request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching request details",
      error: error.message
    });
  }
};
router.get(["/my-requests/:requestId", "/my-requests/*requestId"], authenticateCustomer, getMySingleRequestHandler);

/**
 * POST/PATCH /api/returns/my-requests/:requestId/cancel and /:requestId/cancel
 * Customer can cancel their request while it is still in "Requested" status.
 */
const cancelCustomerRequestHandler = async (req, res) => {
  try {
    const rawParamId = Array.isArray(req.params.requestId) ? req.params.requestId.join('/') : req.params.requestId;
    const reqId = rawParamId ? decodeURIComponent(rawParamId).trim() : '';
    const userEmail = (req.user?.email || "").trim().toLowerCase();
    const userId = req.user?._id;

    const ownershipConditions = [];
    if (userId) ownershipConditions.push({ "customer.customerId": userId });
    if (userEmail) ownershipConditions.push({ "customer.email": new RegExp(`^${userEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") });

    const searchConditions = [];
    if (mongoose.Types.ObjectId.isValid(reqId)) searchConditions.push({ _id: reqId });
    if (reqId) {
      searchConditions.push({ requestId: reqId });
      const cleanNoSlash = reqId.replace(/\//g, '');
      if (cleanNoSlash !== reqId) searchConditions.push({ requestId: cleanNoSlash });
    }

    const request = await ReturnRequest.findOne({
      $and: [
        { $or: searchConditions },
        { $or: ownershipConditions }
      ]
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Return request not found or you do not have permission to cancel it."
      });
    }

    if (request.status !== "Requested") {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a request that has already moved to "${request.status}". Please contact boutique concierge.`
      });
    }

    request.status = "Cancelled";
    request.refundStatus = "None";
    if (request.requestType === "Exchange" && request.exchangeStockDeducted) {
      for (const item of request.items) {
        if (item.replacementSize) {
          await Product.updateOne(
            { _id: item.productId },
            {
              $inc: {
                [`sizeStock.${item.replacementSize}`]: item.quantity,
                stock: item.quantity
              }
            }
          );
        }
      }
      request.exchangeStockDeducted = false;
    }
    request.statusHistory.push({
      status: "Cancelled",
      timestamp: new Date(),
      message: "Customer cancelled the request.",
      updatedBy: req.user?.name || "Customer"
    });

    await request.save();

    res.json({
      success: true,
      message: "Request cancelled successfully.",
      request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error cancelling request",
      error: error.message
    });
  }
};

const customerCancelRoutes = [
  "/my-requests/:requestId/cancel",
  "/my-requests/*requestId/cancel",
  "/:requestId/cancel",
  "/*requestId/cancel"
];
router.post(customerCancelRoutes, authenticateCustomer, cancelCustomerRequestHandler);
router.patch(customerCancelRoutes, authenticateCustomer, cancelCustomerRequestHandler);

// =========================================================================
// 3. GUEST ORDER RETURN ENDPOINTS (Secure Order + Email Verification)
// =========================================================================

/**
 * POST /api/returns/guest/eligibility
 * Check return eligibility for guest order using orderId + email verification.
 */
router.post("/guest/eligibility", async (req, res) => {
  try {
    const { orderId, email } = req.body;

    if (!orderId || !email) {
      return res.status(400).json({ message: "Order ID and Email address are required." });
    }

    const order = await Order.findOne({
      $or: [
        { orderId },
        mongoose.Types.ObjectId.isValid(orderId) ? { _id: orderId } : { orderId }
      ],
      "customer.email": new RegExp(`^${email.trim()}$`, "i")
    });

    if (!order) {
      return res.status(404).json({
        message: "Order not found or email address does not match."
      });
    }

    const evaluation = await evaluateOrderReturnEligibility(order);
    res.json(evaluation);
  } catch (error) {
    res.status(500).json({
      message: "Error verifying guest order eligibility",
      error: error.message
    });
  }
});

/**
 * POST /api/returns/guest
 * Create return or exchange request for verified guest order.
 */
router.post("/guest", async (req, res) => {
  try {
    const { orderId, email, requestType, items, reason, comments, evidenceImages } = req.body;

    if (!orderId || !email) {
      return res.status(400).json({ message: "Order ID and verified Email are required." });
    }
    if (!requestType || !["Return", "Exchange"].includes(requestType)) {
      return res.status(400).json({ message: 'Request type must be "Return" or "Exchange".' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "At least one item must be selected." });
    }
    if (!reason || !VALID_REASONS.includes(reason)) {
      return res.status(400).json({ message: `Valid reason required. Options: ${VALID_REASONS.join(", ")}` });
    }

    const order = await Order.findOne({
      $or: [
        { orderId },
        mongoose.Types.ObjectId.isValid(orderId) ? { _id: orderId } : { orderId }
      ],
      "customer.email": new RegExp(`^${email.trim()}$`, "i")
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found or email address does not match." });
    }

    const windowCheck = checkOrderReturnWindow(order);
    if (!windowCheck.isWithinWindow) {
      return res.status(400).json({ message: windowCheck.reason });
    }

    // Serialize concurrent reservations for the same guest order to prevent over-reservation
    const result = await withOrderLock(order.orderId, async () => {
      // Re-evaluate remaining eligible quantities freshly from DB inside lock
      const eligibility = await evaluateOrderReturnEligibility(order);
      if (!eligibility.isOrderEligible) {
        return {
          status: 400,
          error: eligibility.ineligibilityReason || "All purchased quantities for this order have already been returned or requested."
        };
      }

      // Aggregate payload items by variant to prevent multi-line quantity bypass
      const aggregatedPayloadItems = new Map();
      for (const reqItem of items) {
        const pId = (reqItem.productId || "").toString();
        const sz = (reqItem.size || "Standard").toString().trim();
        const vKey = getVariantKey(pId, sz);
        const qty = parseInt(reqItem.quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          return { status: 400, error: `Quantity for "${reqItem.name || pId}" must be at least 1.` };
        }
        if (aggregatedPayloadItems.has(vKey)) {
          const existing = aggregatedPayloadItems.get(vKey);
          existing.quantity += qty;
        } else {
          aggregatedPayloadItems.set(vKey, {
            ...reqItem,
            productId: pId,
            size: sz,
            quantity: qty
          });
        }
      }

      // Check for rapid duplicate submission within last 5 seconds
      const fiveSecondsAgo = new Date(Date.now() - 5000);
      const recentDuplicate = await ReturnRequest.findOne({
        orderId: order.orderId,
        createdAt: { $gte: fiveSecondsAgo },
        status: "Requested"
      });
      if (recentDuplicate) {
        return {
          status: 409,
          error: `A return/exchange request (#${recentDuplicate.requestId}) was just submitted for this order. Please wait for concierge verification.`
        };
      }

      const verifiedReturnItems = [];
      let calculatedTotalRefund = 0;

      for (const [vKey, reqItem] of aggregatedPayloadItems) {
        const match = eligibility.items.find(
          (it) => getVariantKey(it.productId, it.size) === vKey
        );

        if (!match) {
          return {
            status: 400,
            error: `Item "${reqItem.name || reqItem.productId}" was not found in this order.`
          };
        }

        if (reqItem.quantity > match.remainingQuantity) {
          return {
            status: 400,
            error: `Requested quantity (${reqItem.quantity}) exceeds remaining eligible quantity (${match.remainingQuantity}) for ${match.name}.`
          };
        }

        let replacementSize = null;
        if (requestType === "Exchange") {
          if (!reqItem.replacementSize || typeof reqItem.replacementSize !== "string") {
            return {
              status: 400,
              error: `Please select a replacement size for ${match.name}.`
            };
          }
          replacementSize = reqItem.replacementSize.trim();
          if (replacementSize.toUpperCase() === match.size.toString().trim().toUpperCase()) {
            return {
              status: 400,
              error: `Replacement size for ${match.name} cannot be identical to the original size (${match.size}).`
            };
          }

          const sizeOption = match.exchangeSizes.find(
            (s) => s.size.toString().trim().toUpperCase() === replacementSize.toUpperCase()
          );
          if (!sizeOption || !sizeOption.inStock) {
            return {
              status: 400,
              error: `Replacement size "${replacementSize}" is out of stock.`
            };
          }
        }

        const itemAllocatedDiscount = match.unitDiscount * reqItem.quantity;
        const itemEligibleRefund = match.netUnitRefund * reqItem.quantity;
        calculatedTotalRefund += itemEligibleRefund;

        verifiedReturnItems.push({
          productId: match.productId,
          name: match.name,
          image: match.image,
          originalPrice: match.originalPrice,
          originalMrp: match.originalMrp,
          size: match.size,
          quantity: reqItem.quantity,
          reason: reqItem.reason && VALID_REASONS.includes(reqItem.reason) ? reqItem.reason : reason,
          customerComments: reqItem.customerComments || "",
          replacementSize,
          allocatedDiscount: itemAllocatedDiscount,
          eligibleRefundAmount: itemEligibleRefund
        });
      }

      const newRequestId = generateRequestId(requestType);

      const newRequest = new ReturnRequest({
        requestId: newRequestId,
        orderId: order.orderId,
        orderRef: order._id,
        customer: {
          fullName: order.customer.fullName,
          email: order.customer.email.toLowerCase(),
          phone: order.customer.phone,
          isGuest: true
        },
        requestType,
        items: verifiedReturnItems,
        reason,
        comments: comments || "",
        evidenceImages: Array.isArray(evidenceImages) ? evidenceImages.slice(0, 5) : [],
        status: "Requested",
        refundStatus: requestType === "Return" ? "Pending" : "None",
        refundAmount: requestType === "Return" ? calculatedTotalRefund : 0,
        statusHistory: [
          {
            status: "Requested",
            timestamp: new Date(),
            message: `Guest customer initiated ${requestType.toLowerCase()} request.`,
            updatedBy: "Guest Customer"
          }
        ]
      });

      const savedRequest = await newRequest.save();
      return { status: 201, savedRequest };
    });

    if (result.error) {
      return res.status(result.status || 400).json({ message: result.error });
    }

    res.status(201).json({
      message: `${requestType} request submitted successfully.`,
      request: result.savedRequest
    });
  } catch (error) {
    res.status(500).json({
      message: "Error submitting guest return request",
      error: error.message
    });
  }
});

/**
 * POST /api/returns/guest/cancel
 * Cancel guest return request with verified orderId, email, and requestId.
 */
router.post("/guest/cancel", async (req, res) => {
  try {
    const { orderId, email, requestId } = req.body;

    if (!orderId || !email || !requestId) {
      return res.status(400).json({ message: "Order ID, Email, and Request ID are required." });
    }

    const request = await ReturnRequest.findOne({
      requestId: requestId.trim(),
      orderId: orderId.trim(),
      "customer.email": new RegExp(`^${email.trim()}$`, "i")
    });

    if (!request) {
      return res.status(404).json({ message: "Request not found or verification details do not match." });
    }

    if (request.status !== "Requested") {
      return res.status(400).json({
        message: `Cannot cancel a request that has already moved to "${request.status}". Please contact boutique concierge.`
      });
    }

    request.status = "Cancelled";
    request.refundStatus = "None";
    if (request.requestType === "Exchange" && request.exchangeStockDeducted) {
      for (const item of request.items) {
        if (item.replacementSize) {
          await Product.updateOne(
            { _id: item.productId },
            {
              $inc: {
                [`sizeStock.${item.replacementSize}`]: item.quantity,
                stock: item.quantity
              }
            }
          );
        }
      }
      request.exchangeStockDeducted = false;
    }

    request.statusHistory.push({
      status: "Cancelled",
      timestamp: new Date(),
      message: "Guest customer cancelled the request.",
      updatedBy: "Guest Customer"
    });

    await request.save();

    res.json({
      message: "Request cancelled successfully.",
      request
    });
  } catch (error) {
    res.status(500).json({
      message: "Error cancelling guest request",
      error: error.message
    });
  }
});

/**
 * POST /api/returns/guest/track
 * Track guest return request with verified orderId and email.
 */
router.post("/guest/track", async (req, res) => {
  try {
    const { orderId, email, requestId } = req.body;

    if (!orderId || !email) {
      return res.status(400).json({ message: "Order ID and Email are required." });
    }

    const query = {
      orderId,
      "customer.email": new RegExp(`^${email.trim()}$`, "i")
    };
    if (requestId) {
      query.requestId = requestId.trim();
    }

    const requests = await ReturnRequest.find(query).sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    res.status(500).json({
      message: "Error tracking guest return request",
      error: error.message
    });
  }
});

// =========================================================================
// 4. ADMINISTRATOR PROTECTED ENDPOINTS (requireAdmin)
// =========================================================================

/**
 * GET /api/admin/returns/stats
 * Real-time summary statistics from MongoDB.
 */
router.get("/admin/stats", requireAdmin, async (req, res) => {
  try {
    const [
      total,
      requested,
      approved,
      inTransit,
      received,
      completed,
      rejected,
      cancelled,
      returnsCount,
      exchangesCount,
      pendingRefunds,
      completedRefunds
    ] = await Promise.all([
      ReturnRequest.countDocuments(),
      ReturnRequest.countDocuments({ status: "Requested" }),
      ReturnRequest.countDocuments({ status: "Approved" }),
      ReturnRequest.countDocuments({ status: "In Transit" }),
      ReturnRequest.countDocuments({ status: "Received and Inspected" }),
      ReturnRequest.countDocuments({ status: "Completed" }),
      ReturnRequest.countDocuments({ status: "Rejected" }),
      ReturnRequest.countDocuments({ status: "Cancelled" }),
      ReturnRequest.countDocuments({ requestType: "Return" }),
      ReturnRequest.countDocuments({ requestType: "Exchange" }),
      ReturnRequest.countDocuments({ refundStatus: "Pending" }),
      ReturnRequest.countDocuments({ refundStatus: "Completed" })
    ]);

    res.json({
      total,
      requested,
      approved,
      inTransit,
      received,
      receivedAndInspected: received,
      completed,
      rejected,
      cancelled,
      returnsCount,
      exchangesCount,
      pendingRefunds,
      pendingRefundsCount: pendingRefunds,
      completedRefunds,
      completedRefundsCount: completedRefunds,
      windowDays: getReturnWindowDays()
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching returns statistics",
      error: error.message
    });
  }
});

/**
 * GET /api/admin/returns
 * List all return/exchange requests with filtering and search.
 */
router.get("/admin", requireAdmin, async (req, res) => {
  try {
    const { status, type, query, search, refundStatus } = req.query;
    const filter = {};

    if (status && status !== "All") {
      filter.status = status;
    }
    if (type && type !== "All") {
      filter.requestType = type;
    }
    if (refundStatus && refundStatus !== "All") {
      if (refundStatus === "N/A" || refundStatus === "None") {
        filter.refundStatus = "None";
      } else {
        filter.refundStatus = refundStatus;
      }
    }

    const rawSearch = (search || query || "").trim();
    if (rawSearch) {
      // Remove leading '#' if present (e.g., #RET-12345 or #AUR-ORD-12345)
      const cleanQ = rawSearch.replace(/^#/, "").trim();
      const escapedQ = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escapedQ, "i");
      filter.$or = [
        { requestId: regex },
        { orderId: regex },
        { "customer.fullName": regex },
        { "customer.email": regex },
        { "customer.phone": regex }
      ];
    }

    const requests = await ReturnRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate("orderRef");

    res.json({
      success: true,
      total: requests.length,
      requests
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching return requests for admin",
      error: error.message
    });
  }
});

/**
 * GET /api/admin/returns/:id
 * Retrieve full request details for administration. Supports encoded IDs and slashes.
 */
const getSingleRequestHandler = async (req, res) => {
  try {
    const rawParamId = Array.isArray(req.params.id) ? req.params.id.join('/') : req.params.id;
    const paramId = rawParamId ? decodeURIComponent(rawParamId).trim() : '';
    const bodyId = (req.body?.requestId || req.body?.returnRequestId || req.body?.id || '').toString().trim();
    const id = paramId || bodyId;

    const searchConditions = [];
    if (mongoose.Types.ObjectId.isValid(id)) {
      searchConditions.push({ _id: id });
    }
    if (id) {
      searchConditions.push({ requestId: id });
      const cleanNoSlash = id.replace(/\//g, '');
      if (cleanNoSlash && cleanNoSlash !== id) {
        searchConditions.push({ requestId: cleanNoSlash });
      }
      const slashAsSeven = id.replace(/\//g, '7');
      if (slashAsSeven && slashAsSeven !== id) {
        searchConditions.push({ requestId: slashAsSeven });
      }
    }
    if (bodyId && bodyId !== id) {
      if (mongoose.Types.ObjectId.isValid(bodyId)) {
        searchConditions.push({ _id: bodyId });
      }
      searchConditions.push({ requestId: bodyId });
    }

    const request = await ReturnRequest.findOne({ $or: searchConditions }).populate("orderRef");

    if (!request) {
      return res.status(404).json({
        success: false,
        message: `Return request not found for reference "${id || 'unknown'}"`
      });
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching request details",
      error: error.message
    });
  }
};
router.get(["/admin/:id", "/admin/*id"], requireAdmin, getSingleRequestHandler);

/**
 * PUT/PATCH /api/admin/returns/:id/status
 * Administrative workflow status transition with stock safety and idempotency.
 */
const updateStatusHandler = async (req, res) => {
  try {
    const rawParamId = Array.isArray(req.params.id) ? req.params.id.join('/') : req.params.id;
    const paramId = rawParamId ? decodeURIComponent(rawParamId).trim() : '';
    const bodyId = (req.body?.requestId || req.body?.returnRequestId || req.body?.id || '').toString().trim();
    const id = paramId || bodyId;
    const { status, adminNotes, restoreInventory } = req.body;

    const validStatuses = [
      "Requested",
      "Approved",
      "Rejected",
      "In Transit",
      "Received and Inspected",
      "Completed",
      "Cancelled"
    ];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`
      });
    }

    const searchConditions = [];
    if (mongoose.Types.ObjectId.isValid(id)) {
      searchConditions.push({ _id: id });
    }
    if (id) {
      searchConditions.push({ requestId: id });
      const cleanNoSlash = id.replace(/\//g, '');
      if (cleanNoSlash && cleanNoSlash !== id) {
        searchConditions.push({ requestId: cleanNoSlash });
      }
      const slashAsSeven = id.replace(/\//g, '7');
      if (slashAsSeven && slashAsSeven !== id) {
        searchConditions.push({ requestId: slashAsSeven });
      }
    }
    if (bodyId && bodyId !== id) {
      if (mongoose.Types.ObjectId.isValid(bodyId)) {
        searchConditions.push({ _id: bodyId });
      }
      searchConditions.push({ requestId: bodyId });
    }

    const request = await ReturnRequest.findOne({ $or: searchConditions });

    if (!request) {
      return res.status(404).json({ success: false, message: `Return request not found for reference "${id || 'unknown'}".` });
    }

    const prevStatus = request.status;

    // Prevent transitions from terminal states unless explicit
    if (prevStatus === "Cancelled" && status !== "Cancelled") {
      return res.status(400).json({ message: "Cannot reactivate a cancelled request." });
    }

    // 1. Workflow: APPROVE
    if (status === "Approved") {
      if (request.requestType === "Exchange") {
        // Reserve replacement stock if not already deducted
        if (!request.exchangeStockDeducted) {
          for (const item of request.items) {
            if (item.replacementSize) {
              const product = await Product.findById(item.productId);
              if (product) {
                const available = product.sizeStock && typeof product.sizeStock === "object"
                  ? (Number(product.sizeStock[item.replacementSize]) || 0)
                  : (Number(product.stock) || 0);

                if (available < item.quantity) {
                  return res.status(400).json({
                    message: `Cannot approve exchange. Insufficient stock for ${product.name} (Size: ${item.replacementSize}). Available: ${available}, needed: ${item.quantity}.`
                  });
                }

                // Safely deduct replacement stock
                if (product.sizeStock && typeof product.sizeStock === "object") {
                  await Product.updateOne(
                    {
                      _id: product._id,
                      [`sizeStock.${item.replacementSize}`]: { $gte: item.quantity },
                      stock: { $gte: item.quantity }
                    },
                    {
                      $inc: {
                        [`sizeStock.${item.replacementSize}`]: -item.quantity,
                        stock: -item.quantity
                      }
                    }
                  );
                } else {
                  await Product.updateOne(
                    { _id: product._id, stock: { $gte: item.quantity } },
                    { $inc: { stock: -item.quantity } }
                  );
                }
              }
            }
          }
          request.exchangeStockDeducted = true;
        }
      } else {
        // Return: set refundStatus to Pending if it was None
        if (request.refundStatus === "None") {
          request.refundStatus = "Pending";
        }
      }
    }

    // 2. Workflow: REJECT OR CANCEL
    if (status === "Rejected" || status === "Cancelled") {
      request.refundStatus = "None";
      // Roll back exchange stock if it was previously deducted
      if (request.requestType === "Exchange" && request.exchangeStockDeducted) {
        for (const item of request.items) {
          if (item.replacementSize) {
            await Product.updateOne(
              { _id: item.productId },
              {
                $inc: {
                  [`sizeStock.${item.replacementSize}`]: item.quantity,
                  stock: item.quantity
                }
              }
            );
          }
        }
        request.exchangeStockDeducted = false;
      }
    }

    // 3. Workflow: RECEIVED AND INSPECTED
    // Restore returned item stock ONLY if item passed inspection, admin approves,
    // and stock has NOT already been restored!
    if (status === "Received and Inspected" || (status === "Completed" && request.requestType === "Return")) {
      const shouldRestore = restoreInventory !== false; // Default true unless explicitly false
      if (shouldRestore && !request.stockRestored) {
        for (const item of request.items) {
          if (item.productId && item.size) {
            const product = await Product.findById(item.productId);
            if (product) {
              if (product.sizeStock && typeof product.sizeStock === "object") {
                await Product.updateOne(
                  { _id: item.productId },
                  {
                    $inc: {
                      [`sizeStock.${item.size}`]: item.quantity,
                      stock: item.quantity
                    }
                  }
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
        request.stockRestored = true;
      }
    }

    request.status = status;
    if (adminNotes !== undefined) {
      request.adminNotes = adminNotes;
    }

    request.statusHistory.push({
      status,
      timestamp: new Date(),
      message: adminNotes ? `Status updated to ${status}. Note: ${adminNotes}` : `Status updated to ${status}.`,
      updatedBy: req.user?.name || "Administrator"
    });

    const updatedRequest = await request.save();

    res.json({
      success: true,
      message: `Request status updated to "${status}".`,
      request: updatedRequest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating request status",
      error: error.message
    });
  }
};
router.put(["/admin/:id/status", "/admin/*id/status"], requireAdmin, updateStatusHandler);
router.patch(["/admin/:id/status", "/admin/*id/status"], requireAdmin, updateStatusHandler);

/**
 * PUT/PATCH /api/admin/returns/:id/refund
 * Administrative refund status confirmation.
 * Prevents duplicated refunds and records explicit confirmation.
 */
const updateRefundHandler = async (req, res) => {
  try {
    const rawParamId = Array.isArray(req.params.id) ? req.params.id.join('/') : req.params.id;
    const paramId = rawParamId ? decodeURIComponent(rawParamId).trim() : '';
    const bodyId = (req.body?.requestId || req.body?.returnRequestId || req.body?.id || '').toString().trim();
    const id = paramId || bodyId;
    const { refundStatus, adminNotes } = req.body;

    const validRefundStatuses = ["Pending", "Completed", "Rejected"];
    if (!refundStatus || !validRefundStatuses.includes(refundStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid refund status. Options: ${validRefundStatuses.join(", ")}`
      });
    }

    const searchConditions = [];
    if (mongoose.Types.ObjectId.isValid(id)) {
      searchConditions.push({ _id: id });
    }
    if (id) {
      searchConditions.push({ requestId: id });
      const cleanNoSlash = id.replace(/\//g, '');
      if (cleanNoSlash && cleanNoSlash !== id) {
        searchConditions.push({ requestId: cleanNoSlash });
      }
      const slashAsSeven = id.replace(/\//g, '7');
      if (slashAsSeven && slashAsSeven !== id) {
        searchConditions.push({ requestId: slashAsSeven });
      }
    }
    if (bodyId && bodyId !== id) {
      if (mongoose.Types.ObjectId.isValid(bodyId)) {
        searchConditions.push({ _id: bodyId });
      }
      searchConditions.push({ requestId: bodyId });
    }

    const request = await ReturnRequest.findOne({ $or: searchConditions });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: `Return request not found for reference "${id || 'unknown'}"`
      });
    }

    if (request.requestType !== "Return") {
      return res.status(400).json({
        success: false,
        message: "Refunds apply only to Return requests, not Exchanges."
      });
    }

    request.refundStatus = refundStatus;
    if (adminNotes !== undefined) {
      request.adminNotes = adminNotes;
    }

    request.statusHistory.push({
      status: request.status,
      timestamp: new Date(),
      message: `Refund status marked as "${refundStatus}". Amount: ₹${request.refundAmount.toLocaleString("en-IN")}. ${adminNotes || ""}`,
      updatedBy: req.user?.name || "Administrator"
    });

    const updatedRequest = await request.save();

    res.json({
      success: true,
      message: `Refund status updated to "${refundStatus}".`,
      request: updatedRequest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating refund status",
      error: error.message
    });
  }
};
router.put(["/admin/:id/refund", "/admin/*id/refund"], requireAdmin, updateRefundHandler);
router.patch(["/admin/:id/refund", "/admin/*id/refund"], requireAdmin, updateRefundHandler);

module.exports = router;
