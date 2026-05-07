import "dotenv/config";
import app from "./app.js";
import { connectDb } from "./config/db.js";

const port = process.env.PORT ?? 5000;

try {
  await connectDb();

  app.listen(port, () => {
    console.log(`Poster Town API running at http://localhost:${port}`);
  });
} catch (error) {
  console.error("Failed to start server", error);
  process.exit(1);
}
