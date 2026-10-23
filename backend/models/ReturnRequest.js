const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    image: {
      type: String,
      default: ""
    },
    originalPrice: {
      type: Number,
      required: true
    },
    originalMrp: {
      type: Number,
      default: null
    },
    size: {
      type: String,
      default: "M"
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    reason: {
      type: String,
      enum: [
        "Wrong item received",
        "Damaged or defective item",
        "Size or fit issue",
        "Product differs from description",
        "Received the wrong size or color",
        "Other"
      ],
      required: true
    },
    customerComments: {
      type: String,
      default: ""
    },
    replacementSize: {
      type: String,
      default: null
    },
    allocatedDiscount: {
      type: Number,
      default: 0
    },
    eligibleRefundAmount: {
      type: Number,
      default: 0
    }
  },
  { _id: false }
);

const returnRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    orderId: {
      type: String,
      required: true,
      index: true
    },
    orderRef: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true
    },
    customer: {
      customerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: false
      },
      fullName: {
        type: String,
        required: true
      },
      email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
      },
      phone: {
        type: String,
        required: true
      },
      isGuest: {
        type: Boolean,
        default: false
      }
    },
    requestType: {
      type: String,
      enum: ["Return", "Exchange"],
      required: true
    },
    items: {
      type: [returnItemSchema],
      required: true,
      validate: [(arr) => arr.length > 0, "At least one item must be selected"]
    },
    reason: {
      type: String,
      required: true
    },
    comments: {
      type: String,
      default: ""
    },
    evidenceImages: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: [
        "Requested",
        "Approved",
        "Rejected",
        "In Transit",
        "Received and Inspected",
        "Completed",
        "Cancelled"
      ],
      default: "Requested",
      index: true
    },
    refundStatus: {
      type: String,
      enum: ["None", "Pending", "Completed", "Rejected"],
      default: "None"
    },
    refundAmount: {
      type: Number,
      default: 0
    },
    stockRestored: {
      type: Boolean,
      default: false
    },
    exchangeStockDeducted: {
      type: Boolean,
      default: false
    },
    adminNotes: {
      type: String,
      default: ""
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        message: { type: String, default: "" },
        updatedBy: { type: String, default: "System" }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Helpful compound indexes for fast searching & authorization checks
returnRequestSchema.index({ orderId: 1, "customer.email": 1 });
returnRequestSchema.index({ "customer.customerId": 1, createdAt: -1 });

const ReturnRequest = mongoose.model("ReturnRequest", returnRequestSchema);

module.exports = ReturnRequest;
