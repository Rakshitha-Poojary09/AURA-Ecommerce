const mongoose = require("mongoose");

/**
 * Coupon Schema for AURA E-Commerce
 * Stores discount configurations, validity periods, and usage limits.
 */
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Coupon code is required"],
      unique: true,
      trim: true,
      uppercase: true,
      minlength: [2, "Coupon code must be at least 2 characters"],
      maxlength: [30, "Coupon code cannot exceed 30 characters"]
    },
    discountType: {
      type: String,
      required: [true, "Discount type is required"],
      enum: {
        values: ["percentage", "fixed"],
        message: "Discount type must be either 'percentage' or 'fixed'"
      },
      default: "percentage"
    },
    discountValue: {
      type: Number,
      required: [true, "Discount value is required"],
      min: [0.01, "Discount value must be greater than 0"]
    },
    minOrderAmount: {
      type: Number,
      default: 0,
      min: [0, "Minimum order amount cannot be negative"]
    },
    maxDiscountAmount: {
      type: Number,
      default: null,
      min: [0, "Maximum discount amount cannot be negative"]
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"]
    },
    expiryDate: {
      type: Date,
      required: [true, "Expiry date is required"]
    },
    usageLimit: {
      type: Number,
      default: null, // null means unlimited
      min: [1, "Total usage limit must be at least 1 if set"]
    },
    usageLimitPerCustomer: {
      type: Number,
      default: 1,
      min: [1, "Customer usage limit must be at least 1"]
    },
    usedCount: {
      type: Number,
      default: 0,
      min: [0, "Usage count cannot be negative"]
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Pre-validate hook to clean code and validate logical constraints
couponSchema.pre("validate", function () {
  if (this.code) {
    this.code = this.code.trim().toUpperCase();
  }

  // Validate percentage discount range
  if (this.discountType === "percentage" && this.discountValue > 100) {
    throw new Error("Percentage discount cannot exceed 100%");
  }

  // Validate date range
  if (this.startDate && this.expiryDate) {
    const start = new Date(this.startDate);
    const expiry = new Date(this.expiryDate);
    if (expiry <= start) {
      throw new Error("Expiry date must be after start date");
    }
  }
});

// Virtual status helper: 'active', 'inactive', 'expired', 'scheduled'
couponSchema.virtual("computedStatus").get(function () {
  const now = new Date();
  if (!this.isActive) return "inactive";
  if (this.expiryDate && now > this.expiryDate) return "expired";
  if (this.startDate && now < this.startDate) return "scheduled";
  return "active";
});

// Configure JSON output to include virtuals
couponSchema.set("toJSON", { virtuals: true });
couponSchema.set("toObject", { virtuals: true });

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
