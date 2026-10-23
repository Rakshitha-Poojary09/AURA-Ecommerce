const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Absolute paths to upload directories
const REVIEWS_UPLOAD_DIR = path.resolve(__dirname, "../uploads/reviews");
const REVIEWS_VIDEOS_DIR = path.resolve(__dirname, "../uploads/reviews/videos");

// Ensure upload directories exist
if (!fs.existsSync(REVIEWS_UPLOAD_DIR)) {
  fs.mkdirSync(REVIEWS_UPLOAD_DIR, { recursive: true });
}
if (!fs.existsSync(REVIEWS_VIDEOS_DIR)) {
  fs.mkdirSync(REVIEWS_VIDEOS_DIR, { recursive: true });
}

// Allowed MIME types & extensions for images
const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp"
]);

const ALLOWED_IMAGE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp"
]);

// Allowed MIME types & extensions for videos
const ALLOWED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v"
]);

const ALLOWED_VIDEO_EXTS = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".m4v"
]);

// 1. Configure Multer Disk Storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === "video") {
      cb(null, REVIEWS_VIDEOS_DIR);
    } else {
      cb(null, REVIEWS_UPLOAD_DIR);
    }
  },
  filename: (req, file, cb) => {
    const rawExt = path.extname(file.originalname || "").toLowerCase();
    const isVideo = file.fieldname === "video";

    let ext = isVideo ? ".mp4" : ".jpg";
    if (isVideo && ALLOWED_VIDEO_EXTS.has(rawExt)) {
      ext = rawExt;
    } else if (!isVideo && ALLOWED_IMAGE_EXTS.has(rawExt)) {
      ext = rawExt;
    }

    const prefix = isVideo ? "rev-vid-" : "rev-";
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    const safeFilename = `${prefix}${uniqueSuffix}${ext}`;
    cb(null, safeFilename);
  }
});

// 2. File Filter for Images and Videos
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || "").toLowerCase();
  const mime = (file.mimetype || "").toLowerCase();

  if (file.fieldname === "video") {
    if (!ALLOWED_VIDEO_MIMES.has(mime) && !ALLOWED_VIDEO_EXTS.has(ext)) {
      const error = new Error("Unsupported video format. Only MP4, WebM, and MOV vertical fashion videos are permitted.");
      error.code = "INVALID_FILE_TYPE";
      return cb(error, false);
    }
    return cb(null, true);
  }

  // Photos or Thumbnail
  if (!ALLOWED_IMAGE_MIMES.has(mime) && !ALLOWED_IMAGE_EXTS.has(ext)) {
    const error = new Error("Unsupported image format. Only JPG, JPEG, PNG, and WebP images are allowed.");
    error.code = "INVALID_FILE_TYPE";
    return cb(error, false);
  }
  cb(null, true);
};

// 3. Multer Instance (50MB video, 5MB photo)
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 60 * 1024 * 1024 // 60 MB maximum to accommodate 9:16 vertical video reviews
  }
});

/**
 * Deep Image Content Inspection: Verify Magic Bytes
 */
async function verifyImageMagicBytes(filePath) {
  let fileHandle = null;
  try {
    fileHandle = await fs.promises.open(filePath, "r");
    const buffer = Buffer.alloc(16);
    const { bytesRead } = await fileHandle.read(buffer, 0, 16, 0);

    if (bytesRead < 12) return null;

    // JPEG / JPG: 0xFF 0xD8 0xFF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return { mime: "image/jpeg", ext: "jpg" };
    }

    // PNG: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return { mime: "image/png", ext: "png" };
    }

    // WebP: RIFF ... WEBP
    if (
      buffer[0] === 0x52 &&
      buffer[1] === 0x49 &&
      buffer[2] === 0x46 &&
      buffer[3] === 0x46 &&
      buffer[8] === 0x57 &&
      buffer[9] === 0x45 &&
      buffer[10] === 0x42 &&
      buffer[11] === 0x50
    ) {
      return { mime: "image/webp", ext: "webp" };
    }

    return null;
  } catch (err) {
    console.error("Error checking image magic bytes:", err);
    return null;
  } finally {
    if (fileHandle) {
      await fileHandle.close().catch(() => {});
    }
  }
}

/**
 * Deep Video Content Inspection: Verify Magic Bytes
 */
async function verifyVideoMagicBytes(filePath) {
  let fileHandle = null;
  try {
    fileHandle = await fs.promises.open(filePath, "r");
    const buffer = Buffer.alloc(32);
    const { bytesRead } = await fileHandle.read(buffer, 0, 32, 0);

    if (bytesRead < 8) return null;

    // MP4 / QuickTime: bytes 4-7 are 'ftyp', 'moov', 'mdat' or 'wide'
    const atomType = buffer.toString("latin1", 4, 8);
    if (["ftyp", "moov", "mdat", "wide"].includes(atomType)) {
      return { mime: "video/mp4", ext: "mp4" };
    }

    // WebM: begins with EBML ID 0x1A 0x45 0xDF 0xA3
    if (
      buffer[0] === 0x1a &&
      buffer[1] === 0x45 &&
      buffer[2] === 0xdf &&
      buffer[3] === 0xa3
    ) {
      return { mime: "video/webm", ext: "webm" };
    }

    // Also check first 4 bytes for standard container identifiers
    const firstFour = buffer.toString("latin1", 0, 4);
    if (firstFour === "RIFF" || firstFour === "webm") {
      return { mime: "video/webm", ext: "webm" };
    }

    return null;
  } catch (err) {
    console.error("Error checking video magic bytes:", err);
    return null;
  } finally {
    if (fileHandle) {
      await fileHandle.close().catch(() => {});
    }
  }
}

/**
 * Safely delete a photo file from disk by filename or path
 */
async function deleteReviewPhotoFile(filenameOrPath) {
  if (!filenameOrPath) return;
  try {
    const rawName = typeof filenameOrPath === "string" ? filenameOrPath : filenameOrPath.filename;
    if (!rawName) return;

    const baseName = path.basename(rawName);
    const targetPath = path.resolve(REVIEWS_UPLOAD_DIR, baseName);

    if (!targetPath.startsWith(REVIEWS_UPLOAD_DIR)) {
      console.warn("Path traversal attempt prevented for file:", rawName);
      return;
    }

    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
  } catch (err) {
    console.error("Failed to delete review photo file:", err);
  }
}

/**
 * Safely delete a video file from disk by filename or path
 */
async function deleteReviewVideoFile(filenameOrPath) {
  if (!filenameOrPath) return;
  try {
    const rawName = typeof filenameOrPath === "string" ? filenameOrPath : filenameOrPath.filename;
    if (!rawName) return;

    const baseName = path.basename(rawName);
    const targetPath = path.resolve(REVIEWS_VIDEOS_DIR, baseName);

    if (!targetPath.startsWith(REVIEWS_VIDEOS_DIR)) {
      console.warn("Path traversal attempt prevented for video file:", rawName);
      return;
    }

    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath);
    }
  } catch (err) {
    console.error("Failed to delete review video file:", err);
  }
}

/**
 * Clean up an array or object of uploaded files (used on validation or creation failures)
 */
async function cleanupUploadedFiles(files) {
  if (!files) return;

  let fileList = [];
  if (Array.isArray(files)) {
    fileList = files;
  } else if (typeof files === "object") {
    // files object from upload.fields()
    Object.values(files).forEach((item) => {
      if (Array.isArray(item)) {
        fileList.push(...item);
      } else if (item && item.path) {
        fileList.push(item);
      }
    });
  }

  for (const file of fileList) {
    if (!file) continue;
    try {
      const filePath = file.path;
      if (filePath && fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (err) {
      console.error("Failed to cleanup uploaded file:", err);
    }
  }
}

/**
 * Express Middleware Wrapper for Multer Media (Photos + Videos + Thumbnail)
 */
function uploadReviewMedia(req, res, next) {
  const contentType = req.headers["content-type"] || "";
  if (!contentType.includes("multipart/form-data")) {
    return next();
  }

  const handler = upload.fields([
    { name: "photos", maxCount: 5 },
    { name: "video", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 }
  ]);

  handler(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: "File exceeds size limit. Photos must be under 5MB and videos under 60MB."
          });
        }
        if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            message: "Maximum 5 photos and 1 fashion try-on video allowed per review."
          });
        }
        return res.status(400).json({
          message: `Upload error: ${err.message}`
        });
      }
      if (err.code === "INVALID_FILE_TYPE") {
        return res.status(400).json({
          message: err.message
        });
      }
      return res.status(400).json({
        message: err.message || "Failed to process uploaded media files."
      });
    }

    // Normalization helper:
    // If req.files is an object from upload.fields, expose convenient accessors
    if (req.files) {
      req.photoFiles = req.files.photos || [];
      req.videoFile = req.files.video && req.files.video[0] ? req.files.video[0] : null;
      req.thumbnailFile = req.files.thumbnail && req.files.thumbnail[0] ? req.files.thumbnail[0] : null;
    } else {
      req.photoFiles = [];
      req.videoFile = null;
      req.thumbnailFile = null;
    }

    next();
  });
}

module.exports = {
  REVIEWS_UPLOAD_DIR,
  REVIEWS_VIDEOS_DIR,
  uploadReviewPhotos: uploadReviewMedia,
  uploadReviewMedia,
  verifyImageMagicBytes,
  verifyVideoMagicBytes,
  deleteReviewPhotoFile,
  deleteReviewVideoFile,
  cleanupUploadedFiles
};
