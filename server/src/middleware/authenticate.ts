import { NextFunction, Request, Response } from "express";
import { supabase } from "../config/database";
import { apiUser, type AuthUser, throwDatabaseError } from "../services/database";
import { forbidden, unauthorized } from "../utils/errors";
import { verifyAccessToken } from "../utils/auth";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) throw unauthorized();
    const claims = verifyAccessToken(header.slice(7));
    const { data: row, error } = await supabase.from("users").select("*").eq("id", claims.sub).maybeSingle();
    if (error) throwDatabaseError(error);
    if (!row) throw unauthorized("Account is unavailable or token has been revoked");
    const user = apiUser(row as Record<string, unknown> & { id: string });
    if (!user.isActive || user.tokenVersion !== claims.tokenVersion) {
      throw unauthorized("Account is unavailable or token has been revoked");
    }
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== "admin") {
    next(forbidden("Administrator access required"));
    return;
  }
  next();
}
