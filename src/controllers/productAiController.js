import multer from "multer";
import { uploadImageBuffer } from "../config/cloudinary.js";
import { Product } from "../models/Product.js";
import { buildProductDraft, describePosterImage } from "../utils/geminiProductDraft.js";

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

// Series and character names already in the catalog, so new drafts reuse the same
// spelling and storefront filters stay grouped.
async function catalogVocabulary() {
  try {
    const [series, characters] = await Promise.all([
      Product.distinct("filterableAttributes.animeSeries"),
      Product.distinct("filterableAttributes.character")
    ]);
    const tidy = (values) => values.filter((value) => typeof value === "string" && value.trim()).slice(0, 80);
    return { series: tidy(series), characters: tidy(characters) };
  } catch {
    return {};
  }
}

export async function createProductDraft(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Product image is required" });
    }

    // Describe the image first so a Gemini failure doesn't leave an orphaned upload
    // in Cloudinary.
    const ai = await describePosterImage({
      imageBuffer: req.file.buffer,
      mimeType: req.file.mimetype,
      vocabulary: await catalogVocabulary()
    });

    const upload = await uploadImageBuffer(req.file.buffer, "postertown/products");
    const draft = buildProductDraft(ai, {
      url: upload.secure_url,
      cloudinary: {
        url: upload.secure_url,
        publicId: upload.public_id,
        width: upload.width,
        height: upload.height,
        format: upload.format
      }
    });

    res.status(201).json(draft);
  } catch (error) {
    next(error);
  }
}
