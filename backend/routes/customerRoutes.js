const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Order = require("../models/Order");
const { requireAdmin } = require("../middleware/auth");

const router = express.Router();

/**
 * Helper to check if an order status is cancelled (case-insensitive)
 */
const isCancelled = (status = "") => {
  return (status || "").toLowerCase() === "cancelled";
};

// ====================================================================
// 1. GET /api/admin/customers
// Retrieve all registered customers with aggregated order statistics
// Protected (Administrator only, aura_admin_session)
// ====================================================================
router.get("/", requireAdmin, async (req, res) => {
  try {
    // 1. Fetch all registered users with customer role (exclude password by default)
    const users = await User.find({ role: "customer" })
      .select("-password")
      .sort({ createdAt: -1 });

    // 2. Fetch all orders from MongoDB to calculate accurate customer metrics
    const orders = await Order.find()
      .select("orderId customer total status createdAt items")
      .sort({ createdAt: -1 });

    // 3. Map orders by customerId and customer email for efficient lookups
    const ordersByCustomerId = new Map();
    const ordersByEmail = new Map();

    for (const order of orders) {
      if (order.customer?.customerId) {
        const cId = String(order.customer.customerId);
        if (!ordersByCustomerId.has(cId)) {
          ordersByCustomerId.set(cId, []);
        }
        ordersByCustomerId.get(cId).push(order);
      }

      if (order.customer?.email) {
        const emailKey = order.customer.email.trim().toLowerCase();
        if (!ordersByEmail.has(emailKey)) {
          ordersByEmail.set(emailKey, []);
        }
        ordersByEmail.get(emailKey).push(order);
      }
    }

    // 4. Aggregate metrics for each customer
    const customers = users.map((user) => {
      const uId = String(user._id);
      const uEmail = (user.email || "").trim().toLowerCase();

      // Collect unique orders matching either customerId or email
      const matchedOrderMap = new Map();

      if (ordersByCustomerId.has(uId)) {
        for (const o of ordersByCustomerId.get(uId)) {
          matchedOrderMap.set(String(o._id || o.orderId), o);
        }
      }

      if (ordersByEmail.has(uEmail)) {
        for (const o of ordersByEmail.get(uEmail)) {
          matchedOrderMap.set(String(o._id || o.orderId), o);
        }
      }

      const userOrders = Array.from(matchedOrderMap.values()).sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      const totalOrders = userOrders.length;

      // Exclude cancelled orders from totalSpent calculation
      const nonCancelledOrders = userOrders.filter(
        (o) => !isCancelled(o.status)
      );
      const totalSpent = nonCancelledOrders.reduce(
        (sum, o) => sum + (Number(o.total) || 0),
        0
      );

      const lastOrderDate = totalOrders > 0 ? userOrders[0].createdAt : null;

      // Retrieve phone number from orders if available
      const phone = userOrders.find((o) => o.customer?.phone)?.customer?.phone || null;

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        totalOrders,
        totalSpent,
        lastOrderDate,
        status: "Active"
      };
    });

    // 5. Calculate catalog-wide customer KPIs
    const totalCustomers = customers.length;
    const customersWithOrders = customers.filter((c) => c.totalOrders > 0).length;
    const customersWithoutOrders = customers.filter((c) => c.totalOrders === 0).length;
    const totalCustomerRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);

    return res.json({
      success: true,
      count: customers.length,
      customers,
      stats: {
        totalCustomers,
        customersWithOrders,
        customersWithoutOrders,
        totalCustomerRevenue
      }
    });
  } catch (error) {
    console.error("Error retrieving admin customers:", error);
    return res.status(500).json({
      message: "Could not retrieve customer list.",
      error: error.message
    });
  }
});

// ====================================================================
// 2. GET /api/admin/customers/:customerId
// Retrieve comprehensive profile and full order history for a single customer
// Protected (Administrator only, aura_admin_session)
// ====================================================================
router.get("/:customerId", requireAdmin, async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ message: "Invalid customer ID format." });
    }

    // 1. Fetch customer from database, strictly ensuring role is customer and password is not selected
    const customer = await User.findOne({ _id: customerId, role: "customer" })
      .select("-password");

    if (!customer) {
      return res.status(404).json({ message: "Customer not found." });
    }

    // 2. Fetch all orders associated with this customer
    const cleanEmail = (customer.email || "").trim().toLowerCase();
    const queryConditions = [
      { "customer.customerId": customer._id }
    ];

    if (cleanEmail) {
      queryConditions.push({
        "customer.email": new RegExp(`^${cleanEmail}$`, "i")
      });
    }

    const customerOrders = await Order.find({
      $or: queryConditions
    }).sort({ createdAt: -1 });

    const totalOrders = customerOrders.length;

    // Exclude cancelled orders from totalSpent
    const nonCancelledOrders = customerOrders.filter(
      (o) => !isCancelled(o.status)
    );
    const totalSpent = nonCancelledOrders.reduce(
      (sum, o) => sum + (Number(o.total) || 0),
      0
    );

    const lastOrderDate = totalOrders > 0 ? customerOrders[0].createdAt : null;
    const phone = customerOrders.find((o) => o.customer?.phone)?.customer?.phone || null;

    // 3. Format order history safely
    const orderHistory = customerOrders.map((order) => ({
      _id: order._id,
      orderId: order.orderId,
      date: order.createdAt,
      createdAt: order.createdAt,
      total: Number(order.total) || 0,
      subtotal: Number(order.subtotal) || 0,
      shipping: Number(order.shipping) || 0,
      status: order.status || "Pending",
      paymentMethod: order.paymentMethod || "Cash on Delivery (COD)",
      itemsCount: Array.isArray(order.items)
        ? order.items.reduce((s, it) => s + (Number(it.quantity) || 1), 0)
        : 0,
      items: (order.items || []).map((it) => ({
        productId: it.productId,
        name: it.name,
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
        size: it.size || "M",
        image: it.image || ""
      }))
    }));

    return res.json({
      success: true,
      customer: {
        _id: customer._id,
        name: customer.name,
        email: customer.email,
        phone,
        role: customer.role,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        totalOrders,
        totalSpent,
        lastOrderDate,
        status: "Active",
        orders: orderHistory
      }
    });
  } catch (error) {
    console.error("Error retrieving customer details:", error);
    return res.status(500).json({
      message: "Could not retrieve customer details.",
      error: error.message
    });
  }
});

module.exports = router;
