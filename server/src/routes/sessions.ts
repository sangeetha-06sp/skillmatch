import { Router } from "express";
import { z } from "zod";
import { ExchangeRequest } from "../models/ExchangeRequest";
import { Session } from "../models/Session";
import { Dispute } from "../models/Dispute";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";
import { notify } from "../services/notifications";
import { transferForSession } from "../services/wallet";
import { asyncHandler } from "../utils/asyncHandler";
import { badRequest, forbidden, notFound } from "../utils/errors";
import { paginationFrom, pageInfo } from "../utils/pagination";

const router = Router();
const sessionFields = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(480),
  mode: z.enum(["online", "in-person"]).optional(),
  meetingUrl: z.string().url().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

async function settleIfCompleted(sessionId: string): Promise<void> {
  const session = await Session.findById(sessionId);
  if (!session || session.status !== "completed" || session.paymentAmount <= 0) return;
  const exchange = await ExchangeRequest.findById(session.request);
  if (!exchange) throw notFound("Related exchange request not found");
  await transferForSession({
    from: exchange.requester,
    to: exchange.recipient,
    amount: session.paymentAmount,
    sessionId: session._id,
    idempotencyKey: `session:${session.id}`,
  });
}

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { page, limit, skip } = paginationFrom(req);
  const filter = { participants: user._id };
  const [sessions, total] = await Promise.all([
    Session.find(filter).populate("participants", "name avatarUrl").populate({ path: "request", select: "skill requester recipient status", populate: { path: "skill", select: "title" } }).sort({ scheduledAt: -1 }).skip(skip).limit(limit),
    Session.countDocuments(filter),
  ]);
  res.json({ sessions, pagination: pageInfo(total, page, limit) });
}));

router.post("/", authenticate, validateBody(sessionFields.extend({ requestId: z.string().regex(/^[a-f\d]{24}$/i) })), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const request = await ExchangeRequest.findById(req.body.requestId);
  if (!request) throw notFound("Exchange request not found");
  if (!request.recipient.equals(user._id) && !request.requester.equals(user._id)) throw forbidden();
  if (request.status !== "accepted") throw badRequest("An accepted exchange request is required");
  if (await Session.exists({ request: request._id })) throw badRequest("A session already exists for this request");
  const session = await Session.create({
    request: request._id,
    participants: [request.requester, request.recipient],
    scheduledAt: new Date(req.body.scheduledAt),
    durationMinutes: req.body.durationMinutes,
    mode: req.body.mode ?? "online",
    meetingUrl: req.body.meetingUrl,
    notes: req.body.notes,
    paymentAmount: request.paymentAmount,
  });
  await notify(request.requester.equals(user._id) ? request.recipient : request.requester, "session_scheduled", "Session scheduled", "A session has been scheduled for your exchange.", `/sessions/${session.id}`);
  res.status(201).json({ session });
}));

router.post("/:id/start", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const session = await Session.findById(req.params.id);
  if (!session) throw notFound("Session not found");
  if (!session.participants.some((id) => id.equals(user._id))) throw forbidden();
  if (!["scheduled", "in_progress"].includes(session.status)) throw badRequest("This session cannot be started");
  session.status = "in_progress";
  await session.save();
  res.json({ session });
}));

router.post("/:id/cancel", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const session = await Session.findById(req.params.id);
  if (!session) throw notFound("Session not found");
  if (!session.participants.some((id) => id.equals(user._id))) throw forbidden();
  const cancelled = await Session.findOneAndUpdate(
    { _id: session._id, status: "scheduled", confirmations: { $size: 0 } },
    { $set: { status: "cancelled" } },
    { new: true },
  );
  if (!cancelled) throw badRequest("Only unconfirmed scheduled sessions can be cancelled");
  await ExchangeRequest.updateOne({ _id: session.request, status: "accepted" }, { $set: { status: "cancelled" } });
  const other = session.participants.find((id) => !id.equals(user._id));
  if (other) await notify(other, "session_cancelled", "Session cancelled", "A participant cancelled your scheduled session.", `/sessions/${session.id}`);
  res.json({ session: cancelled });
}));

router.post("/:id/confirm-completion", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const session = await Session.findById(req.params.id);
  if (!session) throw notFound("Session not found");
  if (!session.participants.some((id) => id.equals(user._id))) throw forbidden();
  if (session.status === "disputed" || session.status === "cancelled") throw badRequest("This session cannot be completed");
  const alreadyCompleted = session.status === "completed";
  if (session.status !== "completed") {
    const updated = await Session.findOneAndUpdate(
      { _id: session._id, status: { $in: ["scheduled", "in_progress"] }, "confirmations.user": { $ne: user._id } },
      { $push: { confirmations: { user: user._id, confirmedAt: new Date() } } },
      { new: true },
    );
    if (!updated && !(await Session.exists({ _id: session._id, "confirmations.user": user._id }))) throw badRequest("Session state changed; please retry");
    const latest = updated ?? await Session.findById(session._id);
    if (latest && latest.confirmations.length >= 2) {
      await Session.updateOne({ _id: latest._id, status: { $in: ["scheduled", "in_progress"] }, confirmations: { $size: 2 } }, { $set: { status: "completed" } });
      await ExchangeRequest.updateOne({ _id: latest.request }, { $set: { status: "completed" } });
    }
  }
  await settleIfCompleted(String(req.params.id));
  const result = await Session.findById(req.params.id).populate("participants", "name avatarUrl");
  if (result?.status === "completed" && !alreadyCompleted) {
    for (const participant of result.participants) await notify(participant as never, "session_completed", "Session completed", "Both participants confirmed this session as complete.", `/sessions/${result.id}`);
  }
  res.json({ session: result });
}));

router.post("/:id/dispute", authenticate, validateBody(z.object({ reason: z.string().trim().min(10).max(2000) })), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const session = await Session.findById(req.params.id);
  if (!session) throw notFound("Session not found");
  if (!session.participants.some((id) => id.equals(user._id))) throw forbidden();
  if (["completed", "cancelled"].includes(session.status)) throw badRequest("Completed or cancelled sessions cannot be disputed");
  const dispute = await Dispute.create({ session: session._id, openedBy: user._id, reason: req.body.reason });
  session.status = "disputed";
  await session.save();
  const other = session.participants.find((id) => !id.equals(user._id));
  if (other) await notify(other, "dispute_opened", "Session dispute opened", "A participant opened a dispute for your session.", `/disputes/${dispute.id}`);
  res.status(201).json({ dispute });
}));

export default router;
