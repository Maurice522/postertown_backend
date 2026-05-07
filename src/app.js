import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { configureCloudinary } from "./config/cloudinary.js";
import { createCrudRouter } from "./routes/crudRouter.js";
import { errorHandler, notFound } from "./middleware/errorHandlers.js";

configureCloudinary();

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(morgan("dev"));

app.get("/", (req, res) => {
  res.json({
    name: "Poster Town API",
    database: "MongoDB",
    imageStorage: "Cloudinary",
    endpoints: {
      products: "/api/products",
      users: "/api/users",
      orders: "/api/orders"
    }
  });
});

app.use("/api/products", createCrudRouter("products"));
app.use("/api/users", createCrudRouter("users"));
app.use("/api/orders", createCrudRouter("orders"));

app.use(notFound);
app.use(errorHandler);

export default app;
