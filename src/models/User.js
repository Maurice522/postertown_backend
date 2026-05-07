import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    phone: { type: String, trim: true },
    role: { type: String, default: "customer" }
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

export const User = mongoose.model("User", userSchema);
