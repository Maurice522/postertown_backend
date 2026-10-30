import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { configureCloudinary } from "./config/cloudinary.js";
import { createCrudRouter } from "./routes/crudRouter.js";
import authRoutes from "./routes/authRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { COLLECTION_CATALOG } from "./utils/collections.js";
import { errorHandler, notFound } from "./middleware/errorHandlers.js";
import { requestLogger } from "./middleware/requestLogger.js";

configureCloudinary();

const app = express();
// Render runs behind one proxy; trust it so req.ip is the real visitor (used by the
// admin login lockout).
app.set("trust proxy", 1);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("dev"));
app.use(requestLogger);

app.get("/", (req, res) => {
  res.json({
    name: "Poster Town API",
    database: "MongoDB",
    imageStorage: "Cloudinary",
    endpoints: {
      products: "/api/products",
      users: "/api/users",
      orders: "/api/orders",
      auth: {
        login: "/api/auth/login",
        signupStart: "/api/auth/signup/start",
        signupVerify: "/api/auth/signup/verify",
        passwordForgot: "/api/auth/password/forgot",
        passwordReset: "/api/auth/password/reset"
      }
    }
  });
});

app.get("/api/collections", (req, res) => {
  res.json(COLLECTION_CATALOG.map(({ slug, title }) => ({ slug, title })));
});
app.use("/api/products", createCrudRouter("products"));
app.use("/api/users", createCrudRouter("users"));
app.use("/api/orders", createCrudRouter("orders"));
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
