import Mailjet from "node-mailjet";

export const orderStatusMessages = {
  payment_verification: "Payment verification started",
  product_packing: "Your order is packed",
  in_transit: "Your order has been dispatched",
  completed: "Your order was delivered",
  cancelled: "Your order was cancelled",
  return_in_transit: "Return pickup is in transit / scheduled",
  refunded: "Refund processed"
};

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
    fromName: process.env.MAILJET_FROM_NAME ?? "Poster Town"
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
    html: `
      <p>Hi ${escapeHtml(customerName)},</p>
      <p>${escapeHtml(message)}.</p>
      <p><strong>Order ID:</strong> ${escapeHtml(orderId)}</p>
      <p>Thank you,<br />Poster Town</p>
    `
  });
}

export async function sendSignupVerificationEmail({ email, name, code }) {
  return sendEmail({
    to: email,
    name,
    subject: "Verify your Poster Town account",
    text: `Hi ${name || "there"},\n\nYour Poster Town verification code is ${code}.\n\nThis code expires in 15 minutes.`,
    html: `
      <p>Hi ${escapeHtml(name || "there")},</p>
      <p>Your Poster Town verification code is:</p>
      <h2>${escapeHtml(code)}</h2>
      <p>This code expires in 15 minutes.</p>
    `
  });
}

export async function sendPasswordResetEmail({ email, name, code }) {
  return sendEmail({
    to: email,
    name,
    subject: "Reset your Poster Town password",
    text: `Hi ${name || "there"},\n\nYour Poster Town password reset code is ${code}.\n\nThis code expires in 15 minutes.`,
    html: `
      <p>Hi ${escapeHtml(name || "there")},</p>
      <p>Your Poster Town password reset code is:</p>
      <h2>${escapeHtml(code)}</h2>
      <p>This code expires in 15 minutes.</p>
    `
  });
}
