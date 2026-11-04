import { Router } from "express";
import { z } from "zod";
import { ExchangeRequest } from "../models/ExchangeRequest";
import { Skill } from "../models/Skill";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";
import { notify } from "../services/notifications";
import { asyncHandler } from "../utils/asyncHandler";
import { badRequest, forbidden, notFound } from "../utils/errors";
import { paginationFrom, pageInfo } from "../utils/pagination";

const router = Router();

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { page, limit, skip } = paginationFrom(req);
  const filter = { $or: [{ requester: user._id }, { recipient: user._id }] };
  const [requests, total] = await Promise.all([
    ExchangeRequest.find(filter).populate("requester recipient", "name avatarUrl").populate("skill", "title category type").sort({ createdAt: -1 }).skip(skip).limit(limit),
    ExchangeRequest.countDocuments(filter),
  ]);
  res.json({ requests, pagination: pageInfo(total, page, limit) });
}));

router.post("/", authenticate, validateBody(z.object({
  skillId: z.string().regex(/^[a-f\d]{24}$/i),
  message: z.string().trim().max(1000).optional(),
})), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const skill = await Skill.findOne({ _id: req.body.skillId, active: true, type: "offer" });
  if (!skill) throw notFound("Active offered skill not found");
  if (skill.owner.equals(user._id)) throw badRequest("You cannot request your own skill");
  const active = await ExchangeRequest.exists({ requester: user._id, skill: skill._id, status: { $in: ["pending", "accepted"] } });
  if (active) throw badRequest("You already have an active request for this skill");
  const request = await ExchangeRequest.create({
    requester: user._id, recipient: skill.owner, skill: skill._id, message: req.body.message,
    paymentAmount: skill.credits,
  });
  await notify(skill.owner, "request_received", "New skill request", `${user.name} requested your ${skill.title} skill.`, `/requests/${request.id}`);
  res.status(201).json({ request });
}));

router.patch("/:id/status", authenticate, validateBody(z.object({ status: z.enum(["accepted", "rejected", "cancelled"]) })), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const request = await ExchangeRequest.findById(req.params.id).populate("skill", "title");
  if (!request) throw notFound("Exchange request not found");
  const status = req.body.status as "accepted" | "rejected" | "cancelled";
  if (request.status !== "pending") throw badRequest("Only pending requests can change status");
  if (status === "cancelled") {
    if (!request.requester.equals(user._id)) throw forbidden("Only the requester can cancel this request");
  } else if (!request.recipient.equals(user._id)) {
    throw forbidden("Only the skill provider can accept or reject this request");
  }
  request.status = status;
  await request.save();
  const recipient = status === "cancelled" ? request.recipient : request.requester;
  await notify(recipient, `request_${status}`, `Request ${status}`, `Your exchange request was ${status}.`, `/requests/${request.id}`);
  res.json({ request });
}));

export default router;
