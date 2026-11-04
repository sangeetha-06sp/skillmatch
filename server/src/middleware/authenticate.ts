import { NextFunction, Request, Response } from "express";
import { User, IUser } from "../models/User";
import { forbidden, unauthorized } from "../utils/errors";
import { verifyAccessToken } from "../utils/auth";

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.header("authorization");
    if (!header?.startsWith("Bearer ")) throw unauthorized();
    const claims = verifyAccessToken(header.slice(7));
    const user = await User.findById(claims.sub).select("+tokenVersion");
    if (!user || !user.isActive || (user.tokenVersion ?? 0) !== claims.tokenVersion) throw unauthorized("Account is unavailable or token has been revoked");
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(req: Request): IUser {
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
