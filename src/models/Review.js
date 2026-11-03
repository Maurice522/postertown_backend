import mongoose from "mongoose";

// A customer review of one poster. New reviews wait as "pending" until the admin
// approves them; only approved ones are public and count towards the product's rating.
const reviewSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    productId: { type: String, required: true, index: true },
    productName: String,
    // The delivered order this review comes from: only buyers can review.
    orderId: { type: String, required: true, index: true },
    userId: String,
    // "order_returned" when it was hidden because the order was returned.
    hiddenReason: String,
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // Private: lets the admin contact the reviewer. Never sent to the storefront.
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1500 },
    // A customer's photo of the poster on their wall. Kept here until approval, then
    // uploaded to Cloudinary (photoUrl) so unapproved uploads never reach the CDN.
    photoDataUrl: String,
    photoUrl: String,
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending", index: true },
    approvedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// One review per poster per order.
reviewSchema.index({ orderId: 1, productId: 1 }, { unique: true });

export const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
