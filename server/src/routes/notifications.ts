import { Router } from "express";
import { z } from "zod";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { Notification } from "../models/Notification";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { notFound } from "../utils/errors";
import { paginationFrom, pageInfo } from "../utils/pagination";

const router = Router();

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { page, limit, skip } = paginationFrom(req);
  const filter = { user: user._id, ...(req.query.unread === "true" ? { readAt: { $exists: false } } : {}) };
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: user._id, readAt: { $exists: false } }),
  ]);
  res.json({ notifications, unreadCount, pagination: pageInfo(total, page, limit) });
}));

router.patch("/:id/read", authenticate, asyncHandler(async (req, res) => {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: requireAuth(req)._id },
    { $set: { readAt: new Date() } },
    { new: true },
  );
  if (!notification) throw notFound("Notification not found");
  res.json({ notification });
}));

router.post("/read-all", authenticate, validateBody(z.object({}).strict()), asyncHandler(async (req, res) => {
  const result = await Notification.updateMany({ user: requireAuth(req)._id, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  res.json({ updated: result.modifiedCount });
}));

export default router;
