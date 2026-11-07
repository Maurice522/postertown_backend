// Reports which settings the server has, without ever revealing a value.
// Each setting lists the names the code accepts for it; one non-empty value is enough.
const SETTINGS = {
  database: { MONGO_URI: ["MONGO_URI", "MONGODB_URI"] },
  images: {
    CLOUDINARY_CLOUD_NAME: ["CLOUDINARY_CLOUD_NAME"],
    CLOUDINARY_API_KEY: ["CLOUDINARY_API_KEY"],
    CLOUDINARY_API_SECRET: ["CLOUDINARY_API_SECRET"]
  },
  email: {
    MAILJET_API_KEY: ["MAILJET_API_KEY", "MJ_APIKEY_PUBLIC"],
    MAILJET_SECRET_KEY: ["MAILJET_SECRET_KEY", "MAILJET_API_SECRET", "MJ_APIKEY_PRIVATE"],
    MAILJET_FROM_EMAIL: ["MAILJET_FROM_EMAIL", "MAIL_FROM_EMAIL", "EMAIL_FROM"],
    ORDER_ALERT_EMAIL: ["ORDER_ALERT_EMAIL"]
  },
  googleLogin: { GOOGLE_CLIENT_ID: ["GOOGLE_CLIENT_ID"] },
  admin: {
    ADMIN_USERNAME: ["ADMIN_USERNAME"],
    ADMIN_TOTP_SECRET: ["ADMIN_TOTP_SECRET"],
    ADMIN_SESSION_SECRET: ["ADMIN_SESSION_SECRET"]
  },
  productDrafts: { GEMINI_API_KEY: ["GEMINI_API_KEY", "GEMINI_API_KEYS"] },
  ga4Refunds: {
    GA4_MEASUREMENT_ID: ["GA4_MEASUREMENT_ID"],
    GA4_API_SECRET: ["GA4_API_SECRET"]
  }
};

const isSet = (names) => names.some((name) => String(process.env[name] ?? "").trim() !== "");

export const configReport = () => {
  const features = {};
  const missing = [];
  for (const [feature, settings] of Object.entries(SETTINGS)) {
    const result = {};
    for (const [setting, names] of Object.entries(settings)) {
      result[setting] = isSet(names);
      if (!result[setting]) missing.push(setting);
    }
    features[feature] = { ready: Object.values(result).every(Boolean), settings: result };
  }
  // The measurement id isn't secret, so its shape is checked to catch typos.
  const id = String(process.env.GA4_MEASUREMENT_ID ?? "").trim();
  if (id) features.ga4Refunds.measurementIdLooksValid = /^G-[A-Z0-9]+$/.test(id);
  return { ok: missing.length === 0, missing, features };
};
