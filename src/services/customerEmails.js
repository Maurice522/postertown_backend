// Emails the admin sends to one customer from the Users page (cart reminder, coupon,
// delivery details, refund update, review request, custom). Same layout as the order
// emails. The admin can edit the subject, heading and message; {name} becomes the
// customer's first name.
import {
  brand,
  button,
  customerInfoHtml,
  emailLayout,
  escapeHtml,
  imageUrl,
  isReturnStatus,
  orderItemsHtml,
  orderJourneyHtml,
  totalsHtml
} from "./emailService.js";

export const CUSTOMER_EMAIL_TEMPLATES = {
  cart_reminder: {
    label: "Cart reminder",
    needs: "cart",
    subject: "Your posters are still waiting for you",
    heading: "You left something in your cart",
    message:
      "Hi {name},\n\nYou picked out some great posters but didn't finish checking out. They're still in your cart, ready when you are.\n\nShipping is free when you buy 2 or more posters."
  },
  coupon: {
    label: "Send a coupon",
    needs: "coupon",
    subject: "A little something for your next poster",
    heading: "A gift from Poster Town",
    message:
      "Hi {name},\n\nThanks for being part of Poster Town. Here's a coupon for your next order. Just enter the code in your cart at checkout."
  },
  delivery_details: {
    label: "Delivery details",
    needs: "order",
    subject: "About the delivery of your Poster Town order",
    heading: "About your delivery",
    message:
      "Hi {name},\n\nWe're getting your order ready to ship and want to make sure it reaches you without trouble. Could you reply to this email to confirm your delivery address and a phone number the courier can call?"
  },
  refund_update: {
    label: "Refund update",
    needs: "order",
    subject: "An update on your Poster Town refund",
    heading: "Update on your refund",
    message:
      "Hi {name},\n\nWe're writing about the refund for your order. If you haven't already, please reply with the UPI ID or bank details you'd like the refund sent to.\n\nSorry for the trouble, and thank you for your patience."
  },
  review_request: {
    label: "Ask for a review",
    needs: "order",
    subject: "How do your new posters look?",
    heading: "How do your posters look?",
    message:
      "Hi {name},\n\nWe hope your posters arrived safely and look great on your wall. Would you take a minute to tell other fans what you think? A photo of the poster on your wall helps a lot."
  },
  custom: {
    label: "Custom message",
    needs: "",
    subject: "A message from Poster Town",
    heading: "",
    message: "Hi {name},\n\n"
  }
};

const firstName = (name = "") => String(name).trim().split(/\s+/)[0] || "there";

function productUrl(item = {}) {
  const id = item.productId || item.id;
  return id ? `${brand.siteUrl}singleproduct/${encodeURIComponent(id)}` : brand.siteUrl;
}

function paragraphsHtml(message = "") {
  return String(message)
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(
      (part) =>
        `<p style="color:${brand.ink};font-size:15px;line-height:1.65;margin:0 0 14px;">${escapeHtml(part).replace(/\n/g, "<br />")}</p>`
    )
    .join("");
}

function couponHtml(coupon) {
  if (!coupon) return "";
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 20px;">
      <tr>
        <td align="center" style="background:${brand.panel};border:2px dashed ${brand.accent};border-radius:14px;padding:18px;">
          <div style="color:${brand.muted};font-size:12px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">Your coupon code</div>
          <div style="color:${brand.accentDark};font-size:30px;font-weight:900;letter-spacing:.12em;margin:6px 0;">${escapeHtml(coupon.code)}</div>
          <div style="color:${brand.ink};font-size:14px;font-weight:700;">${escapeHtml(coupon.description || "")}</div>
          ${coupon.requirement ? `<div style="color:${brand.muted};font-size:12px;margin-top:6px;">${escapeHtml(coupon.requirement)}</div>` : ""}
        </td>
      </tr>
    </table>`;
}

function noteHtml(text) {
  return `<div style="background:${brand.panel};border:1px solid ${brand.border};border-radius:12px;color:${brand.muted};font-size:13px;line-height:1.55;margin-top:22px;padding:14px;">${escapeHtml(text)}</div>`;
}

function reviewLinksHtml(items = []) {
  if (!items.length) return "";
  return `
    <h2 style="font-size:18px;margin:26px 0 12px;">Rate your posters</h2>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      ${items
        .map((item) => {
          const img = imageUrl(item);
          return `
          <tr>
            <td style="border-bottom:1px solid ${brand.border};padding:12px 0;width:58px;">
              ${img ? `<img src="${escapeHtml(img)}" width="48" height="48" alt="" style="background:${brand.panel};border-radius:10px;display:block;height:48px;object-fit:cover;width:48px;" />` : ""}
            </td>
            <td style="border-bottom:1px solid ${brand.border};font-size:14px;font-weight:800;padding:12px 10px;">${escapeHtml(item.name || "Poster")}</td>
            <td align="right" style="border-bottom:1px solid ${brand.border};padding:12px 0;white-space:nowrap;">
              <a href="${escapeHtml(productUrl(item))}" style="color:${brand.accent};font-size:13px;font-weight:800;text-decoration:none;">Write a review &rarr;</a>
            </td>
          </tr>`;
        })
        .join("")}
    </table>`;
}

// Builds the email without sending it (the admin's preview uses this too).
export function buildCustomerEmail({ template, user = {}, order, cartItems = [], coupon, subject, heading, message }) {
  const base = CUSTOMER_EMAIL_TEMPLATES[template];
  if (!base) throw Object.assign(new Error("Unknown email template"), { status: 400 });
  const fill = (text) => String(text || "").replaceAll("{name}", firstName(user.name));
  const finalSubject = fill(subject || base.subject).slice(0, 150);
  const finalHeading = fill(heading || base.heading) || finalSubject;
  const body = fill(message || base.message);

  let extra;
  if (template === "cart_reminder") {
    extra = `${orderItemsHtml(cartItems).replace("Order summary", "In your cart")}
      ${couponHtml(coupon)}
      <div style="margin-top:22px;">${button("Complete your order", `${brand.siteUrl}cart`)}</div>`;
  } else if (template === "coupon") {
    extra = `${couponHtml(coupon)}${button("Shop posters", brand.siteUrl)}`;
  } else if (template === "delivery_details") {
    extra = `${orderItemsHtml(order?.items)}${customerInfoHtml(order)}
      ${noteHtml("Just reply to this email with your details. It comes straight to our team.")}`;
  } else if (template === "refund_update") {
    extra = `${couponHtml(coupon)}${isReturnStatus(order?.status) ? orderJourneyHtml(order.status) : ""}${orderItemsHtml(order?.items)}${totalsHtml(order?.totals)}
      ${noteHtml("Reply to this email if you have any questions about your refund.")}`;
  } else if (template === "review_request") {
    extra = `${couponHtml(coupon)}${reviewLinksHtml(order?.items)}
      ${noteHtml("You can also review from the poster's page while signed in to the account you ordered with.")}`;
  } else {
    extra = `${couponHtml(coupon)}${button("Visit Poster Town", brand.siteUrl)}`;
  }

  const html = emailLayout({
    title: finalSubject,
    preheader: body.replace(/\s+/g, " ").slice(0, 120),
    eyebrow: order?.id ? `Order ${order.id}` : brand.name,
    children: `
      <h1 style="font-size:24px;line-height:1.2;margin:0 0 16px;">${escapeHtml(finalHeading)}</h1>
      ${paragraphsHtml(body)}
      ${extra}`
  }).replace("If you did not request this, you can safely ignore it.", "Questions? Just reply to this email.");

  const text = [
    body,
    coupon ? `Coupon code: ${coupon.code} (${coupon.description || ""})` : "",
    template === "cart_reminder" ? `Complete your order: ${brand.siteUrl}cart` : "",
    template === "review_request"
      ? (order?.items || []).map((item) => `${item.name}: ${productUrl(item)}`).join("\n")
      : "",
    `Warm regards,\nTeam Poster Town\n${brand.siteUrl}`
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject: finalSubject, html, text };
}
