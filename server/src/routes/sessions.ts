import { Router } from "express";
import { z } from "zod";
import { supabase } from "../config/database";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";
import { notify } from "../services/notifications";
import { apiRow, fetchSkills, fetchUsers, requireData, throwDatabaseError, type DbRow } from "../services/database";
import { asyncHandler } from "../utils/asyncHandler";
import { badRequest, forbidden, notFound } from "../utils/errors";
import { pageInfo, paginationFrom } from "../utils/pagination";

const router = Router();
const sessionFields = z.object({
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(480),
  mode: z.enum(["online", "in-person"]).optional(),
  meetingUrl: z.string().url().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
});

async function populatedSession(row: DbRow) {
  const { data: exchange, error } = await supabase.from("exchange_requests").select("*").eq("id", row.request_id).maybeSingle();
  if (error) throwDatabaseError(error);
  if (!exchange) throw notFound("Related exchange request not found");
  const participantIds = Array.isArray(row.participants) ? row.participants as string[] : [];
  const [users, skills] = await Promise.all([
    fetchUsers([...participantIds, String(exchange.requester_id), String(exchange.recipient_id)]),
    fetchSkills([String(exchange.skill_id)]),
  ]);
  const skill = skills.get(String(exchange.skill_id));
  return {
    ...apiRow(row),
    participants: participantIds.map((id) => {
      const person = users.get(id);
      return person ? { _id: person.id, id: person.id, name: person.name, avatarUrl: person.avatar_url } : id;
    }),
    request: {
      _id: exchange.id,
      skill: skill ? { _id: skill.id, title: skill.title } : String(exchange.skill_id),
      requester: exchange.requester_id,
      recipient: exchange.recipient_id,
    },
  };
}

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { page, limit, skip } = paginationFrom(req);
  const { data, error, count } = await supabase.from("sessions").select("*", { count: "exact" })
    .contains("participants", [user.id]).order("scheduled_at", { ascending: false }).range(skip, skip + limit - 1);
  if (error) throwDatabaseError(error);
  res.json({ sessions: await Promise.all(((data ?? []) as DbRow[]).map(populatedSession)), pagination: pageInfo(count ?? 0, page, limit) });
}));

router.post("/", authenticate, validateBody(sessionFields.extend({ requestId: z.string().uuid() })), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const body = req.body as z.infer<typeof sessionFields> & { requestId: string };
  const { data, error } = await supabase.rpc("schedule_exchange_session", {
    p_request_id: body.requestId,
    p_user_id: user.id,
    p_scheduled_at: body.scheduledAt,
    p_duration_minutes: body.durationMinutes,
    p_mode: body.mode ?? "online",
    p_meeting_url: body.meetingUrl ?? null,
    p_notes: body.notes ?? "",
  });
  if (error) throwDatabaseError(error);
  const row = requireData(data as DbRow | null, "Could not schedule this session");
  const { data: exchange, error: exchangeError } = await supabase.from("exchange_requests").select("requester_id,recipient_id").eq("id", row.request_id).single();
  if (exchangeError) throwDatabaseError(exchangeError);
  const other = exchange.requester_id === user.id ? exchange.recipient_id : exchange.requester_id;
  await notify(other, "session_scheduled", "Session scheduled", "A session has been scheduled for your exchange.", `/sessions/${row.id}`);
  res.status(201).json({ session: await populatedSession(row) });
}));

router.post("/:id/start", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { data: existing, error: existingError } = await supabase.from("sessions").select("*").eq("id", req.params.id).maybeSingle();
  if (existingError) throwDatabaseError(existingError);
  if (!existing) throw notFound("Session not found");
  if (!(existing.participants as string[]).includes(user.id)) throw forbidden();
  if (!["scheduled", "in_progress"].includes(existing.status)) throw badRequest("This session cannot be started");
  const { data, error } = await supabase.from("sessions").update({ status: "in_progress" })
    .eq("id", existing.id).in("status", ["scheduled", "in_progress"]).select("*").maybeSingle();
  if (error) throwDatabaseError(error);
  if (!data) throw badRequest("Session state changed; please retry");
  res.json({ session: await populatedSession(data as DbRow) });
}));

router.post("/:id/cancel", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { data, error } = await supabase.rpc("cancel_scheduled_session", { p_session_id: req.params.id, p_user_id: user.id });
  if (error) throwDatabaseError(error);
  const row = requireData(data as DbRow | null, "Session not found");
  const { data: exchange, error: exchangeError } = await supabase.from("exchange_requests").select("requester_id,recipient_id").eq("id", row.request_id).single();
  if (exchangeError) throwDatabaseError(exchangeError);
  const other = exchange.requester_id === user.id ? exchange.recipient_id : exchange.requester_id;
  await notify(other, "session_cancelled", "Session cancelled", "A participant cancelled your scheduled session.", `/sessions/${row.id}`);
  res.json({ session: await populatedSession(row) });
}));

router.post("/:id/confirm-completion", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { data: before, error: beforeError } = await supabase.from("sessions").select("status").eq("id", req.params.id).maybeSingle();
  if (beforeError) throwDatabaseError(beforeError);
  if (!before) throw notFound("Session not found");
  const { data, error } = await supabase.rpc("confirm_session_completion", { p_session_id: req.params.id, p_user_id: user.id });
  if (error) throwDatabaseError(error);
  const row = requireData(data as DbRow | null, "Session not found");
  const result = await populatedSession(row);
  if (row.status === "completed" && before.status !== "completed") {
    const participants = Array.isArray(row.participants) ? row.participants as string[] : [];
    for (const participant of participants) {
      await notify(participant, "session_completed", "Session completed", "Both participants confirmed this session as complete.", `/sessions/${row.id}`);
    }
  }
  res.json({ session: result });
}));

router.post("/:id/dispute", authenticate, validateBody(z.object({ reason: z.string().trim().min(10).max(2000) })), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { data, error } = await supabase.rpc("open_session_dispute", {
    p_session_id: req.params.id,
    p_user_id: user.id,
    p_reason: req.body.reason as string,
  });
  if (error) throwDatabaseError(error);
  const dispute = requireData(data as DbRow | null, "Session not found");
  const { data: session, error: sessionError } = await supabase.from("sessions").select("participants").eq("id", dispute.session_id).single();
  if (sessionError) throwDatabaseError(sessionError);
  const other = (session.participants as string[]).find((participant) => participant !== user.id);
  if (other) await notify(other, "dispute_opened", "Session dispute opened", "A participant opened a dispute for your session.", `/disputes/${dispute.id}`);
  res.status(201).json({ dispute: apiRow(dispute) });
}));

export default router;
