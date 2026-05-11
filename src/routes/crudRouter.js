import { Router } from "express";
import { createCrudController } from "../controllers/crudController.js";
import { createOrder, updateOrder } from "../controllers/orderController.js";
import { createProductDraft, uploadDraftImage } from "../controllers/productAiController.js";
import { attachProductImages, uploadProductImages } from "../middleware/productImages.js";

export function createCrudRouter(collectionName) {
  const router = Router();
  const controller = createCrudController(collectionName);
  const productImageMiddleware = collectionName === "products" ? [uploadProductImages, attachProductImages] : [];

  if (collectionName === "products") {
    router.post("/draft-from-image", uploadDraftImage, createProductDraft);
  }

  router.get("/", controller.list);
  router.get("/:id", controller.getById);
  router.post("/", ...(collectionName === "orders" ? [createOrder] : [...productImageMiddleware, controller.create]));
  router.put("/:id", ...(collectionName === "orders" ? [updateOrder] : [...productImageMiddleware, controller.update]));
  router.patch("/:id", ...(collectionName === "orders" ? [updateOrder] : [...productImageMiddleware, controller.update]));
  router.delete("/:id", controller.remove);

  return router;
}
