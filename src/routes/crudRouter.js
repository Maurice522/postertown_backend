import { Router } from "express";
import { createCrudController } from "../controllers/crudController.js";
import { createOrder, updateOrder } from "../controllers/orderController.js";
import { createProductDraft, uploadDraftImage } from "../controllers/productAiController.js";
import { isAdminRequest, requireAdmin } from "../middleware/adminAuth.js";
import { attachProductImages, uploadProductImages } from "../middleware/productImages.js";

// Requests the storefront makes without an admin session:
// - GET /api/orders?userId=...   a customer's own orders
// - PATCH /api/orders/:id        only to ask for a cancel or return
const CUSTOMER_ORDER_STATUSES = ["cancel_requested", "return_requested"];
const CUSTOMER_ORDER_FIELDS = ["status", "statusLabel", "currentState", "currentStateLabel", "updatedAt"];

function adminOrCustomerOrderList(req, res, next) {
  if (isAdminRequest(req)) return next();
  // Customers may only look up orders by their own user id, with no other filters.
  const keys = Object.keys(req.query || {});
  if (keys.length === 1 && keys[0] === "userId" && typeof req.query.userId === "string" && req.query.userId) {
    return next();
  }
  return res.status(401).json({ message: "Admin login required" });
}

function adminOrCustomerOrderRequest(req, res, next) {
  if (isAdminRequest(req)) return next();
  const fields = Object.keys(req.body || {});
  const onlyAllowedFields = fields.every((field) => CUSTOMER_ORDER_FIELDS.includes(field));
  if (onlyAllowedFields && CUSTOMER_ORDER_STATUSES.includes(req.body.status)) return next();
  return res.status(401).json({ message: "Admin login required" });
}

export function createCrudRouter(collectionName) {
  const router = Router();
  const controller = createCrudController(collectionName);

  if (collectionName === "products") {
    const images = [uploadProductImages, attachProductImages];
    router.post("/draft-from-image", requireAdmin, uploadDraftImage, createProductDraft);
    router.get("/", controller.list);
    router.get("/:id", controller.getById);
    router.post("/", requireAdmin, ...images, controller.create);
    router.put("/:id", requireAdmin, ...images, controller.update);
    router.patch("/:id", requireAdmin, ...images, controller.update);
    router.delete("/:id", requireAdmin, controller.remove);
    return router;
  }

  if (collectionName === "orders") {
    router.get("/", adminOrCustomerOrderList, controller.list);
    router.get("/:id", controller.getById);
    router.post("/", createOrder);
    router.put("/:id", requireAdmin, updateOrder);
    router.patch("/:id", adminOrCustomerOrderRequest, updateOrder);
    router.delete("/:id", requireAdmin, controller.remove);
    return router;
  }

  // Users (and anything else): admin only. Customers use /api/auth instead.
  router.use(requireAdmin);
  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.post("/", controller.create);
  router.put("/:id", controller.update);
  router.patch("/:id", controller.update);
  router.delete("/:id", controller.remove);
  return router;
}
