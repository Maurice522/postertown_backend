import dns from "node:dns";
import mongoose from "mongoose";

const dnsServers = (process.env.DNS_SERVERS ?? "1.1.1.1,8.8.8.8")
  .split(",")
  .map((server) => server.trim())
  .filter(Boolean);

if (dnsServers.length > 0) {
  dns.setServers(dnsServers);
}

export async function connectDb() {
  const mongoUri = process.env.MONGO_URI ?? process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGO_URI is required in .env");
  }

  mongoose.set("strictQuery", false);

  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");
}
