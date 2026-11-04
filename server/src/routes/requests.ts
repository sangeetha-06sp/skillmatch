import { Router } from "express";
import { z } from "zod";
import { supabase } from "../config/database";
import { authenticate, requireAuth } from "../middleware/authenticate";
import { validateBody } from "../middleware/validate";
import { notify } from "../services/notifications";
import { apiRequest, fetchSkills, fetchUsers, throwDatabaseError, type DbRow } from "../services/database";
import { asyncHandler } from "../utils/asyncHandler";
import { badRequest, forbidden, notFound } from "../utils/errors";
import { pageInfo, paginationFrom } from "../utils/pagination";

const router = Router();

async function populatedRequest(row: DbRow) {
  const [users, skills] = await Promise.all([
    fetchUsers([String(row.requester_id), String(row.recipient_id)]),
    fetchSkills([String(row.skill_id)]),
  ]);
  return apiRequest(row, users, skills);
}

router.get("/", authenticate, asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { page, limit, skip } = paginationFrom(req);
  const { data, error, count } = await supabase.from("exchange_requests").select("*", { count: "exact" })
    .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order("created_at", { ascending: false }).range(skip, skip + limit - 1);
  if (error) throwDatabaseError(error);
  res.json({ requests: await Promise.all(((data ?? []) as DbRow[]).map(populatedRequest)), pagination: pageInfo(count ?? 0, page, limit) });
}));

router.post("/", authenticate, validateBody(z.object({
  skillId: z.string().uuid(),
  message: z.string().trim().max(1000).optional(),
})), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { data: skill, error: skillError } = await supabase.from("skills")
    .select("*").eq("id", req.body.skillId).eq("active", true).eq("type", "offer").maybeSingle();
  if (skillError) throwDatabaseError(skillError);
  if (!skill) throw notFound("Active offered skill not found");
  if (skill.owner_id === user.id) throw badRequest("You cannot request your own skill");
  const { data: owner, error: ownerError } = await supabase.from("users").select("id,is_active").eq("id", skill.owner_id).maybeSingle();
  if (ownerError) throwDatabaseError(ownerError);
  if (!owner?.is_active) throw notFound("Skill provider is unavailable");
  const { data: request, error } = await supabase.from("exchange_requests").insert({
    requester_id: user.id,
    recipient_id: skill.owner_id,
    skill_id: skill.id,
    message: req.body.message ?? "",
    payment_amount: skill.credits,
  }).select("*").single();
  if (error) throwDatabaseError(error);
  await notify(String(skill.owner_id), "request_received", "New skill request", `${user.name} requested your ${skill.title} skill.`, `/requests/${request.id}`);
  res.status(201).json({ request: await populatedRequest(request as DbRow) });
}));

router.patch("/:id/status", authenticate, validateBody(z.object({ status: z.enum(["accepted", "rejected", "cancelled"]) })), asyncHandler(async (req, res) => {
  const user = requireAuth(req);
  const { data: current, error: currentError } = await supabase.from("exchange_requests").select("*").eq("id", req.params.id).maybeSingle();
  if (currentError) throwDatabaseError(currentError);
  if (!current) throw notFound("Exchange request not found");
  const status = req.body.status as "accepted" | "rejected" | "cancelled";
  if (current.status !== "pending") throw badRequest("Only pending requests can change status");
  if (status === "cancelled") {
    if (current.requester_id !== user.id) throw forbidden("Only the requester can cancel this request");
  } else if (current.recipient_id !== user.id) {
    throw forbidden("Only the skill provider can accept or reject this request");
  }
  const { data: updated, error } = await supabase.from("exchange_requests")
    .update({ status }).eq("id", req.params.id).eq("status", "pending").select("*").maybeSingle();
  if (error) throwDatabaseError(error);
  if (!updated) throw badRequest("Request state changed; please retry");
  const recipient = status === "cancelled" ? String(updated.recipient_id) : String(updated.requester_id);
  await notify(recipient, `request_${status}`, `Request ${status}`, `Your exchange request was ${status}.`, `/requests/${updated.id}`);
  res.json({ request: await populatedRequest(updated as DbRow) });
}));

export default router;
