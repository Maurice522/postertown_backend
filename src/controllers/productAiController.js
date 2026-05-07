import multer from "multer";
import { uploadImageBuffer } from "../config/cloudinary.js";
import { createProductDraftFromImage } from "../utils/geminiProductDraft.js";

const storage = multer.memoryStorage();

export const uploadDraftImage = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Only image files are allowed"));
      return;
    }

    cb(null, true);
  }
}).single("image");

export async function createProductDraft(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Product image is required" });
    }

    const upload = await uploadImageBuffer(req.file.buffer, "postertown/products");
    const draft = await createProductDraftFromImage({
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      media: {
        url: upload.secure_url,
        cloudinary: {
          url: upload.secure_url,
          publicId: upload.public_id,
          width: upload.width,
          height: upload.height,
          format: upload.format
        }
      }
    });

    res.status(201).json(draft);
  } catch (error) {
    next(error);
  }
}
