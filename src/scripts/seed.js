import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { connectDb } from "../config/db.js";
import { models } from "../models/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedPath = path.join(__dirname, "..", "data", "db.json");

async function seedCollection(collectionName, records = []) {
  const Model = models[collectionName];

  if (!Model || records.length === 0) {
    return;
  }

  const operations = records.map((record) => ({
    updateOne: {
      filter: { id: record.id },
      update: { $set: record },
      upsert: true
    }
  }));

  const result = await Model.bulkWrite(operations);
  console.log(`${collectionName}: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`);
}

try {
  const raw = await fs.readFile(seedPath, "utf8");
  const data = JSON.parse(raw.replace(/^\uFEFF/, ""));

  await connectDb();
  await seedCollection("products", data.products);
  await seedCollection("users", data.users);
  await seedCollection("orders", data.orders);

  console.log("Seed complete");
  process.exit(0);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
