import { Product } from "../models/Product.js";
import { Review } from "../models/Review.js";

// Only a delivered order lets the customer review what was in it.
export const REVIEWABLE_ORDER_STATUS = "completed";
// Once an order is on its way back (or was never kept), its reviews come down.
export const RETURNED_ORDER_STATUSES = ["return_requested", "return_processing", "return_in_transit", "refunded", "cancelled"];

// The product's rating is the average of its approved reviews.
export async function refreshProductRating(productId) {
  const [summary] = await Review.aggregate([
    { $match: { productId, status: "approved" } },
    { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
  ]);
  const ratings = summary
    ? { average: Math.round(summary.average * 10) / 10, count: summary.count }
    : { average: 0, count: 0 };
  await Product.updateOne({ id: productId }, { $set: { ratings } });
}

// Hides every review written from this order (the poster was returned).
export async function hideReviewsForOrder(orderId) {
  const reviews = await Review.find({ orderId, status: { $ne: "rejected" } }, "productId").lean();
  if (!reviews.length) return;
  await Review.updateMany({ orderId }, { $set: { status: "rejected", hiddenReason: "order_returned" } });
  await Promise.all([...new Set(reviews.map((review) => review.productId))].map(refreshProductRating));
}
