import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { sendNewOrderAlert, sendOrderStatusEmail } from "../services/emailService.js";

function normalizePhone(value = "") {
  return String(value).replace(/\D+/g, "");
}

function createUserId(order) {
  const email = String(order.customer?.email || "").trim().toLowerCase();
  if (email) return `user-${email.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;

  const phone = normalizePhone(order.customer?.phone || order.shipping?.phone);
  if (phone) return `user-phone-${phone}`;

  return `user-guest-${order.id || Date.now()}`;
}

function createOrderId() {
  return `PT-${Date.now().toString().slice(-8)}`;
}

async function notifyOrderStatus(order, status) {
  try {
    await sendOrderStatusEmail(order, status);
  } catch (error) {
    console.error(`[email] failed to send order ${status} notification`, error);
  }
}

const UTR_IN_USE_MESSAGE =
  "This UTR has already been used for another order. Please check the number in your UPI app.";

// UPI transaction reference (UTR): 12 digits. Some apps show it with spaces.
function normalizeUtr(value = "") {
  return String(value).replace(/\D+/g, "");
}

export async function createOrder(req, res, next) {
  try {
    const utr = normalizeUtr(req.body.payment?.transactionId);
    if (!/^\d{12}$/.test(utr)) {
      return res.status(400).json({ message: "Enter the 12-digit UTR from your UPI app" });
    }

    // Friendly early check; the unique index on payment.utr is what actually
    // guarantees it, including for two orders submitted at the same moment.
    const utrInUse = await Order.exists({
      $or: [{ "payment.utr": utr }, { "payment.transactionId": utr }]
    });
    if (utrInUse) {
      return res.status(409).json({ message: UTR_IN_USE_MESSAGE });
    }

    const orderId = req.body.id || createOrderId();
    const customer = req.body.customer || {};
    const shipping = req.body.shipping || {};
    const userId = req.body.userId || createUserId({ ...req.body, id: orderId });
    const userPayload = {
      id: userId,
      name: customer.name || shipping.recipient || shipping.fullName || "Guest Customer",
      email: customer.email || "",
      phone: customer.phone || shipping.phone || "",
      role: "customer",
      authProvider: customer.email ? "email" : "guest",
      shipping
    };

    // Only fill in how the account was created for new users, so placing an order
    // doesn't relabel a Google account as an email one.
    const { authProvider, role, ...profileFields } = userPayload;
    await User.findOneAndUpdate(
      { id: userId },
      { $set: profileFields, $setOnInsert: { authProvider, role } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const orderPayload = {
      ...req.body,
      id: orderId,
      userId,
      customer: {
        ...customer,
        name: customer.name || userPayload.name,
        email: customer.email || userPayload.email,
        phone: customer.phone || userPayload.phone
      },
      payment: {
        ...(req.body.payment || {}),
        transactionId: utr,
        utr,
        status: "pending",
        submittedAt: new Date()
      },
      // New orders always start unpaid; only the admin moves them on.
      status: "payment_verification",
      statusLabel: "Payment Verification"
    };

    const order = await Order.create(orderPayload);
    await notifyOrderStatus(order.toJSON(), order.status);
    try {
      await sendNewOrderAlert(order.toJSON());
    } catch (error) {
      console.error("[email] failed to send the new order alert", error);
    }

    res.status(201).json(order.toJSON());
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.["payment.utr"]) {
      return res.status(409).json({ message: UTR_IN_USE_MESSAGE });
    }

    if (error.code === 11000) {
      return res.status(409).json({ message: `An order with id '${req.body.id}' already exists` });
    }

    next(error);
  }
}

export async function updateOrder(req, res, next) {
  try {
    const { id, _id, ...updates } = req.body;
    const existingOrder = await Order.findOne({ id: req.params.id });

    if (!existingOrder) {
      return res.status(404).json({ message: "order not found" });
    }

    const previousStatus = existingOrder.status;
    existingOrder.set(updates);

    // Record the admin's payment decision: "Payment received" moves the order to
    // packing, "Not received" to payment_not_verified. Other moves (e.g. the customer
    // asking to cancel) are not payment decisions.
    if (previousStatus === "payment_verification" && updates.status === "product_packing") {
      existingOrder.set("payment.status", "verified");
      existingOrder.set("payment.verifiedAt", new Date());
    } else if (previousStatus === "payment_verification" && updates.status === "payment_not_verified") {
      existingOrder.set("payment.status", "rejected");
      existingOrder.set("payment.rejectedAt", new Date());
    }
    const updatedOrder = await existingOrder.save();
    const orderJson = updatedOrder.toJSON();

    if (updates.status && updates.status !== previousStatus) {
      await notifyOrderStatus(orderJson, updates.status);
    }

    res.json(orderJson);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.["payment.utr"]) {
      return res.status(409).json({ message: UTR_IN_USE_MESSAGE });
    }

    next(error);
  }
}
