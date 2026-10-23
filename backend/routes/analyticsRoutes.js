const express = require("express");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * Check if order status is cancelled (case-insensitive)
 */
const isCancelledStatus = (status = "") => {
  return (status || "").toLowerCase() === "cancelled";
};

/**
 * Helper to generate continuous date labels for timeline charts
 */
const generateTimelineBuckets = (period, startDate, endDate) => {
  const buckets = [];
  const current = new Date(startDate);

  if (period === "today") {
    // Generate 6 4-hour intervals for today: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00
    for (let h = 0; h < 24; h += 4) {
      const d = new Date(startDate);
      d.setHours(h, 0, 0, 0);
      const label = `${String(h).padStart(2, "0")}:00`;
      buckets.push({
        date: label,
        key: label,
        label,
        timestamp: d.getTime(),
        revenue: 0,
        orders: 0
      });
    }
  } else if (period === "30d") {
    // Generate daily buckets for last 30 days
    while (current <= endDate) {
      const key = current.toISOString().split("T")[0]; // YYYY-MM-DD
      const label = current.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      buckets.push({
        date: key,
        key,
        label,
        timestamp: current.getTime(),
        revenue: 0,
        orders: 0
      });
      current.setDate(current.getDate() + 1);
    }
  } else if (period === "90d") {
    // Generate daily buckets for last 90 days
    while (current <= endDate) {
      const key = current.toISOString().split("T")[0]; // YYYY-MM-DD
      const label = current.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      buckets.push({
        date: key,
        key,
        label,
        timestamp: current.getTime(),
        revenue: 0,
        orders: 0
      });
      current.setDate(current.getDate() + 1);
    }
  } else if (period === "all") {
    // For all-time, generate monthly or daily intervals based on range
    const diffDays = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
    if (diffDays <= 31) {
      while (current <= endDate) {
        const key = current.toISOString().split("T")[0];
        const label = current.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
        buckets.push({ date: key, key, label, timestamp: current.getTime(), revenue: 0, orders: 0 });
        current.setDate(current.getDate() + 1);
      }
    } else {
      // Monthly buckets
      const tempDate = new Date(current);
      tempDate.setDate(1);
      while (tempDate <= endDate) {
        const key = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, "0")}`;
        const label = tempDate.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
        buckets.push({ date: key, key, label, timestamp: tempDate.getTime(), revenue: 0, orders: 0 });
        tempDate.setMonth(tempDate.getMonth() + 1);
      }
    }
  } else {
    // Default: 7d (Last 7 days)
    while (current <= endDate) {
      const key = current.toISOString().split("T")[0];
      const label = current.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" });
      buckets.push({
        date: key,
        key,
        label,
        timestamp: current.getTime(),
        revenue: 0,
        orders: 0
      });
      current.setDate(current.getDate() + 1);
    }
  }

  return buckets;
};

/**
 * Standard clothing size order for consistent display
 */
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"];

/**
 * Evaluates individual size stock and classifies status
 * - 0 => "Out of Stock"
 * - 1 to 5 => "Low Stock"
 * - > 5 => "Available"
 */
const evaluateSizeStock = (product) => {
  const rawSizeStock = product.sizeStock && typeof product.sizeStock === "object" ? product.sizeStock : {};
  let sizesList = [];

  const configuredSizes = Object.keys(rawSizeStock);

  if (configuredSizes.length > 0) {
    // Sort according to standard clothing size order if matched
    sizesList = configuredSizes.sort((a, b) => {
      const ia = SIZE_ORDER.indexOf(a);
      const ib = SIZE_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  } else if (Array.isArray(product.sizes) && product.sizes.length > 0) {
    sizesList = [...product.sizes];
  } else {
    // Fallback if no sizes defined
    sizesList = ["Standard"];
  }

  const sizeBreakdown = sizesList.map((sz) => {
    let qty = 0;
    if (rawSizeStock[sz] !== undefined) {
      qty = Math.max(0, Number(rawSizeStock[sz]) || 0);
    } else if (sizesList.length === 1 && typeof product.stock === "number") {
      qty = Math.max(0, product.stock);
    }

    let status = "Available";
    let level = "available";

    if (qty === 0) {
      status = "Out of Stock";
      level = "out";
    } else if (qty <= 5) {
      status = "Low Stock";
      level = "low";
    }

    return {
      size: sz,
      quantity: qty,
      status,
      level
    };
  });

  const hasOutOfStock = sizeBreakdown.some((s) => s.level === "out");
  const hasLowStock = sizeBreakdown.some((s) => s.level === "low");
  const isFlagged = hasOutOfStock || hasLowStock;

  const totalStock = sizeBreakdown.reduce((sum, s) => sum + s.quantity, 0);

  return {
    isFlagged,
    hasOutOfStock,
    hasLowStock,
    sizeBreakdown,
    totalStock
  };
};

/**
 * @route   GET /api/admin/analytics
 * @desc    Retrieve aggregated executive dashboard analytics from live MongoDB data
 * @access  Protected (Administrator Only)
 */
router.get("/", requireAdmin, async (req, res) => {
  try {
    const period = (req.query.period || "7d").toLowerCase();
    const now = new Date();
    let startDate;

    if (period === "today") {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "30d") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 29);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "90d") {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 89);
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "all") {
      // Find oldest order or default to 3 months ago
      const oldestOrder = await Order.findOne().sort({ createdAt: 1 }).select("createdAt");
      startDate = oldestOrder && oldestOrder.createdAt 
        ? new Date(oldestOrder.createdAt) 
        : new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate.setHours(0, 0, 0, 0);
    } else {
      // Default: Last 7 days
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
      startDate.setHours(0, 0, 0, 0);
    }

    // Filter to exclude Cancelled orders from revenue calculations
    const nonCancelledMatch = {
      status: { $nin: ["Cancelled", "cancelled"] }
    };

    // Parallel MongoDB queries for analytics aggregation
    const [
      revenueStats,
      totalOrdersCount,
      totalProductsCount,
      registeredCustomerEmails,
      orderCustomerEmails,
      orderStatusStats,
      allProductsList,
      recentOrdersList,
      bestSellingStats,
      timelineOrders
    ] = await Promise.all([
      // 1. Total revenue and average order value (excluding Cancelled orders)
      Order.aggregate([
        { $match: nonCancelledMatch },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$total" },
            nonCancelledCount: { $sum: 1 },
            avgOrderValue: { $avg: "$total" }
          }
        }
      ]),

      // 2. Total orders count (all statuses)
      Order.countDocuments(),

      // 3. Total products count
      Product.countDocuments(),

      // 4. Registered customer accounts
      User.find({ role: "customer" }).distinct("email"),

      // 5. Unique customer emails from orders
      Order.distinct("customer.email"),

      // 6. Order status distribution
      Order.aggregate([
        {
          $group: {
            _id: { $toLower: "$status" },
            count: { $sum: 1 },
            amount: { $sum: "$total" }
          }
        }
      ]),

      // 7. All products to evaluate size-wise inventory accurately
      Product.find()
        .select("name category price image sizes sizeStock stock")
        .sort({ updatedAt: -1 }),

      // 8. Recent 8 orders
      Order.find()
        .sort({ createdAt: -1 })
        .limit(8)
        .select("orderId customer total status items createdAt"),

      // 9. Top best-selling products (excluding Cancelled orders)
      Order.aggregate([
        { $match: nonCancelledMatch },
        { $unwind: "$items" },
        {
          $group: {
            _id: {
              $ifNull: ["$items.productId", "$items.name"]
            },
            name: { $first: "$items.name" },
            image: { $first: "$items.image" },
            quantitySold: { $sum: "$items.quantity" },
            revenueGenerated: {
              $sum: {
                $multiply: [
                  { $ifNull: ["$items.price", 0] },
                  { $ifNull: ["$items.quantity", 1] }
                ]
              }
            }
          }
        },
        { $sort: { quantitySold: -1, revenueGenerated: -1 } },
        { $limit: 5 }
      ]),

      // 10. Orders within selected period timeline
      Order.find({
        createdAt: { $gte: startDate, $lte: now }
      })
        .select("total status createdAt")
        .sort({ createdAt: 1 })
    ]);

    // Format Overall Revenue Stats
    const overallRevenue = revenueStats[0] || {
      totalRevenue: 0,
      nonCancelledCount: 0,
      avgOrderValue: 0
    };

    // Calculate Total Customers (Union of registered customer users + distinct order customer emails)
    const uniqueCustomerEmailsSet = new Set([
      ...registeredCustomerEmails.map((e) => (e || "").toLowerCase().trim()).filter(Boolean),
      ...orderCustomerEmails.map((e) => (e || "").toLowerCase().trim()).filter(Boolean)
    ]);
    const totalCustomersCount = uniqueCustomerEmailsSet.size;

    // Order Status Map
    const statusMap = {
      pending: 0,
      processing: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0
    };

    orderStatusStats.forEach((item) => {
      const key = (item._id || "").toLowerCase();
      if (statusMap[key] !== undefined) {
        statusMap[key] = item.count;
      }
    });

    const statusTotals = {
      pending: statusMap.pending,
      processing: statusMap.processing,
      shipped: statusMap.shipped,
      delivered: statusMap.delivered,
      cancelled: statusMap.cancelled
    };

    // Formatted array for visual Order Status breakdown
    const STATUS_CONFIGS = [
      { key: "pending", label: "Pending", color: "amber" },
      { key: "processing", label: "Processing", color: "blue" },
      { key: "shipped", label: "Shipped", color: "indigo" },
      { key: "delivered", label: "Delivered", color: "emerald" },
      { key: "cancelled", label: "Cancelled", color: "rose" }
    ];

    const ordersByStatusArray = STATUS_CONFIGS.map((conf) => {
      const count = statusMap[conf.key] || 0;
      const percentage = totalOrdersCount > 0 ? Math.round((count / totalOrdersCount) * 100) : 0;
      return {
        status: conf.label,
        count,
        percentage,
        color: conf.color
      };
    });

    // Evaluate Size-Wise Inventory for each product individually
    const lowStockItems = [];
    allProductsList.forEach((prod) => {
      const evaluation = evaluateSizeStock(prod);
      if (evaluation.isFlagged) {
        lowStockItems.push({
          _id: prod._id,
          id: prod._id,
          name: prod.name,
          category: prod.category,
          price: prod.price,
          image: prod.image,
          sizes: evaluation.sizeBreakdown,
          sizeStock: prod.sizeStock || {},
          totalStock: evaluation.totalStock,
          stock: evaluation.totalStock,
          hasOutOfStock: evaluation.hasOutOfStock,
          hasLowStock: evaluation.hasLowStock
        });
      }
    });

    // Sort low-stock items: items with Out of Stock sizes first, then ascending by total remaining units
    lowStockItems.sort((a, b) => {
      if (a.hasOutOfStock && !b.hasOutOfStock) return -1;
      if (!a.hasOutOfStock && b.hasOutOfStock) return 1;
      return a.totalStock - b.totalStock;
    });

    // Generate Timeline Buckets for Revenue Chart
    const timelineBuckets = generateTimelineBuckets(period, startDate, now);

    let periodRevenue = 0;
    let periodOrdersCount = 0;

    timelineOrders.forEach((ord) => {
      const orderDate = new Date(ord.createdAt);
      const isCancelled = isCancelledStatus(ord.status);
      const orderTotal = isCancelled ? 0 : Number(ord.total) || 0;

      periodOrdersCount += 1;
      if (!isCancelled) {
        periodRevenue += Number(ord.total) || 0;
      }

      if (period === "today") {
        const hour = orderDate.getHours();
        const bucketIndex = Math.min(Math.floor(hour / 4), timelineBuckets.length - 1);
        if (timelineBuckets[bucketIndex]) {
          timelineBuckets[bucketIndex].revenue += orderTotal;
          timelineBuckets[bucketIndex].orders += 1;
        }
      } else if (period === "all" && timelineBuckets[0]?.date?.length === 7) {
        // Monthly bucket: YYYY-MM
        const key = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, "0")}`;
        const target = timelineBuckets.find((b) => b.key === key || b.date === key);
        if (target) {
          target.revenue += orderTotal;
          target.orders += 1;
        }
      } else {
        // Daily bucket: YYYY-MM-DD
        const key = orderDate.toISOString().split("T")[0];
        const target = timelineBuckets.find((b) => b.key === key || b.date === key);
        if (target) {
          target.revenue += orderTotal;
          target.orders += 1;
        }
      }
    });

    // Round timeline bucket revenues
    timelineBuckets.forEach((b) => {
      b.revenue = Math.round(b.revenue);
    });

    // Enrich Best-Sellers with fallback images and properties
    const enrichedBestSellers = await Promise.all(
      bestSellingStats.map(async (bs) => {
        let imageUrl = bs.image;
        if (!imageUrl && mongoose.Types.ObjectId.isValid(bs._id)) {
          const productDoc = await Product.findById(bs._id).select("image");
          if (productDoc && productDoc.image) {
            imageUrl = productDoc.image;
          }
        }
        return {
          productId: bs._id,
          name: bs.name || "Boutique Apparel",
          image: imageUrl || "",
          quantitySold: bs.quantitySold || 0,
          unitsSold: bs.quantitySold || 0, // backwards compat alias
          revenueGenerated: Math.round(bs.revenueGenerated || 0)
        };
      })
    );

    // Formatted Recent Orders
    const formattedRecentOrders = recentOrdersList.map((ord) => ({
      orderId: ord.orderId,
      _id: ord._id,
      customer: ord.customer?.fullName || "Guest Customer",
      customerName: ord.customer?.fullName || "Guest Customer", // backwards compat alias
      customerEmail: ord.customer?.email || "",
      date: ord.createdAt,
      amount: ord.total,
      total: ord.total, // backwards compat alias
      status: ord.status || "Pending",
      itemCount: Array.isArray(ord.items) ? ord.items.reduce((s, it) => s + (it.quantity || 1), 0) : 1
    }));

    // Construct response matching exact requirements
    return res.json({
      period,
      summary: {
        totalRevenue: Math.round(overallRevenue.totalRevenue || 0),
        totalOrders: totalOrdersCount,
        totalProducts: totalProductsCount,
        totalCustomers: totalCustomersCount,
        pendingOrders: statusTotals.pending,
        deliveredOrders: statusTotals.delivered,
        lowStockCount: lowStockItems.length,
        lowStockProductsCount: lowStockItems.length, // backwards compat
        avgOrderValue: Math.round(overallRevenue.avgOrderValue || 0),
        periodRevenue: Math.round(periodRevenue),
        periodOrdersCount
      },
      revenueByDate: timelineBuckets,
      revenueTimeline: timelineBuckets, // backwards compat
      ordersByStatus: ordersByStatusArray,
      statusDistribution: statusTotals, // backwards compat
      bestSellingProducts: enrichedBestSellers,
      lowStockItems,
      lowStockProducts: lowStockItems, // backwards compat
      recentOrders: formattedRecentOrders
    });
  } catch (error) {
    console.error("Error generating admin analytics:", error);
    return res.status(500).json({
      message: "Error computing executive dashboard analytics from MongoDB.",
      error: error.message
    });
  }
});

module.exports = router;
