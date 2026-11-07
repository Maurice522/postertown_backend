import { Router } from "express";
import { requireAdmin } from "../middleware/adminAuth.js";
import { Order } from "../models/Order.js";
import { Review } from "../models/Review.js";
import { User } from "../models/User.js";
import { buildCustomerEmail, CUSTOMER_EMAIL_TEMPLATES } from "../services/customerEmails.js";
import { sendEmail } from "../services/emailService.js";
import { COUPONS } from "../utils/pricing.js";

// Admin user management (all routes need an admin session):
// - GET   /api/admin/users                 every customer with order / cart / review totals
// - GET   /api/admin/users/email-options   email templates and coupon codes
// - GET   /api/admin/users/:id             one customer: orders, reviews, cart, emails sent
// - PATCH /api/admin/users/:id             block or unblock ({ status })
// - POST  /api/admin/users/:id/email       preview ({ preview: true }) or send an email
const router = Router();
router.use(requireAdmin);

// Orders that never became a sale don't count towards what a customer spent.
const NOT_SPENT = ["cancelled", "refunded", "payment_not_verified"];
const ORDER_FIELDS = "id userId status createdAt items totals customer shipping payment";

const cartTotal = (items = []) =>
  items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.amount || 1), 0);

function couponFor(code) {
  const key = String(code || "").trim().toUpperCase();
  if (!key) return null;
  const coupon = COUPONS[key];
  if (!coupon) throw Object.assign(new Error("That coupon code doesn't exist in the shop"), { status: 400 });
  return { code: key, description: coupon.description, requirement: coupon.requirement };
}

function userSummary(user, orders = [], reviewCount = 0) {
  const sales = orders.filter((order) => !NOT_SPENT.includes(order.status));
  const cartItems = user.cart?.items || [];
  const lastOrder = orders[0];
  return {
    id: user.id,
    name: user.name,
    email: user.email || "",
    phone: user.phone || user.addresses?.[0]?.phone || "",
    authProvider: user.authProvider,
    status: user.status,
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    city: user.addresses?.[0]?.city || "",
    orderCount: orders.length,
    totalSpent: sales.reduce((sum, order) => sum + Number(order.totals?.total || 0), 0),
    lastOrderAt: lastOrder?.createdAt || null,
    lastOrderStatus: lastOrder?.status || "",
    cartCount: cartItems.reduce((sum, item) => sum + Number(item.amount || 1), 0),
    cartValue: cartTotal(cartItems),
    cartUpdatedAt: user.cart?.updatedAt || null,
    reviewCount,
    emailsSent: (user.contactLog || []).length,
    lastEmailAt: user.contactLog?.length ? user.contactLog[user.contactLog.length - 1].sentAt : null
  };
}

router.get("/", async (req, res, next) => {
  try {
    const [users, orders, reviews] = await Promise.all([
      User.find({ status: { $ne: "deleted" } }).sort({ createdAt: -1 }).lean(),
      Order.find({}, "id userId status createdAt totals.total").sort({ createdAt: -1 }).lean(),
      Review.aggregate([{ $group: { _id: "$userId", count: { $sum: 1 } } }])
    ]);
    const ordersByUser = new Map();
    for (const order of orders) {
      if (!ordersByUser.has(order.userId)) ordersByUser.set(order.userId, []);
      ordersByUser.get(order.userId).push(order);
    }
    const reviewsByUser = new Map(reviews.map((entry) => [entry._id, entry.count]));
    res.set("Cache-Control", "no-store").json(
      users.map((user) => userSummary(user, ordersByUser.get(user.id), reviewsByUser.get(user.id) || 0))
    );
  } catch (error) {
    next(error);
  }
});

router.get("/email-options", (req, res) => {
  res.json({
    templates: Object.entries(CUSTOMER_EMAIL_TEMPLATES).map(([value, template]) => ({ value, ...template })),
    coupons: Object.entries(COUPONS).map(([code, coupon]) => ({ code, description: coupon.description }))
  });
});

router.get("/:id", async (req, res, next) => {
  try {
    const user = await User.findOne({ id: req.params.id }).lean();
    if (!user) return res.status(404).json({ message: "Customer not found" });
    const [orders, reviews] = await Promise.all([
      Order.find({ userId: user.id }, ORDER_FIELDS).sort({ createdAt: -1 }).lean(),
      Review.find({ userId: user.id }).sort({ createdAt: -1 }).lean()
    ]);
    res.set("Cache-Control", "no-store").json({
      ...userSummary(user, orders, reviews.length),
      addresses: user.addresses || [],
      marketingEmails: Boolean(user.preferences?.marketingEmails),
      cart: user.cart?.items || [],
      contactLog: [...(user.contactLog || [])].reverse(),
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        total: order.totals?.total || 0,
        items: (order.items || []).map((item) => ({
          productId: item.productId,
          name: item.name,
          size: item.size,
          amount: item.amount || item.quantity || 1,
          price: item.price
        }))
      })),
      reviews: reviews.map(({ _id, photoDataUrl, ...review }) => ({ ...review, hasPhoto: Boolean(review.photoUrl || photoDataUrl) }))
    });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!["active", "blocked"].includes(status)) {
      return res.status(400).json({ message: "Status must be active or blocked" });
    }
    const user = await User.findOneAndUpdate({ id: req.params.id }, { status }, { new: true }).lean();
    if (!user) return res.status(404).json({ message: "Customer not found" });
    res.json({ id: user.id, status: user.status });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/email", async (req, res, next) => {
  try {
    const { template, subject, heading, message, couponCode, orderId, preview } = req.body || {};
    const base = CUSTOMER_EMAIL_TEMPLATES[template];
    if (!base) return res.status(400).json({ message: "Pick an email type" });

    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: "Customer not found" });
    if (!user.email) return res.status(400).json({ message: "This customer has no email address" });

    let order = null;
    if (orderId) {
      order = await Order.findOne({ id: orderId, userId: user.id }).lean();
      if (!order) return res.status(400).json({ message: "That order doesn't belong to this customer" });
    }
    if (base.needs === "order" && !order) return res.status(400).json({ message: "Pick the order this email is about" });

    const cartItems = user.cart?.items || [];
    if (base.needs === "cart" && !cartItems.length) {
      return res.status(400).json({ message: "This customer's cart is empty" });
    }

    const coupon = couponFor(couponCode);
    if (base.needs === "coupon" && !coupon) return res.status(400).json({ message: "Pick a coupon to send" });

    const email = buildCustomerEmail({ template, user, order, cartItems, coupon, subject, heading, message });
    if (preview) return res.json(email);

    const result = await sendEmail({ to: user.email, name: user.name, ...email });
    if (result?.skipped) {
      return res.status(503).json({ message: "Email isn't set up on the server (Mailjet settings missing)" });
    }

    const entry = {
      template,
      subject: email.subject,
      orderId: order?.id || "",
      couponCode: coupon?.code || "",
      sentAt: new Date(),
      sentBy: req.admin?.sub || "admin"
    };
    await User.updateOne({ id: user.id }, { $push: { contactLog: { $each: [entry], $slice: -100 } } });
    res.json({ message: `Email sent to ${user.email}`, entry });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    next(error);
  }
});

export default router;
