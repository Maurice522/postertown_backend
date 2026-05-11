import { Order } from "../models/Order.js";
import { User } from "../models/User.js";
import { sendOrderStatusEmail } from "../services/emailService.js";

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

export async function createOrder(req, res, next) {
  try {
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

    await User.findOneAndUpdate(
      { id: userId },
      { $set: userPayload },
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
      status: req.body.status || "payment_verification",
      statusLabel: req.body.statusLabel || "Payment Verification"
    };

    const order = await Order.create(orderPayload);
    await notifyOrderStatus(order.toJSON(), order.status);

    res.status(201).json(order.toJSON());
  } catch (error) {
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
    const updatedOrder = await existingOrder.save();
    const orderJson = updatedOrder.toJSON();

    if (updates.status && updates.status !== previousStatus) {
      await notifyOrderStatus(orderJson, updates.status);
    }

    res.json(orderJson);
  } catch (error) {
    next(error);
  }
}
