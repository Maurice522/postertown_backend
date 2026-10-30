import Mailjet from "node-mailjet";

export const orderStatusMessages = {
  payment_verification: "Payment verification started",
  product_packing: "We received your payment and your order is being packed",
  payment_not_verified:
    "We could not find a matching payment for this order. Reply to this email with your UTR and payment screenshot and we will check again",
  in_transit: "Your order has been dispatched",
  completed: "Your order was delivered",
  cancelled: "Your order was cancelled",
  return_requested: "Return / refund request received",
  return_in_transit: "Return pickup is in transit / scheduled",
  refunded: "Refund processed"
};

const brand = {
  name: "Poster Town",
  logoUrl: "https://res.cloudinary.com/infieq/image/upload/v1779269763/postertown/brand/poster-town-logo.png",
  siteUrl: "https://metalpostertown.in/",
  accent: "#168f85",
  accentDark: "#0f6862",
  ink: "#17202b",
  muted: "#647184",
  border: "#e2e8f0",
  panel: "#f7f9fb",
  danger: "#b42318"
};

const outboundOrderJourney = [
  { status: "payment_verification", label: "Payment verification" },
  { status: "product_packing", label: "Packed" },
  { status: "in_transit", label: "Dispatched" },
  { status: "completed", label: "Delivered" }
];

const returnOrderJourney = [
  { status: "return_requested", label: "Refund requested" },
  { status: "return_in_transit", label: "Pickup" },
  { status: "refunded", label: "Refunded" }
];

let mailjetClient;

function getMailjetConfig() {
  return {
    apiKey: process.env.MAILJET_API_KEY ?? process.env.MJ_APIKEY_PUBLIC,
    apiSecret:
      process.env.MAILJET_SECRET_KEY ??
      process.env.MAILJET_API_SECRET ??
      process.env.MJ_APIKEY_PRIVATE,
    fromEmail:
      process.env.MAILJET_FROM_EMAIL ??
      process.env.MAIL_FROM_EMAIL ??
      process.env.EMAIL_FROM,
    fromName: process.env.MAILJET_FROM_NAME ?? brand.name
  };
}

function getMailjetClient() {
  const { apiKey, apiSecret } = getMailjetConfig();

  if (!apiKey || !apiSecret) {
    return null;
  }

  if (!mailjetClient) {
    mailjetClient = Mailjet.apiConnect(apiKey, apiSecret);
  }

  return mailjetClient;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currency(value = 0) {
  return `INR ${Number(value || 0).toLocaleString("en-IN")}`;
}

function getCustomerName(order = {}) {
  return (
    order.customer?.name ||
    order.shipping?.fullName ||
    order.shipping?.recipient ||
    "Customer"
  );
}

function getCustomerEmail(order = {}) {
  return order.customer?.email || order.email || "";
}

function imageUrl(item = {}) {
  if (Array.isArray(item.image)) return item.image?.[0]?.url || item.image?.[0] || "";
  return item.image || item.media?.thumbnail || item.media?.featuredImage || "";
}

function addressBlock(shipping = {}) {
  return [
    shipping.recipient || shipping.fullName,
    shipping.addressLine1,
    shipping.addressLine2,
    [shipping.city, shipping.state, shipping.pincode].filter(Boolean).join(", "),
    shipping.country
  ].filter(Boolean).join("<br />");
}

function emailLayout({ preheader, title, eyebrow = brand.name, children }) {
  return `
<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#eef2f6;color:${brand.ink};font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader || title)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef2f6;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid ${brand.border};border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:26px 30px 18px;border-bottom:1px solid ${brand.border};">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <div style="color:${brand.accent};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(eyebrow)}</div>
                      <table role="presentation" cellspacing="0" cellpadding="0" style="margin-top:8px;">
                        <tr>
                          <td style="vertical-align:middle;width:30px;">
                            <img src="${brand.logoUrl}" width="24" height="24" alt="" style="border:0;display:block;height:24px;object-fit:contain;width:24px;" />
                          </td>
                          <td style="color:${brand.ink};font-size:28px;font-weight:800;line-height:1.1;vertical-align:middle;">Poster Town</td>
                        </tr>
                      </table>
                    </td>
                    <td align="right" style="font-size:12px;color:${brand.muted};">Metal posters<br />made to stand out</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:30px;">
                ${children}
              </td>
            </tr>
            <tr>
              <td style="background:${brand.panel};border-top:1px solid ${brand.border};padding:18px 30px;color:${brand.muted};font-size:12px;line-height:1.5;">
                This email was sent by Poster Town. If you did not request this, you can safely ignore it.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function button(label, href = "#") {
  return `<a href="${escapeHtml(href)}" style="background:${brand.accent};border-radius:10px;color:#ffffff;display:inline-block;font-size:14px;font-weight:800;padding:13px 18px;text-decoration:none;">${escapeHtml(label)}</a>`;
}

function codeEmailHtml({ title, name, code, purpose }) {
  return emailLayout({
    title,
    preheader: `${purpose} code: ${code}`,
    children: `
      <h1 style="font-size:24px;line-height:1.2;margin:0 0 12px;">${escapeHtml(title)}</h1>
      <p style="color:${brand.muted};font-size:15px;line-height:1.6;margin:0 0 24px;">Hi ${escapeHtml(name || "there")}, use the code below to continue. It expires in 15 minutes.</p>
      <div style="background:${brand.panel};border:1px solid ${brand.border};border-radius:14px;padding:24px;text-align:center;">
        <div style="color:${brand.muted};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(purpose)} code</div>
        <div style="color:${brand.ink};font-size:36px;font-weight:900;letter-spacing:.12em;margin-top:10px;">${escapeHtml(code)}</div>
      </div>
      <p style="color:${brand.muted};font-size:13px;line-height:1.5;margin:22px 0 0;">For your security, never share this code with anyone.</p>
    `
  });
}

function isReturnStatus(status) {
  return ["return_requested", "return_in_transit", "refunded"].includes(status);
}

function journeyForStatus(status) {
  return isReturnStatus(status) ? returnOrderJourney : outboundOrderJourney;
}

function statusIndex(status, journey) {
  if (status === "cancelled") return -1;
  return journey.findIndex((step) => step.status === status);
}

function orderJourneyHtml(status) {
  if (status === "cancelled" || status === "payment_not_verified") {
    return `
      <div style="background:#fff4f2;border:1px solid #ffd7d2;border-radius:14px;color:${brand.danger};font-size:14px;font-weight:800;margin:24px 0;padding:14px 16px;">
        ${status === "cancelled" ? "Order cancelled" : "Payment not verified"}
      </div>
    `;
  }

  const journey = journeyForStatus(status);
  const currentIndex = statusIndex(status, journey);
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-collapse:collapse;">
      <tr>
        ${journey.map((step, index) => {
          const active = index <= currentIndex;
          return `
            <td align="center" width="${Math.floor(100 / journey.length)}%" style="vertical-align:top;">
              <div style="background:${active ? brand.accent : "#d9e1e8"};border-radius:999px;color:#ffffff;font-size:12px;font-weight:800;height:28px;line-height:28px;margin:0 auto 8px;width:28px;">${active ? "&#10003;" : index + 1}</div>
              <div style="color:${active ? brand.ink : brand.muted};font-size:11px;font-weight:700;line-height:1.25;">${escapeHtml(step.label)}</div>
            </td>
          `;
        }).join("")}
      </tr>
    </table>
  `;
}

function orderItemsHtml(items = []) {
  if (!items.length) return "";

  return `
    <h2 style="font-size:18px;margin:26px 0 12px;">Order summary</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${items.map((item) => {
        const img = imageUrl(item);
        const quantity = Number(item.amount || item.quantity || 1);
        const price = Number(item.price || 0) * quantity;
        return `
          <tr>
            <td style="border-bottom:1px solid ${brand.border};padding:12px 0;width:58px;">
              ${img ? `<img src="${escapeHtml(img)}" width="48" height="48" alt="${escapeHtml(item.name || "Product")}" style="background:${brand.panel};border-radius:10px;display:block;height:48px;object-fit:cover;width:48px;" />` : ""}
            </td>
            <td style="border-bottom:1px solid ${brand.border};padding:12px 10px;">
              <div style="font-size:14px;font-weight:800;line-height:1.35;">${escapeHtml(item.name || item.id || "Product")}</div>
              <div style="color:${brand.muted};font-size:12px;margin-top:3px;">${escapeHtml(item.size || item.sizeType || "")}${quantity ? ` &times; ${quantity}` : ""}</div>
            </td>
            <td align="right" style="border-bottom:1px solid ${brand.border};font-size:14px;font-weight:800;padding:12px 0;white-space:nowrap;">${currency(price)}</td>
          </tr>
        `;
      }).join("")}
    </table>
  `;
}

function totalsHtml(totals = {}) {
  if (!Object.keys(totals).length) return "";

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;border-collapse:collapse;">
      ${[
        ["Subtotal", totals.subtotal],
        ["GST", totals.gst],
        ["Shipping", totals.shipping],
        ["Total", totals.total]
      ].filter(([, value]) => value !== undefined && value !== null && value !== "").map(([label, value]) => `
        <tr>
          <td style="color:${brand.muted};font-size:13px;padding:5px 0;">${label}</td>
          <td align="right" style="font-size:${label === "Total" ? "18px" : "13px"};font-weight:${label === "Total" ? "900" : "700"};padding:5px 0;">${currency(value)}</td>
        </tr>
      `).join("")}
    </table>
  `;
}

function customerInfoHtml(order = {}) {
  const shipping = addressBlock(order.shipping);
  const payment = order.payment?.method || order.payment?.transactionId || "";
  if (!shipping && !payment) return "";

  return `
    <h2 style="font-size:18px;margin:28px 0 12px;">Customer information</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td style="background:${brand.panel};border:1px solid ${brand.border};border-radius:12px;padding:14px;vertical-align:top;width:50%;">
          <div style="font-size:13px;font-weight:800;margin-bottom:8px;">Shipping address</div>
          <div style="color:${brand.muted};font-size:13px;line-height:1.55;">${shipping || "-"}</div>
        </td>
        <td style="width:12px;"></td>
        <td style="background:${brand.panel};border:1px solid ${brand.border};border-radius:12px;padding:14px;vertical-align:top;width:50%;">
          <div style="font-size:13px;font-weight:800;margin-bottom:8px;">Payment</div>
          <div style="color:${brand.muted};font-size:13px;line-height:1.55;">${escapeHtml(payment || "-")}</div>
        </td>
      </tr>
    </table>
  `;
}

function orderStatusEmailHtml({ order, status, message, customerName }) {
  const orderId = order.id || "your order";
  const isReturn = status === "return_in_transit" || status === "refunded";
  const title = {
    payment_verification: "Thank you for your order",
    product_packing: "Payment received",
    payment_not_verified: "We couldn't verify your payment"
  }[status] || message;

  return emailLayout({
    title: `${brand.name} order ${orderId}`,
    preheader: message,
    eyebrow: `Order ${orderId}`,
    children: `
      <h1 style="font-size:24px;line-height:1.2;margin:0 0 10px;">${escapeHtml(title)}</h1>
      <p style="color:${brand.muted};font-size:15px;line-height:1.6;margin:0 0 16px;">Hi ${escapeHtml(customerName)}, ${escapeHtml(message)}.</p>
      ${button(isReturn ? "View return status" : "View your order", brand.siteUrl)}
      ${orderJourneyHtml(status)}
      ${orderItemsHtml(order.items)}
      ${totalsHtml(order.totals)}
      ${customerInfoHtml(order)}
    `
  });
}

export async function sendEmail({ to, name, subject, text, html }) {
  const { fromEmail, fromName } = getMailjetConfig();
  const client = getMailjetClient();

  if (!to) {
    console.warn("[email] skipped: recipient email is missing");
    return { skipped: true, reason: "missing_recipient" };
  }

  if (!client || !fromEmail) {
    console.warn("[email] skipped: Mailjet credentials or sender email is missing");
    return { skipped: true, reason: "missing_mailjet_config" };
  }

  const response = await client
    .post("send", { version: "v3.1" })
    .request({
      Messages: [
        {
          From: {
            Email: fromEmail,
            Name: fromName
          },
          To: [
            {
              Email: to,
              Name: name || to
            }
          ],
          Subject: subject,
          TextPart: text,
          HTMLPart: html
        }
      ]
    });

  console.log(`[email] sent "${subject}" to ${to}`);
  return response.body;
}

export async function sendOrderStatusEmail(order, status = order?.status) {
  const message = orderStatusMessages[status];

  if (!message) {
    console.log(`[email] skipped: no order status email template for "${status}"`);
    return { skipped: true, reason: "unknown_status" };
  }

  const orderId = order.id || "your order";
  const customerName = getCustomerName(order);
  const customerEmail = getCustomerEmail(order);
  const subject = `Poster Town order ${orderId}: ${message}`;
  const text = `Hi ${customerName},\n\n${message}.\n\nOrder ID: ${orderId}\n\nThank you,\nPoster Town`;

  return sendEmail({
    to: customerEmail,
    name: customerName,
    subject,
    text,
    html: orderStatusEmailHtml({ order, status, message, customerName })
  });
}

export async function sendSignupVerificationEmail({ email, name, code }) {
  return sendEmail({
    to: email,
    name,
    subject: "Verify your Poster Town account",
    text: `Hi ${name || "there"},\n\nYour Poster Town verification code is ${code}.\n\nThis code expires in 15 minutes.`,
    html: codeEmailHtml({
      title: "Verify your Poster Town account",
      name,
      code,
      purpose: "Verification"
    })
  });
}

export async function sendPasswordResetEmail({ email, name, code }) {
  return sendEmail({
    to: email,
    name,
    subject: "Reset your Poster Town password",
    text: `Hi ${name || "there"},\n\nYour Poster Town password reset code is ${code}.\n\nThis code expires in 15 minutes.`,
    html: codeEmailHtml({
      title: "Reset your Poster Town password",
      name,
      code,
      purpose: "Password reset"
    })
  });
}
