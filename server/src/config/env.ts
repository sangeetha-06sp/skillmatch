import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

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
  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
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
  if (!env.supabaseUrl || !URL.canParse(env.supabaseUrl) || !env.supabaseUrl.startsWith("https://")) {
    throw new Error("SUPABASE_URL must be a valid HTTPS Supabase project URL");
  }
  const serviceKey = env.supabaseServiceRoleKey;
  if (!serviceKey || serviceKey.startsWith("sb_publishable_")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must be configured on the backend; a publishable key cannot be used");
  }
  if (serviceKey.startsWith("eyJ")) {
    try {
      const claims = JSON.parse(Buffer.from(serviceKey.split(".")[1] ?? "", "base64url").toString("utf8")) as { role?: string };
      if (claims.role !== "service_role") throw new Error("SUPABASE_SERVICE_ROLE_KEY must contain a service-role key");
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("SUPABASE_SERVICE_ROLE_KEY must be a valid service-role key");
      throw error;
    }
  } else if (!serviceKey.startsWith("sb_secret_")) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must contain a Supabase service-role/secret key");
  }
}
