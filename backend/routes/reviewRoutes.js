const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const Review = require("../models/Review");
const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const { authenticateCustomer, requireAdmin } = require("../middleware/auth");
const {
  uploadReviewPhotos,
  uploadReviewMedia,
  verifyImageMagicBytes,
  verifyVideoMagicBytes,
  deleteReviewPhotoFile,
  deleteReviewVideoFile,
  cleanupUploadedFiles
} = require("../utils/reviewPhotoStorage");

const router = express.Router();

// Normalization helpers for uploaded media across single/multiple field formats
const getPhotoFilesFromReq = (req) => {
  if (Array.isArray(req.files)) return req.files;
  if (req.files && Array.isArray(req.files.photos)) return req.files.photos;
  if (req.photoFiles && Array.isArray(req.photoFiles)) return req.photoFiles;
  return [];
};

const getVideoFileFromReq = (req) => {
  if (req.videoFile) return req.videoFile;
  if (req.files && Array.isArray(req.files.video) && req.files.video[0]) return req.files.video[0];
  return null;
};

const getThumbnailFileFromReq = (req) => {
  if (req.thumbnailFile) return req.thumbnailFile;
  if (req.files && Array.isArray(req.files.thumbnail) && req.files.thumbnail[0]) return req.files.thumbnail[0];
  return null;
};

/**
 * Optional customer authentication helper.
 * Extracts customer from aura_customer_session cookie or Bearer token if present.
 * Does not throw 401 if unauthenticated (allows guests to proceed).
 */
const getOptionalCustomer = async (req) => {
  try {
    let token = null;
    if (req.cookies && req.cookies.aura_customer_session) {
      token = req.cookies.aura_customer_session;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) return null;

    const secret = process.env.JWT_SECRET || "aura_luxury_fashion_jwt_secret_key_2026_super_secure";
    const decoded = jwt.verify(token, secret);
    if (!decoded || !decoded.id) return null;

    const user = await User.findById(decoded.id);
    if (!user || user.role === "admin") return null;

    return user;
  } catch (err) {
    return null;
  }
};

/**
 * Check whether a customer is a verified purchaser for a given product.
 * Returns true if customer has at least one NON-CANCELLED order containing this product.
 */
const checkVerifiedPurchaser = async (userId, userEmail, productId) => {
  const prodIdStr = String(productId);
  const cleanEmail = (userEmail || "").trim().toLowerCase();

  const queryConditions = [
    { "customer.customerId": userId }
  ];

  if (cleanEmail) {
    queryConditions.push({
      "customer.email": new RegExp(`^${cleanEmail}$`, "i")
    });
  }

  const orders = await Order.find({
    $or: queryConditions,
    status: { $nin: ["Cancelled", "cancelled"] }
  });

  return orders.some((order) =>
    Array.isArray(order.items) &&
    order.items.some((item) => {
      const rawId = item.productId || item._id || item.id;
      return String(rawId) === prodIdStr;
    })
  );
};

// ====================================================================
// 1. GET /api/products/:productId/reviews
// Retrieve reviews, ratings breakdown, and user review eligibility
// Public (Guests & Customers)
// ====================================================================
router.get("/products/:productId/reviews", async (req, res) => {
  try {
    const { productId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID format." });
    }

    const productExists = await Product.exists({ _id: productId });
    if (!productExists) {
      return res.status(404).json({ message: "Product not found." });
    }

    // Fetch ONLY approved reviews for this product (newest first)
    const reviews = await Review.find({
      productId,
      $or: [{ status: "approved" }, { status: { $exists: false } }]
    }).sort({ createdAt: -1 });
    const totalReviews = reviews.length;

    // Calculate average rating strictly from approved reviews
    const averageRating = totalReviews === 0
      ? 0
      : Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews) * 10) / 10;

    // Calculate rating distribution (5-star down to 1-star) from approved reviews only
    const ratingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    reviews.forEach((r) => {
      const rKey = Number(r.rating);
      if (ratingDistribution[rKey] !== undefined) {
        ratingDistribution[rKey]++;
      }
    });

    // Check optional authenticated customer status
    let isVerifiedPurchaser = false;
    let userReview = null;
    let canReview = false;

    const optionalUser = await getOptionalCustomer(req);
    if (optionalUser) {
      isVerifiedPurchaser = await checkVerifiedPurchaser(
        optionalUser._id,
        optionalUser.email,
        productId
      );

      // Fetch user's own review so they can view, edit, or delete it
      // Note: If hidden, it will NOT be in the public 'reviews' array above
      const existingUserReview = await Review.findOne({
        productId,
        customerId: optionalUser._id
      });
      userReview = existingUserReview || null;

      // Customer can review if verified purchaser and hasn't reviewed yet
      canReview = isVerifiedPurchaser && !existingUserReview;
    }

    return res.json({
      productId,
      totalReviews,
      averageRating,
      ratingDistribution,
      reviews,
      isVerifiedPurchaser,
      userReview,
      canReview
    });
  } catch (error) {
    console.error("Error retrieving product reviews:", error);
    return res.status(500).json({
      message: "Error retrieving product reviews.",
      error: error.message
    });
  }
});

/**
 * Helper to process and validate uploaded photos using magic bytes
 */
const processUploadedPhotos = async (files) => {
  if (!Array.isArray(files) || files.length === 0) return { photos: [] };

  const validPhotos = [];

  for (const file of files) {
    const detected = await verifyImageMagicBytes(file.path);
    if (!detected) {
      await cleanupUploadedFiles(files);
      return {
        error: `File "${file.originalname}" is not a valid image format. Only real JPG, JPEG, PNG, and WebP images are permitted.`
      };
    }

    validPhotos.push({
      url: `/uploads/reviews/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname || file.filename,
      mimeType: detected.mime,
      size: file.size,
      uploadedAt: new Date()
    });
  }

  return { photos: validPhotos };
};

/**
 * Helper to process and validate uploaded fashion video review
 */
const processUploadedVideo = async (videoFile, thumbnailFile, bodyVideoUrl, bodyThumbnailUrl) => {
  let videoObj = {
    url: "",
    thumbnailUrl: "",
    filename: "",
    originalName: "",
    mimeType: "",
    size: 0,
    duration: 0,
    aspectRatio: "9:16"
  };

  if (videoFile) {
    const detected = await verifyVideoMagicBytes(videoFile.path);
    if (!detected) {
      await deleteReviewVideoFile(videoFile.path);
      return {
        error: `File "${videoFile.originalname}" is not a valid video format. Only real MP4, WebM, and MOV vertical fashion videos are permitted.`
      };
    }

    videoObj.url = `/uploads/reviews/videos/${videoFile.filename}`;
    videoObj.filename = videoFile.filename;
    videoObj.originalName = videoFile.originalname || videoFile.filename;
    videoObj.mimeType = detected.mime;
    videoObj.size = videoFile.size;
  } else if (bodyVideoUrl && typeof bodyVideoUrl === "string" && bodyVideoUrl.trim()) {
    videoObj.url = bodyVideoUrl.trim();
    videoObj.originalName = "fashion-tryon.mp4";
    videoObj.mimeType = "video/mp4";
  }

  if (thumbnailFile) {
    const detectedThumb = await verifyImageMagicBytes(thumbnailFile.path);
    if (detectedThumb) {
      videoObj.thumbnailUrl = `/uploads/reviews/${thumbnailFile.filename}`;
    }
  } else if (bodyThumbnailUrl && typeof bodyThumbnailUrl === "string" && bodyThumbnailUrl.trim()) {
    videoObj.thumbnailUrl = bodyThumbnailUrl.trim();
  }

  return { video: videoObj };
};

// ====================================================================
// 2. POST /api/products/:productId/reviews
// Submit a new review for a product with optional video and photo uploads
// Protected (Customer only, verified purchaser only, once per product)
// ====================================================================
router.post(
  "/products/:productId/reviews",
  authenticateCustomer,
  uploadReviewPhotos,
  async (req, res) => {
    try {
      const { productId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(productId)) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Invalid product ID format." });
      }

      const product = await Product.findById(productId);
      if (!product) {
        await cleanupUploadedFiles(req.files);
        return res.status(404).json({ message: "Product not found." });
      }

      const {
        rating,
        title,
        comment,
        videoUrl,
        thumbnailUrl
      } = req.body || {};

      // Reject any video upload or URL attempt by customers upfront
      const attemptedVideoFile = getVideoFileFromReq(req);
      const attemptedVideoUrl = (videoUrl && typeof videoUrl === "string" && videoUrl.trim()) || req.body?.video;
      if (attemptedVideoFile || attemptedVideoUrl) {
        await cleanupUploadedFiles(req.files);
        return res.status(403).json({
          message: "Video try-on upload is restricted to authenticated administrators only. Customers may only submit ratings, comments, and photos."
        });
      }

      // Validate rating
      const numRating = Number(rating);
      if (!rating || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "Rating must be a whole number between 1 and 5 stars."
        });
      }

      // Validate title
      const cleanTitle = (title || "").trim();
      if (!cleanTitle) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "Review title is required."
        });
      }
      if (cleanTitle.length > 120) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "Review title cannot exceed 120 characters."
        });
      }

      // Validate comment
      const cleanComment = (comment || "").trim();
      if (!cleanComment) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "Review comment is required."
        });
      }
      if (cleanComment.length > 2000) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "Review comment cannot exceed 2000 characters."
        });
      }

      // Enforce verified purchaser rule (non-cancelled orders)
      const isVerified = await checkVerifiedPurchaser(
        req.user._id,
        req.user.email,
        productId
      );

      if (!isVerified) {
        await cleanupUploadedFiles(req.files);
        return res.status(403).json({
          message: "Only verified purchasers who have ordered this item can leave a review. Cancelled orders do not qualify."
        });
      }

      // Check if customer already submitted a review for this product
      const existingReview = await Review.findOne({
        productId,
        customerId: req.user._id
      });

      if (existingReview) {
        await cleanupUploadedFiles(req.files);
        return res.status(409).json({
          message: "You have already reviewed this product. You can edit your existing review.",
          reviewId: existingReview._id
        });
      }

      // Extract uploaded photos
      const photoFiles = getPhotoFilesFromReq(req);

      // Validate actual image content / magic bytes
      const { photos: validPhotos, error: photoError } = await processUploadedPhotos(photoFiles);
      if (photoError) {
        return res.status(400).json({ message: photoError });
      }

      // Create and save review (customer reviews never contain video)
      const newReview = new Review({
        productId,
        customerId: req.user._id,
        customerName: req.user.name,
        rating: numRating,
        title: cleanTitle,
        comment: cleanComment,
        photos: validPhotos,
        video: {
          url: "",
          thumbnailUrl: "",
          filename: "",
          originalName: "",
          mimeType: "",
          size: 0,
          duration: 0,
          aspectRatio: "9:16"
        },
        isVerifiedPurchase: true
      });

      const savedReview = await newReview.save();

      return res.status(201).json({
        message: "Review submitted successfully! Thank you for your feedback ✨",
        review: savedReview
      });
    } catch (error) {
      await cleanupUploadedFiles(req.files);
      if (error.code === 11000) {
        return res.status(409).json({
          message: "You have already reviewed this product."
        });
      }
      console.error("Error creating review:", error);
      return res.status(500).json({
        message: "Could not submit review. Please try again later.",
        error: error.message
      });
    }
  }
);

// ====================================================================
// 3. PUT /api/reviews/:reviewId
// Edit an existing review (update rating, title, comment, photos, video)
// Protected (Customer only, owner only)
// ====================================================================
router.put(
  "/reviews/:reviewId",
  authenticateCustomer,
  uploadReviewPhotos,
  async (req, res) => {
    try {
      const { reviewId } = req.params;

      // Reject any video upload, update, or removal attempts by customers upfront
      const attemptedVideoFile = getVideoFileFromReq(req);
      const attemptedVideoUrl = (req.body?.videoUrl && typeof req.body.videoUrl === "string" && req.body.videoUrl.trim()) || req.body?.video;
      if (attemptedVideoFile || attemptedVideoUrl || req.body?.removeVideo) {
        await cleanupUploadedFiles(req.files);
        return res.status(403).json({
          message: "Video try-on management is restricted to authenticated administrators only."
        });
      }

      if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Invalid review ID format." });
      }

      const review = await Review.findById(reviewId);
      if (!review) {
        await cleanupUploadedFiles(req.files);
        return res.status(404).json({ message: "Review not found." });
      }

      // Ownership check: customer can edit only their own review
      if (review.customerId && review.customerId.toString() !== req.user._id.toString()) {
        await cleanupUploadedFiles(req.files);
        return res.status(403).json({
          message: "Access denied. You can only edit your own review."
        });
      }

      const {
        rating,
        title,
        comment,
        retainedPhotoIds,
        videoUrl,
        thumbnailUrl,
        removeVideo
      } = req.body || {};

      // Validate rating if provided
      if (rating !== undefined) {
        const numRating = Number(rating);
        if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
          await cleanupUploadedFiles(req.files);
          return res.status(400).json({
            message: "Rating must be a whole number between 1 and 5 stars."
          });
        }
        review.rating = numRating;
      }

      // Validate title if provided
      if (title !== undefined) {
        const cleanTitle = String(title).trim();
        if (!cleanTitle) {
          await cleanupUploadedFiles(req.files);
          return res.status(400).json({
            message: "Review title cannot be empty."
          });
        }
        if (cleanTitle.length > 120) {
          await cleanupUploadedFiles(req.files);
          return res.status(400).json({
            message: "Review title cannot exceed 120 characters."
          });
        }
        review.title = cleanTitle;
      }

      // Validate comment if provided
      if (comment !== undefined) {
        const cleanComment = String(comment).trim();
        if (!cleanComment) {
          await cleanupUploadedFiles(req.files);
          return res.status(400).json({
            message: "Review comment cannot be empty."
          });
        }
        if (cleanComment.length > 2000) {
          await cleanupUploadedFiles(req.files);
          return res.status(400).json({
            message: "Review comment cannot exceed 2000 characters."
          });
        }
        review.comment = cleanComment;
      }

      // Determine which existing photos the customer wishes to retain
      let retainedList = review.photos || [];
      if (retainedPhotoIds !== undefined) {
        let parsedIds = [];
        try {
          parsedIds = typeof retainedPhotoIds === "string"
            ? JSON.parse(retainedPhotoIds)
            : retainedPhotoIds;
          if (!Array.isArray(parsedIds)) parsedIds = [parsedIds];
        } catch (e) {
          parsedIds = String(retainedPhotoIds).split(",").map((s) => s.trim()).filter(Boolean);
        }
        const parsedIdSet = new Set(parsedIds.map(String));

        const kept = [];
        const removed = [];

        for (const p of review.photos || []) {
          const pId = String(p._id);
          const pUrl = String(p.url);
          const pFile = String(p.filename);
          if (parsedIdSet.has(pId) || parsedIdSet.has(pUrl) || parsedIdSet.has(pFile)) {
            kept.push(p);
          } else {
            removed.push(p);
          }
        }

        // Delete unreferenced removed photos from disk
        for (const rem of removed) {
          await deleteReviewPhotoFile(rem.filename);
        }

        retainedList = kept;
      }

      const newPhotoFiles = getPhotoFilesFromReq(req);
      const newVideoFile = getVideoFileFromReq(req);
      const newThumbFile = getThumbnailFileFromReq(req);

      // Check combined photo limit
      if (retainedList.length + newPhotoFiles.length > 5) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({
          message: "A review cannot exceed 5 photos in total."
        });
      }

      // Validate and process newly uploaded photos
      if (newPhotoFiles.length > 0) {
        const { photos: newPhotos, error: photoError } = await processUploadedPhotos(newPhotoFiles);
        if (photoError) {
          return res.status(400).json({ message: photoError });
        }
        review.photos = [...retainedList, ...newPhotos];
      } else {
        review.photos = retainedList;
      }

      // Update customer name to current user name in case user updated profile
      review.customerName = req.user.name;

      const updatedReview = await review.save();

      return res.json({
        message: "Review updated successfully ✨",
        review: updatedReview
      });
    } catch (error) {
      await cleanupUploadedFiles(req.files);
      console.error("Error updating review:", error);
      return res.status(500).json({
        message: "Could not update review. Please try again.",
        error: error.message
      });
    }
  }
);

// ====================================================================
// 4. DELETE /api/reviews/:reviewId
// Delete an existing review and remove its associated photos and video from disk
// Protected (Customer only, owner only)
// ====================================================================
router.delete("/reviews/:reviewId", authenticateCustomer, async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: "Invalid review ID format." });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    // Ownership check: customer can delete only their own review
    if (review.customerId && review.customerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "Access denied. You can only delete your own review."
      });
    }

    // Customer accounts cannot delete video try-on showcases; only administrators can delete video showcases
    if (review.video && review.video.url) {
      return res.status(403).json({
        message: "Customer accounts cannot delete video try-on showcases. Only administrators can delete video showcases."
      });
    }

    // Clean up all review photos from disk
    if (Array.isArray(review.photos) && review.photos.length > 0) {
      for (const p of review.photos) {
        await deleteReviewPhotoFile(p.filename);
      }
    }

    // Clean up video file from disk if present
    if (review.video && review.video.filename) {
      await deleteReviewVideoFile(review.video.filename);
    }

    await Review.findByIdAndDelete(reviewId);

    return res.json({
      message: "Review deleted successfully."
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    return res.status(500).json({
      message: "Could not delete review.",
      error: error.message
    });
  }
});

// ====================================================================
// 5. GET /api/admin/reviews
// Retrieve all reviews with product & customer details for Admin Moderation
// Protected (Admin only, aura_admin_session)
// ====================================================================
router.get("/admin/reviews", requireAdmin, async (req, res) => {
  try {
    const { status, rating, search, hasVideo, isInfluencer } = req.query;

    const filter = {};

    // Filter by status if provided (approved, hidden)
    if (status && ["approved", "hidden"].includes(status.toLowerCase())) {
      filter.status = status.toLowerCase();
    }

    // Filter by rating if provided (1 to 5)
    if (rating && [1, 2, 3, 4, 5].includes(Number(rating))) {
      filter.rating = Number(rating);
    }

    // Filter by video presence
    if (hasVideo === "true") {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { "video.url": { $exists: true, $nin: ["", null] } },
          { videoUrl: { $exists: true, $nin: ["", null] } }
        ]
      });
    }

    // Filter by influencer badge
    if (isInfluencer === "true") {
      filter.isInfluencer = true;
    }

    // Fetch all reviews, populate product and customer info
    const reviews = await Review.find(filter)
      .populate("productId", "title name image images price category sku")
      .populate("customerId", "name email")
      .sort({ createdAt: -1 });

    // Optional text search filter across customerName, review title, comment, or product title
    let filteredReviews = reviews;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredReviews = reviews.filter((r) => {
        const custName = (r.customerName || "").toLowerCase();
        const revTitle = (r.title || "").toLowerCase();
        const revComment = (r.comment || "").toLowerCase();
        const prodTitle = (r.productId?.title || r.productId?.name || "").toLowerCase();
        return (
          custName.includes(q) ||
          revTitle.includes(q) ||
          revComment.includes(q) ||
          prodTitle.includes(q)
        );
      });
    }

    // Overall stats across all reviews in database
    const allReviewsInDb = await Review.find();
    const totalCount = allReviewsInDb.length;
    const approvedReviews = allReviewsInDb.filter((r) => r.status !== "hidden");
    const approvedCount = approvedReviews.length;
    const hiddenCount = allReviewsInDb.filter((r) => r.status === "hidden").length;
    const videoReviewsCount = allReviewsInDb.filter((r) => r.video?.url).length;
    // Calculate average rating strictly from approved reviews
    const avgRating = approvedCount === 0
      ? 0
      : Math.round((approvedReviews.reduce((s, r) => s + r.rating, 0) / approvedCount) * 10) / 10;

    return res.json({
      success: true,
      count: filteredReviews.length,
      reviews: filteredReviews,
      stats: {
        total: totalCount,
        approved: approvedCount,
        hidden: hiddenCount,
        videoCount: videoReviewsCount,
        averageRating: avgRating
      }
    });
  } catch (error) {
    console.error("Error retrieving admin reviews:", error);
    return res.status(500).json({
      message: "Could not retrieve reviews for moderation.",
      error: error.message
    });
  }
});

// ====================================================================
// 6. POST /api/admin/reviews
// Admin creates a review (e.g. Influencer Try-On Video or Customer Spotlight)
// Protected (Admin only, aura_admin_session)
// ====================================================================
router.post(
  "/admin/reviews",
  requireAdmin,
  uploadReviewMedia,
  async (req, res) => {
    try {
      const {
        productId,
        customerName,
        rating,
        title,
        comment,
        isInfluencer,
        influencerHandle,
        isVerifiedPurchase,
        status,
        videoUrl,
        thumbnailUrl
      } = req.body || {};

      if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Valid Product ID is required." });
      }

      const product = await Product.findById(productId);
      if (!product) {
        await cleanupUploadedFiles(req.files);
        return res.status(404).json({ message: "Product not found." });
      }

      const cleanCustomerName = (customerName || "").trim();
      if (!cleanCustomerName) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Reviewer name is required." });
      }

      const numRating = Number(rating);
      if (!rating || !Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Rating must be an integer between 1 and 5." });
      }

      const cleanTitle = (title || "").trim();
      if (!cleanTitle) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Review title is required." });
      }

      const cleanComment = (comment || "").trim();
      if (!cleanComment) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Review comment is required." });
      }

      const photoFiles = getPhotoFilesFromReq(req);
      const videoFile = getVideoFileFromReq(req);
      const thumbFile = getThumbnailFileFromReq(req);

      const { photos: validPhotos, error: photoError } = await processUploadedPhotos(photoFiles);
      if (photoError) {
        return res.status(400).json({ message: photoError });
      }

      const { video: validVideo, error: videoError } = await processUploadedVideo(
        videoFile,
        thumbFile,
        videoUrl,
        thumbnailUrl
      );
      if (videoError) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: videoError });
      }

      const reviewStatus = status && ["approved", "hidden"].includes(status.toLowerCase())
        ? status.toLowerCase()
        : "approved";

      const isInf = isInfluencer === true || isInfluencer === "true";
      const isVer = isVerifiedPurchase === true || isVerifiedPurchase === "true";

      const newReview = new Review({
        productId,
        customerName: cleanCustomerName,
        rating: numRating,
        title: cleanTitle,
        comment: cleanComment,
        status: reviewStatus,
        isInfluencer: isInf,
        influencerHandle: (influencerHandle || "").trim(),
        isVerifiedPurchase: isVer,
        photos: validPhotos,
        video: validVideo
      });

      const savedReview = await newReview.save();
      const populated = await Review.findById(savedReview._id)
        .populate("productId", "title name image images price category sku")
        .populate("customerId", "name email");

      return res.status(201).json({
        message: "Review created successfully ✨",
        review: populated
      });
    } catch (error) {
      await cleanupUploadedFiles(req.files);
      console.error("Error creating review as admin:", error);
      return res.status(500).json({
        message: "Could not create review.",
        error: error.message
      });
    }
  }
);

// ====================================================================
// 7. PUT /api/admin/reviews/:reviewId
// Admin updates any review details, video, photos, status, and influencer flag
// Protected (Admin only, aura_admin_session)
// ====================================================================
router.put(
  "/admin/reviews/:reviewId",
  requireAdmin,
  uploadReviewMedia,
  async (req, res) => {
    try {
      const { reviewId } = req.params;

      if (!mongoose.Types.ObjectId.isValid(reviewId)) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Invalid review ID format." });
      }

      const review = await Review.findById(reviewId);
      if (!review) {
        await cleanupUploadedFiles(req.files);
        return res.status(404).json({ message: "Review not found." });
      }

      const {
        customerName,
        rating,
        title,
        comment,
        productId,
        isInfluencer,
        influencerHandle,
        isVerifiedPurchase,
        status,
        videoUrl,
        thumbnailUrl,
        removeVideo,
        retainedPhotoIds
      } = req.body || {};

      if (productId) {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
          await cleanupUploadedFiles(req.files);
          return res.status(400).json({ message: "Invalid product ID format." });
        }
        const prodExists = await Product.exists({ _id: productId });
        if (!prodExists) {
          await cleanupUploadedFiles(req.files);
          return res.status(404).json({ message: "Selected product does not exist." });
        }
        review.productId = productId;
      }

      if (customerName !== undefined) {
        const cleanName = String(customerName).trim();
        if (cleanName) review.customerName = cleanName;
      }

      if (rating !== undefined) {
        const numRating = Number(rating);
        if (Number.isInteger(numRating) && numRating >= 1 && numRating <= 5) {
          review.rating = numRating;
        }
      }

      if (title !== undefined) {
        const cleanTitle = String(title).trim();
        if (cleanTitle) review.title = cleanTitle;
      }

      if (comment !== undefined) {
        const cleanComment = String(comment).trim();
        if (cleanComment) review.comment = cleanComment;
      }

      if (status !== undefined && ["approved", "hidden"].includes(status.toLowerCase())) {
        review.status = status.toLowerCase();
      }

      if (isInfluencer !== undefined) {
        review.isInfluencer = isInfluencer === true || isInfluencer === "true";
      }

      if (influencerHandle !== undefined) {
        review.influencerHandle = String(influencerHandle).trim();
      }

      if (isVerifiedPurchase !== undefined) {
        review.isVerifiedPurchase = isVerifiedPurchase === true || isVerifiedPurchase === "true";
      }

      // Handle retained photos
      let retainedList = review.photos || [];
      if (retainedPhotoIds !== undefined) {
        let parsedIds = [];
        try {
          parsedIds = typeof retainedPhotoIds === "string"
            ? JSON.parse(retainedPhotoIds)
            : retainedPhotoIds;
          if (!Array.isArray(parsedIds)) parsedIds = [parsedIds];
        } catch (e) {
          parsedIds = String(retainedPhotoIds).split(",").map((s) => s.trim()).filter(Boolean);
        }
        const parsedIdSet = new Set(parsedIds.map(String));

        const kept = [];
        const removed = [];

        for (const p of review.photos || []) {
          const pId = String(p._id);
          const pUrl = String(p.url);
          const pFile = String(p.filename);
          if (parsedIdSet.has(pId) || parsedIdSet.has(pUrl) || parsedIdSet.has(pFile)) {
            kept.push(p);
          } else {
            removed.push(p);
          }
        }

        for (const rem of removed) {
          await deleteReviewPhotoFile(rem.filename);
        }

        retainedList = kept;
      }

      const newPhotoFiles = getPhotoFilesFromReq(req);
      const newVideoFile = getVideoFileFromReq(req);
      const newThumbFile = getThumbnailFileFromReq(req);

      if (newPhotoFiles.length > 0) {
        const { photos: newPhotos, error: photoError } = await processUploadedPhotos(newPhotoFiles);
        if (photoError) {
          return res.status(400).json({ message: photoError });
        }
        review.photos = [...retainedList, ...newPhotos];
      } else if (retainedPhotoIds !== undefined) {
        review.photos = retainedList;
      }

      // Handle video changes
      if (removeVideo === "true" || removeVideo === true) {
        if (review.video?.filename) {
          await deleteReviewVideoFile(review.video.filename);
        }
        review.video = {
          url: "",
          thumbnailUrl: "",
          filename: "",
          originalName: "",
          mimeType: "",
          size: 0,
          duration: 0,
          aspectRatio: "9:16"
        };
      } else if (newVideoFile || videoUrl !== undefined || newThumbFile || thumbnailUrl !== undefined) {
        if (newVideoFile && review.video?.filename) {
          await deleteReviewVideoFile(review.video.filename);
        }

        const effectiveVideoUrl = videoUrl !== undefined ? videoUrl : (review.video ? review.video.url : "");
        const effectiveThumbUrl = thumbnailUrl !== undefined ? thumbnailUrl : (review.video ? review.video.thumbnailUrl : "");

        const { video: updatedVideo, error: videoError } = await processUploadedVideo(
          newVideoFile,
          newThumbFile,
          effectiveVideoUrl,
          effectiveThumbUrl
        );
        if (videoError) {
          await cleanupUploadedFiles(req.files);
          return res.status(400).json({ message: videoError });
        }
        review.video = updatedVideo;
      }

      const savedReview = await review.save();
      const populated = await Review.findById(savedReview._id)
        .populate("productId", "title name image images price category sku")
        .populate("customerId", "name email");

      return res.json({
        message: "Review updated successfully ✨",
        review: populated
      });
    } catch (error) {
      await cleanupUploadedFiles(req.files);
      console.error("Error updating review as admin:", error);
      return res.status(500).json({
        message: "Could not update review.",
        error: error.message
      });
    }
  }
);

// ====================================================================
// 8. PUT /api/admin/reviews/:reviewId/status
// Moderate review status (approve or hide)
// Protected (Admin only, aura_admin_session)
// ====================================================================
router.put("/admin/reviews/:reviewId/status", requireAdmin, async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: "Invalid review ID format." });
    }

    if (!status || !["approved", "hidden"].includes(status.toLowerCase())) {
      return res.status(400).json({
        message: "Invalid review status. Status must be either 'approved' or 'hidden'."
      });
    }

    const review = await Review.findById(reviewId)
      .populate("productId", "title name image images price category sku")
      .populate("customerId", "name email");

    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    const previousStatus = review.status;
    review.status = status.toLowerCase();
    const updatedReview = await review.save();

    return res.json({
      message: `Review successfully updated from '${previousStatus}' to '${review.status}'.`,
      review: updatedReview
    });
  } catch (error) {
    console.error("Error moderating review status:", error);
    return res.status(500).json({
      message: "Could not update review status.",
      error: error.message
    });
  }
});

// ====================================================================
// 9. DELETE /api/admin/reviews/:reviewId
// Permanently delete a review from MongoDB and remove associated files
// Protected (Admin only, aura_admin_session)
// ====================================================================
router.delete("/admin/reviews/:reviewId", requireAdmin, async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(reviewId)) {
      return res.status(400).json({ message: "Invalid review ID format." });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Review not found." });
    }

    // Clean up all review photos from disk
    if (Array.isArray(review.photos) && review.photos.length > 0) {
      for (const p of review.photos) {
        await deleteReviewPhotoFile(p.filename);
      }
    }

    // Clean up video file from disk
    if (review.video && review.video.filename) {
      await deleteReviewVideoFile(review.video.filename);
    }

    await Review.findByIdAndDelete(reviewId);

    return res.json({
      message: "Review permanently deleted from database.",
      deletedId: reviewId
    });
  } catch (error) {
    console.error("Error deleting review as admin:", error);
    return res.status(500).json({
      message: "Could not delete review.",
      error: error.message
    });
  }
});

// ====================================================================
// 10. PRODUCT SHOWCASE / TRY-ON VIDEOS ENDPOINTS
// ====================================================================

/**
 * @route   GET /api/videos (and /api/try-on-videos)
 * @desc    Public storefront retrieval of approved product try-on showcase videos
 * @access  Public (Storefront customer homepage & PDP)
 */
const getPublicTryOnVideos = async (req, res) => {
  try {
    const { productId, limit = 50 } = req.query;
    const filter = {
      status: "approved",
      "video.url": { $exists: true, $ne: "" }
    };

    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      filter.productId = new mongoose.Types.ObjectId(productId);
    }

    const videos = await Review.find(filter)
      .populate("productId", "name title price mrp image images category description stock sizes")
      .sort({ createdAt: -1 })
      .limit(Number(limit) || 50);

    // Filter out orphaned reviews where product was deleted
    const validVideos = videos.filter((v) => v.productId != null);

    return res.json({
      count: validVideos.length,
      videos: validVideos
    });
  } catch (error) {
    console.error("Error retrieving try-on videos:", error);
    return res.status(500).json({
      message: "Could not retrieve try-on videos.",
      error: error.message
    });
  }
};

router.get("/videos", getPublicTryOnVideos);
router.get("/try-on-videos", getPublicTryOnVideos);

/**
 * @route   GET /api/admin/videos
 * @desc    Retrieve all try-on videos (approved & hidden) for admin catalog management
 * @access  Protected (Admin only)
 */
router.get("/admin/videos", requireAdmin, async (req, res) => {
  try {
    const videos = await Review.find({
      "video.url": { $exists: true, $ne: "" }
    })
      .populate("productId", "name title price mrp image images category description stock")
      .sort({ createdAt: -1 });

    return res.json({
      count: videos.length,
      videos
    });
  } catch (error) {
    console.error("Error retrieving admin videos:", error);
    return res.status(500).json({
      message: "Could not retrieve admin videos.",
      error: error.message
    });
  }
});

/**
 * @route   POST /api/admin/videos
 * @desc    Upload or add a genuine product showcase try-on video
 * @access  Protected (Admin only)
 */
router.post(
  "/admin/videos",
  requireAdmin,
  uploadReviewMedia,
  async (req, res) => {
    try {
      const {
        productId,
        displayName,
        customerName,
        title,
        comment,
        rating,
        isInfluencer,
        influencerHandle,
        status,
        videoUrl,
        thumbnailUrl
      } = req.body || {};

      if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "A valid product selection from MongoDB is required." });
      }

      const product = await Product.findById(productId);
      if (!product) {
        await cleanupUploadedFiles(req.files);
        return res.status(404).json({ message: "Selected product does not exist in the database." });
      }

      const name = (displayName || customerName || "").trim();
      if (!name) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Display name or creator name is required." });
      }

      const videoFile = getVideoFileFromReq(req);
      const thumbFile = getThumbnailFileFromReq(req);

      if (!videoFile && (!videoUrl || typeof videoUrl !== "string" || !videoUrl.trim())) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Please upload a video file or provide a valid video URL." });
      }

      const { video: validVideo, error: videoError } = await processUploadedVideo(
        videoFile,
        thumbFile,
        videoUrl,
        thumbnailUrl
      );
      if (videoError || !validVideo || !validVideo.url) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: videoError || "Invalid video file or URL provided." });
      }

      const numRating = rating ? Number(rating) : 5;
      const cleanRating = Number.isInteger(numRating) && numRating >= 1 && numRating <= 5 ? numRating : 5;
      const cleanTitle = (title || "").trim() || `${name} Try-On Showcase`;
      const cleanComment = (comment || "").trim() || `Authentic showcase video highlighting drape, fit, and styling for ${product.name || product.title}.`;
      const videoStatus = status && ["approved", "hidden"].includes(status.toLowerCase()) ? status.toLowerCase() : "approved";
      const isInf = isInfluencer === true || isInfluencer === "true";

      const newVideoDoc = new Review({
        productId,
        customerName: name,
        rating: cleanRating,
        title: cleanTitle,
        comment: cleanComment,
        status: videoStatus,
        isInfluencer: isInf,
        influencerHandle: (influencerHandle || "").trim(),
        isVerifiedPurchase: true,
        video: validVideo
      });

      const saved = await newVideoDoc.save();
      const populated = await Review.findById(saved._id).populate("productId", "name title price mrp image images category");

      return res.status(201).json({
        message: "Try-On showcase video added successfully ✨",
        video: populated
      });
    } catch (error) {
      await cleanupUploadedFiles(req.files);
      console.error("Error creating video as admin:", error);
      return res.status(500).json({
        message: "Could not create video showcase.",
        error: error.message
      });
    }
  }
);

/**
 * @route   PUT /api/admin/videos/:id
 * @desc    Edit video details or replace showcase video
 * @access  Protected (Admin only)
 */
router.put(
  "/admin/videos/:id",
  requireAdmin,
  uploadReviewMedia,
  async (req, res) => {
    try {
      const videoId = req.params.id;
      if (!mongoose.Types.ObjectId.isValid(videoId)) {
        await cleanupUploadedFiles(req.files);
        return res.status(400).json({ message: "Invalid video ID format." });
      }

      const existing = await Review.findById(videoId);
      if (!existing) {
        await cleanupUploadedFiles(req.files);
        return res.status(404).json({ message: "Video not found." });
      }

      const {
        productId,
        displayName,
        customerName,
        title,
        comment,
        rating,
        status,
        isInfluencer,
        influencerHandle,
        videoUrl,
        thumbnailUrl
      } = req.body || {};

      if (productId) {
        if (!mongoose.Types.ObjectId.isValid(productId)) {
          await cleanupUploadedFiles(req.files);
          return res.status(400).json({ message: "Invalid product ID format." });
        }
        const prodExists = await Product.exists({ _id: productId });
        if (!prodExists) {
          await cleanupUploadedFiles(req.files);
          return res.status(404).json({ message: "Selected product does not exist." });
        }
        existing.productId = productId;
      }

      if (displayName !== undefined || customerName !== undefined) {
        const name = (displayName !== undefined ? displayName : customerName).trim();
        if (name) existing.customerName = name;
      }
      if (title !== undefined && title.trim()) existing.title = title.trim();
      if (comment !== undefined && comment.trim()) existing.comment = comment.trim();
      if (rating !== undefined) {
        const numR = Number(rating);
        if (Number.isInteger(numR) && numR >= 1 && numR <= 5) existing.rating = numR;
      }
      if (status !== undefined && ["approved", "hidden"].includes(status.toLowerCase())) {
        existing.status = status.toLowerCase();
      }
      if (isInfluencer !== undefined) {
        existing.isInfluencer = isInfluencer === true || isInfluencer === "true";
      }
      if (influencerHandle !== undefined) {
        existing.influencerHandle = (influencerHandle || "").trim();
      }

      const newVideoFile = getVideoFileFromReq(req);
      const newThumbFile = getThumbnailFileFromReq(req);

      if (newVideoFile || newThumbFile || videoUrl !== undefined || thumbnailUrl !== undefined) {
        const effVideoUrl = videoUrl !== undefined ? videoUrl : (existing.video ? existing.video.url : "");
        const effThumbUrl = thumbnailUrl !== undefined ? thumbnailUrl : (existing.video ? existing.video.thumbnailUrl : "");

        const { video: updatedVideo, error: videoError } = await processUploadedVideo(
          newVideoFile,
          newThumbFile,
          effVideoUrl,
          effThumbUrl
        );
        if (videoError) {
          await cleanupUploadedFiles(req.files);
          return res.status(400).json({ message: videoError });
        }
        if (newVideoFile && existing.video?.filename && existing.video.filename !== updatedVideo.filename) {
          await deleteReviewVideoFile(existing.video.filename);
        }
        existing.video = updatedVideo;
      }

      const saved = await existing.save();
      const populated = await Review.findById(saved._id).populate("productId", "name title price mrp image images category");

      return res.json({
        message: "Video showcase updated successfully ✨",
        video: populated
      });
    } catch (error) {
      await cleanupUploadedFiles(req.files);
      console.error("Error updating video as admin:", error);
      return res.status(500).json({
        message: "Could not update video.",
        error: error.message
      });
    }
  }
);

/**
 * @route   DELETE /api/admin/videos/:id
 * @desc    Delete a showcase video
 * @access  Protected (Admin only)
 */
router.delete("/admin/videos/:id", requireAdmin, async (req, res) => {
  try {
    const videoId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(videoId)) {
      return res.status(400).json({ message: "Invalid video ID format." });
    }

    const existing = await Review.findById(videoId);
    if (!existing) {
      return res.status(404).json({ message: "Video not found." });
    }

    if (existing.video && existing.video.filename) {
      await deleteReviewVideoFile(existing.video.filename);
    }

    await Review.findByIdAndDelete(videoId);

    return res.json({
      message: "Video deleted successfully.",
      deletedId: videoId
    });
  } catch (error) {
    console.error("Error deleting video as admin:", error);
    return res.status(500).json({
      message: "Could not delete video.",
      error: error.message
    });
  }
});

module.exports = router;
