import mongoose from "mongoose";
import { env } from "./env";

let memoryServer: import("mongodb-memory-server").MongoMemoryServer | undefined;

export async function connectDatabase(): Promise<void> {
  let uri = env.mongoUri;
  if (uri === "memory://") {
    if (env.nodeEnv === "production") throw new Error("The in-memory database cannot be used in production");
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri("skillbridge");
    console.warn("Using ephemeral MongoDB memory server; all data is lost when the process exits.");
  }
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.info(`MongoDB connected (${mongoose.connection.host}/${mongoose.connection.name})`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  await memoryServer?.stop();
}

mongoose.connection.on("error", (error) => console.error("MongoDB connection error:", error.message));
mongoose.connection.on("disconnected", () => console.warn("MongoDB disconnected"));
