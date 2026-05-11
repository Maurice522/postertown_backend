import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    id: String,
    productId: String,
    name: { type: String, required: true },
    subtitle: String,
    category: String,
    color: String,
    size: String,
    amount: { type: Number, default: 1 },
    image: mongoose.Schema.Types.Mixed,
    price: { type: Number, default: 0 },
    originalPrice: Number,
    badges: [mongoose.Schema.Types.Mixed],
    rating: Number,
    max: Number,
  },
  { _id: false, strict: false }
);

const orderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    isGuest: { type: Boolean, default: false, index: true },
    status: { type: String, default: "payment_verification", index: true },
    statusLabel: { type: String, default: "Payment Verification" },
    customer: {
      name: { type: String, default: "" },
      email: { type: String, default: "", index: true },
      phone: { type: String, default: "" },
    },
    shipping: {
      fullName: String,
      phone: String,
      addressLine1: String,
      addressLine2: String,
      city: String,
      state: String,
      pincode: String,
      recipient: String,
      destination: String,
    },
    payment: {
      method: { type: String, default: "UPI" },
      receiverUpiId: String,
      transactionId: { type: String, default: "", index: true },
      screenshotName: String,
      screenshotDataUrl: String,
      note: String,
      payerName: String,
    },
    items: { type: [orderItemSchema], default: [] },
    totals: {
      subtotalExGst: { type: Number, default: 0 },
      gst: { type: Number, default: 0 },
      subtotal: { type: Number, default: 0 },
      shipping: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
    notifications: {
      email: Boolean,
      phone: Boolean,
    },
    actions: {
      cancellable: { type: Boolean, default: true },
      refundable: { type: Boolean, default: true },
    },
    source: {
      channel: { type: String, default: "web" },
      storage: String,
    },
  },
  {
    strict: false,
    minimize: false,
    timestamps: true,
    versionKey: false,
    toJSON: {
      transform(doc, ret) {
        delete ret._id;
        return ret;
      },
    },
  }
);

export const Order = mongoose.model("Order", orderSchema);
