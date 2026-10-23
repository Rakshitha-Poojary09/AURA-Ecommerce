const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Product = require("../models/Product");
const { authenticateCustomer } = require("../middleware/auth");

const router = express.Router();

/**
 * @route   GET /api/wishlist
 * @desc    Get currently logged-in customer's saved wishlist items
 * @access  Protected
 */
router.get("/", authenticateCustomer, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("wishlist");

    if (!user) {
      return res.status(404).json({ message: "Customer account not found" });
    }

    // Filter out any products that may have been deleted from catalog (graceful handling)
    const validWishlist = (user.wishlist || []).filter((item) => item !== null && item._id);

    // If any deleted products were detected, clean them from the user's document asynchronously
    if (validWishlist.length !== (user.wishlist || []).length) {
      const validIds = validWishlist.map((it) => it._id);
      await User.findByIdAndUpdate(req.user._id, { wishlist: validIds });
    }

    return res.json({
      wishlist: validWishlist,
      count: validWishlist.length
    });
  } catch (error) {
    console.error("Error fetching wishlist:", error);
    return res.status(500).json({
      message: "Error fetching customer wishlist",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/wishlist/toggle
 * @desc    Add or remove a product from customer's wishlist
 * @access  Protected
 */
router.post("/toggle", authenticateCustomer, async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ message: "Product ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "Customer account not found" });
    }

    const currentWishlist = user.wishlist || [];
    const exists = currentWishlist.some(
      (id) => id && id.toString() === productId.toString()
    );

    let updatedUser;
    let message = "";
    let isAdded = false;

    if (exists) {
      // Remove from wishlist
      updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $pull: { wishlist: productId } },
        { returnDocument: "after" }
      ).populate("wishlist");
      message = "Product removed from your wishlist";
      isAdded = false;
    } else {
      // Verify product exists in MongoDB before adding
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ message: "Product no longer exists in catalog" });
      }

      // Add to wishlist safely
      updatedUser = await User.findByIdAndUpdate(
        req.user._id,
        { $addToSet: { wishlist: productId } },
        { returnDocument: "after" }
      ).populate("wishlist");
      message = `Saved "${product.name}" to your wishlist! ❤️`;
      isAdded = true;
    }

    const validWishlist = (updatedUser.wishlist || []).filter((item) => item !== null && item._id);

    return res.json({
      message,
      isAdded,
      wishlist: validWishlist,
      count: validWishlist.length
    });
  } catch (error) {
    console.error("Error toggling wishlist item:", error);
    return res.status(500).json({
      message: "Error updating wishlist",
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/wishlist/merge
 * @desc    Safely merge guest wishlist items (from client localStorage) with authenticated customer's MongoDB wishlist
 * @access  Protected
 */
router.put("/merge", authenticateCustomer, async (req, res) => {
  try {
    const { productIds } = req.body;

    if (!Array.isArray(productIds) || productIds.length === 0) {
      const user = await User.findById(req.user._id).populate("wishlist");
      const validWishlist = (user.wishlist || []).filter((item) => item !== null && item._id);
      return res.json({
        message: "No guest items to merge",
        wishlist: validWishlist,
        count: validWishlist.length
      });
    }

    // Filter valid MongoDB ObjectId strings and ensure products exist in database
    const validObjectIds = productIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
    const existingProducts = await Product.find({ _id: { $in: validObjectIds } }).select("_id");
    const verifiedProductIds = existingProducts.map((p) => p._id);

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $addToSet: { wishlist: { $each: verifiedProductIds } } },
      { returnDocument: "after" }
    ).populate("wishlist");

    const validWishlist = (updatedUser.wishlist || []).filter((item) => item !== null && item._id);

    return res.json({
      message: "Guest wishlist successfully merged with your account",
      wishlist: validWishlist,
      count: validWishlist.length
    });
  } catch (error) {
    console.error("Error merging wishlist:", error);
    return res.status(500).json({
      message: "Error merging wishlist items",
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/wishlist/:productId
 * @desc    Explicitly remove a product from customer's wishlist
 * @access  Protected
 */
router.delete("/:productId", authenticateCustomer, async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID format" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $pull: { wishlist: productId } },
      { returnDocument: "after" }
    ).populate("wishlist");

    const validWishlist = (updatedUser.wishlist || []).filter((item) => item !== null && item._id);

    return res.json({
      message: "Product removed from wishlist",
      wishlist: validWishlist,
      count: validWishlist.length
    });
  } catch (error) {
    console.error("Error removing wishlist item:", error);
    return res.status(500).json({
      message: "Error removing product from wishlist",
      error: error.message
    });
  }
});

module.exports = router;
