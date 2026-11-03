import { Router } from "express";
import crypto from "node:crypto";
import { uploadImageBuffer } from "../config/cloudinary.js";
import { isAdminRequest, requireAdmin } from "../middleware/adminAuth.js";
import { Product } from "../models/Product.js";
import { Review } from "../models/Review.js";

// - GET    /api/reviews?productId=...   approved reviews (admin: all, optional ?status=)
// - POST   /api/reviews                 a customer submits a review (starts pending)
// - PATCH  /api/reviews/:id             admin approves / rejects
// - DELETE /api/reviews/:id             admin deletes
const router = Router();

const PUBLIC_FIELDS = "id productId name rating comment photoUrl createdAt";
const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

// Light spam guard: a few reviews per visitor per hour.
const SUBMISSIONS_PER_HOUR = 5;
const submissions = new Map();
function tooManySubmissions(ip) {
  const now = Date.now();
  const recent = (submissions.get(ip) || []).filter((time) => now - time < 60 * 60 * 1000);
  if (recent.length >= SUBMISSIONS_PER_HOUR) return true;
  submissions.set(ip, [...recent, now]);
  return false;
}

// The product's rating is the average of its approved reviews.
async function refreshProductRating(productId) {
  const [summary] = await Review.aggregate([
    { $match: { productId, status: "approved" } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const ratings = summary
    ? { average: Math.round(summary.average * 10) / 10, count: summary.count }
    : { average: 0, count: 0 };
  await Product.updateOne({ id: productId }, { $set: { ratings } });
}

router.get("/", async (req, res, next) => {
  try {
    if (isAdminRequest(req)) {
      const filter = {};
      if (req.query.status) filter.status = String(req.query.status);
      if (req.query.productId) filter.productId = String(req.query.productId);
      res.set("Cache-Control", "no-store");
      return res.json(await Review.find(filter).sort({ createdAt: -1 }).limit(500));
    }

    const productId = String(req.query.productId || "");
    if (!productId) return res.status(400).json({ message: "productId is required" });
    const reviews = await Review.find({ productId, status: "approved" }, PUBLIC_FIELDS)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.set("Cache-Control", "public, max-age=60");
    res.json(reviews.map(({ _id, ...review }) => review));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { productId, name, email, comment, photoDataUrl } = req.body || {};
    const rating = Number(req.body?.rating);

    const product = productId ? await Product.findOne({ id: String(productId) }, "id name").lean() : null;
    if (!product) return res.status(400).json({ message: "This poster couldn't be found" });
    if (!String(name || "").trim()) return res.status(400).json({ message: "Add your name" });
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Pick a rating from 1 to 5 stars" });
    }
    if (String(comment || "").trim().length < 5) {
      return res.status(400).json({ message: "Write a few words about the poster" });
    }
    if (photoDataUrl) {
      const isImage = /^data:image\/(jpeg|png|webp|heic|heif);base64,/.test(photoDataUrl);
      const bytes = Math.floor((String(photoDataUrl).length * 3) / 4);
      if (!isImage) return res.status(400).json({ message: "The photo must be a JPG, PNG or WebP image" });
      if (bytes > MAX_PHOTO_BYTES) return res.status(400).json({ message: "The photo is too large (max 4 MB)" });
    }
    if (tooManySubmissions(req.ip)) {
      return res.status(429).json({ message: "Too many reviews from this device. Please try again later." });
    }

    await Review.create({
      id: `rev-${crypto.randomUUID()}`,
      productId: product.id,
      productName: product.name,
      name: String(name).trim().slice(0, 60),
      email: String(email || "").trim().slice(0, 120) || undefined,
      rating,
      comment: String(comment).trim().slice(0, 1500),
      photoDataUrl: photoDataUrl || undefined,
    });
    res.status(201).json({ message: "Thanks! Your review will appear once we've checked it." });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAdmin, async (req, res, next) => {
  try {
    const review = await Review.findOne({ id: req.params.id });
    if (!review) return res.status(404).json({ message: "review not found" });

    const { status } = req.body || {};
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "status must be pending, approved or rejected" });
    }

    if (status === "approved" && review.photoDataUrl && !review.photoUrl) {
      const base64 = review.photoDataUrl.slice(review.photoDataUrl.indexOf(",") + 1);
      const uploaded = await uploadImageBuffer(Buffer.from(base64, "base64"), "postertown/reviews");
      review.photoUrl = uploaded.secure_url;
      review.photoDataUrl = undefined;
    }
    review.status = status;
    review.approvedAt = status === "approved" ? new Date() : undefined;
    await review.save();
    await refreshProductRating(review.productId);
    res.json(review.toJSON());
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const review = await Review.findOneAndDelete({ id: req.params.id });
    if (!review) return res.status(404).json({ message: "review not found" });
    await refreshProductRating(review.productId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default router;
