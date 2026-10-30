import multer from "multer";
import { uploadImageBuffer } from "../config/cloudinary.js";
import { assignCollections, sanitizeCollections } from "../utils/collections.js";

const storage = multer.memoryStorage();

export const uploadProductImages = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 10
  },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }

    cb(null, true);
  }
}).array("images", 10);

function parseJsonLike(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed || !["{", "["].includes(trimmed[0])) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export async function attachProductImages(req, res, next) {
  try {
    const imageLabels = parseJsonLike(req.body.imageLabels);
    delete req.body.imageLabels;

    if (req.body.product || req.body.data) {
      const parsed = parseJsonLike(req.body.product ?? req.body.data);
      req.body = typeof parsed === "object" && parsed !== null ? { ...parsed } : req.body;
    } else {
      req.body = Object.fromEntries(
        Object.entries(req.body).map(([key, value]) => [key, parseJsonLike(value)])
      );
    }

    // Every saved product gets its collections: the admin's choice when sent,
    // otherwise the keyword/category rules (e.g. products added without Gemini).
    if (req.body.name || req.body.category) {
      req.body.collections = Array.isArray(req.body.collections)
        ? sanitizeCollections(req.body.collections)
        : assignCollections(req.body);
    }

    if (!req.files?.length) {
      next();
      return;
    }

    const uploads = await Promise.all(
      req.files.map((file) => uploadImageBuffer(file.buffer, "postertown/products"))
    );
    const imageUrls = uploads.map((upload) => upload.secure_url);
    const cloudinaryImages = uploads.map((upload) => ({
      url: upload.secure_url,
      publicId: upload.public_id,
      width: upload.width,
      height: upload.height,
      format: upload.format
    }));

    req.body.media = {
      ...(req.body.media ?? {}),
      featuredImage: req.body.media?.featuredImage ?? imageUrls[0],
      thumbnail: req.body.media?.thumbnail ?? imageUrls[0],
      gallery: [...(req.body.media?.gallery ?? []), ...imageUrls],
      cloudinary: [...(req.body.media?.cloudinary ?? []), ...cloudinaryImages]
    };

    // Captions for generated mockups ("Room wall", "Held in hand", ...). Stored as
    // { url, label } pairs because URLs can't be used as Mongo keys.
    if (Array.isArray(imageLabels)) {
      const added = imageUrls
        .map((url, index) => ({ url, label: String(imageLabels[index] ?? "").trim().slice(0, 40) }))
        .filter((entry) => entry.label);
      if (added.length) {
        const existing = Array.isArray(req.body.media.galleryLabels) ? req.body.media.galleryLabels : [];
        req.body.media.galleryLabels = [...existing, ...added];
      }
    }

    next();
  } catch (error) {
    next(error);
  }
}
