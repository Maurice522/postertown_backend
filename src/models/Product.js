import mongoose from "mongoose";

const flexibleSchemaOptions = {
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
};

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    sku: { type: String, index: true },
    slug: { type: String, index: true },
    name: { type: String, required: true, trim: true }
  },
  flexibleSchemaOptions
);

export const Product = mongoose.model("Product", productSchema);
