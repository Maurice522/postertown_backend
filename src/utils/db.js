import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "..", "data", "db.json");

export async function readDb() {
  const data = await fs.readFile(dbPath, "utf8");
  return JSON.parse(data.replace(/^\uFEFF/, ""));
}

export async function writeDb(data) {
  await fs.writeFile(dbPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export async function getCollection(collectionName) {
  const db = await readDb();
  return { db, collection: db[collectionName] ?? [] };
}

