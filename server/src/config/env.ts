import dotenv from "dotenv";

dotenv.config();

const defaults = {
  NODE_ENV: "development",
  PORT: "4000",
  JWT_EXPIRES_IN: "1d",
  CLIENT_ORIGIN: "http://localhost:5173",
  PLATFORM_FEE_PERCENT: "0",
  SEED_ADMIN_PASSWORD: "ChangeMe123!",
};

export const env = {
  nodeEnv: process.env.NODE_ENV ?? defaults.NODE_ENV,
  port: Number(process.env.PORT ?? defaults.PORT),
  mongoUri: process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/skillbridge",
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? defaults.JWT_EXPIRES_IN,
  clientOrigin: process.env.CLIENT_ORIGIN ?? defaults.CLIENT_ORIGIN,
  platformFeePercent: Number(process.env.PLATFORM_FEE_PERCENT ?? defaults.PLATFORM_FEE_PERCENT),
  seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? defaults.SEED_ADMIN_PASSWORD,
};

export function validateEnvironment(): void {
  if (!Number.isInteger(env.port) || env.port < 1 || env.port > 65535) {
    throw new Error("PORT must be a valid TCP port");
  }
  if (!Number.isFinite(env.platformFeePercent) || env.platformFeePercent < 0 || env.platformFeePercent > 100) {
    throw new Error("PLATFORM_FEE_PERCENT must be between 0 and 100");
  }
  if (env.nodeEnv === "production" && env.jwtSecret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters in production");
  }
  if (env.jwtSecret.length < (env.nodeEnv === "production" ? 32 : 16)) {
    throw new Error(`JWT_SECRET must be at least ${env.nodeEnv === "production" ? 32 : 16} characters`);
  }
}
