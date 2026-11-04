import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { env } from "../config/env";
import { unauthorized } from "./errors";

export const hashPassword = (password: string) => bcrypt.hash(password, 12);
export const comparePassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function signAccessToken(user: { _id: unknown; role: string; tokenVersion?: number }): string {
  if (!env.jwtSecret) throw new Error("JWT_SECRET must be configured before signing tokens");
  return jwt.sign({ sub: String(user._id), role: user.role, tokenVersion: user.tokenVersion ?? 0 }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): { sub: string; role: string; tokenVersion: number } {
  try {
    if (!env.jwtSecret) throw new Error("JWT_SECRET is not configured");
    const payload = jwt.verify(token, env.jwtSecret);
    if (typeof payload === "string" || typeof payload.sub !== "string" || typeof payload.role !== "string") {
      throw new Error("Invalid token claims");
    }
    return {
      sub: payload.sub,
      role: payload.role,
      tokenVersion: typeof payload.tokenVersion === "number" ? payload.tokenVersion : 0,
    };
  } catch {
    throw unauthorized("Invalid or expired token");
  }
}
