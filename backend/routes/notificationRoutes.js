const express = require("express");
const mongoose = require("mongoose");
const AdminNotification = require("../models/AdminNotification");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Review = require("../models/Review");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * Synchronize live MongoDB records into AdminNotification documents.
 * Uses atomic upsert with $setOnInsert so existing documents are left intact
 * and their persistent 'read' status is NEVER overwritten or duplicated.
 */
async function syncNotificationsFromData() {
  try {
    const candidates = [];

    // 1. Inventory Notifications (Products: Low Stock & Out of Stock)
    const products = await Product.find().lean();
    for (const prod of products) {
      const prodId = String(prod._id);
      const prodName = prod.name || "Garment";

      // Check Out of Stock
      const isZeroTotalStock = typeof prod.stock === "number" && prod.stock <= 0;
      let allSizesZero = false;

      if (prod.sizeStock && typeof prod.sizeStock === "object") {
        const sizeStockEntries = Object.entries(prod.sizeStock);
        if (sizeStockEntries.length > 0) {
          allSizesZero = sizeStockEntries.every(([_, qty]) => Number(qty) <= 0);
        }
      }

      if (isZeroTotalStock || allSizesZero) {
        candidates.push({
          eventKey: `out_of_stock:${prodId}`,
          type: "inventory",
          title: `Out of Stock: ${prodName}`,
          message: `${prodName} is completely out of stock across all sizes.`,
          referenceId: prodId,
          targetPage: "Products",
          createdAt: prod.updatedAt || prod.createdAt || new Date()
        });
      } else {
        // Check Low Stock: any size between 1 and 5
        if (prod.sizeStock && typeof prod.sizeStock === "object") {
          for (const [sz, qtyRaw] of Object.entries(prod.sizeStock)) {
            const qty = Number(qtyRaw) || 0;
            if (qty >= 1 && qty <= 5) {
              candidates.push({
                eventKey: `low_stock:${prodId}:${sz}`,
                type: "inventory",
                title: `Low Stock: ${prodName}`,
                message: `Low stock: ${prodName} — Size ${sz} has only ${qty} left.`,
                referenceId: prodId,
                targetPage: "Products",
                createdAt: prod.updatedAt || prod.createdAt || new Date()
              });
            }
          }
        } else if (typeof prod.stock === "number" && prod.stock >= 1 && prod.stock <= 5) {
          candidates.push({
            eventKey: `low_stock:${prodId}:total`,
            type: "inventory",
            title: `Low Stock: ${prodName}`,
            message: `Low stock: ${prodName} — Only ${prod.stock} left in stock.`,
            referenceId: prodId,
            targetPage: "Products",
            createdAt: prod.updatedAt || prod.createdAt || new Date()
          });
        }
      }
    }

    // 2. Orders Notifications (Pending Orders & Recent Orders)
    const orders = await Order.find().sort({ createdAt: -1 }).limit(50).lean();
    for (const order of orders) {
      const orderRef = order.orderId || String(order._id);
      const customerName = order.customer?.fullName || "Patron";
      const totalFormatted = `₹${Number(order.total || 0).toLocaleString("en-IN")}`;
      const statusLower = (order.status || "").toLowerCase();

      if (statusLower === "pending") {
        candidates.push({
          eventKey: `pending_order:${orderRef}`,
          type: "orders",
          title: `Pending Order: ${orderRef}`,
          message: `Order ${orderRef} from ${customerName} requires fulfillment attention (${totalFormatted}).`,
          referenceId: orderRef,
          targetPage: "Orders",
          createdAt: order.createdAt || new Date()
        });
      } else {
        candidates.push({
          eventKey: `recent_order:${orderRef}`,
          type: "orders",
          title: `Order ${order.status || "Updated"}: ${orderRef}`,
          message: `${customerName} placed order ${orderRef} for ${totalFormatted} (${order.status || "Processing"}).`,
          referenceId: orderRef,
          targetPage: "Orders",
          createdAt: order.createdAt || new Date()
        });
      }
    }

    // 3. Customers Notifications (Registered patrons)
    const customers = await User.find({ role: "customer" })
      .select("-password")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    for (const cust of customers) {
      const custId = String(cust._id);
      candidates.push({
        eventKey: `new_customer:${custId}`,
        type: "customers",
        title: `New Patron Registered`,
        message: `${cust.name} (${cust.email}) registered as an AURA patron.`,
        referenceId: custId,
        targetPage: "Customers",
        createdAt: cust.createdAt || new Date()
      });
    }

    // 4. Reviews Notifications (Customer product reviews)
    const reviews = await Review.find().sort({ createdAt: -1 }).limit(50).lean();
    for (const rev of reviews) {
      const revId = String(rev._id);
      candidates.push({
        eventKey: `new_review:${revId}`,
        type: "reviews",
        title: `New Review (${rev.rating}★)`,
        message: `${rev.customerName} submitted a ${rev.rating}-star review for "${rev.title}".`,
        referenceId: revId,
        targetPage: "Reviews",
        createdAt: rev.createdAt || new Date()
      });
    }

    // Perform atomic upserts with $setOnInsert to prevent duplicates and preserve 'read' status
    const operations = candidates.map((item) => ({
      updateOne: {
        filter: { eventKey: item.eventKey },
        update: {
          $setOnInsert: {
            eventKey: item.eventKey,
            type: item.type,
            title: item.title,
            message: item.message,
            referenceId: item.referenceId,
            targetPage: item.targetPage,
            read: false,
            createdAt: item.createdAt || new Date()
          }
        },
        upsert: true
      }
    }));

    if (operations.length > 0) {
      await AdminNotification.bulkWrite(operations, { ordered: false });
    }
  } catch (syncErr) {
    console.error("Error during admin notifications sync:", syncErr);
  }
}

// ====================================================================
// 1. GET /api/admin/notifications
// Retrieve all notifications with optional category and read state filters
// Protected: requireAdmin (aura_admin_session)
// ====================================================================
router.get("/", requireAdmin, async (req, res) => {
  try {
    // 1. Sync live records from MongoDB
    await syncNotificationsFromData();

    // 2. Build filter query
    const { type, read } = req.query;
    const filter = {};

    if (type && type !== "all") {
      filter.type = type;
    }

    if (read === "unread") {
      filter.read = false;
    } else if (read === "read") {
      filter.read = true;
    }

    // 3. Query notifications
    const notifications = await AdminNotification.find(filter)
      .sort({ createdAt: -1 })
      .limit(100);

    // 4. Calculate unread and total counters
    const unreadCount = await AdminNotification.countDocuments({ read: false });
    const totalCount = await AdminNotification.countDocuments();

    // Category breakdown counts
    const categoryCounts = {
      all: totalCount,
      inventory: await AdminNotification.countDocuments({ type: "inventory" }),
      orders: await AdminNotification.countDocuments({ type: "orders" }),
      customers: await AdminNotification.countDocuments({ type: "customers" }),
      reviews: await AdminNotification.countDocuments({ type: "reviews" }),
      system: await AdminNotification.countDocuments({ type: "system" })
    };

    return res.json({
      success: true,
      unreadCount,
      totalCount,
      categoryCounts,
      notifications
    });
  } catch (error) {
    console.error("Error retrieving admin notifications:", error);
    return res.status(500).json({
      message: "Could not retrieve notifications.",
      error: error.message
    });
  }
});

// ====================================================================
// 2. PUT /api/admin/notifications/mark-all-read
// Mark all unread notifications as read
// Protected: requireAdmin (aura_admin_session)
// ====================================================================
router.put("/mark-all-read", requireAdmin, async (req, res) => {
  try {
    const result = await AdminNotification.updateMany(
      { read: false },
      { $set: { read: true } }
    );

    return res.json({
      success: true,
      message: "All notifications marked as read.",
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return res.status(500).json({
      message: "Could not mark all notifications as read.",
      error: error.message
    });
  }
});

// ====================================================================
// 3. PUT /api/admin/notifications/:id/read
// Mark a single notification as read
// Protected: requireAdmin (aura_admin_session)
// ====================================================================
router.put("/:id/read", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid notification ID format." });
    }

    const notification = await AdminNotification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification not found." });
    }

    return res.json({
      success: true,
      message: "Notification marked as read.",
      notification
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({
      message: "Could not mark notification as read.",
      error: error.message
    });
  }
});

module.exports = router;
