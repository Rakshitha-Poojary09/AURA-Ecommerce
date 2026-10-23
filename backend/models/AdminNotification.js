const mongoose = require("mongoose");

/**
 * Admin Notification Schema for AURA E-Commerce Dashboard
 * Persists actionable alerts and read/unread status across refreshes
 */
const adminNotificationSchema = new mongoose.Schema(
  {
    eventKey: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    type: {
      type: String,
      enum: ["inventory", "orders", "customers", "reviews", "system"],
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    referenceId: {
      type: String,
      default: null
    },
    targetPage: {
      type: String,
      enum: ["Products", "Orders", "Customers", "Reviews", "Dashboard", null],
      default: null
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Transform JSON to never expose internal sensitive properties
adminNotificationSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const AdminNotification = mongoose.model("AdminNotification", adminNotificationSchema);

module.exports = AdminNotification;
