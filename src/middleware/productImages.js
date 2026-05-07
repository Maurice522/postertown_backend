import multer from "multer";
import { uploadImageBuffer } from "../config/cloudinary.js";

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
    if (req.body.product || req.body.data) {
      const parsed = parseJsonLike(req.body.product ?? req.body.data);
      req.body = typeof parsed === "object" && parsed !== null ? { ...parsed } : req.body;
    } else {
      req.body = Object.fromEntries(
        Object.entries(req.body).map(([key, value]) => [key, parseJsonLike(value)])
      );
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

    next();
  } catch (error) {
    next(error);
  }
}
