import crypto from "node:crypto";
import { User } from "../models/User.js";
import {
  sendPasswordResetEmail,
  sendSignupVerificationEmail
} from "../services/emailService.js";

const CODE_TTL_MS = 15 * 60 * 1000;
const PASSWORD_KEY_LENGTH = 64;

function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  const plainUser = user.toJSON ? user.toJSON() : { ...user };
  delete plainUser.passwordHash;
  delete plainUser.emailVerification;
  delete plainUser.passwordReset;
  return plainUser;
}

function createCode() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashCode(code) {
  return crypto.createHash("sha256").update(code).digest("hex");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash = "") {
  const [salt, hash] = storedHash.split(":");

  if (!salt || !hash) {
    return false;
  }

  const providedHash = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH);
  const savedHash = Buffer.from(hash, "hex");

  return savedHash.length === providedHash.length && crypto.timingSafeEqual(savedHash, providedHash);
}

function getExpiryDate() {
  return new Date(Date.now() + CODE_TTL_MS);
}

function normalizeEmail(email = "") {
  return String(email).trim().toLowerCase();
}

function createUserId(email) {
  return `user-${email.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function shouldExposeDevCode(emailResult) {
  return process.env.NODE_ENV !== "production" && emailResult?.skipped;
}

async function sendSignupCode({ email, name, code }) {
  const result = await sendSignupVerificationEmail({ email, name, code });
  return shouldExposeDevCode(result) ? code : undefined;
}

async function sendResetCode({ email, name, code }) {
  const result = await sendPasswordResetEmail({ email, name, code });
  return shouldExposeDevCode(result) ? code : undefined;
}

export async function sendSignupVerification(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const name = String(req.body.name || "Customer").trim();
    const password = String(req.body.password || "");

    if (!email || !name || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const existingUser = await User.findOne({ email }).select("+passwordHash");

    if (existingUser?.emailVerified) {
      return res.status(409).json({ message: "An account already exists with this email" });
    }

    const code = createCode();
    const user = await User.findOneAndUpdate(
      { email },
      {
        $set: {
          email,
          name,
          passwordHash: hashPassword(password),
          authProvider: "email",
          status: "active",
          emailVerified: false,
          emailVerification: {
            codeHash: hashCode(code),
            expiresAt: getExpiryDate(),
            sentAt: new Date()
          }
        },
        $setOnInsert: {
          id: createUserId(email),
          role: "customer"
        }
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const devOtp = await sendSignupCode({ email, name: user.name || name, code });
    res.json({
      message: "Signup verification email sent",
      email,
      ...(devOtp ? { devOtp } : {})
    });
  } catch (error) {
    next(error);
  }
}

export async function verifySignupEmail(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || req.body.otp || "").trim();

    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const user = await User.findOne({ email });
    const verification = user?.emailVerification;

    if (!verification || verification.codeHash !== hashCode(code)) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    if (verification.expiresAt && verification.expiresAt < new Date()) {
      return res.status(400).json({ message: "Verification code expired" });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.emailVerification = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    res.json({ message: "Email verified", user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function login(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email }).select("+passwordHash");

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (user.status !== "active") {
      return res.status(403).json({ message: "This account is not active" });
    }

    if (!user.emailVerified) {
      return res.status(403).json({ message: "Please verify your email before logging in" });
    }

    user.lastLoginAt = new Date();
    await user.save();

    res.json({ message: "Logged in", user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}

export async function sendPasswordReset(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });
    let devOtp;

    if (user) {
      const code = createCode();
      user.passwordReset = {
        codeHash: hashCode(code),
        expiresAt: getExpiryDate(),
        sentAt: new Date()
      };
      await user.save();
      devOtp = await sendResetCode({ email, name: user.name, code });
    }

    res.json({
      message: "If the email exists, a password reset email has been sent",
      email,
      ...(devOtp ? { devOtp } : {})
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyPasswordReset(req, res, next) {
  try {
    const email = normalizeEmail(req.body.email);
    const code = String(req.body.code || req.body.otp || "").trim();
    const password = String(req.body.password || "");

    if (!email || !code || !password) {
      return res.status(400).json({ message: "Email, code, and new password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({ email });
    const reset = user?.passwordReset;

    if (!reset || reset.codeHash !== hashCode(code)) {
      return res.status(400).json({ message: "Invalid reset code" });
    }

    if (reset.expiresAt && reset.expiresAt < new Date()) {
      return res.status(400).json({ message: "Reset code expired" });
    }

    user.passwordHash = hashPassword(password);
    user.passwordReset = undefined;
    user.emailVerified = true;
    user.emailVerifiedAt = user.emailVerifiedAt || new Date();
    user.lastLoginAt = new Date();
    await user.save();

    res.json({ message: "Password reset complete", user: sanitizeUser(user) });
  } catch (error) {
    next(error);
  }
}
