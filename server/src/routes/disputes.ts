import { Router } from "express";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { Dispute } from "../models/Dispute";
import { asyncHandler } from "../utils/asyncHandler";
import { forbidden, notFound } from "../utils/errors";
import { paginationFrom, pageInfo } from "../utils/pagination";

const router = Router();

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { page, limit, skip } = paginationFrom(req);
  const filter = user.role === "admin" ? {} : { openedBy: user._id };
  const [disputes, total] = await Promise.all([
    Dispute.find(filter).populate("session", "participants scheduledAt status").populate("openedBy", "name").sort({ createdAt: -1 }).skip(skip).limit(limit),
    Dispute.countDocuments(filter),
  ]);
  res.json({ disputes, pagination: pageInfo(total, page, limit) });
}));

router.get("/:id", authenticate, asyncHandler(async (req, res) => {
  const dispute = await Dispute.findById(req.params.id).populate("session", "participants scheduledAt status").populate("openedBy", "name");
  if (!dispute) throw notFound("Dispute not found");
  const session = dispute.session as unknown as { participants: { equals: (id: unknown) => boolean }[] } | null;
  const isParticipant = Boolean(session?.participants.some((participant) => participant.equals(requireAuth(req)._id)));
  if (requireAuth(req).role !== "admin" && !isParticipant) throw forbidden();
  res.json({ dispute });
}));

export default router;
