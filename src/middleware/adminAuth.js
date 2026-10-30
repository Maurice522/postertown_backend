import crypto from "node:crypto";

// Admin sessions are signed tokens: base64url(payload).signature, where the
// signature is an HMAC with ADMIN_SESSION_SECRET. Nothing is stored server-side.
const SESSION_HOURS = 12;

function sessionSecret() {
  return process.env.ADMIN_SESSION_SECRET || "";
}

function sign(data) {
  return crypto.createHmac("sha256", sessionSecret()).update(data).digest("base64url");
}

export function createAdminToken(username) {
  const payload = Buffer.from(
    JSON.stringify({ sub: username, role: "admin", exp: Date.now() + SESSION_HOURS * 60 * 60 * 1000 })
  ).toString("base64url");
  return { token: `${payload}.${sign(payload)}`, expiresInHours: SESSION_HOURS };
}

export function readAdminToken(header = "") {
  const token = String(header).replace(/^Bearer\s+/i, "");
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !sessionSecret()) return null;

  const expected = sign(payload);
  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return null;
  }

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.role === "admin" && data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function isAdminRequest(req) {
  return Boolean(readAdminToken(req.headers.authorization));
}

export function requireAdmin(req, res, next) {
  const session = readAdminToken(req.headers.authorization);
  if (!session) {
    return res.status(401).json({ message: "Admin login required" });
  }
  req.admin = session;
  next();
}
