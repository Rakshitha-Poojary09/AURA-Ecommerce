const mongoose = require("mongoose");

/**
 * Schema for individual items within an order
 */
const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.Mixed, // Allows numeric ID or MongoDB ObjectId
      required: false
    },
    name: {
      type: String,
      required: true
    },
    image: {
      type: String,
      default: ""
    },
    price: {
      type: Number,
      required: true
    },
    mrp: {
      type: Number,
      default: null,
      required: false
    },
    quantity: {
      type: Number,
      required: true,
      default: 1
    },
    size: {
      type: String,
      default: "M"
    },
    color: {
      type: String,
      default: ""
    },
    colorName: {
      type: String,
      default: ""
    },
    colorCode: {
      type: String,
      default: ""
    }
  },
  { _id: false }
);

/**
 * Main Order Schema
 */
const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true
    },
    customer: {
      fullName: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true
      },
      phone: {
        type: String,
        required: true
      },
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false
      }
    },
    shippingAddress: {
      address: {
        type: String,
        required: true
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      pinCode: {
        type: String,
        required: true
      }
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [(arr) => arr.length > 0, "Order must contain at least one item"]
    },
    subtotal: {
      type: Number,
      required: true
    },
    discount: {
      type: Number,
      default: 0
    },
    coupon: {
      couponId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Coupon",
        required: false
      },
      code: {
        type: String,
        uppercase: true,
        trim: true
      },
      discountType: {
        type: String,
        enum: ["percentage", "fixed"]
      },
      discountValue: {
        type: Number
      },
      discountAmount: {
        type: Number,
        default: 0
      },
      eligibleSubtotal: {
        type: Number
      }
    },
    shipping: {
      type: Number,
      required: true,
      default: 0
    },
    total: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ["Pending", "Processing", "Shipped", "Delivered", "Cancelled"],
      default: "Pending"
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        message: { type: String }
      }
    ],
    trackingNumber: {
      type: String,
      default: null
    },
    courierName: {
      type: String,
      default: null
    },
    paymentMethod: {
      type: String,
      default: "Cash on Delivery (COD)"
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;
