import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { isDatabaseReady } from "./config/database";
import adminRoutes from "./routes/admin";
import authRoutes from "./routes/auth";
import disputeRoutes from "./routes/disputes";
import matchRoutes from "./routes/matches";
import notificationRoutes from "./routes/notifications";
import requestRoutes from "./routes/requests";
import sessionRoutes from "./routes/sessions";
import skillRoutes from "./routes/skills";
import waitlistRoutes from "./routes/waitlist";
import walletRoutes from "./routes/wallet";
import { errorHandler, notFoundHandler } from "./middleware/errors";
import { env } from "./config/env";
import { AppError } from "./utils/errors";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  origin: env.clientOrigin.split(",").map((origin) => origin.trim()),
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: "draft-7", legacyHeaders: false }));

app.get("/api/health", (_req, res) => {
  const ready = isDatabaseReady();
  res.status(ready ? 200 : 503).json({ status: ready ? "ok" : "database_unavailable", database: ready ? "connected" : "disconnected" });
});

app.use("/api", (_req, _res, next) => {
  if (!isDatabaseReady()) {
    next(new AppError(503, "Database is not ready", "DATABASE_UNAVAILABLE"));
    return;
  }
  next();
});

app.use("/api/auth", authRoutes);
app.use("/api/skills", skillRoutes);
app.use("/api/matches", matchRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/disputes", disputeRoutes);
app.use("/api/admin", adminRoutes);
app.use(notFoundHandler);
app.use(errorHandler);
