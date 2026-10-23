const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * User / Customer Schema for AURA E-Commerce
 */
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Full name must be at least 2 characters"]
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address"
      ]
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false // Exclude from query results by default for security
    },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer"
    },
    phone: {
      type: String,
      trim: true,
      default: ""
    },
    addresses: [
      {
        fullName: {
          type: String,
          trim: true,
          default: ""
        },
        phone: {
          type: String,
          trim: true,
          default: ""
        },
        address: {
          type: String,
          required: [true, "Street address is required"],
          trim: true
        },
        city: {
          type: String,
          required: [true, "City is required"],
          trim: true
        },
        state: {
          type: String,
          required: [true, "State is required"],
          trim: true
        },
        pinCode: {
          type: String,
          required: [true, "PIN Code is required"],
          trim: true
        },
        isDefault: {
          type: Boolean,
          default: false
        }
      }
    ],
    wishlist: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product"
      }
    ],
    passwordResetToken: {
      type: String,
      select: false
    },
    passwordResetExpires: {
      type: Date,
      select: false
    },
    passwordChangedAt: {
      type: Date
    },
    tokenVersion: {
      type: Number,
      default: 0
    },
    isEmailVerified: {
      type: Boolean
      // Note: Omit schema default so legacy accounts remain undefined and are grandfathered
    },
    emailVerificationToken: {
      type: String,
      select: false
    },
    emailVerificationExpires: {
      type: Date,
      select: false
    },
    emailVerifiedAt: {
      type: Date
    },
    lastVerifiedToken: {
      type: String,
      select: false
    }
  },
  {
    timestamps: true
  }
);

// Pre-save hook to hash password before saving to MongoDB
userSchema.pre("save", async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified("password")) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Instance method to safely compare entered password against hash
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Transform output JSON to guarantee password, reset tokens, and verification tokens are never exposed
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.passwordResetToken;
  delete userObject.passwordResetExpires;
  delete userObject.emailVerificationToken;
  delete userObject.emailVerificationExpires;
  delete userObject.lastVerifiedToken;
  delete userObject.__v;
  return userObject;
};

const User = mongoose.model("User", userSchema);

module.exports = User;
