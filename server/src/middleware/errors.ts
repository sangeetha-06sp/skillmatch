import { ErrorRequestHandler, RequestHandler } from "express";
import mongoose from "mongoose";
import { AppError } from "../utils/errors";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, `Route ${req.method} ${req.originalUrl} not found`, "NOT_FOUND"));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON" } });
    return;
  }
  if ((error as { type?: string }).type === "entity.too.large") {
    res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: "Request body exceeds the allowed size" } });
    return;
  }
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: { code: error.code, message: error.message, details: error.details } });
    return;
  }
  if (error instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid data", details: error.message } });
    return;
  }
  if (error instanceof mongoose.Error.CastError) {
    res.status(400).json({ error: { code: "INVALID_ID", message: "Invalid resource identifier" } });
    return;
  }
  if ((error as { code?: number }).code === 11000) {
    res.status(409).json({ error: { code: "DUPLICATE", message: "A record with that value already exists" } });
    return;
  }
  if (process.env.NODE_ENV !== "test") console.error(error);
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } });
};
