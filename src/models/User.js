import mongoose from "mongoose";

function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email || undefined;
}

const addressSchema = new mongoose.Schema(
  {
    label: { type: String, default: "Home", trim: true },
    fullName: { type: String, trim: true },
    phone: { type: String, trim: true },
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    pincode: { type: String, trim: true },
    country: { type: String, default: "India", trim: true },
    isDefault: { type: Boolean, default: false }
  },
  { _id: false, strict: false }
);

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      set: normalizeEmail,
      index: true
    },
    passwordHash: { type: String, select: false },
    phone: { type: String, trim: true },
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
      index: true
    },
    authProvider: {
      type: String,
      enum: ["email", "guest"],
      default: "email",
      index: true
    },
    status: {
      type: String,
      enum: ["active", "blocked", "deleted"],
      default: "active",
      index: true
    },
    emailVerified: { type: Boolean, default: false },
    emailVerifiedAt: Date,
    emailVerification: {
      codeHash: String,
      expiresAt: Date,
      sentAt: Date
    },
    passwordReset: {
      codeHash: String,
      expiresAt: Date,
      sentAt: Date,
      verifiedAt: Date
    },
    lastLoginAt: Date,
    addresses: { type: [addressSchema], default: [] },
    preferences: {
      marketingEmails: { type: Boolean, default: false },
      orderStatusEmails: { type: Boolean, default: true }
    }
  },
  {
    strict: false,
    minimize: false,
    timestamps: true,
    versionKey: false,
    toObject: {
      virtuals: true
    },
    toJSON: {
      virtuals: true,
      transform(doc, ret) {
        delete ret._id;
        delete ret.passwordHash;
        delete ret.emailVerification;
        delete ret.passwordReset;
        return ret;
      }
    }
  }
);

userSchema.virtual("orders", {
  ref: "Order",
  localField: "id",
  foreignField: "userId",
  justOne: false
});

userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $gt: "" }
    }
  }
);

export const User = mongoose.model("User", userSchema);
