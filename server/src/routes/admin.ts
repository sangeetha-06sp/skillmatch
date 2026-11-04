import { Router } from "express";
import { z } from "zod";
import { authenticate, requireAuth, requireAdmin } from "../middleware/authenticate";
import { Dispute } from "../models/Dispute";
import { ExchangeRequest } from "../models/ExchangeRequest";
import { Notification } from "../models/Notification";
import { Session } from "../models/Session";
import { Skill } from "../models/Skill";
import { User } from "../models/User";
import { Waitlist } from "../models/Waitlist";
import { WalletTransaction } from "../models/WalletTransaction";
import { notify } from "../services/notifications";
import { validateBody } from "../middleware/validate";
import { asyncHandler } from "../utils/asyncHandler";
import { badRequest, notFound } from "../utils/errors";
import { paginationFrom, pageInfo } from "../utils/pagination";

const router = Router();
router.use(authenticate, requireAdmin);

router.get("/stats", asyncHandler(async (_req, res) => {
  const [users, skills, requests, sessions, openDisputes, waitlist, wallet] = await Promise.all([
    User.countDocuments(), Skill.countDocuments({ active: true }), ExchangeRequest.countDocuments(),
    Session.countDocuments(), Dispute.countDocuments({ status: { $in: ["open", "under_review"] } }),
    Waitlist.countDocuments({ status: "pending" }),
    WalletTransaction.aggregate([{ $match: { direction: "debit", reason: "session_payment" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
  ]);
  res.json({ stats: { users, activeSkills: skills, requests, sessions, openDisputes, pendingWaitlist: waitlist, transferredCredits: wallet[0]?.total ?? 0 } });
}));

router.get("/users", asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.q === "string" && req.query.q.trim()) {
    const q = req.query.q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [{ name: new RegExp(q, "i") }, { email: new RegExp(q, "i") }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).select("-passwordHash").sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ users, pagination: pageInfo(total, page, limit) });
}));

router.patch("/users/:id/status", validateBody(z.object({ isActive: z.boolean() })), asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(requireAuth(req)._id) && req.body.isActive === false) throw badRequest("You cannot deactivate your own account");
  const update = req.body.isActive
    ? { $set: { isActive: true } }
    : { $set: { isActive: false }, $inc: { tokenVersion: 1 } };
  const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select("-passwordHash");
  if (!user) throw notFound("User not found");
  res.json({ user });
}));

router.get("/disputes", asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req);
  const filter = typeof req.query.status === "string" ? { status: req.query.status } : {};
  const [disputes, total] = await Promise.all([
    Dispute.find(filter).populate("session", "participants scheduledAt status").populate("openedBy", "name email").sort({ createdAt: -1 }).skip(skip).limit(limit),
    Dispute.countDocuments(filter),
  ]);
  res.json({ disputes, pagination: pageInfo(total, page, limit) });
}));

router.patch("/disputes/:id", validateBody(z.object({
  status: z.enum(["under_review", "resolved", "dismissed"]),
  resolution: z.string().trim().min(3).max(2000).optional(),
})), asyncHandler(async (req, res) => {
  const dispute = await Dispute.findById(req.params.id);
  if (!dispute) throw notFound("Dispute not found");
  if (["resolved", "dismissed"].includes(dispute.status)) throw badRequest("This dispute has already been closed");
  if (req.body.status !== "under_review" && !req.body.resolution) throw badRequest("A resolution note is required to close a dispute");
  dispute.status = req.body.status;
  dispute.resolution = req.body.resolution;
  if (req.body.status !== "under_review") {
    dispute.resolvedBy = requireAuth(req)._id;
    dispute.resolvedAt = new Date();
    await Session.updateOne({ _id: dispute.session, status: "disputed" }, { $set: { status: "in_progress" } });
  }
  await dispute.save();
  const session = await Session.findById(dispute.session);
  if (session) for (const participant of session.participants) await notify(participant, "dispute_updated", "Dispute updated", `An administrator updated your dispute: ${dispute.status}.`, `/disputes/${dispute.id}`);
  res.json({ dispute });
}));

router.get("/waitlist", asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req);
  const filter = typeof req.query.status === "string" ? { status: req.query.status } : {};
  const [entries, total] = await Promise.all([
    Waitlist.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Waitlist.countDocuments(filter),
  ]);
  res.json({ entries, pagination: pageInfo(total, page, limit) });
}));

router.patch("/waitlist/:id", validateBody(z.object({ status: z.enum(["pending", "invited", "joined"]) })), asyncHandler(async (req, res) => {
  const entry = await Waitlist.findByIdAndUpdate(req.params.id, { $set: { status: req.body.status } }, { new: true });
  if (!entry) throw notFound("Waitlist entry not found");
  res.json({ entry });
}));

router.get("/wallet-transactions", asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginationFrom(req);
  const [transactions, total] = await Promise.all([
    WalletTransaction.find().populate("user counterparty", "name email").populate("session", "status").sort({ createdAt: -1 }).skip(skip).limit(limit),
    WalletTransaction.countDocuments(),
  ]);
  res.json({ transactions, pagination: pageInfo(total, page, limit) });
}));

export default router;
