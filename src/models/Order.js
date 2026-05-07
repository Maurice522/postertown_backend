import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    status: { type: String, default: "pending", index: true }
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
      }
    }
  }
);

export const Order = mongoose.model("Order", orderSchema);
