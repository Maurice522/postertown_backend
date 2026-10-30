import { Router } from "express";
import { createAdminToken, requireAdmin } from "../middleware/adminAuth.js";
import { verifyCode } from "../utils/totp.js";

const router = Router();

// Brute-force guard: a 6-digit code has a million options, so cap failed tries per IP.
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;
const failures = new Map();
// A code can't be used twice (someone watching over your shoulder).
let lastUsedStep = null;

function lockedFor(ip) {
  const entry = failures.get(ip);
  if (!entry) return 0;
  if (Date.now() > entry.resetAt) {
    failures.delete(ip);
    return 0;
  }
  return entry.count >= MAX_FAILURES ? Math.ceil((entry.resetAt - Date.now()) / 60000) : 0;
}

function recordFailure(ip) {
  const entry = failures.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    failures.set(ip, { count: 1, resetAt: Date.now() + LOCK_MINUTES * 60 * 1000 });
  } else {
    entry.count += 1;
  }
}

router.post("/login", (req, res) => {
  const { ADMIN_USERNAME, ADMIN_TOTP_SECRET, ADMIN_SESSION_SECRET } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_TOTP_SECRET || !ADMIN_SESSION_SECRET) {
    return res.status(503).json({ message: "Admin login is not configured on the server" });
  }

  const ip = req.ip;
  const minutes = lockedFor(ip);
  if (minutes) {
    return res.status(429).json({ message: `Too many wrong codes. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` });
  }

  const username = String(req.body.username || "").trim().toLowerCase();
  const step = verifyCode(ADMIN_TOTP_SECRET, req.body.code);

  if (username !== ADMIN_USERNAME.toLowerCase() || step === null) {
    recordFailure(ip);
    return res.status(401).json({ message: "Wrong username or code" });
  }

  if (step === lastUsedStep) {
    return res.status(401).json({ message: "That code was just used. Wait for the next code in your app." });
  }

  lastUsedStep = step;
  failures.delete(ip);
  res.json({ username: ADMIN_USERNAME, ...createAdminToken(ADMIN_USERNAME) });
});

// Lets the admin console check that a saved session is still valid.
router.get("/session", requireAdmin, (req, res) => {
  res.json({ username: req.admin.sub, expiresAt: req.admin.exp });
});

export default router;
