const mongoose = require("mongoose");

/**
 * Review Model for AURA Product Reviews & Ratings
 */
const reviewSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      index: true
    },
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1 star"],
      max: [5, "Rating cannot exceed 5 stars"],
      validate: {
        validator: Number.isInteger,
        message: "Rating must be an integer between 1 and 5"
      }
    },
    title: {
      type: String,
      required: [true, "Review title is required"],
      trim: true,
      maxlength: [120, "Review title cannot exceed 120 characters"]
    },
    comment: {
      type: String,
      required: [true, "Review comment is required"],
      trim: true,
      maxlength: [2000, "Review comment cannot exceed 2000 characters"]
    },
    status: {
      type: String,
      enum: ["approved", "hidden"],
      default: "approved",
      index: true
    },
    isInfluencer: {
      type: Boolean,
      default: false,
      index: true
    },
    influencerHandle: {
      type: String,
      default: "",
      trim: true
    },
    isVerifiedPurchase: {
      type: Boolean,
      default: false
    },
    video: {
      url: {
        type: String,
        default: ""
      },
      thumbnailUrl: {
        type: String,
        default: ""
      },
      filename: {
        type: String,
        default: ""
      },
      originalName: {
        type: String,
        default: ""
      },
      mimeType: {
        type: String,
        default: ""
      },
      size: {
        type: Number,
        default: 0
      },
      duration: {
        type: Number,
        default: 0
      },
      aspectRatio: {
        type: String,
        default: "9:16"
      }
    },
    photos: {
      type: [
        new mongoose.Schema(
          {
            url: {
              type: String,
              required: true
            },
            filename: {
              type: String,
              required: true
            },
            originalName: {
              type: String,
              default: ""
            },
            mimeType: {
              type: String,
              required: true
            },
            size: {
              type: Number,
              required: true
            },
            uploadedAt: {
              type: Date,
              default: Date.now
            }
          },
          { _id: true }
        )
      ],
      default: [],
      validate: {
        validator: function (val) {
          return !val || val.length <= 5;
        },
        message: "A review cannot exceed 5 photos."
      }
    }
  },
  {
    timestamps: true
  }
);

// Enforce unique review per customer per product for customer accounts
reviewSchema.index(
  { productId: 1, customerId: 1 },
  { unique: true, partialFilterExpression: { customerId: { $type: "objectId" } } }
);

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;
