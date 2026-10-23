const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ReturnRequest = require("../models/ReturnRequest");

/**
 * Normalizes product ID and variant size into a consistent lookup key.
 */
const getVariantKey = (productId, size) => {
  const pId = (productId || "").toString().trim();
  const s = (size || "Standard").toString().trim().toUpperCase();
  return `${pId}__${s}`;
};

/**
 * Configurable Return Window in days.
 * Defaults to 14 days as documented in AURA concierge policy.
 * Can be overridden via environment variable RETURN_WINDOW_DAYS.
 */
const getReturnWindowDays = () => {
  const configured = parseInt(process.env.RETURN_WINDOW_DAYS || "14", 10);
  return isNaN(configured) || configured <= 0 ? 14 : configured;
};

/**
 * Extracts effective delivery date from order delivery fields, statusHistory, or fallback timestamps.
 */
const getDeliveryDate = (order) => {
  if (!order) return null;

  // 1. Explicit delivery timestamps if present
  if (order.deliveredAt) return new Date(order.deliveredAt);
  if (order.deliveryDate) return new Date(order.deliveryDate);

  // 2. Check statusHistory for "Delivered" status entry (prefer latest entry)
  if (order.statusHistory && Array.isArray(order.statusHistory)) {
    const deliveredEntries = order.statusHistory.filter(
      (h) => h.status && h.status.toLowerCase() === "delivered"
    );
    if (deliveredEntries.length > 0) {
      const latest = deliveredEntries[deliveredEntries.length - 1];
      if (latest && latest.timestamp) {
        return new Date(latest.timestamp);
      }
    }
  }

  // 3. Fallback for orders marked Delivered without explicit statusHistory entry
  if (order.status && order.status.toLowerCase() === "delivered") {
    return order.updatedAt ? new Date(order.updatedAt) : new Date(order.createdAt);
  }

  // 4. Default fallback to updatedAt / createdAt
  return order.updatedAt ? new Date(order.updatedAt) : (order.createdAt ? new Date(order.createdAt) : null);
};

/**
 * Checks whether an order is within the configurable return window.
 */
const checkOrderReturnWindow = (order) => {
  const windowDays = getReturnWindowDays();

  if (!order || order.status !== "Delivered") {
    const currentStatus = order ? order.status : "Unknown";
    return {
      isWithinWindow: false,
      code: "NOT_DELIVERED",
      reason: `Orders must be in "Delivered" status to request a return or exchange. Current status: "${currentStatus}".`,
      windowDays,
      deliveryDate: null,
      expiryDate: null
    };
  }

  const deliveryDate = getDeliveryDate(order);
  if (!deliveryDate || isNaN(deliveryDate.getTime())) {
    return {
      isWithinWindow: false,
      code: "INVALID_DELIVERY_DATE",
      reason: "Could not determine a valid delivery date for this order.",
      windowDays,
      deliveryDate: null,
      expiryDate: null
    };
  }

  const now = new Date();
  const expiryDate = new Date(deliveryDate.getTime() + windowDays * 24 * 60 * 60 * 1000);

  if (now > expiryDate) {
    const formattedDelivery = deliveryDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    const formattedExpiry = expiryDate.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
    return {
      isWithinWindow: false,
      code: "WINDOW_EXPIRED",
      reason: `The ${windowDays}-day return window expired on ${formattedExpiry} for this order (delivered on ${formattedDelivery}).`,
      windowDays,
      deliveryDate,
      expiryDate
    };
  }

  return {
    isWithinWindow: true,
    code: null,
    reason: null,
    windowDays,
    deliveryDate,
    expiryDate
  };
};

/**
 * Computes proportional discount allocation for an item unit in an order.
 * Ensures the customer's refund reflects the actual amount paid after coupon discounts,
 * without touching or distorting stored order data.
 */
const calculateItemUnitRefund = (item, order) => {
  const itemPrice = Number(item.price) || 0;
  const orderSubtotal = Number(order.subtotal) || 0;
  const orderDiscount = Number(order.discount) || 0;

  let unitDiscount = 0;
  if (orderDiscount > 0 && orderSubtotal > 0) {
    // Proportional ratio based on merchandise subtotal
    const ratio = itemPrice / orderSubtotal;
    unitDiscount = Math.round(ratio * orderDiscount);
  }

  const netUnitRefund = Math.max(0, itemPrice - unitDiscount);
  return {
    originalPrice: itemPrice,
    unitDiscount,
    netUnitRefund
  };
};

/**
 * Comprehensive eligibility evaluation for all items in an order.
 * Inspects all previous active requests for this order to prevent duplicate/excess requests.
 * Only valid, non-cancelled, non-rejected requests reserve quantity.
 */
const evaluateOrderReturnEligibility = async (order) => {
  const windowCheck = checkOrderReturnWindow(order);

  // Retrieve all existing return/exchange requests for this order
  const queryConditions = [{ orderId: order.orderId }];
  if (order._id && mongoose.Types.ObjectId.isValid(order._id)) {
    queryConditions.push({ orderRef: order._id });
  }

  const allOrderRequests = await ReturnRequest.find({
    $or: queryConditions
  }).sort({ createdAt: -1 });

  // Separate active (reserving) vs inactive (released) requests
  const activeRequests = allOrderRequests.filter(
    (req) => !["Rejected", "Cancelled"].includes(req.status)
  );
  const inactiveRequests = allOrderRequests.filter(
    (req) => ["Rejected", "Cancelled"].includes(req.status)
  );

  // Track already requested quantities per product + variant (size)
  const requestedByVariant = new Map();
  for (const req of activeRequests) {
    for (const it of req.items) {
      const key = getVariantKey(it.productId, it.size);
      const curr = requestedByVariant.get(key) || { quantity: 0, requests: [] };
      curr.quantity += Number(it.quantity) || 0;
      curr.requests.push({
        requestId: req.requestId,
        requestType: req.requestType,
        status: req.status,
        quantity: Number(it.quantity) || 0,
        createdAt: req.createdAt
      });
      requestedByVariant.set(key, curr);
    }
  }

  // Track how much reserved quantity has already been attributed to each variant
  // to properly support multiple order lines for the same variant
  const reservedAttributed = new Map();

  // Evaluate each item in the order
  const eligibleItems = [];
  for (const item of order.items || []) {
    const rawProdId = (item.productId || item._id || item.id || "").toString();
    const itemSize = item.size || "Standard";
    const key = getVariantKey(rawProdId, itemSize);

    const variantData = requestedByVariant.get(key) || { quantity: 0, requests: [] };
    const totalVariantRequested = variantData.quantity;
    const previouslyAttributed = reservedAttributed.get(key) || 0;

    const unallocatedReserved = Math.max(0, totalVariantRequested - previouslyAttributed);
    const itemPurchasedQty = Number(item.quantity) || 0;
    const itemAlreadyRequested = Math.min(itemPurchasedQty, unallocatedReserved);
    reservedAttributed.set(key, previouslyAttributed + itemAlreadyRequested);

    const remainingQuantity = Math.max(0, itemPurchasedQty - itemAlreadyRequested);
    const isItemEligible = windowCheck.isWithinWindow && remainingQuantity > 0;

    let itemIneligibilityReason = null;
    if (!windowCheck.isWithinWindow) {
      itemIneligibilityReason = windowCheck.reason;
    } else if (remainingQuantity === 0) {
      const reqList = variantData.requests
        .map((r) => `#${r.requestId} (${r.requestType} - ${r.status})`)
        .join(", ");
      itemIneligibilityReason = `All ${itemPurchasedQty} unit(s) of this variant have already been requested or returned under ${reqList || "an active request"}.`;
    }

    const { unitDiscount, netUnitRefund } = calculateItemUnitRefund(item, order);

    // Fetch live product for exchange size availability
    let liveProduct = null;
    try {
      if (mongoose.Types.ObjectId.isValid(rawProdId)) {
        liveProduct = await Product.findById(rawProdId);
      } else {
        liveProduct = await Product.findOne({ name: item.name });
      }
    } catch (e) {
      // Ignore lookup failure
    }

    // Determine available sizes for exchange
    const exchangeSizes = [];
    if (liveProduct && Array.isArray(liveProduct.sizes)) {
      const isAccessory = liveProduct.category === "Accessories" || (liveProduct.sizes.length === 1 && liveProduct.sizes[0] === "One Size");
      for (const sz of liveProduct.sizes) {
        if (!isAccessory && sz.toString().trim().toUpperCase() === itemSize.toString().trim().toUpperCase()) {
          continue; // Skip identical size for clothing
        }
        const stockAvail = liveProduct.sizeStock && typeof liveProduct.sizeStock === "object"
          ? (Number(liveProduct.sizeStock[sz]) || 0)
          : (Number(liveProduct.stock) || 0);
        exchangeSizes.push({
          size: sz,
          inStock: stockAvail > 0,
          availableStock: Math.max(0, stockAvail)
        });
      }
    }

    eligibleItems.push({
      productId: rawProdId,
      name: item.name,
      image: item.image,
      size: item.size || "Standard",
      originalPrice: item.price,
      originalMrp: item.mrp,
      purchasedQuantity: itemPurchasedQty,
      alreadyRequestedQuantity: itemAlreadyRequested,
      remainingQuantity,
      isItemEligible,
      itemIneligibilityReason,
      unitDiscount,
      netUnitRefund,
      exchangeSizes
    });
  }

  const hasAnyEligibleItem = eligibleItems.some((it) => it.isItemEligible);

  // Formatted summaries of active requests for informative user guidance
  const activeRequestsSummary = activeRequests.map((r) => ({
    requestId: r.requestId,
    requestType: r.requestType,
    status: r.status,
    refundStatus: r.refundStatus,
    refundAmount: r.refundAmount,
    createdAt: r.createdAt,
    canCancel: r.status === "Requested",
    items: (r.items || []).map((it) => ({
      name: it.name,
      size: it.size,
      quantity: it.quantity,
      originalPrice: it.originalPrice,
      replacementSize: it.replacementSize
    }))
  }));

  let ineligibilityReason = null;
  let ineligibilityCode = null;

  if (!windowCheck.isWithinWindow) {
    ineligibilityReason = windowCheck.reason;
    ineligibilityCode = windowCheck.code;
  } else if (!hasAnyEligibleItem) {
    ineligibilityCode = "ALL_ITEMS_REQUESTED";
    if (activeRequestsSummary.length > 0) {
      const summaryText = activeRequestsSummary
        .map((r) => `${r.requestType} #${r.requestId} (${r.status})`)
        .join("; ");
      ineligibilityReason = `All purchased quantities for this order have already been returned or requested under active request(s): ${summaryText}.`;
    } else {
      ineligibilityReason = "All purchased quantities for this order have already been returned or requested.";
    }
  }

  return {
    orderId: order.orderId,
    orderStatus: order.status,
    isOrderEligible: windowCheck.isWithinWindow && hasAnyEligibleItem,
    ineligibilityCode,
    ineligibilityReason,
    windowDays: windowCheck.windowDays,
    deliveryDate: windowCheck.deliveryDate,
    expiryDate: windowCheck.expiryDate,
    items: eligibleItems,
    existingRequests: activeRequestsSummary,
    existingRequestsCount: activeRequests.length,
    inactiveRequestsCount: inactiveRequests.length
  };
};

module.exports = {
  getVariantKey,
  getReturnWindowDays,
  getDeliveryDate,
  checkOrderReturnWindow,
  calculateItemUnitRefund,
  evaluateOrderReturnEligibility
};
